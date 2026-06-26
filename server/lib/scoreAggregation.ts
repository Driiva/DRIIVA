import { db } from "../db";
import { trips, drivingProfiles } from "@shared/schema";
import { eq, and, gte, lt, lte, sql, desc } from "drizzle-orm";

export interface AggregatedScore {
  period: 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  userId: number;
  averageScore: number;
  tripCount: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  hardBrakingCount: number;
  harshAccelerationCount: number;
  speedViolationsCount: number;
  nightDrivingTrips: number;
  sharpCornersCount: number;
}

export interface TimeSeriesDataPoint {
  date: Date;
  score: number;
  tripCount: number;
  distanceKm: number;
}

export class ScoreAggregationService {
  /**
   * Get aggregated weekly score for a user
   */
  async getWeeklyScore(userId: number, weekStartDate?: Date): Promise<AggregatedScore | null> {
    const startDate = weekStartDate || this.getWeekStart(new Date());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    return this.getAggregatedScore(userId, startDate, endDate, 'weekly');
  }

  /**
   * Get aggregated monthly score for a user
   */
  async getMonthlyScore(userId: number, monthStartDate?: Date): Promise<AggregatedScore | null> {
    const startDate = monthStartDate || this.getMonthStart(new Date());
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    return this.getAggregatedScore(userId, startDate, endDate, 'monthly');
  }

  /**
   * Get aggregated score for a custom date range
   */
  async getAggregatedScore(
    userId: number,
    startDate: Date,
    endDate: Date,
    period: 'weekly' | 'monthly' = 'weekly'
  ): Promise<AggregatedScore | null> {
    try {
      // Optimized query using SQL aggregation
      const result = await db
        .select({
          averageScore: sql<number>`ROUND(AVG(${trips.score})::numeric, 2)`,
          tripCount: sql<number>`COUNT(*)::int`,
          totalDistanceKm: sql<number>`SUM(${trips.distance}::numeric)::numeric`,
          totalDurationMinutes: sql<number>`SUM(${trips.duration})::int`,
          hardBrakingCount: sql<number>`SUM(${trips.hardBrakingEvents})::int`,
          harshAccelerationCount: sql<number>`SUM(${trips.harshAcceleration})::int`,
          speedViolationsCount: sql<number>`SUM(${trips.speedViolations})::int`,
          nightDrivingTrips: sql<number>`SUM(CASE WHEN ${trips.nightDriving} THEN 1 ELSE 0 END)::int`,
          sharpCornersCount: sql<number>`SUM(${trips.sharpCorners})::int`,
        })
        .from(trips)
        .where(
          and(
            eq(trips.userId, userId),
            // Bucket each trip by a single column (startTime) so a drive that
            // crosses the window boundary (e.g. over midnight) lands in exactly
            // one period instead of vanishing from every aggregate. Half-open
            // [startDate, endDate) avoids double-counting the boundary instant.
            gte(trips.startTime, startDate),
            lt(trips.startTime, endDate)
          )
        );

      if (result.length === 0 || result[0].tripCount === 0) {
        return null;
      }

      const data = result[0];

      return {
        period,
        startDate,
        endDate,
        userId,
        averageScore: Number(data.averageScore) || 0,
        tripCount: data.tripCount || 0,
        totalDistanceKm: Number(data.totalDistanceKm) || 0,
        totalDurationMinutes: data.totalDurationMinutes || 0,
        hardBrakingCount: data.hardBrakingCount || 0,
        harshAccelerationCount: data.harshAccelerationCount || 0,
        speedViolationsCount: data.speedViolationsCount || 0,
        nightDrivingTrips: data.nightDrivingTrips || 0,
        sharpCornersCount: data.sharpCornersCount || 0,
      };
    } catch (error) {
      console.error('Error aggregating scores:', error);
      throw error;
    }
  }

  /**
   * Get time-series data for a user (daily scores over a date range)
   * Optimized for time-series visualization
   */
  async getTimeSeriesData(
    userId: number,
    startDate: Date,
    endDate: Date,
    granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<TimeSeriesDataPoint[]> {
    try {
      // Build date truncation SQL based on granularity
      const dateTruncMap: Record<string, string> = {
        'daily': 'day',
        'weekly': 'week',
        'monthly': 'month'
      };
      const dateTrunc = dateTruncMap[granularity] || 'day';

      // Optimized query grouping by date
      // Note: DATE_TRUNC requires the interval as a string literal, so we use sql.raw for the interval
      // This is safe because granularity is validated to be one of the allowed values
      const dateTruncExpr = sql`DATE_TRUNC(${sql.raw(`'${dateTrunc}'`)}, ${trips.startTime})`;
      
      const result = await db
        .select({
          date: dateTruncExpr,
          averageScore: sql<number>`ROUND(AVG(${trips.score})::numeric, 2)`,
          tripCount: sql<number>`COUNT(*)::int`,
          totalDistanceKm: sql<number>`SUM(${trips.distance}::numeric)::numeric`,
        })
        .from(trips)
        .where(
          and(
            eq(trips.userId, userId),
            // Bucket each trip by a single column (startTime) so a drive that
            // crosses the window boundary (e.g. over midnight) lands in exactly
            // one period instead of vanishing from every aggregate. Half-open
            // [startDate, endDate) avoids double-counting the boundary instant.
            gte(trips.startTime, startDate),
            lt(trips.startTime, endDate)
          )
        )
        .groupBy(dateTruncExpr)
        .orderBy(dateTruncExpr);

      return result.map(row => ({
        date: row.date as Date,
        score: Number(row.averageScore) || 0,
        tripCount: row.tripCount || 0,
        distanceKm: Number(row.totalDistanceKm) || 0,
      }));
    } catch (error) {
      console.error('Error fetching time-series data:', error);
      throw error;
    }
  }

  /**
   * Get all weekly scores for a user (last N weeks)
   */
  async getWeeklyScores(userId: number, weeks: number = 12): Promise<AggregatedScore[]> {
    const scores: AggregatedScore[] = [];
    const today = new Date();

    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      // Get Monday of the week
      const dayOfWeek = weekStart.getDay();
      const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      weekStart.setDate(diff);

      const score = await this.getWeeklyScore(userId, weekStart);
      if (score) {
        scores.push(score);
      }
    }

    return scores.reverse(); // Oldest first
  }

  /**
   * Get all monthly scores for a user (last N months)
   */
  async getMonthlyScores(userId: number, months: number = 12): Promise<AggregatedScore[]> {
    const scores: AggregatedScore[] = [];
    const today = new Date();

    for (let i = 0; i < months; i++) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const score = await this.getMonthlyScore(userId, monthStart);
      if (score) {
        scores.push(score);
      }
    }

    return scores.reverse(); // Oldest first
  }

  /**
   * Get trend analysis (improving, declining, stable)
   */
  async getScoreTrend(userId: number, period: 'weekly' | 'monthly' = 'weekly'): Promise<{
    trend: 'improving' | 'declining' | 'stable';
    change: number;
    recentScore: number;
    previousScore: number;
  }> {
    const scores = period === 'weekly' 
      ? await this.getWeeklyScores(userId, 2)
      : await this.getMonthlyScores(userId, 2);

    if (scores.length < 2) {
      return {
        trend: 'stable',
        change: 0,
        recentScore: scores[0]?.averageScore || 0,
        previousScore: scores[0]?.averageScore || 0,
      };
    }

    const recentScore = scores[scores.length - 1].averageScore;
    const previousScore = scores[scores.length - 2].averageScore;
    const change = recentScore - previousScore;
    const threshold = 2; // 2 point change threshold

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (change > threshold) {
      trend = 'improving';
    } else if (change < -threshold) {
      trend = 'declining';
    }

    return {
      trend,
      change: Number(change.toFixed(2)),
      recentScore,
      previousScore,
    };
  }

  /**
   * Helper: Get start of week (Monday)
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  /**
   * Helper: Get start of month
   */
  private getMonthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
}

export const scoreAggregation = new ScoreAggregationService();
