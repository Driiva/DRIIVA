import { DrivingProfile, Trip } from "@shared/schema";

export interface AIInsight {
  riskTrend: 'decreasing' | 'stable' | 'increasing';
  refundPrediction: {
    amount: number;
    confidence: number;
    timeline: string;
  };
  recommendations: string[];
  sustainabilityScore: {
    co2Saved: number;
    ecoRank: number;
    monthlyTrend: 'improving' | 'stable' | 'declining';
  };
  behaviorPatterns: {
    bestDays: string[];
    riskiestTimes: string[];
    improvementAreas: string[];
  };
  communityComparison: {
    /** Null until a real cohort exists to be a percentile of. */
    betterThan: number | null;
    topPercentile: boolean;
    potentialRefundBoost: number;
  };
}

export class AIInsightsEngine {
  generateInsights(
    profile: DrivingProfile,
    trips: Trip[],
    communityAverage: number = 75
  ): AIInsight {
    const currentScore = profile.currentScore || 0;
    const premiumAmount = 500; // £500 annual premium
    
    // Analyze risk trend based on recent trips
    const recentScores = trips.slice(0, 5).map(t => t.score);
    const avgRecentScore = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const riskTrend = this.calculateRiskTrend(currentScore, avgRecentScore);
    
    // Predict future refund based on trajectory
    const refundPrediction = this.predictRefund(currentScore, riskTrend, premiumAmount);
    
    // Generate personalized recommendations
    const recommendations = this.generateRecommendations(profile, trips);
    
    // Calculate sustainability metrics
    const sustainabilityScore = this.calculateSustainability(trips);
    
    // Analyze behavior patterns
    const behaviorPatterns = this.analyzeBehaviorPatterns(trips);
    
    // Community comparison
    const communityComparison = this.compareWithCommunity(currentScore, communityAverage);
    
    return {
      riskTrend,
      refundPrediction,
      recommendations,
      sustainabilityScore,
      behaviorPatterns,
      communityComparison
    };
  }
  
  private calculateRiskTrend(currentScore: number, avgRecentScore: number): 'decreasing' | 'stable' | 'increasing' {
    const difference = avgRecentScore - currentScore;
    if (difference > 2) return 'increasing';
    if (difference < -2) return 'decreasing';
    return 'stable';
  }
  
  private predictRefund(currentScore: number, trend: string, premium: number): AIInsight['refundPrediction'] {
    // Base refund calculation
    let predictedScore = currentScore;
    
    // Adjust based on trend
    if (trend === 'increasing') {
      predictedScore = Math.min(currentScore + 5, 100);
    } else if (trend === 'decreasing') {
      predictedScore = Math.max(currentScore - 3, 60);
    }
    
    // Calculate refund using corrected formula (70+ threshold)
    let refundPercentage = 0;
    if (predictedScore >= 70) {
      const baseRefundRate = 0.05;
      const maxRefundRate = 0.15;
      const scoreRange = 100 - 70;
      const scoreAboveMin = Math.max(0, predictedScore - 70);
      refundPercentage = baseRefundRate + ((maxRefundRate - baseRefundRate) * (scoreAboveMin / scoreRange));
    }
    
    const amount = Math.round(premium * Math.min(refundPercentage, 0.15));
    
    // Confidence based on consistency
    const confidence = trend === 'stable' ? 0.85 : 0.65;
    
    return {
      amount,
      confidence,
      timeline: '3 months'
    };
  }
  
  private generateRecommendations(profile: DrivingProfile, _trips: Trip[]): string[] {
    const recommendations: string[] = [];

    // Analyze specific areas for improvement
    if ((profile.hardBrakingScore ?? 100) < 70) {
      recommendations.push('Maintain safer following distances to reduce hard braking by 30%');
    }

    if ((profile.nightDrivingScore ?? 100) < 70) {
      recommendations.push('Consider daytime alternatives for 2-3 weekly trips to boost safety score');
    }

    if ((profile.accelerationScore ?? 100) < 70) {
      recommendations.push('Gentle acceleration could improve your score by up to 5 points');
    }

    // WAVE G: this used to assert a top-decile ranking among Driiva drivers.
    // There is no cohort to rank within, and nothing computed a percentile.
    // Praise the behaviour, which is measured, not a rank, which is not.
    if ((profile.currentScore ?? 0) >= 85) {
      recommendations.push('Your driving has been consistently smooth. Keep it there.');
    }

    return recommendations.slice(0, 3); // Max 3 recommendations
  }

  private calculateSustainability(trips: Trip[]): AIInsight['sustainabilityScore'] {
    const totalMiles = trips.reduce((sum, trip) => sum + Number(trip.distance), 0);
    const avgScore = trips.reduce((sum, trip) => sum + trip.score, 0) / trips.length;
    
    // Estimate CO2 saved by efficient driving (kg)
    const co2Saved = Math.round((avgScore / 100) * totalMiles * 0.15);
    
    // Eco rank based on efficiency
    const ecoRank = avgScore >= 85 ? 1 : avgScore >= 75 ? 2 : 3;
    
    // Trend based on recent vs older trips
    const recentAvg = trips.slice(0, 5).reduce((sum, t) => sum + t.score, 0) / 5;
    const olderAvg = trips.slice(5, 10).reduce((sum, t) => sum + t.score, 0) / 5;
    const monthlyTrend = recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable';
    
    return {
      co2Saved,
      ecoRank,
      monthlyTrend
    };
  }
  
  private analyzeBehaviorPatterns(trips: Trip[]): AIInsight['behaviorPatterns'] {
    // Group trips by day of week
    const dayScores: { [key: string]: number[] } = {};
    const timeScores: { [key: string]: number[] } = {};
    
    trips.forEach(trip => {
      const date = new Date(trip.startTime);
      const day = date.toLocaleDateString('en-GB', { weekday: 'long' });
      const hour = date.getHours();
      const timeCategory = hour < 6 ? 'Early Morning' : hour < 12 ? 'Morning' : 
                          hour < 18 ? 'Afternoon' : 'Evening';
      
      if (!dayScores[day]) dayScores[day] = [];
      if (!timeScores[timeCategory]) timeScores[timeCategory] = [];
      
      dayScores[day].push(trip.score);
      timeScores[timeCategory].push(trip.score);
    });
    
    // Find best days
    const bestDays = Object.entries(dayScores)
      .map(([day, scores]) => ({
        day,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length
      }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 2)
      .map(d => d.day);
    
    // Find riskiest times
    const riskiestTimes = Object.entries(timeScores)
      .map(([time, scores]) => ({
        time,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length
      }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 2)
      .map(t => t.time);
    
    // Improvement areas based on metrics
    const improvementAreas: string[] = [];
    const avgHardBraking = trips.reduce((sum, t) => sum + (t.hardBrakingEvents ?? 0), 0) / trips.length;
    const avgSpeeding = trips.reduce((sum, t) => sum + (t.speedViolations ?? 0), 0) / trips.length;
    
    if (avgHardBraking > 2) improvementAreas.push('Braking patterns');
    if (avgSpeeding > 1) improvementAreas.push('Speed compliance');
    if (trips.some(t => t.nightDriving)) improvementAreas.push('Night driving safety');
    
    return {
      bestDays,
      riskiestTimes,
      improvementAreas
    };
  }
  
  private compareWithCommunity(score: number, communityAvg: number): AIInsight['communityComparison'] {
    // WAVE G: `betterThan` was Math.round((score / 100) * 100), which is the
    // driver's own score relabelled as "you drive better than N% of the
    // community". It is not a percentile and there is no community to rank
    // against, so it is null until a real cohort exists. `topPerformerScore`
    // was likewise an invented benchmark; it is now the top of the scale, which
    // is at least true by definition.
    const betterThan = null;
    const topPercentile = score >= 85;

    const topPerformerScore = 100;
    const potentialBoost = topPerformerScore - score;
    const potentialRefundBoost = potentialBoost > 0 ? Math.round((potentialBoost / 100) * 500 * 0.15) : 0;
    
    return {
      betterThan,
      topPercentile,
      potentialRefundBoost
    };
  }
}

export const aiInsightsEngine = new AIInsightsEngine();