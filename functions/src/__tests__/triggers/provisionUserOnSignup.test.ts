/**
 * TESTS: provisionUser / provisionUserOnSignup (dormant M1 trigger)
 * ====================================================================
 * Exercises the async side-effects of the unified provisioning handler:
 * the users/usernames/policies writes, ADMIN_EMAILS auto-promotion, and
 * Damoov-registration resilience. The trigger itself is not wired into
 * functions/src/index.ts (dormant) - these tests drive `provisionUser`
 * directly, the same seam M1 T5's emulator integration test will use.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDb, mockSet, mockUpdate, mockRunTransaction } from '../setup';

const { mockCreateDamoovUser } = vi.hoisted(() => ({
  mockCreateDamoovUser: vi.fn(),
}));

vi.mock('../../lib/damoov', () => ({
  createDamoovUser: mockCreateDamoovUser,
}));

import { provisionUser, provisionUserOnSignup } from '../../triggers/provisionUserOnSignup';

function fakeUserRecord(overrides: Partial<{ uid: string; email: string; displayName: string }> = {}) {
  return {
    uid: 'user-001',
    email: 'jamal@example.com',
    displayName: 'Jamal Driver',
    ...overrides,
  } as unknown as import('firebase-functions').auth.UserRecord;
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ADMIN_EMAILS;

  // Counter transaction: pretend the counter doc doesn't exist yet, so
  // generatePolicyNumber() resolves deterministically to DRV-001.
  mockRunTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      set: vi.fn(),
    }),
  );

  mockCreateDamoovUser.mockResolvedValue(null);
});

describe('provisionUser', () => {
  it('writes users/{uid}, usernames/{localPart} and the default policies/{...} doc', async () => {
    await provisionUser(fakeUserRecord());

    const collectionsWritten = mockDb.collection.mock.calls.map((call: unknown[]) => call[0]);
    expect(collectionsWritten).toContain('users');
    expect(collectionsWritten).toContain('usernames');
    expect(collectionsWritten).toContain('policies');

    const [userDoc, usernameDoc, policyDoc] = mockSet.mock.calls.map((call: unknown[]) => call[0]);
    expect(userDoc).toMatchObject({ uid: 'user-001', email: 'jamal@example.com', onboardingComplete: false });
    expect(usernameDoc).toMatchObject({ uid: 'user-001', email: 'jamal@example.com' });
    expect(policyDoc).toMatchObject({ policyId: 'policy_user-001', userId: 'user-001', policyNumber: 'DRV-001' });
  });

  it('auto-promotes an ADMIN_EMAILS user to isAdmin on the written doc', async () => {
    process.env.ADMIN_EMAILS = 'jamal@example.com';

    await provisionUser(fakeUserRecord());

    const [userDoc] = mockSet.mock.calls.map((call: unknown[]) => call[0]);
    expect(userDoc.isAdmin).toBe(true);
  });

  it('does not set isAdmin for a non-admin user', async () => {
    process.env.ADMIN_EMAILS = 'someoneelse@example.com';

    await provisionUser(fakeUserRecord());

    const [userDoc] = mockSet.mock.calls.map((call: unknown[]) => call[0]);
    expect(userDoc.isAdmin).toBeUndefined();
  });

  it('stores the Damoov deviceToken when registration succeeds', async () => {
    mockCreateDamoovUser.mockResolvedValue('device-token-abc');

    await provisionUser(fakeUserRecord());

    expect(mockUpdate).toHaveBeenCalledWith({ damoovDeviceToken: 'device-token-abc' });
  });

  it('does not throw and does not update the doc when Damoov registration fails', async () => {
    mockCreateDamoovUser.mockRejectedValue(new Error('Damoov is down'));

    await expect(provisionUser(fakeUserRecord())).resolves.toBeUndefined();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does not throw when a Firestore write fails (matches onUserCreate\'s never-throw posture)', async () => {
    mockSet.mockRejectedValueOnce(new Error('Firestore is down'));

    await expect(provisionUser(fakeUserRecord())).resolves.toBeUndefined();
  });

  it('skips the usernames write when the user has no email', async () => {
    await provisionUser(fakeUserRecord({ email: '' }));

    const collectionsWritten = mockDb.collection.mock.calls.map((call: unknown[]) => call[0]);
    expect(collectionsWritten).not.toContain('usernames');
  });

  it('derives displayName from the email local part when displayName is absent (Google-shaped input)', async () => {
    await provisionUser(fakeUserRecord({ displayName: undefined as unknown as string }));

    const [userDoc] = mockSet.mock.calls.map((call: unknown[]) => call[0]);
    expect(userDoc.displayName).toBe('jamal');
  });
});

describe('provisionUserOnSignup (dormant trigger export)', () => {
  it('is defined and callable, invoking the same provisioning logic as provisionUser', async () => {
    expect(provisionUserOnSignup).toBeTypeOf('function');

    await (provisionUserOnSignup as unknown as (u: unknown) => Promise<void>)(fakeUserRecord());

    const collectionsWritten = mockDb.collection.mock.calls.map((call: unknown[]) => call[0]);
    expect(collectionsWritten).toContain('users');
  });
});
