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
import { UserDocumentSchema } from '@driiva/contracts';

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

  it('produces a UserDocumentSchema-valid doc for a Google user (displayName absent, falls back to the email local part)', () => {
    const doc = buildProvisionedUserDoc({ ...baseInput, displayName: undefined });

    expect(() => UserDocumentSchema.parse(doc)).not.toThrow();
    expect(doc.displayName).toBe('driver');
  });

  it('falls back to "Driver" when both displayName and the email local part are unavailable', () => {
    const doc = buildProvisionedUserDoc({ ...baseInput, email: '', displayName: undefined });

    expect(() => UserDocumentSchema.parse(doc)).not.toThrow();
    expect(doc.displayName).toBe('Driver');
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
