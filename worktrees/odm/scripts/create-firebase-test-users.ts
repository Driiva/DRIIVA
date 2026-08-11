/**
 * CREATE FIREBASE TEST USERS (PSN-style)
 * =======================================
 * Creates 5 test accounts in Firebase Auth + Firestore (users, usernames, policy).
 * Run from repo root with Firebase Admin credentials set:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   or FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
 *
 *   npm run create-firebase-test-users
 *
 * Uses firebase-admin/app (modular) to avoid ESM "credential undefined" with import * as admin.
 */

import "dotenv/config";
import { initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const TEST_PASSWORD = "TestPass123!";
const DOMAIN = "driiva.co.uk";

const TEST_ACCOUNTS = [
  { username: "steelphoenix7", displayName: "Steel Phoenix" },
  { username: "crimsonshadow99", displayName: "Crimson Shadow" },
  { username: "novablade42", displayName: "Nova Blade" },
  { username: "frostviper11", displayName: "Frost Viper" },
  { username: "stormbreaker5", displayName: "Storm Breaker" },
];

function initAdmin(): App {
  const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? applicationDefault()
    : process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) as object)
      : null;
  if (!credential) {
    throw new Error(
      "Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_KEY to run this script."
    );
  }
  return initializeApp({ credential });
}

async function main() {
  const app = initAdmin();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const credentials: { email: string; username: string; password: string; displayName: string; uid?: string }[] = [];

  for (const { username, displayName } of TEST_ACCOUNTS) {
    const email = `${username}@${DOMAIN}`;
    try {
      const user = await auth.createUser({
        email,
        password: TEST_PASSWORD,
        displayName,
        emailVerified: true,
      });

      const now = new Date();
      const nowISO = now.toISOString();
      const policyStart = new Date(now);
      const policyEnd = new Date(now);
      policyEnd.setFullYear(policyEnd.getFullYear() + 1);
      const policyNumber = `DRV-${now.getFullYear()}-${user.uid.slice(0, 6).toUpperCase()}`;

      await db.doc(`users/${user.uid}`).set({
        uid: user.uid,
        email,
        fullName: displayName,
        onboardingCompleted: true,
        onboardingComplete: true,
        createdAt: nowISO,
        updatedAt: nowISO,
      });

      await db.doc(`usernames/${username}`).set({ email, uid: user.uid }, { merge: true });

      await db.doc(`policies/${user.uid}-policy`).set({
        policyId: `${user.uid}-policy`,
        userId: user.uid,
        policyNumber,
        status: "active",
        coverageType: "comprehensive_plus",
        basePremiumCents: 184000,
        currentPremiumCents: 184000,
        effectiveDate: policyStart.toISOString(),
        expirationDate: policyEnd.toISOString(),
        renewalDate: policyEnd.toISOString(),
        createdAt: nowISO,
        updatedAt: nowISO,
        created_by: "scripts/create-firebase-test-users",
      });

      credentials.push({ email, username, password: TEST_PASSWORD, displayName, uid: user.uid });
      console.log(`Created: ${email} (${user.uid})`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already exists")) {
        console.warn(`Skipped (already exists): ${email}`);
        credentials.push({ email, username, password: TEST_PASSWORD, displayName });
      } else {
        throw err;
      }
    }
  }

  console.log("\n--- TEST ACCOUNT CREDENTIALS ---\n");
  console.log("Sign in with EMAIL or USERNAME (same box). Password for all:", TEST_PASSWORD);
  console.log("");
  credentials.forEach((c, i) => {
    console.log(`${i + 1}. ${c.displayName}`);
    console.log(`   Email:   ${c.email}`);
    console.log(`   Username: ${c.username}`);
    console.log(`   Password: ${c.password}`);
    console.log("");
  });
  console.log("--- END ---");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
