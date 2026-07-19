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

## The displayName fix

`onUserCreate` read `fullName` from the same Firestore doc the client's
batch wrote atomically alongside it, so the typed full name always landed
on `displayName`. `provisionUser` (an Auth trigger, dispatched off account
creation) only sees the Auth profile's `displayName` at the moment it
fires - and for the only signup path that matters (email/password), the
trigger reliably fires BEFORE the client's un-awaited `updateProfile(user,
{ displayName: formData.fullName })` call lands (`signup.tsx`). The first
version of this cutover derived a fallback from the email local part in
that case (`deriveDisplayName`), which is worse than it sounds: it doesn't
degrade gracefully, it permanently writes the WRONG name into Firestore -
"Jamal Driver" becomes "jamal" and stays "jamal" until the user hand-edits
their profile, because every reader (`dashboard.tsx:270`,
`useDashboardData.ts:211`, `profile.tsx:197,451`) reads the Firestore
`displayName` with priority over the correct Auth-profile name.

Fixed: `deriveDisplayName` now writes `null` instead of deriving a
fallback when the Auth record has no displayName yet (`@driiva/contracts`'
`UserDocumentSchema.displayName` is now `.nullable()` to allow it). Every
reader's fallback chain (`dashboardData?.displayName || user?.name ||
'Driver'`) then skips the null and resolves to `user?.name`, which
`AuthContext.tsx` sources from the Firebase Auth profile's `displayName` -
correct as soon as `updateProfile` lands, which for the same client
session is near-immediate. Google-style signups, where the Auth record
already carries a real `displayName` at account-creation time, are
unaffected and still get their name written straight through.

## Username derivation - checked, matches

Both the retired client batch and `provisionUser` derive the username the
same way: the email local part, lower-cased
(`email.split('@')[0].toLowerCase()`). Confirmed at
`client/src/pages/signup.tsx` (the advisory collision check, still live) and
`functions/src/triggers/provisionUserOnSignup.ts:114`. Signup does not let
the user choose a separate username, so there is no design gap here.

## Build-pipeline fix (found while regenerating the committed `functions/lib/`)

The review flagged that the committed `functions/lib/` was stale (still exported
`onUserCreate`). Regenerating it with a plain `npm run build` surfaced a real,
pre-existing bug: `functions/tsconfig.json` path-mapped `@driiva/contracts` to
the package's raw `../packages/contracts/src/index.ts`, not its compiled
`dist/index.d.ts` (unlike `packages/scoring/tsconfig.json`, which already does
this correctly). Since T1 added a `@driiva/contracts` import into
`functions/src/utils/provisionUser.ts`, this made `tsc`'s computed `rootDir`
span the whole monorepo, and a real build silently emitted into
`functions/lib/functions/src/*` and `functions/lib/packages/contracts/src/*`
instead of the flat `functions/lib/*` that `package.json`'s `"main":
"lib/index.js"` and Firebase's deploy expect - a working but wrong artifact,
not a build failure, so CI's `functions-build` job (which only checks exit
code) never caught it.

Fixed: `functions/tsconfig.json` now path-maps to `../packages/contracts/dist/index.d.ts`
and sets `rootDir: "src"` explicitly, mirroring `packages/scoring`'s already-
correct pattern. Because this makes `functions`'s own build depend on
`@driiva/contracts` being built first, `functions/package.json`'s `prebuild`
script now builds it (`npm run build --prefix ../packages/contracts`) before
copying the shared trip/refund files, so `npm run build` inside `functions/`
- exactly what Firebase's `predeploy` hook runs - is self-contained from a
clean checkout. `.github/workflows/ci.yml`'s `functions-build` job was
updated the same way (root install + `npm run build --prefix
packages/contracts` before the functions-scoped install/build/test), so this
can't silently regress again. Verified: a full `rm -rf functions/lib
packages/contracts/dist && npm run build` (inside `functions/`) now produces
a flat `lib/` whose `index.js` exports `provisionUserOnSignup` and
`syncUserOnSignup` and not `onUserCreate`, confirmed by actually `require()`-
ing it, not just a clean `tsc` exit code.

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
