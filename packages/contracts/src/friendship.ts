import { z } from 'zod';

import { FirestoreTimestampSchema } from './timestamp';

/**
 * FRIENDSHIPS AND INVITES
 * =======================
 * The social graph behind the friends leaderboard. New in Wave B: there was
 * no model for this anywhere in the product before.
 *
 * Design notes worth keeping:
 *
 * A friendship is ONE document, not two. Storing a row per direction means
 * two writes that can half-fail, leaving A friends with B while B is not
 * friends with A. The document id is the two uids sorted and joined, so the
 * pair itself determines the id and a duplicate friendship cannot be created
 * from either side.
 *
 * `users` duplicates the two uids as an array purely so Firestore can answer
 * "who are my friends" with a single array-contains query, and so the rules
 * can authorise on membership without a second read.
 *
 * Invite codes are their own collection keyed BY the code, so accepting one is
 * a direct document get rather than a query. That matters for the rules: a
 * query cannot be authorised per-document, but a get can.
 */

/** Sorted-pair document id. Same answer whichever way round the uids arrive. */
export function friendshipId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

export const FriendshipDocumentSchema = z.object({
  friendshipId: z.string(),
  /** Exactly the two uids, sorted, matching the document id. */
  users: z.array(z.string()).length(2),
  /** Who sent the invite that produced this friendship. */
  initiatedBy: z.string(),
  /** The invite code this came from, for support and abuse tracing. */
  viaInviteCode: z.string().optional(),
  createdAt: FirestoreTimestampSchema,
});
export type FriendshipDocument = z.infer<typeof FriendshipDocumentSchema>;

export const InviteStatusSchema = z.enum(['pending', 'accepted', 'revoked']);
export type InviteStatus = z.infer<typeof InviteStatusSchema>;

/**
 * Collection: `invites/{code}`.
 *
 * The code is the document id. It is short enough to share in a message and
 * drawn from an unambiguous alphabet, because a code that has to be read aloud
 * or retyped cannot afford to contain both O and 0.
 */
export const InviteDocumentSchema = z.object({
  code: z.string(),
  createdBy: z.string(),
  createdAt: FirestoreTimestampSchema,
  expiresAt: FirestoreTimestampSchema,
  status: InviteStatusSchema,
  acceptedBy: z.string().optional(),
  acceptedAt: FirestoreTimestampSchema.optional(),
});
export type InviteDocument = z.infer<typeof InviteDocumentSchema>;

/**
 * Invite codes omit I, O, 0 and 1. Someone will read one of these off a phone
 * screen to a friend in a car park, and "is that an oh or a zero" is a support
 * ticket waiting to happen.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

/** How long an invite stays acceptable. */
export const INVITE_TTL_DAYS = 14;

export function generateInviteCode(
  randomInt: (maxExclusive: number) => number = (max) => Math.floor(Math.random() * max),
): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

const CODE_PATTERN = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

/** Normalises user input before lookup: trims, uppercases, strips spacing. */
export function normaliseInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidInviteCode(raw: string): boolean {
  return CODE_PATTERN.test(normaliseInviteCode(raw));
}
