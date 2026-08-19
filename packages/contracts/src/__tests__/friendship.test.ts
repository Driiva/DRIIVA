import { describe, it, expect } from 'vitest';

import {
  friendshipId,
  FriendshipDocumentSchema,
  InviteDocumentSchema,
  generateInviteCode,
  normaliseInviteCode,
  isValidInviteCode,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  decideRedemption,
} from '../friendship';

const ts = { seconds: 1_770_000_000, nanoseconds: 0 };

describe('friendshipId', () => {
  it('is the same whichever way round the uids arrive', () => {
    expect(friendshipId('alice', 'bob')).toBe(friendshipId('bob', 'alice'));
  });

  it('sorts rather than concatenating in argument order', () => {
    expect(friendshipId('zoe', 'adam')).toBe('adam_zoe');
  });

  // The whole point of a derived id: two people inviting each other at the
  // same moment must land on one document, not two mirrored ones that can
  // disagree about whether they are friends.
  it('gives both directions a single document id', () => {
    const fromA = friendshipId('uid-1', 'uid-2');
    const fromB = friendshipId('uid-2', 'uid-1');
    expect(new Set([fromA, fromB]).size).toBe(1);
  });
});

describe('FriendshipDocumentSchema', () => {
  it('accepts a well-formed pair', () => {
    const parsed = FriendshipDocumentSchema.parse({
      friendshipId: 'a_b',
      users: ['a', 'b'],
      initiatedBy: 'a',
      viaInviteCode: 'ABCD2345',
      createdAt: ts,
    });
    expect(parsed.users).toHaveLength(2);
  });

  it('rejects a friendship that is not exactly two people', () => {
    const base = { friendshipId: 'a_b', initiatedBy: 'a', createdAt: ts };
    expect(() => FriendshipDocumentSchema.parse({ ...base, users: ['a'] })).toThrow();
    expect(() => FriendshipDocumentSchema.parse({ ...base, users: ['a', 'b', 'c'] })).toThrow();
  });
});

describe('InviteDocumentSchema', () => {
  it('accepts a pending invite with no acceptance fields', () => {
    const parsed = InviteDocumentSchema.parse({
      code: 'ABCD2345',
      createdBy: 'a',
      createdAt: ts,
      expiresAt: ts,
      status: 'pending',
    });
    expect(parsed.acceptedBy).toBeUndefined();
  });

  it('rejects an unknown status', () => {
    expect(() =>
      InviteDocumentSchema.parse({
        code: 'ABCD2345',
        createdBy: 'a',
        createdAt: ts,
        expiresAt: ts,
        status: 'cancelled',
      }),
    ).toThrow();
  });
});

describe('invite codes', () => {
  it('generates codes of the declared length from the declared alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(isValidInviteCode(code)).toBe(true);
    }
  });

  // A code gets read off one phone screen and typed into another. Characters
  // that look alike turn that into a support ticket.
  it('never emits the ambiguous glyphs I, O, 0 or 1', () => {
    expect(INVITE_CODE_ALPHABET).not.toMatch(/[IO01]/);
    const sample = Array.from({ length: 200 }, () => generateInviteCode()).join('');
    expect(sample).not.toMatch(/[IO01]/);
  });

  it('is deterministic given a deterministic source, so it can be tested', () => {
    const always = () => 0;
    expect(generateInviteCode(always)).toBe('A'.repeat(INVITE_CODE_LENGTH));
  });

  it('normalises the ways a person actually types a code', () => {
    expect(normaliseInviteCode('  abcd2345 ')).toBe('ABCD2345');
    expect(normaliseInviteCode('abcd-2345')).toBe('ABCD2345');
    expect(isValidInviteCode('abcd 2345')).toBe(true);
  });

  it('rejects wrong length and out-of-alphabet input', () => {
    expect(isValidInviteCode('ABCD234')).toBe(false);
    expect(isValidInviteCode('ABCD23456')).toBe(false);
    expect(isValidInviteCode('ABCD2I45')).toBe(false);
    expect(isValidInviteCode('')).toBe(false);
  });
});

/**
 * REDEMPTION DECISION
 * ===================
 * The rules of redeeming an invite are the same on every surface, but the
 * Firestore SDKs are not: the web app speaks firebase/firestore and mobile
 * speaks @react-native-firebase/firestore. Only the reads and writes differ.
 * Keeping the decision here means one owner for "may this code be redeemed,
 * and if not, why not", instead of two copies that drift until a code minted
 * on one surface stops working on the other.
 */
describe('decideRedemption', () => {
  const valid = 'ABCDEFGH';
  const base = {
    userId: 'me',
    alreadyFriends: false,
    nowMs: 1_000_000,
  };
  const pending = {
    exists: true,
    createdBy: 'them',
    status: 'pending' as const,
    expiresAtMs: 2_000_000,
  };

  it('accepts a pending, unexpired code from somebody else', () => {
    const d = decideRedemption({ ...base, rawCode: valid, invite: pending });
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.friendUid).toBe('them');
      expect(d.pairId).toBe(friendshipId('me', 'them'));
    }
  });

  it('accepts a code the user typed in lower case with spacing', () => {
    const d = decideRedemption({ ...base, rawCode: ' abcd efgh ', invite: pending });
    expect(d.ok).toBe(true);
  });

  it('refuses a code that is not a code at all', () => {
    const d = decideRedemption({ ...base, rawCode: 'nope', invite: pending });
    expect(d).toEqual({ ok: false, failure: 'invalid-code' });
  });

  // I, O, 0 and 1 are deliberately outside the alphabet so a code read aloud
  // is unambiguous. A code containing them cannot have been minted by us.
  it('refuses a code containing the excluded characters', () => {
    const d = decideRedemption({ ...base, rawCode: 'ABCDEFGO', invite: pending });
    expect(d).toEqual({ ok: false, failure: 'invalid-code' });
  });

  it('refuses a code that does not exist', () => {
    const d = decideRedemption({ ...base, rawCode: valid, invite: { exists: false } });
    expect(d).toEqual({ ok: false, failure: 'not-found' });
  });

  it('refuses the user their own code', () => {
    const d = decideRedemption({
      ...base,
      rawCode: valid,
      invite: { ...pending, createdBy: 'me' },
    });
    expect(d).toEqual({ ok: false, failure: 'own-code' });
  });

  it('refuses a code already spent', () => {
    const d = decideRedemption({
      ...base,
      rawCode: valid,
      invite: { ...pending, status: 'accepted' },
    });
    expect(d).toEqual({ ok: false, failure: 'already-used' });
  });

  it('refuses a revoked code', () => {
    const d = decideRedemption({
      ...base,
      rawCode: valid,
      invite: { ...pending, status: 'revoked' },
    });
    expect(d).toEqual({ ok: false, failure: 'already-used' });
  });

  it('refuses an expired code', () => {
    const d = decideRedemption({
      ...base,
      rawCode: valid,
      invite: { ...pending, expiresAtMs: 999_999 },
      nowMs: 1_000_000,
    });
    expect(d).toEqual({ ok: false, failure: 'expired' });
  });

  it('treats the expiry instant itself as still valid', () => {
    const d = decideRedemption({
      ...base,
      rawCode: valid,
      invite: { ...pending, expiresAtMs: 1_000_000 },
      nowMs: 1_000_000,
    });
    expect(d.ok).toBe(true);
  });

  it('refuses a pair who are already friends', () => {
    const d = decideRedemption({
      ...base,
      rawCode: valid,
      invite: pending,
      alreadyFriends: true,
    });
    expect(d).toEqual({ ok: false, failure: 'already-friends' });
  });

  // Ordering matters: "that is your own code" is more useful than "that code
  // has expired" when both are true, because only one of them tells the user
  // what to actually do.
  it('reports own-code ahead of expiry when both apply', () => {
    const d = decideRedemption({
      ...base,
      rawCode: valid,
      invite: { ...pending, createdBy: 'me', expiresAtMs: 1 },
    });
    expect(d).toEqual({ ok: false, failure: 'own-code' });
  });

  it('refuses an invite with no creator rather than pairing with undefined', () => {
    const d = decideRedemption({
      ...base,
      rawCode: valid,
      invite: { exists: true, status: 'pending', expiresAtMs: 2_000_000 },
    });
    expect(d.ok).toBe(false);
  });
});
