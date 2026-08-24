/**
 * PROVISION USER - pure builder
 * ==============================
 * Builds the complete `users/{uid}` document for the unified Auth-triggered
 * provisioning path (M1 strangler seam, see .superpowers/sdd/m1-grounding.md
 * §2/§8). Ported from the driving-profile/activePolicy/poolShare/settings
 * defaults in `functions/src/triggers/users.ts` (`onUserCreate`, ~L138-181),
 * plus the base identity fields from `client/src/pages/signup.tsx`'s
 * fire-and-forget batch.
 *
 * PURE: takes already-resolved inputs (uid, email, timestamps, policy id/
 * number) and returns a plain object - no Firestore reads/writes, no
 * network calls, no wall-clock reads. The async side-effects (writing the
 * doc, creating the policy doc, the Damoov registration) live in the
 * `provisionUser` handler (`functions/src/triggers/provisionUserOnSignup.ts`),
 * which calls this builder and supplies the resolved inputs.
 */
import type { UserDocument, FirestoreTimestampLike } from '@driiva/contracts';
export interface BuildProvisionedUserDocInput {
    uid: string;
    email: string;
    /** Firebase Auth `displayName`, when the provider sets one (e.g. Google). */
    displayName?: string | null;
    /** True when `email` is in the ADMIN_EMAILS allowlist. */
    isAdmin?: boolean;
    now: FirestoreTimestampLike;
}
/**
 * A provisioned user document plus the `isAdmin` flag. `isAdmin` is written
 * onto the real document (matching `onUserCreate`'s auto-promotion) but
 * `@driiva/contracts`' `UserDocumentSchema` doesn't declare the field today,
 * so it is typed here alongside the shared contract rather than
 * hand-widening it.
 */
export type ProvisionedUserDocument = UserDocument & {
    isAdmin?: boolean;
};
export declare function buildProvisionedUserDoc(input: BuildProvisionedUserDocInput): ProvisionedUserDocument;
//# sourceMappingURL=provisionUser.d.ts.map