"use strict";
/**
 * PROVISION USER ON SIGNUP
 * ========================
 * The unified user-provisioning path for M1 (see
 * .superpowers/sdd/m1-grounding.md §2/§8, rebuild_plan.md §M1 T1). A single
 * Firebase Auth `onCreate` trigger that writes the complete `users/{uid}`
 * doc for EVERY signup method, including Google - which the retired
 * `onUserCreate` (a Firestore-doc trigger, see git history) never fired for.
 *
 * LIVE as of the M1 T7 cutover: exported from `functions/src/index.ts` (the
 * deploy surface), replacing `onUserCreate` and the client's fire-and-forget
 * batch (`client/src/pages/signup.tsx`), which are both retired. `syncUserOnSignup`
 * (DEC-3) stays alongside this as the Neon analytics mirror. `provisionUser`
 * and `buildProvisionedUserDoc` are exported individually so the emulator
 * integration test (M1 T5) can drive them directly without the trigger
 * wrapper.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.provisionUserOnSignup = void 0;
exports.provisionUser = provisionUser;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const types_1 = require("../types");
const region_1 = require("../lib/region");
const damoov_1 = require("../lib/damoov");
const sentry_1 = require("../lib/sentry");
const provisionUser_1 = require("../utils/provisionUser");
const db = admin.firestore();
// Comma-separated list of emails that are automatically granted admin access.
// Mirrors functions/src/triggers/users.ts's ADMIN_EMAILS - duplicated here
// rather than imported so this module stays independent of the old trigger
// it is meant to replace at cutover. Read lazily (per invocation, not at
// module load) so it reflects the current env in tests; a Cloud Function's
// env doesn't change mid-container-lifetime, so this has no production cost.
function getAdminEmails() {
    return (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
}
/**
 * Generate a unique policy number in format DRV-001, DRV-002, etc.
 * Ported verbatim from `functions/src/triggers/users.ts`'s (unexported)
 * `generatePolicyNumber` - same `counters/policy` counter doc, so numbering
 * stays contiguous across both provisioning paths during the M1 coexistence
 * window.
 */
async function generatePolicyNumber() {
    const counterRef = db.collection(types_1.COLLECTION_NAMES.COUNTERS).doc('policy');
    return await db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextValue = 1;
        if (counterDoc.exists) {
            nextValue = (counterDoc.data()?.currentValue || 0) + 1;
        }
        transaction.set(counterRef, { currentValue: nextValue }, { merge: true });
        const paddedNumber = String(nextValue).padStart(3, '0');
        return `DRV-${paddedNumber}`;
    });
}
/**
 * Async handler for the Auth `onCreate` event: writes `users/{uid}`,
 * `usernames/{localPart}`, the default `policies/{...}` doc, and registers
 * the user with Damoov. Fires for every signup method, including Google.
 * Skips all of the above (idempotency guard, above) when a policy already
 * exists for the uid, so a duplicate Auth-trigger delivery is a no-op.
 *
 * Matches the retired `onUserCreate`'s never-throw posture (it lived in
 * functions/src/triggers/users.ts, deleted at the M1 T7 cutover - see git
 * history): the whole body is wrapped in one try/catch that logs and does
 * not rethrow. This is an Auth `onCreate` trigger, not a Firestore-doc
 * trigger - it is not auto-retried by the platform, so a transient
 * Firestore blip must not fail loudly; it leaves the user un-provisioned
 * for a manual/scripted retry rather than surfacing an error to the signup
 * flow.
 */
async function provisionUser(user) {
    const { uid, email: rawEmail, displayName } = user;
    const email = rawEmail || '';
    try {
        // Idempotency guard (restored from onUserCreate, users.ts:75-85 - the
        // ONE genuine cutover-gate flagged by the whole-branch review). Auth
        // onCreate triggers are delivered at-least-once, not exactly-once, so a
        // re-run for the same uid must be a no-op: without this check it would
        // mint a second policies/{...} doc, drift the shared DRV-### counter,
        // AND - worse, since the write below is a full `.set()` of the whole
        // users/{uid} doc, not a merge - clobber any state the user has
        // legitimately accrued since first provisioning (onboardingComplete,
        // driving score, etc). A policy already existing for this uid is the
        // signal that provisioning already ran.
        const existingPolicies = await db
            .collection(types_1.COLLECTION_NAMES.POLICIES)
            .where('userId', '==', uid)
            .limit(1)
            .get();
        if (!existingPolicies.empty) {
            functions.logger.info(`User ${uid} already has a policy, skipping re-provisioning`);
            return;
        }
        const adminEmails = getAdminEmails();
        const isAdmin = adminEmails.length > 0 && adminEmails.includes(email.toLowerCase());
        if (isAdmin) {
            functions.logger.info(`Auto-promoting ${uid} (${email}) to admin - reason: ADMIN_EMAILS allowlist`);
        }
        const policyId = `policy_${uid}`;
        const policyNumber = await generatePolicyNumber();
        const now = admin.firestore.Timestamp.now();
        const renewalDate = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
        const userDoc = (0, provisionUser_1.buildProvisionedUserDoc)({
            uid,
            email,
            displayName: displayName ?? undefined,
            isAdmin,
            policyId,
            policyNumber,
            now,
            renewalDate,
        });
        await db.collection(types_1.COLLECTION_NAMES.USERS).doc(uid).set(userDoc);
        functions.logger.info(`Provisioned user doc for ${uid}`, { email, isAdmin });
        const localPart = email.split('@')[0]?.toLowerCase();
        if (localPart) {
            await db.collection('usernames').doc(localPart).set({ email, uid }, { merge: true });
        }
        const policyData = {
            policyId,
            userId: uid,
            policyNumber,
            status: 'pending',
            coverageType: 'standard',
            coverageDetails: {
                liabilityLimitCents: 10000000, // £100,000
                collisionDeductibleCents: 50000, // £500
                comprehensiveDeductibleCents: 25000, // £250
                includesRoadside: true,
                includesRental: false,
            },
            basePremiumCents: 0,
            currentPremiumCents: 0,
            discountPercentage: 0,
            effectiveDate: now,
            expirationDate: renewalDate,
            renewalDate,
            vehicle: null,
            billingCycle: 'annual',
            stripeSubscriptionId: null,
            createdAt: now,
            updatedAt: now,
            createdBy: 'cloud-function:provisionUserOnSignup',
            updatedBy: 'cloud-function:provisionUserOnSignup',
        };
        await db.collection(types_1.COLLECTION_NAMES.POLICIES).doc(policyId).set(policyData);
        functions.logger.info(`Created default policy ${policyId} for user ${uid}`, { policyNumber });
        // Silently register the user with Damoov for telematics data collection.
        // createDamoovUser already never throws (returns null on failure), but the
        // call is wrapped anyway so a future change to that contract can't
        // silently turn a Damoov outage into a failed provisioning.
        if (email) {
            try {
                const deviceToken = await (0, damoov_1.createDamoovUser)(uid, email);
                if (deviceToken) {
                    await db.collection(types_1.COLLECTION_NAMES.USERS).doc(uid).update({ damoovDeviceToken: deviceToken });
                    functions.logger.info(`Stored Damoov deviceToken for user ${uid}`);
                }
            }
            catch (error) {
                functions.logger.error(`Damoov registration failed for user ${uid} (non-fatal)`, error);
            }
        }
    }
    catch (error) {
        functions.logger.error(`Error provisioning user ${uid}:`, error);
        // Don't throw - Auth onCreate triggers are not auto-retried by the
        // platform, so failing loudly here would just surface a spurious error
        // with no retry benefit. Matches onUserCreate's posture.
    }
}
/**
 * DORMANT - not exported from functions/src/index.ts, not part of the
 * deployed functions set. M1 T7 wires this in at cutover.
 */
exports.provisionUserOnSignup = functions
    .region(region_1.EUROPE_LONDON)
    .runWith({ secrets: ['DAMOOV_INSTANCE_ID', 'DAMOOV_INSTANCE_KEY'] })
    .auth.user()
    .onCreate((0, sentry_1.wrapTrigger)(provisionUser));
//# sourceMappingURL=provisionUserOnSignup.js.map