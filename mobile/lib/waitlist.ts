/**
 * Waitlist writes for the mobile onboarding funnel.
 *
 * Wave 0 (0d): the quote screen used to render "You're on the list" with a
 * a comment marking where the write should be, and no write.
 * Every signup evaporated while the user was told they had joined, and the
 * waitlist is the raise-critical metric.
 *
 * Writes land in the same `marketing_waitlist` collection the driiva.co.uk
 * waitlist endpoint uses (apps/marketing/api/lib/waitlist-core.ts), keyed by
 * the same normalised-email doc id, so mobile and web signups are one list
 * and one count rather than two.
 */
import { firestore, isExpoGo } from './firebase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const WAITLIST_COLLECTION = 'marketing_waitlist';

export class WaitlistError extends Error {
  readonly reason: 'invalid_email' | 'preview_build' | 'write_failed';

  constructor(reason: WaitlistError['reason'], message: string) {
    super(message);
    this.name = 'WaitlistError';
    this.reason = reason;
  }
}

/**
 * Mirrors emailKey() in apps/marketing/api/lib/waitlist-core.ts so the same
 * address resolves to the same document from either surface.
 */
export function waitlistDocId(email: string): string {
  return email.replace(/[^a-z0-9]/g, '_').slice(0, 200);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Persists an email to the waitlist. Throws on every path that does not
 * result in a stored record, so callers cannot render a confirmation for a
 * write that did not happen.
 */
export async function joinWaitlist(
  rawEmail: string,
  source = 'mobile_onboarding',
): Promise<void> {
  const email = normaliseEmail(rawEmail);

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    throw new WaitlistError('invalid_email', 'Enter a valid email address.');
  }

  // In Expo Go the Firebase layer is a mock whose writes resolve without
  // persisting anything (see lib/firebase.ts). Succeeding here would recreate
  // the exact bug this module exists to fix, so refuse instead.
  if (isExpoGo) {
    throw new WaitlistError(
      'preview_build',
      'Waitlist signup needs a full build. This is a preview.',
    );
  }

  try {
    await firestore()
      .collection(WAITLIST_COLLECTION)
      .doc(waitlistDocId(email))
      .set({
        email,
        source,
        createdAt: new Date(),
      });
  } catch (err) {
    console.error('[waitlist] write failed', err);
    throw new WaitlistError('write_failed', 'We could not save your place. Try again.');
  }
}
