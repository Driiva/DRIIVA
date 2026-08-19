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

/**
 * REDEEMING AN INVITE
 * ===================
 * Why the decision lives here and not in each app: the rules of redemption are
 * identical on every surface, but the Firestore SDKs are not. The web app
 * speaks `firebase/firestore` and mobile speaks
 * `@react-native-firebase/firestore`, so the reads and writes genuinely cannot
 * be shared. The reasoning can, and must be, or the two surfaces drift until a
 * code minted on one stops being redeemable on the other.
 *
 * Each caller does the two lookups it needs (the invite document, and whether
 * the pair are already friends), hands the facts in, and gets back either a
 * pairing to write or the one failure worth telling the user about.
 */

/** Why a redemption failed, in terms the UI can turn into honest copy. */
export type RedeemFailure =
  | 'invalid-code'
  | 'not-found'
  | 'expired'
  | 'already-used'
  | 'own-code'
  | 'already-friends'
  | 'write-failed';

/** The facts about an invite, read by whichever SDK the caller speaks. */
export interface InviteSnapshot {
  exists: boolean;
  createdBy?: string;
  status?: InviteStatus;
  /** Epoch milliseconds. Callers convert their own Timestamp type. */
  expiresAtMs?: number;
}

export type RedeemDecision =
  | { ok: true; code: string; friendUid: string; pairId: string }
  | { ok: false; failure: RedeemFailure };

export interface RedeemInputs {
  rawCode: string;
  userId: string;
  invite: InviteSnapshot;
  alreadyFriends: boolean;
  nowMs: number;
}

/**
 * Decides whether an invite may be redeemed.
 *
 * The check order is deliberate: it reports the failure that tells the user
 * what to do next. "That is your own code" is more useful than "that code has
 * expired" when both are true, because only one of them suggests an action.
 */
export function decideRedemption(inputs: RedeemInputs): RedeemDecision {
  const { rawCode, userId, invite, alreadyFriends, nowMs } = inputs;

  if (!isValidInviteCode(rawCode)) return { ok: false, failure: 'invalid-code' };

  const code = normaliseInviteCode(rawCode);

  if (!invite.exists) return { ok: false, failure: 'not-found' };

  // An invite with no creator cannot be paired with anybody. Refusing beats
  // writing a friendship whose other half is undefined.
  if (!invite.createdBy) return { ok: false, failure: 'not-found' };

  if (invite.createdBy === userId) return { ok: false, failure: 'own-code' };

  if (invite.status !== 'pending') return { ok: false, failure: 'already-used' };

  // The expiry instant itself still counts as valid: a code that says it lasts
  // fourteen days should last fourteen days, not fourteen days minus a tick.
  if (typeof invite.expiresAtMs === 'number' && invite.expiresAtMs < nowMs) {
    return { ok: false, failure: 'expired' };
  }

  if (alreadyFriends) return { ok: false, failure: 'already-friends' };

  return {
    ok: true,
    code,
    friendUid: invite.createdBy,
    pairId: friendshipId(userId, invite.createdBy),
  };
}
