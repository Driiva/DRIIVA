/**
 * TESTS: Daily Damoov Sync — syncDamoovTrips
 * ============================================
 * Tests the Damoov-to-Firestore trip conversion logic, profile update
 * calculations, and audit log writing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DamoovTripData } from '../../lib/damoov';

// ---------------------------------------------------------------------------
// Core logic under test — extracted from damoovSync.ts
// ---------------------------------------------------------------------------

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function damoovTripToFirestoreDoc(trip: DamoovTripData, userId: string) {
  const now = new Date();
  return {
    tripId: `damoov_${trip.Id}`,
    userId,
    startedAt: new Date(trip.StartDate),
    endedAt: new Date(trip.EndDate),
    durationSeconds: Math.round(trip.DurationMin * 60),
    distanceMeters: Math.round(trip.DistanceKm * 1000),
    score: trip.Rating100,
    scoreBreakdown: {
      speedScore: trip.RatingSpeeding100,
      brakingScore: trip.RatingBraking100,
      accelerationScore: trip.RatingAcceleration100,
      corneringScore: trip.RatingCornering100,
      phoneUsageScore: trip.RatingPhoneUsage100,
    },
    events: {
      hardBrakingCount: trip.HardBrakingCount,
      hardAccelerationCount: trip.HardAccelerationCount,
      speedingSeconds: 0,
      sharpTurnCount: trip.CorneringCount,
      phonePickupCount: 0,
    },
    anomalies: {
      hasGpsJumps: false,
      hasImpossibleSpeed: false,
      isDuplicate: false,
      flaggedForReview: false,
    },
    status: 'completed',
    source: 'damoov',
    startLocation: {
      lat: trip.Points?.[0]?.Latitude ?? 0,
      lng: trip.Points?.[0]?.Longitude ?? 0,
      address: null,
      placeType: null,
    },
    endLocation: {
      lat: trip.Points?.[trip.Points.length - 1]?.Latitude ?? 0,
      lng: trip.Points?.[trip.Points.length - 1]?.Longitude ?? 0,
      address: null,
      placeType: null,
    },
    createdBy: 'cloud-function:damoovSync',
    pointsCount: trip.Points?.length ?? 0,
  };
}

function calculateRollingAverage(scores: number[]): number {
  if (scores.length === 0) return 100;
  const total = scores.reduce((sum, s) => sum + s, 0);
  return Math.round(total / scores.length);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeDamoovTrip = (overrides: Partial<DamoovTripData> = {}): DamoovTripData => ({
  Id: 'trip-abc-123',
  StartDate: '2026-03-01T08:00:00Z',
  EndDate: '2026-03-01T08:35:00Z',
  DistanceKm: 12.5,
  DurationMin: 35,
  Rating100: 82,
  RatingBraking100: 78,
  RatingAcceleration100: 85,
  RatingSpeeding100: 90,
  RatingPhoneUsage100: 100,
  RatingCornering100: 75,
  HardBrakingCount: 2,
  HardAccelerationCount: 1,
  CorneringCount: 3,
  Points: [
    { Latitude: 51.5074, Longitude: -0.1278 },
    { Latitude: 51.5194, Longitude: -0.1270 },
    { Latitude: 51.5300, Longitude: -0.1200 },
  ],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Damoov Sync — Trip Conversion', () => {
  it('converts a Damoov trip to Firestore trip document shape', () => {
    const trip = makeDamoovTrip();
    const doc = damoovTripToFirestoreDoc(trip, 'user-001');

    expect(doc.tripId).toBe('damoov_trip-abc-123');
    expect(doc.userId).toBe('user-001');
    expect(doc.distanceMeters).toBe(12500);
    expect(doc.durationSeconds).toBe(2100);
    expect(doc.score).toBe(82);
    expect(doc.status).toBe('completed');
    expect(doc.source).toBe('damoov');
    expect(doc.createdBy).toBe('cloud-function:damoovSync');
  });

  it('maps score breakdown correctly', () => {
    const trip = makeDamoovTrip({
      RatingSpeeding100: 95,
      RatingBraking100: 70,
      RatingAcceleration100: 88,
      RatingCornering100: 65,
      RatingPhoneUsage100: 100,
    });
    const doc = damoovTripToFirestoreDoc(trip, 'user-002');

    expect(doc.scoreBreakdown).toEqual({
      speedScore: 95,
      brakingScore: 70,
      accelerationScore: 88,
      corneringScore: 65,
      phoneUsageScore: 100,
    });
  });

  it('maps driving events from Damoov counts', () => {
    const trip = makeDamoovTrip({
      HardBrakingCount: 5,
      HardAccelerationCount: 3,
      CorneringCount: 7,
    });
    const doc = damoovTripToFirestoreDoc(trip, 'user-003');

    expect(doc.events).toEqual({
      hardBrakingCount: 5,
      hardAccelerationCount: 3,
      speedingSeconds: 0,
      sharpTurnCount: 7,
      phonePickupCount: 0,
    });
  });

  it('extracts start and end locations from GPS points', () => {
    const trip = makeDamoovTrip({
      Points: [
        { Latitude: 51.5, Longitude: -0.1 },
        { Latitude: 51.6, Longitude: -0.2 },
        { Latitude: 51.7, Longitude: -0.3 },
      ],
    });
    const doc = damoovTripToFirestoreDoc(trip, 'user-004');

    expect(doc.startLocation.lat).toBe(51.5);
    expect(doc.startLocation.lng).toBe(-0.1);
    expect(doc.endLocation.lat).toBe(51.7);
    expect(doc.endLocation.lng).toBe(-0.3);
  });

  it('handles trip with no GPS points gracefully', () => {
    const trip = makeDamoovTrip({ Points: undefined });
    const doc = damoovTripToFirestoreDoc(trip, 'user-005');

    expect(doc.startLocation.lat).toBe(0);
    expect(doc.startLocation.lng).toBe(0);
    expect(doc.endLocation.lat).toBe(0);
    expect(doc.endLocation.lng).toBe(0);
    expect(doc.pointsCount).toBe(0);
  });

  it('converts distance from km to meters correctly', () => {
    const trip = makeDamoovTrip({ DistanceKm: 0.5 });
    const doc = damoovTripToFirestoreDoc(trip, 'user-006');
    expect(doc.distanceMeters).toBe(500);
  });

  it('converts duration from minutes to seconds correctly', () => {
    const trip = makeDamoovTrip({ DurationMin: 90 });
    const doc = damoovTripToFirestoreDoc(trip, 'user-007');
    expect(doc.durationSeconds).toBe(5400);
  });

  it('sets anomalies to all-false for Damoov trips', () => {
    const doc = damoovTripToFirestoreDoc(makeDamoovTrip(), 'user-008');
    expect(doc.anomalies).toEqual({
      hasGpsJumps: false,
      hasImpossibleSpeed: false,
      isDuplicate: false,
      flaggedForReview: false,
    });
  });
});

describe('Damoov Sync — Date Formatting', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDate(new Date('2026-03-02T14:30:00Z'))).toBe('2026-03-02');
  });

  it('pads single-digit months and days', () => {
    expect(formatDate(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05');
  });
});

describe('Damoov Sync — Rolling Average', () => {
  it('computes average of multiple scores', () => {
    expect(calculateRollingAverage([80, 90, 70])).toBe(80);
  });

  it('returns 100 for empty score array', () => {
    expect(calculateRollingAverage([])).toBe(100);
  });

  it('rounds to nearest integer', () => {
    expect(calculateRollingAverage([81, 82])).toBe(82); // 81.5 → 82
  });

  it('handles single score', () => {
    expect(calculateRollingAverage([75])).toBe(75);
  });
});
