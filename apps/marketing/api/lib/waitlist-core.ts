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

  const firestore = await createFirestoreClient();
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
    const firestore = await createFirestoreClient();
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

async function createFirestoreClient(): Promise<FirestoreClient> {
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
    await initFirebaseOnce(sa, projectId);
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

async function initFirebaseOnce(sa: string, projectId: string) {
  if (firebaseInited) return;
  // A real dynamic import, not require. These functions run as ESM on Vercel,
  // where require is not defined, so the previous version threw
  // "ReferenceError: require is not defined" at init and every signup failed.
  // The import still keeps firebase-admin out of the Vite client bundle.
  const admin = (await import('firebase-admin')).default;
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
      const { Resend } = await import('resend');
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

/**
 * Built on the canonical Driiva shell (design-system/email-shell.html), not
 * hand-rolled. The previous version was a translucent rgba card with no
 * bgcolor attribute, which renders as nothing in most clients: the email
 * arrived blank. Outlook ignores CSS background on tables entirely and reads
 * only the bgcolor attribute, which is why both outer tables carry one.
 *
 * Instrument Glass law: near-monochrome, the amber-to-indigo gradient lives
 * only as the 3px hairline, the headline stays #fafafa and is never
 * gradient-clipped, and the position is a tabular figure because it is a
 * number someone reads rather than prose.
 */
function confirmationEmailHtml(position: number): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>You are on the Driiva waitlist</title>
</head>
<body style="margin:0;padding:0;width:100%;background:#050509;background-color:#050509;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#050509" style="background:#050509;background-color:#050509;background-image:radial-gradient(1100px 520px at 50% -22%,rgba(107,95,220,0.12),transparent 60%);padding:40px 16px"><tbody><tr><td align="center">
 <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#0a0a14" style="width:600px;max-width:100%;background:#0a0a14;background-color:#0a0a14;border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.55)"><tbody>

  <tr><td style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,#d4850a 0%,#a04c2a 34%,#6b3fa0 68%,#3b2d8b 100%)">&nbsp;</td></tr>

  <tr><td style="padding:34px 36px 0 36px">
    <img src="https://driiva.co.uk/brand/logo-wordmark-white-v3.png" width="128" alt="driiva" style="display:block;width:128px;max-width:44%;height:auto;border:0">
    <div style="margin-top:24px;font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.60)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;vertical-align:middle;margin-right:9px"></span>Waitlist confirmed</div>
  </td></tr>

  <tr><td style="padding:16px 36px 0 36px">
    <h1 style="margin:0;font-family:'Inter Tight',Inter,-apple-system,sans-serif;font-size:30px;font-weight:700;letter-spacing:-0.035em;line-height:1.04;color:#fafafa">You are on the list.</h1>
    <p style="margin:14px 0 0 0;font-family:Inter,-apple-system,sans-serif;font-size:15.5px;line-height:1.55;color:rgba(255,255,255,0.66)">We will email you the moment the beta opens.</p>
  </td></tr>

  <tr><td style="padding:26px 36px 0 36px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#12111f" style="background:#12111f;background-color:#12111f;border:1px solid rgba(255,255,255,0.07);border-radius:14px"><tbody><tr>
      <td style="padding:18px 20px">
        <div style="font-family:'Inter Tight',sans-serif;font-size:23px;font-weight:700;color:#f8fafc;letter-spacing:-0.02em">#${position}</div>
        <div style="margin-top:6px;font-family:'JetBrains Mono',monospace;font-size:9.5px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.46)">your place in the queue</div>
      </td>
    </tr></tbody></table>
  </td></tr>

  <tr><td style="padding:28px 36px 34px 36px">
    <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px;font-family:Inter,sans-serif;font-size:13.5px;line-height:1.55;color:rgba(255,255,255,0.55)">Driiva is working towards the FCA regulatory sandbox and is not authorised. The waitlist is not a policy offer.</div>
    <div style="margin-top:14px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.38)">DRIIVA LTD &middot; telematics insurance for young UK drivers</div>
  </td></tr>

 </tbody></table>
</td></tr></tbody></table>
</body>
</html>`;
}

function confirmationEmailText(position: number): string {
  return `You are #${position} on the Driiva waitlist.

We'll email you the moment the beta opens for sign-ups.

Driiva is working towards the FCA regulatory sandbox and is not authorised. The waitlist is not a policy offer.

— Driiva`;
}
