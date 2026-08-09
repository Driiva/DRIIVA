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
