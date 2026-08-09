/**
 * Lives in the root test tree rather than beside the module: mobile/ has its
 * own Expo tsconfig and dependency set, which the root vitest run cannot
 * resolve.
 *
 * Wave 0 (0d): the quote screen rendered "You're on the list" over a
 * `// TODO: write to waitlist Firestore collection`. These tests pin the two
 * properties that were missing: a real write happens, and every path that
 * does not produce one throws so the caller cannot show a confirmation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const setMock = vi.fn();
const docMock = vi.fn(() => ({ set: setMock }));
const collectionMock = vi.fn(() => ({ doc: docMock }));

const firebaseState = { isExpoGo: false };

vi.mock('../../mobile/lib/firebase', () => ({
  firestore: () => ({ collection: collectionMock }),
  get isExpoGo() {
    return firebaseState.isExpoGo;
  },
}));

const { joinWaitlist, waitlistDocId, WaitlistError, WAITLIST_COLLECTION } =
  await import('../../mobile/lib/waitlist');

beforeEach(() => {
  setMock.mockReset().mockResolvedValue(undefined);
  docMock.mockClear();
  collectionMock.mockClear();
  firebaseState.isExpoGo = false;
});

describe('joinWaitlist', () => {
  it('writes the email to the shared marketing_waitlist collection', async () => {
    await joinWaitlist('Driver@Example.COM ');

    expect(collectionMock).toHaveBeenCalledWith(WAITLIST_COLLECTION);
    expect(docMock).toHaveBeenCalledWith(waitlistDocId('driver@example.com'));
    expect(setMock).toHaveBeenCalledTimes(1);

    const written = setMock.mock.calls[0][0];
    expect(written.email).toBe('driver@example.com');
    expect(written.source).toBe('mobile_onboarding');
    expect(written.createdAt).toBeInstanceOf(Date);
  });

  it('keys documents the same way the marketing waitlist endpoint does', () => {
    // Mirrors emailKey() in apps/marketing/api/lib/waitlist-core.ts, so one
    // person signing up on both surfaces is one waitlist entry.
    expect(waitlistDocId('driver@example.com')).toBe('driver_example_com');
  });

  it('rejects an invalid email without writing', async () => {
    await expect(joinWaitlist('not-an-email')).rejects.toBeInstanceOf(WaitlistError);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('rejects an empty email without writing', async () => {
    await expect(joinWaitlist('   ')).rejects.toBeInstanceOf(WaitlistError);
    expect(setMock).not.toHaveBeenCalled();
  });

  it('refuses in Expo Go, where the Firebase layer is a mock that persists nothing', async () => {
    firebaseState.isExpoGo = true;

    await expect(joinWaitlist('driver@example.com')).rejects.toMatchObject({
      reason: 'preview_build',
    });
    expect(setMock).not.toHaveBeenCalled();
  });

  it('surfaces a write failure instead of resolving', async () => {
    setMock.mockRejectedValue(new Error('permission-denied'));

    await expect(joinWaitlist('driver@example.com')).rejects.toMatchObject({
      reason: 'write_failed',
    });
  });
});
