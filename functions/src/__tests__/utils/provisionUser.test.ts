/**
 * TESTS: buildProvisionedUserDoc (pure builder)
 * ==============================================
 * The builder is the shape-source-of-truth half of the M1 unified
 * provisioning path (see functions/src/utils/provisionUser.ts). It takes
 * already-resolved inputs and returns a plain object - no Firestore/IO, no
 * side-effects. Every case here must produce a doc that parses cleanly
 * against @driiva/contracts' UserDocumentSchema.
 */

import { describe, it, expect } from 'vitest';
import { UserDocumentSchema, STARTING_SCORE } from '@driiva/contracts';

import { buildProvisionedUserDoc } from '../../utils/provisionUser';

const fakeTimestamp = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return { seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0, toDate: () => d };
};

const baseInput = {
  uid: 'user-abc123',
  email: 'driver@example.com',
  policyId: 'policy_user-abc123',
  policyNumber: 'DRV-001',
  now: fakeTimestamp(),
  renewalDate: fakeTimestamp(365),
};

describe('buildProvisionedUserDoc', () => {
  it('produces a UserDocumentSchema-valid doc for an email/password user (displayName present)', () => {
    const doc = buildProvisionedUserDoc({ ...baseInput, displayName: 'Jamal Driver' });

    expect(() => UserDocumentSchema.parse(doc)).not.toThrow();
    expect(doc.displayName).toBe('Jamal Driver');
  });

  it('produces a UserDocumentSchema-valid doc for a Google user with a real Auth displayName', () => {
    const doc = buildProvisionedUserDoc({ ...baseInput, displayName: 'Ada Google' });

    expect(() => UserDocumentSchema.parse(doc)).not.toThrow();
    expect(doc.displayName).toBe('Ada Google');
  });

  // M1 T7 fix: previously this derived a fallback from the email local part,
  // which for email/password signup (the only path where this fires with no
  // displayName - see provisionUserOnSignup.ts's own comment) permanently
  // wrote the WRONG name, because the Auth onCreate trigger fires before the
  // client's un-awaited updateProfile call lands. Writing null instead lets
  // the UI's existing `|| user?.name || 'Driver'` fallback chain resolve to
  // the real Auth-profile name once updateProfile has landed.
  it('writes displayName as null when the Auth record has none, instead of deriving the email local part', () => {
    const doc = buildProvisionedUserDoc({ ...baseInput, displayName: undefined });

    expect(() => UserDocumentSchema.parse(doc)).not.toThrow();
    expect(doc.displayName).toBeNull();
  });

  it('writes displayName as null when both displayName and email are unavailable (no server-side "Driver" fallback anymore)', () => {
    const doc = buildProvisionedUserDoc({ ...baseInput, email: '', displayName: undefined });

    expect(() => UserDocumentSchema.parse(doc)).not.toThrow();
    expect(doc.displayName).toBeNull();
  });

  it('produces a UserDocumentSchema-valid doc for an ADMIN_EMAILS user and marks isAdmin true', () => {
    const doc = buildProvisionedUserDoc({ ...baseInput, displayName: 'Founder', isAdmin: true });

    expect(() => UserDocumentSchema.parse(doc)).not.toThrow();
    expect(doc.isAdmin).toBe(true);
  });

  it('defaults isAdmin to unset for a non-admin user', () => {
    const doc = buildProvisionedUserDoc({ ...baseInput, displayName: 'Jamal Driver' });

    expect(doc.isAdmin).toBeUndefined();
  });

  it('writes the LIVE onboardingComplete field as false and never the dead onboardingCompleted (-ed) vestige', () => {
    const doc = buildProvisionedUserDoc({ ...baseInput, displayName: 'Jamal Driver' });

    expect(doc.onboardingComplete).toBe(false);
    expect(doc).not.toHaveProperty('onboardingCompleted');
  });

  it('ports the drivingProfile/poolShare/settings/recentTrips defaults from onUserCreate', () => {
    const doc = buildProvisionedUserDoc({ ...baseInput, displayName: 'Jamal Driver' });

    expect(doc.drivingProfile).toEqual({
      // Sourced from the constant, not retyped: this test previously pinned a
      // literal 100 and would have had to be edited by hand every time the
      // starting position changed, which is how a test stops guarding and
      // starts obstructing.
      currentScore: STARTING_SCORE,
      scoreBreakdown: {
        speedScore: STARTING_SCORE,
        brakingScore: STARTING_SCORE,
        accelerationScore: STARTING_SCORE,
        corneringScore: STARTING_SCORE,
        phoneUsageScore: STARTING_SCORE,
      },
      totalTrips: 0,
      totalMiles: 0,
      totalDrivingMinutes: 0,
      lastTripAt: null,
      streakDays: 0,
      riskTier: 'low',
    });
    expect(doc.poolShare).toEqual({
      currentShareCents: 0,
      contributionCents: 0,
      sharePercentage: 0,
      lastUpdatedAt: baseInput.now,
    });
    expect(doc.settings).toEqual({
      notificationsEnabled: true,
      autoTripDetection: false,
      unitSystem: 'imperial',
    });
    expect(doc.recentTrips).toEqual([]);
    expect(doc.fcmTokens).toEqual([]);
    expect(doc.photoURL).toBeNull();
    expect(doc.phoneNumber).toBeNull();
  });

  it('embeds an ActivePolicySummary pointing at the caller-supplied policyId/policyNumber, pending/standard/zero premium', () => {
    const doc = buildProvisionedUserDoc({ ...baseInput, displayName: 'Jamal Driver' });

    expect(doc.activePolicy).toEqual({
      policyId: baseInput.policyId,
      policyNumber: baseInput.policyNumber,
      status: 'pending',
      premiumCents: 0,
      coverageType: 'standard',
      renewalDate: baseInput.renewalDate,
    });
  });
});
