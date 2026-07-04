import { describe, it, expect } from 'vitest';

import { TripDocumentSchema, TripStatusSchema } from '../trip';
import { fakeTimestamp } from './fixtures';

describe('TripDocumentSchema', () => {
  const validFixture = {
    tripId: 'trip_abc123',
    userId: 'user_abc123',
    startedAt: fakeTimestamp(),
    endedAt: fakeTimestamp(),
    durationSeconds: 900,
    startLocation: { lat: 51.5074, lng: -0.1278, address: null, placeType: 'home' as const },
    endLocation: { lat: 51.509, lng: -0.13, address: 'Work', placeType: 'work' as const },
    distanceMeters: 5_200,
    score: 82,
    scoreBreakdown: {
      speedScore: 80,
      brakingScore: 85,
      accelerationScore: 80,
      corneringScore: 90,
      phoneUsageScore: 75,
    },
    events: {
      hardBrakingCount: 1,
      hardAccelerationCount: 0,
      speedingSeconds: 12,
      sharpTurnCount: 2,
      phonePickupCount: 0,
    },
    anomalies: {
      hasGpsJumps: false,
      hasImpossibleSpeed: false,
      isDuplicate: false,
      flaggedForReview: false,
    },
    status: 'completed' as const,
    processedAt: fakeTimestamp(),
    context: { weatherCondition: 'clear', isNightDriving: false, isRushHour: true },
    createdAt: fakeTimestamp(),
    createdBy: 'user_abc123',
    pointsCount: 340,
  };

  it('parses a representative completed-trip fixture', () => {
    expect(TripDocumentSchema.parse(validFixture)).toEqual(validFixture);
  });

  it('parses with the functions-only optional segmentation field present', () => {
    const withSegmentation = {
      ...validFixture,
      segmentation: {
        totalStops: 2,
        totalSegments: 3,
        classifiedAt: fakeTimestamp(),
        hasSignificantStops: true,
      },
    };
    expect(TripDocumentSchema.parse(withSegmentation)).toEqual(withSegmentation);
  });

  it('parses with nullable fields at null (recording trip, not yet processed)', () => {
    const recording = { ...validFixture, status: 'recording' as const, processedAt: null, context: null };
    expect(TripDocumentSchema.parse(recording)).toEqual(recording);
  });

  it('pins the current field set (drift guard: fails if a field is removed/renamed)', () => {
    expect(Object.keys(TripDocumentSchema.shape)).toMatchSnapshot();
  });

  it('accepts the vestige "disputed" status value (quirk: declared in the type, zero real writers)', () => {
    expect(TripStatusSchema.parse('disputed')).toBe('disputed');
  });

  it('rejects an invalid status', () => {
    expect(() => TripDocumentSchema.parse({ ...validFixture, status: 'archived' })).toThrow();
  });

  it('rejects a score outside 0-100', () => {
    expect(() => TripDocumentSchema.parse({ ...validFixture, score: 101 })).toThrow();
  });
});
