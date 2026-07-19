/**
 * Shared setup for the Auth+Firestore integration suite (M1 T5).
 *
 * Unlike tests/rules/helpers.ts (Firestore-only, @firebase/rules-unit-testing,
 * synthetic pre-authenticated contexts), this suite drives the REAL Firebase
 * Admin and client SDKs against the auth(9099)/firestore(8080) emulators
 * declared in firebase.json, to prove T1's provisioning logic and T2's
 * owner-gated completion write end to end - not a rules simulation.
 *
 * Requires the Auth+Firestore emulators running on 127.0.0.1, see the
 * `test:integration` script in package.json, which boots them via
 * `firebase emulators:exec`.
 *
 * MODULE-INSTANCE NOTE: this suite imports `provisionUser` directly from
 * functions/src/triggers/provisionUserOnSignup.ts, which itself does
 * `import * as admin from 'firebase-admin'` - resolved from
 * functions/node_modules (v12.7.0), not the root's firebase-admin (v13.7.0,
 * see package.json). Those are two independent module registries with their
 * own `admin.apps` list, so initializing the root-resolved admin would leave
 * provisionUserOnSignup.ts's own `admin.firestore()` call throwing "no
 * default app". vitest.integration.config.ts aliases the bare `firebase-admin`
 * specifier to the functions/ copy for every file in this suite, so this
 * helper's `admin` import and the one inside provisionUserOnSignup.ts resolve
 * to the exact same module and share one initialized app - PROVIDED this
 * module is imported (and so runs its top-level initializeApp side effect)
 * before provisionUserOnSignup.ts. identity.test.ts imports this module
 * first for that reason; `admin.firestore()` runs at provisionUserOnSignup.ts's
 * own module top level, so a lazily-deferred init here (e.g. inside a
 * beforeAll) would run too late.
 */
import * as admin from 'firebase-admin';
import { initializeApp as initializeClientApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

export const FIRESTORE_EMULATOR_HOST = '127.0.0.1';
export const FIRESTORE_EMULATOR_PORT = 8080;
export const AUTH_EMULATOR_HOST = '127.0.0.1';
export const AUTH_EMULATOR_PORT = 9099;

// `firebase emulators:exec` already sets these, but default them here too so
// the suite is self-documenting and still points at the emulator (never a
// real project) if run some other way.
process.env.FIRESTORE_EMULATOR_HOST ??= `${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}`;
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= `${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`;

// Matches whichever project `firebase emulators:exec` is actually running
// (it sets GCLOUD_PROJECT for the child process), falling back to the
// .firebaserc default. singleProjectMode in firebase.json means the running
// emulators only accept this one project id.
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'driiva';

// Eager, module-load-time init (not a lazy getter) - see the module-instance
// note above for why this must run before provisionUserOnSignup.ts's own
// `admin.firestore()` call.
export const adminApp: admin.app.App = admin.apps.length
  ? (admin.app() as admin.app.App)
  : admin.initializeApp({ projectId: PROJECT_ID });

export const adminDb = adminApp.firestore();
export const adminAuth = adminApp.auth();

/**
 * Client SDK app + Auth/Firestore instances, connected to the same
 * emulators. Used to sign in as a real created user and perform the
 * OWNER-GATED write (client setDoc under firestore.rules), mirroring
 * quick-onboarding.tsx's handleComplete - not an Admin SDK write, which
 * would bypass the rules under test.
 */
const clientApp = initializeClientApp({ projectId: PROJECT_ID, apiKey: 'demo-emulator-key' });
export const clientAuth = getAuth(clientApp);
connectAuthEmulator(clientAuth, `http://${AUTH_EMULATOR_HOST}:${AUTH_EMULATOR_PORT}`, {
  disableWarnings: true,
});
export const clientDb = getFirestore(clientApp);
connectFirestoreEmulator(clientDb, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
