/**
 * Framework-agnostic waitlist business logic.
 * Used by both the Vercel function entry (api/waitlist.ts) and the
 * Vite dev middleware so prod + dev share one code path.
 *
 * Required env vars (graceful no-op if absent):
 *   FIREBASE_SERVICE_ACCOUNT_JSON  — service account JSON (single line)
 *   FIREBASE_PROJECT_ID             — project id, e.g. "driiva-prod"
 *   FIREBASE_WAITLIST_COLLECTION    — optional, defaults "marketing_waitlist"
 *   RESEND_API_KEY                  — Resend secret
 *   RESEND_FROM                     — verified sender, default "Driiva <hello@driiva.co.uk>"
 *   WAITLIST_BASE_COUNT             - added to live count. Defaults to 0 so the
 *                                     number we publish and email is the real one.
 *                                     Set it deliberately if there is a genuine
 *                                     off-platform cohort to account for.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inMemoryStore = new Set<string>();

export interface WaitlistRequestBody {
  email?: string;
  source?: string;
}

export interface WaitlistResponseBody {
  success: boolean;
  position?: number;
  alreadyOnList?: boolean;
  error?: string;
}

interface FirestoreClient {
  add(email: string, source: string): Promise<void>;
  count(): Promise<number>;
  has(email: string): Promise<boolean>;
}

interface EmailClient {
  sendConfirmation(email: string, position: number): Promise<void>;
}

const BASE_COUNT = Number(process.env.WAITLIST_BASE_COUNT ?? '0');

export async function processWaitlist(
  body: WaitlistRequestBody,
): Promise<{ status: number; payload: WaitlistResponseBody }> {
  const rawEmail = (body.email ?? '').trim().toLowerCase();
  if (!rawEmail || !EMAIL_RE.test(rawEmail) || rawEmail.length > 254) {
    return { status: 400, payload: { success: false, error: 'invalid_email' } };
  }
  const source = (body.source ?? 'hero').slice(0, 32);

  const firestore = createFirestoreClient();
  const email = createEmailClient();

  try {
    if (await firestore.has(rawEmail)) {
      const total = await firestore.count();
      return {
        status: 200,
        payload: {
          success: true,
          alreadyOnList: true,
          position: BASE_COUNT + total,
        },
      };
    }
    await firestore.add(rawEmail, source);
    const total = await firestore.count();
    const position = BASE_COUNT + total;
    email.sendConfirmation(rawEmail, position).catch((err) => {
      console.warn('[waitlist] confirmation email failed', err);
    });
    return { status: 200, payload: { success: true, position } };
  } catch (err) {
    console.error('[waitlist] processing failure', err);
    return { status: 500, payload: { success: false, error: 'server_error' } };
  }
}

export async function getWaitlistCount(): Promise<number | null> {
  // null, not 0. A store we cannot reach is an unknown count, and rendering
  // "0 drivers" from an unreachable store is a claim about the product made
  // on no evidence.
  try {
    const firestore = createFirestoreClient();
    const total = await firestore.count();
    return BASE_COUNT + total;
  } catch (err) {
    console.error('[waitlist] count unavailable', err);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────
   Firestore client — real if creds present, in-memory otherwise.
   ───────────────────────────────────────────────────────── */
let firebaseInited = false;
let firestoreInstance: unknown | null = null;

/**
 * Thrown when the waitlist has nowhere durable to write. It is deliberately
 * NOT caught into a success: a signup that lands in a serverless instance's
 * memory is discarded the moment that instance recycles, and telling someone
 * they are on a list they are not on is the exact failure this endpoint
 * exists to avoid.
 */
class WaitlistNotConfiguredError extends Error {}

function createFirestoreClient(): FirestoreClient {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!sa || !projectId) {
    // In-memory is a LOCAL convenience. In production it silently drops every
    // signup, so refuse instead. driiva-marketing had no environment variables
    // at all, which is how this went unnoticed: every join returned success
    // and nothing was ever stored.
    if (isProduction()) {
      throw new WaitlistNotConfiguredError(
        'FIREBASE_SERVICE_ACCOUNT_JSON and FIREBASE_PROJECT_ID are unset, so there is nowhere durable to record a signup',
      );
    }
    return inMemoryClient();
  }
  try {
    initFirebaseOnce(sa, projectId);
    return firestoreClientReal();
  } catch (err) {
    console.error('[waitlist] Firebase init failed', err);
    if (isProduction()) {
      throw new WaitlistNotConfiguredError('Firebase init failed, so there is nowhere durable to record a signup');
    }
    return inMemoryClient();
  }
}

function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function initFirebaseOnce(sa: string, projectId: string) {
  if (firebaseInited) return;
  // Dynamic import keeps firebase-admin out of the Vite client bundle.
  // The require runs only in Node contexts (Vercel function or Vite SSR plugin).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const admin = require('firebase-admin') as typeof import('firebase-admin');
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(sa)),
      projectId,
    });
  }
  firestoreInstance = admin.firestore();
  firebaseInited = true;
}

function firestoreClientReal(): FirestoreClient {
  const db = firestoreInstance as import('firebase-admin').firestore.Firestore;
  const collection = process.env.FIREBASE_WAITLIST_COLLECTION ?? 'marketing_waitlist';
  return {
    async has(email) {
      const snap = await db.collection(collection).doc(emailKey(email)).get();
      return snap.exists;
    },
    async add(email, source) {
      await db
        .collection(collection)
        .doc(emailKey(email))
        .set({
          email,
          source,
          createdAt: new Date(),
          ip: null,
          userAgent: null,
        });
    },
    async count() {
      const snap = await db.collection(collection).count().get();
      return snap.data().count;
    },
  };
}

function inMemoryClient(): FirestoreClient {
  return {
    async has(email) {
      return inMemoryStore.has(email);
    },
    async add(email) {
      inMemoryStore.add(email);
    },
    async count() {
      return inMemoryStore.size;
    },
  };
}

function emailKey(email: string): string {
  return email.replace(/[^a-z0-9]/g, '_').slice(0, 200);
}

/* ─────────────────────────────────────────────────────────
   Email client — Resend if creds present, console otherwise.
   ───────────────────────────────────────────────────────── */
function createEmailClient(): EmailClient {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? 'Driiva <hello@driiva.co.uk>';
  if (!key) {
    return {
      async sendConfirmation(email, position) {
        console.info(`[waitlist] mock email to ${email}, position #${position}`);
      },
    };
  }
  return {
    async sendConfirmation(email, position) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Resend } = require('resend') as typeof import('resend');
      const resend = new Resend(key);
      await resend.emails.send({
        from,
        to: email,
        subject: 'You are on the Driiva waitlist',
        html: confirmationEmailHtml(position),
        text: confirmationEmailText(position),
      });
    },
  };
}

function confirmationEmailHtml(position: number): string {
  return `<!doctype html>
<html><body style="font-family:'Inter','Helvetica Neue',sans-serif;background:#1a0f1f;color:#ffffff;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:rgba(30,41,59,0.6);border:1px solid rgba(255,255,255,0.18);border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 12px;font-size:22px;letter-spacing:-0.02em;">You are on the list.</h1>
    <p style="font-size:15px;line-height:1.6;color:rgba(255,255,255,0.72);margin:0 0 16px;">
      You are #${position} on the Driiva waitlist. We will email you the moment the beta opens for sign-ups.
    </p>
    <p style="font-size:13.5px;line-height:1.55;color:rgba(255,255,255,0.55);margin:24px 0 0;">
      Driiva is working towards the FCA regulatory sandbox and is not authorised. The waitlist is not a policy offer.
    </p>
  </div>
</body></html>`;
}

function confirmationEmailText(position: number): string {
  return `You are #${position} on the Driiva waitlist.

We'll email you the moment the beta opens for sign-ups.

Driiva is working towards the FCA regulatory sandbox and is not authorised. The waitlist is not a policy offer.

— Driiva`;
}
