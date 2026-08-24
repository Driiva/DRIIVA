import { describe, it, expect } from 'vitest';

import { UserDocumentSchema, DrivingProfileDataSchema } from '../user';
import { fakeTimestamp } from './fixtures';

describe('UserDocumentSchema', () => {
  // Mirrors DEFAULT_DRIVING_PROFILE / DEFAULT_POOL_SHARE / DEFAULT_USER_SETTINGS
  // in shared/firestore-types.ts, plus the identity/audit fields every
  // UserDocument carries.
  const validFixture = {
    uid: 'user_abc123',
    email: 'driver@example.com',
    displayName: 'Jamal Driver',
    photoURL: null,
    phoneNumber: null,
    createdAt: fakeTimestamp(),
    updatedAt: fakeTimestamp(),
    drivingProfile: {
      currentScore: 100,
      scoreBreakdown: {
        speedScore: 100,
        brakingScore: 100,
        accelerationScore: 100,
        corneringScore: 100,
        phoneUsageScore: 100,
      },
      totalTrips: 0,
      totalMiles: 0,
      totalDrivingMinutes: 0,
      lastTripAt: null,
      streakDays: 0,
      riskTier: 'low' as const,
    },
    activePolicy: null,
    poolShare: {
      currentShareCents: 0,
      contributionCents: 0,
      sharePercentage: 0,
      lastUpdatedAt: fakeTimestamp(),
    },
    recentTrips: [],
    fcmTokens: [],
    settings: {
      notificationsEnabled: true,
      autoTripDetection: true,
      unitSystem: 'imperial' as const,
    },
    createdBy: 'onUserCreate',
    updatedBy: 'onUserCreate',
  };

  it('parses a new-user default fixture', () => {
    expect(UserDocumentSchema.parse(validFixture)).toEqual(validFixture);
  });

  it('parses with the soft-onboarding optional fields, the LIVE onboardingComplete gate field, and the onboardingCompleted vestige set (quirk 6.10)', () => {
    const withOptionals = {
      ...validFixture,
      age: 32,
      postcode: 'SW1A 1AA',
      annualMileage: '8000-12000',
      referralSource: 'friend',
      currentInsurer: 'Acme Insurance',
      currentPremiumPounds: 620,
      noClaimsYears: 3,
      vehicle: { vin: null, make: 'Ford', model: 'Focus', year: 2019, color: 'blue' },
      onboardingComplete: true,
      onboardingCompleted: false,
    };
    expect(UserDocumentSchema.parse(withOptionals)).toEqual(withOptionals);
  });

  it('pins the current field set (drift guard: fails if a field is removed/renamed)', () => {
    expect(Object.keys(UserDocumentSchema.shape)).toMatchSnapshot();
  });

  // M1 T7 fix: provisionUserOnSignup writes null (not a derived fallback)
  // when the Auth record has no displayName yet - see
  // functions/src/utils/provisionUser.ts's deriveDisplayName.
  it('parses displayName: null (M1 T7 - no Auth displayName yet)', () => {
    const withNullDisplayName = { ...validFixture, displayName: null };
    expect(UserDocumentSchema.parse(withNullDisplayName)).toEqual(withNullDisplayName);
  });

  it('rejects more than 3 recentTrips (denormalized max per shared/firestore-types.ts comment)', () => {
    const tooMany = {
      ...validFixture,
      recentTrips: Array.from({ length: 4 }, (_, i) => ({
        tripId: `trip_${i}`,
        startedAt: fakeTimestamp(),
        endedAt: fakeTimestamp(),
        distanceMeters: 5150,
        durationSeconds: 720,
        score: 90,
        routeSummary: 'Home → Work',
      })),
    };
    expect(() => UserDocumentSchema.parse(tooMany)).toThrow();
  });

  it('rejects a currentScore outside 0-100', () => {
    expect(() =>
      DrivingProfileDataSchema.parse({ ...validFixture.drivingProfile, currentScore: 150 }),
    ).toThrow();
  });

describe('DrivingProfileDataSchema: totalMiles is miles, not miles times one hundred', () => {
  /*
   * The schema said `z.number().int()`, and it said so on the authority of a
   * comment in shared/firestore-types.ts claiming totalMiles was "stored as
   * integer (miles * 100 for precision)". The comment was quoted directly above
   * the rule, which is how a wrong comment becomes a wrong contract.
   *
   * The only writer, functions/src/triggers/trips.ts, has always written
   * `Math.round(newTotalMiles * 100) / 100`: plain miles to two decimal places.
   * shared/schema.ts declares the SQL column decimal(10, 2), which says the
   * same thing independently of any comment. Every reader in the app renders
   * `Math.round(profile.totalMiles)` and the road-warrior achievement fires at
   * `totalMiles >= 500`, so nothing anywhere divides by a hundred.
   *
   * Nothing caught it because every fixture in this suite used totalMiles: 0,
   * an integer that satisfies the wrong rule, and the schema is not parsed
   * against a real document anywhere in production. This test uses a value a
   * real driver actually produces.
   */
  it('accepts the two decimal places the writer actually writes', () => {
    const parsed = DrivingProfileDataSchema.parse({
      ...validFixture.drivingProfile,
      totalMiles: 1107.7,
    });
    expect(parsed.totalMiles).toBe(1107.7);
  });

  it('accepts a single fractional mile, which is the first trip', () => {
    expect(
      DrivingProfileDataSchema.parse({ ...validFixture.drivingProfile, totalMiles: 0.42 })
        .totalMiles,
    ).toBe(0.42);
  });

  it('still refuses a negative total', () => {
    expect(
      DrivingProfileDataSchema.safeParse({ ...validFixture.drivingProfile, totalMiles: -1 })
        .success,
    ).toBe(false);
  });
});
});
