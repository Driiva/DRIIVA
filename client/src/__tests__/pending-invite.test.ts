/**
 * Pins the invite-across-signup carry.
 *
 * The hole this closes: /invite/:code redirects a signed-out visitor to sign
 * up, and before this the code died at that redirect. The account got created
 * and the friendship silently never formed, so the invite link appeared to
 * work and produced nothing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  PENDING_INVITE_KEY,
  stashPendingInvite,
  readPendingInvite,
  clearPendingInvite,
} from '../hooks/usePendingInvite';

describe('pending invite storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('survives being written and read back', () => {
    stashPendingInvite('ABCD2345');
    expect(readPendingInvite()).toBe('ABCD2345');
  });

  it('returns null when nothing is pending', () => {
    expect(readPendingInvite()).toBeNull();
  });

  it('clears', () => {
    stashPendingInvite('ABCD2345');
    clearPendingInvite();
    expect(readPendingInvite()).toBeNull();
  });

  it('uses a namespaced key, so it cannot collide with other app state', () => {
    stashPendingInvite('ABCD2345');
    expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBe('ABCD2345');
    expect(PENDING_INVITE_KEY.startsWith('driiva-')).toBe(true);
  });

  // Private browsing can throw on any storage access. Losing the invite is
  // acceptable; breaking the sign-up that carries it is not.
  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(() => stashPendingInvite('ABCD2345')).not.toThrow();
    expect(readPendingInvite()).toBeNull();
    expect(() => clearPendingInvite()).not.toThrow();
  });
});
