# M1 T7 - Provisioning cutover

Rebuild mission, M1 (Identity & Onboarding), Task 7. Authoring + emulator-testing
only. No prod or staging deploy was performed as part of this task - see
`.superpowers/sdd/briefs/m1-task-7-brief.md`.

## What flipped

Before this cutover, three independent writers touched `users/{uid}` (see
`.superpowers/sdd/m1-grounding.md` §2). After this cutover there is one:

| Path | Before | After |
| --- | --- | --- |
| Auth `onCreate` deploy target | `onUserCreate` (`functions/src/triggers/users.ts`) - a **Firestore-doc** `onCreate` trigger, so it never fired for Google sign-in | `provisionUserOnSignup` (`functions/src/triggers/provisionUserOnSignup.ts`) - a real Firebase Auth `onCreate` trigger, fires for every signup method |
| Client Firestore write on signup | `client/src/pages/signup.tsx` fire-and-forget `writeBatch`: `users/{uid}` + `usernames/{localPart}`, including the dead `onboardingCompleted` (`-ed`) field | removed - the trigger owns both docs; the client only does `updateProfile` + `sendEmailVerification` |
| Neon mirror | `syncUserOnSignup` | unchanged (DEC-3: kept as the D2-analytics enrichment mirror, not a gate) |

`functions/src/index.ts` now exports `provisionUserOnSignup` in place of
`onUserCreate`. `functions/src/triggers/users.ts` was deleted (nothing else
imported it - confirmed by grep before deletion); its logic was already
ported into `functions/src/utils/provisionUser.ts` / `provisionUserOnSignup.ts`
at T1.

## The must-fix: idempotency guard

`provisionUser` now checks for an existing `policies/{...}` doc for the uid
(the same signal `onUserCreate` used) before writing anything, and returns
early if one exists. Auth `onCreate` triggers are delivered at-least-once,
not exactly-once; without this guard a re-run/duplicate delivery would mint
a second policy, drift the shared `counters/policy` counter, and - because
the handler writes `users/{uid}` with `.set()`, not a merge - clobber any
state the user had legitimately accrued since first provisioning
(`onboardingComplete`, driving score, etc). Tested in
`functions/src/__tests__/triggers/provisionUserOnSignup.test.ts`.

## Known, accepted behaviour change

`displayName` is no longer guaranteed to be the name the user typed at
signup. Previously, `onUserCreate` read `fullName` from the same Firestore
doc the client's batch wrote atomically alongside it, so the typed name
always landed. Now, `provisionUser` (an Auth trigger, dispatched off account
creation) only sees the Auth profile's `displayName` at the moment it fires,
or falls back to the email local part - the client's `updateProfile(user,
{ displayName: formData.fullName })` call is a separate, unawaited,
racing async call. This was already flagged by the whole-branch review
(`.superpowers/sdd/progress.md`, M1-T7 must-include item 2, "note fullName
no-longer-written as intentional") and is not fixed here; it is inherent to
using an Auth trigger for provisioning and was accepted at T1's review gate.

## Username derivation - checked, matches

Both the retired client batch and `provisionUser` derive the username the
same way: the email local part, lower-cased
(`email.split('@')[0].toLowerCase()`). Confirmed at
`client/src/pages/signup.tsx` (the advisory collision check, still live) and
`functions/src/triggers/provisionUserOnSignup.ts:114`. Signup does not let
the user choose a separate username, so there is no design gap here.

## Deploy command (when this ships - separate explicit OK required)

```bash
# Staging first, once FIREBASE_TOKEN / Blaze plan is in place:
firebase deploy --only functions:provisionUserOnSignup,functions:syncUserOnSignup --project staging

# Full functions deploy (after staging verification):
firebase deploy --only functions --project staging
```

`.firebaserc`'s default project is `driiva` (prod) - `firebase deploy` with no
`--project` flag targets prod. Never run a bare `firebase deploy` for this
change.

## Rollback

If `provisionUserOnSignup` misbehaves in staging/prod after a future deploy:

1. `git revert <this cutover commit>` - restores `onUserCreate`
   (`functions/src/triggers/users.ts`), the client's `writeBatch`
   (`client/src/pages/signup.tsx`), and the old `functions/src/index.ts`
   exports byte-for-byte, since nothing downstream of the retired files was
   touched by this task.
2. Redeploy: `firebase deploy --only functions:onUserCreate --project staging`
   (or prod, matching whichever environment needs the rollback), and remove
   `provisionUserOnSignup` from the active deploy the same way.
3. No data migration is needed either direction: both paths write the same
   `UserDocumentSchema`-shaped doc, and the idempotency guards on both sides
   (policy-existence check) mean re-running either path against an
   already-provisioned user is a no-op.

The rollback's correctness rests on the pre-cutover state having already
been emulator-verified: T6 (commit `943199c`, the base this task built on)
ran green on all three suites with `onUserCreate` and the client batch live
and untouched. Reverting this commit restores exactly that state.
