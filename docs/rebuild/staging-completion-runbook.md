# Staging completion runbook

Rebuild mission, M0. This document is a human-executed runbook, not automation.
Nothing in it has been run by an agent: enabling an auth provider, upgrading a
billing plan, and seeding real staging data all require Firebase console access
and staging admin credentials that no agent session holds, and deploy isolation
forbids an agent from running any command here even if it did.

## Why this exists

The `driiva-staging` Firebase project is incomplete. Two concrete symptoms:

- `e2e/signup-onboarding.spec.ts:17` pins the current reality: signup shows the
  raw Firebase error `auth/configuration-not-found` because the Email/Password
  sign-in provider is disabled on `driiva-staging`.
- `e2e/signup-onboarding.spec.ts:39` is a `test.skip`'d walker that drives the
  full signup, 12-step onboarding, and completion flow. It is parked until the
  provider above is enabled.

Completing the steps below unblocks that walker and, more generally, any
authenticated E2E run against staging.

## Prerequisites, who must do what

Everything in this section needs a human with console access or credentials.
No agent can supply these.

| Item | Needs input from | Used in |
| --- | --- | --- |
| Firebase console access to `driiva-staging`, Owner or Editor role | a human with Firebase project access | Step A, Step B |
| Billing details to attach to `driiva-staging` (Blaze is pay-as-you-go) | a human with billing authority on the GCP billing account | Step B |
| `FIREBASE_TOKEN` (output of `firebase login:ci`), or an interactive `firebase login` session | a human who can complete the Firebase CLI OAuth flow | Step C |
| A service account key (or `GOOGLE_APPLICATION_CREDENTIALS` path) for the `driiva-staging` project, or a `FIREBASE_SERVICE_ACCOUNT_KEY` JSON string for that same project | a human with access to the `driiva-staging` GCP project's IAM / service accounts page | Step D |

Do not proceed past Step A until the person doing this has confirmed they are
looking at `driiva-staging` in the Firebase console, not `driiva` (production).
The two projects sit side by side in the console project switcher and look
identical apart from the name.

## Step A: enable the Email/Password sign-in provider

This is the single change that removes the `auth/configuration-not-found` wall.

1. Open the [Firebase console](https://console.firebase.google.com/) and select
   the **driiva-staging** project (confirm the name in the console header before
   continuing).
2. Go to **Authentication → Sign-in method**.
3. Select **Email/Password** in the provider list and enable it (the basic
   Email/Password toggle; email link sign-in is not required).
4. Save.

Verification: reload `/signup` against staging (see Verification section) and
confirm the form no longer errors with `auth/configuration-not-found`.

## Step B: upgrade driiva-staging to the Blaze plan

Cloud Functions cannot be deployed on the free Spark plan. Both
`.github/workflows/ci.yml` and `.github/workflows/deploy-staging.yml` already
carry a comment noting this: if Blaze is not enabled yet, their Firebase deploy
step falls back to `--only firestore:rules,firestore:indexes` and skips
functions.

1. In the Firebase console, with **driiva-staging** selected, go to the gear
   icon → **Usage and billing → Details & settings**.
2. Choose **Modify plan** and select **Blaze (Pay as you go)**.
3. Attach a billing account when prompted.

Verification: the console no longer shows a Spark-plan upgrade prompt, and
`driiva-staging` appears with an active billing account under
**Usage and billing**.

## Step C: deploy rules, indexes, and functions to staging

Read `.firebaserc` before running anything:

```json
{
  "projects": {
    "default": "driiva",
    "staging": "driiva-staging"
  }
}
```

`default` is **production**. A bare `firebase deploy` with no `--project` flag
targets `driiva`, not staging. Every command below carries `--project staging`
for exactly this reason. Never drop that flag, and never run a bare
`firebase deploy` in this repository.

Prerequisites for this step: Step B (Blaze) must be complete, and you need a
`FIREBASE_TOKEN` (`firebase login:ci` on a machine with a browser, or an
interactive `firebase login` if running locally).

```bash
npx firebase deploy \
  --only firestore:rules,firestore:indexes,functions \
  --project staging \
  --non-interactive
```

This is the same command the `deploy-staging` and `ci` GitHub Actions workflows
run (`.github/workflows/deploy-staging.yml`, `.github/workflows/ci.yml`), so
running it locally reproduces exactly what CI would do against staging. Set
`FIREBASE_TOKEN` in the environment before running it, for example:

```bash
FIREBASE_TOKEN=<token from firebase login:ci> npx firebase deploy \
  --only firestore:rules,firestore:indexes,functions \
  --project staging \
  --non-interactive
```

If Blaze has not been upgraded yet, drop `functions` from `--only` so you can
still ship rules and indexes:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes --project staging --non-interactive
```

Verification: the CLI output lists `firestore: rules file firestore.rules
compiled successfully`, `firestore: indexes deployed`, and (once Blaze is on)
each function name against `driiva-staging`. Cross-check in the console:
**Firestore → Rules** shows a recent update timestamp, and **Functions** lists
each function as deployed under the `driiva-staging` project, not `driiva`.

## Step D: seed test users

The seed script already exists: `scripts/create-firebase-test-users.ts`, wired
to `npm run create-firebase-test-users` in `package.json`.

It creates five fixed test accounts via the Firebase Admin SDK: Firebase Auth
users plus matching Firestore documents (`users/{uid}`, `usernames/{username}`,
`policies/{uid}-policy`), each with an active `comprehensive_plus` policy so
they land past onboarding-gated screens. Accounts (all `@driiva.co.uk`,
password `TestPass123!`):

- `steelphoenix7@driiva.co.uk` (Steel Phoenix)
- `crimsonshadow99@driiva.co.uk` (Crimson Shadow)
- `novablade42@driiva.co.uk` (Nova Blade)
- `frostviper11@driiva.co.uk` (Frost Viper)
- `stormbreaker5@driiva.co.uk` (Storm Breaker)

The script authenticates via `firebase-admin/app`, using whichever of these is
set: `GOOGLE_APPLICATION_CREDENTIALS` (a path to a service account JSON key) or
`FIREBASE_SERVICE_ACCOUNT_KEY` (the same JSON, inlined as a string). It has no
`--project` flag of its own: the target project is entirely determined by
which project the service account key belongs to. Before running it, confirm
the key you are pointing at is a `driiva-staging` service account, not a
`driiva` (production) one.

The script also does `import "dotenv/config"`, which loads the plain `.env`
file in the repo root, not `.env.staging`, and dotenv does not overwrite a
variable already present in the shell environment. So the safe pattern is to
export the staging credential in the shell first, rather than trusting whatever
`.env` happens to contain:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/driiva-staging-service-account.json
npm run create-firebase-test-users
```

Equivalently, invoke `tsx` directly with `.env.staging` if the credential is
stored there instead of exported:

```bash
npx tsx --env-file=.env.staging scripts/create-firebase-test-users.ts
```

The script is idempotent: rerunning it against accounts that already exist
logs `Skipped (already exists)` and still prints the credential block instead
of failing.

Verification: the script's own console output lists all five accounts under
`--- TEST ACCOUNT CREDENTIALS ---`. Cross-check in the console:
**Authentication → Users** on `driiva-staging` shows the five
`@driiva.co.uk` accounts, and **Firestore → users** has a matching document for
each UID.

## Step E: unblock the E2E

Only do this after Step A (Email/Password provider enabled) is verified.

1. Open `e2e/signup-onboarding.spec.ts`.
2. Remove the `test.skip` at line 39 (currently
   `test.skip('signup lands on /quick-onboarding before any Firestore write
   confirms; onboarding walks to Confirm; completion outcome pinned', ...)`),
   turning it into a normal `test(...)`.
3. The first test in the file, at line 17 (`'STAGING REALITY: email/password
   signup is impossible...'`), asserts the `auth/configuration-not-found` wall
   exists. Once Step A is live that wall is gone and this test will start
   failing on its own assertion. It needs inverting or removing at that point;
   this runbook does not do that edit, a human makes that call once staging is
   confirmed to behave the new way.

Run the E2E against staging. `playwright.config.ts` already points at
`.env.staging` for you: its `webServer` entry runs
`PORT=4310 npm run dev:staging`, and `baseURL` is `http://localhost:4310`, so no
extra env flags are needed on the Playwright invocation itself.

```bash
npx playwright test e2e/signup-onboarding.spec.ts
```

Verification: the previously `.skip`'d walker runs (not skipped), reaches the
Confirm step, and the test's own assertions resolve one of the two pinned
outcomes (`patchStatus === 200` and `completed === true`, or `patchStatus ===
401` and `completed === false`, per the `§0.4` dead-on-arrival probe already
described in the spec file's comments). Either outcome is a pass; a timeout or
an unhandled error is not.

## Verification checklist

Run through in order; each step should be independently confirmable before
moving to the next.

1. After Step A: `/signup` on staging no longer shows
   `auth/configuration-not-found`; a real signup attempt proceeds to
   `/quick-onboarding`.
2. After Step B: `driiva-staging` shows an active Blaze billing account in the
   console, with no Spark upgrade prompt.
3. After Step C: `npx firebase deploy ... --project staging` output confirms
   rules, indexes, and functions all deployed; the console's Rules tab and
   Functions list both show the update against `driiva-staging`.
4. After Step D: the seed script prints all five test accounts; each appears
   under **Authentication → Users** and has a matching `users/{uid}` Firestore
   document on `driiva-staging`.
5. After Step E: `npx playwright test e2e/signup-onboarding.spec.ts` runs the
   unskipped walker to completion and it resolves one of the two pinned
   outcomes.

## Safety and rollback

- Deploy isolation: every Firebase CLI command in this runbook must carry
  `--project staging`. If a command is ever run without it, it targets
  `driiva` (production) by default per `.firebaserc`. Stop and double check the
  `--project` flag before running any `firebase deploy` or `firebase` command
  that mutates state.
- Credential isolation: the seed script (Step D) has no project flag at all;
  its blast radius is controlled purely by which service account key you feed
  it. Treat a `driiva` (production) service account key as radioactive in this
  context, never export it while running this script.
- Nothing in this runbook is destructive to production. Enabling a provider,
  upgrading a billing plan, deploying rules or functions, and seeding users are
  all scoped to `driiva-staging` when the `--project staging` flag and
  staging-scoped credentials are used correctly.
- Rollback:
  - Step A: disable the Email/Password provider again in
    **Authentication → Sign-in method** if you need to re-park the wall.
  - Step B: Blaze can be downgraded back to Spark from the same
    **Usage and billing** page, once any deployed Cloud Functions are deleted
    (Spark does not support Cloud Functions).
  - Step C: redeploy the previous `firestore.rules` / `firestore.indexes.json`
    revision from git history with the same `--project staging` command to
    revert a bad rules or indexes push. Functions can be rolled back per
    function from the Firebase console's Functions tab (previous version
    history) or by redeploying an earlier commit.
  - Step D: seeded test users can be deleted individually from
    **Authentication → Users** on `driiva-staging`; their Firestore documents
    (`users/{uid}`, `usernames/{username}`, `policies/{uid}-policy`) should be
    deleted alongside them to avoid orphaned records.
  - Step E: re-add `test.skip` at the walker if staging regresses and the wall
    needs to be re-pinned as current reality.
