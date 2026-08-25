# M5 Grounding Brief - Compliance & ops

Written 26 Aug 2026 against `main` @ `30f4fd5`. Supersedes the M5 scope paragraph
in `rebuild_plan.md:113-118`, which was written in July and is stale in three
places (noted inline below).

This brief lives in `docs/rebuild/` rather than `.superpowers/sdd/` on purpose.
M0-M4 kept their grounding in `.superpowers/sdd/`, which is gitignored, and the
M4 pair was deleted by the skill's cleanup step - so the record of *why* M4 was
scoped the way it was is gone and only the diff survives. The nightly job also
hard-resets this checkout to `origin/main` at 01:30, which destroys gitignored
scratch. Compliance is the module most likely to be picked up cold months later
by someone who needs the reasoning, so it gets a tracked file.

Every claim below was read from source on the date above. Where the July plan
said something that is no longer true, that is called out rather than quietly
corrected.

---

## 1. GDPR erasure and export - two implementations, neither complete

There are two separate erasure/export paths and they do not know about each
other.

**Path A - Firestore + Auth (this is the one the UI calls).**
`functions/src/http/gdpr.ts:43-141` (`exportUserData`) and `:147-240`
(`deleteUserAccount`). Between them they cover `users`, `trips`, `tripPoints`
(including the `batches` subcollection), `tripSegments`, `policies`,
`poolShares`, `driver_stats`, then `auth.deleteUser(userId)` at `:228`.
Reachable: `client/src/components/DeleteAccount.tsx:56` and
`ExportDataButton.tsx:33`, both rendered on `/profile`
(`client/src/pages/profile.tsx:713,715`) behind `<ProtectedRoute>`.

**Path B - Postgres (secured, and dead).** `server/routes.ts:552-560` (export)
and `:566-573` (delete) into `server/storage.ts:403-427`, deleting `users`,
`drivingProfiles`, `trips`, `userAchievements`, `incidents`, `leaderboard`.
Properly guarded by `requireAuth` + `requireResourceOwner` + `gdprDeleteLimiter`.
**No client, mobile or app code calls it.** It is reachable only by hand or from
`server/__tests__/api-contract.characterisation.test.ts:412,420`.

**Consequence, stated plainly:** a user who deletes their account today has their
Firestore documents and their Firebase Auth identity removed, and their Postgres
rows survive indefinitely. Nothing is sent to Stripe, Root or Damoov - grep of
`functions/src/http/gdpr.ts` for all three returns nothing. `RootHttpAdapter`
does have a `cancel()` method (`functions/src/http/rootAdapter.ts:267-272`) but
it has no call sites anywhere; M4 shipped it as forward-looking scaffolding and
recorded it as such.

**The July plan is stale on one detail.** It claimed the Postgres delete's "only
trigger is an orphaned component hardcoded to userId 2". There is no such
component and no `userId: 2` literal anywhere in the repo - the old
`DataExport.tsx` was deleted as dead code in `f748d7c` and `DeleteAccount.tsx`
was rewired to the Firestore callable in `b895c8b`. The real defect is simpler
and worse to describe accurately: the Postgres route has no caller at all.

**D8 is the decision this sits on.** `rebuild_plan.md:34` proposes "erasure
propagates to all stores + Stripe/Root/Damoov", with the fallback being current
behaviour. It is still unconfirmed. Note that Root and Damoov have no credentials
in any Doppler config (CLAUDE.md, Known Blockers 8), so their erasure calls
cannot be executed against a real endpoint in this module regardless of what D8
says - they can only be built behind the adapter seam and proven with a mock.
That is a scope boundary, not a reason to skip them.

## 2. Audit logging - two structured stores, zero readers

**`policy_audit_log`** (Postgres, added by M4) is real and well-formed:
`shared/schema.ts:145-151`, migration `migrations/0002_kind_thanos.sql`. Every
write funnels through `server/lib/policyLifecycle.ts:81-132` transactionally with
the status change. A reader exists - `server/storage.ts:532-536`
`getPolicyAuditLog` - but **no route calls it**, so the trail is written and
never read. No retention or purge job exists.

**`systemLogs`** (Firestore) has exactly one writer,
`functions/src/scheduled/damoovSync.ts:226-243`, and it only records Damoov sync
diagnostics. Its two readers (`client/src/pages/admin/system.tsx:56`,
`admin/index.tsx:202`) use the client SDK and are **provably broken**:
`firestore.rules:486-491` denies client reads of that collection
unconditionally, and the repo's own passing test
`tests/rules/deny-by-design-and-catchall.test.ts:32-53` asserts that denial holds
even for a caller carrying an admin claim. Separately, the writer uses `.add()`
(random document id) while `admin/index.tsx:202` reads a document literally named
`'latest'`, which is never written - so even if the rules allowed it, that read
would return nothing.

There is no third audit surface. "Structured audit logging" in the July scope is
therefore not a refactor of something ad-hoc; it is mostly new construction plus
giving the M4 trail a way out.

## 3. Admin - four disagreeing sources of truth, one enforced route

This is the largest gap in M5 and the July scope understates it.

Every admin data read in the web app goes through the Firebase client SDK
directly - `client/src/pages/admin/{index,users,system,feedback,monitoring}.tsx`,
all `getDocs`/`onSnapshot` against `db`. Server-side, `requireAdmin` gates
**exactly one route in the entire application**: `PUT /api/community-pool`
(`server/routes.ts:460`).

Four separate mechanisms decide who is an admin, and they do not agree:

1. `server/middleware/auth.ts:117-137` - env allowlist `ADMIN_FIREBASE_UIDS`.
   Gates the one Express route.
2. `functions/src/http/auth.ts:68-75` - checks the Firebase custom claim `admin`.
   Gates `functions/src/http/admin.ts:33` and `classifier.ts:373`. **Verified:
   `setCustomUserClaims` is never called anywhere in the repo**, so no user can
   ever hold that claim and both callables are unreachable by everyone.
3. `client/src/contexts/AuthContext.tsx:50-53` - `VITE_ADMIN_EMAILS`, a
   build-time public env var visible in devtools.
4. `functions/src/triggers/provisionUserOnSignup.ts:30-86` - a different
   `ADMIN_EMAILS` var, writing `isAdmin: true` onto the user document at signup,
   read back at `AuthContext.tsx:61-64` and gating `AdminRoute`
   (`client/src/App.tsx:57-98`). This is a **UI-only** gate with no server
   enforcement behind it.

**`firestore.rules` has no concept of an admin at all** - `grep -c isAdmin
firestore.rules` returns 0. Only `isAuthenticated()` and `isOwner(userId)` exist.
So the admin panel is simultaneously under-secured (mechanism 4 is a client-side
boolean) and non-functional (the rules deny the collections it wants to read).

## 4. Error surfacing and monitoring - two of four surfaces done

**Toaster: the July finding is stale, it was fixed.** `client/src/App.tsx:295`
renders `<Toaster />` in the root tree with a comment explaining the original
bug, and `client/src/__tests__/toaster-mounted.test.tsx` locks it with both a
render assertion and a source-regex assertion.

**Sentry is initialised on web** (`client/src/lib/sentry.ts:33` from
`main.tsx:10`) **and functions** (`functions/src/lib/sentry.ts:32-35`, wired into
roughly fifteen handlers via `wrapFunction`/`wrapTrigger`). It is **not
initialised on the Express server or on mobile** - neither has any `@sentry/*`
dependency at all.

Commit `b6fe697` (26 Aug) is worth reading before touching this: web Sentry had
been initialised and shipping for months, but the app's own CSP `connect-src`
never allow-listed a Sentry ingest host, so every envelope POST was blocked by
the browser and the SDK swallowed the transport error. It looked like "no errors"
rather than "monitoring is broken". Fixed at
`server/middleware/security.ts:109,115` and pinned by three tests in
`server/__tests__/security-headers.test.ts`. That closes the web half of the July
"monitoring surfaces nothing" finding. The server and mobile halves are open.

This is the shape M5 should expect throughout: an instrument that reports clean
because it never arrived.

## 5. Cookie consent and retention - four numbers, and a test that pins the
contradiction

**No cookie banner exists, and that is a deliberate documented position**:
`apps/marketing/src/routes/Cookies.tsx:6-18` states analytics is cookieless
(`@vercel/analytics`) and so needs no consent under UK PECR. That claim is about
a third party's runtime behaviour and cannot be verified from this repo; M5
should either evidence it or stop relying on it.

**Retention has four different numbers in flight:**

| Figure | Where | Data category |
|---|---|---|
| 12 months rolling | `client/src/pages/privacy.tsx:139` | raw telemetry |
| 7 years | `client/src/pages/privacy.tsx:278-281` | trip / driving / claims |
| 90 days rolling | `client/src/pages/trust.tsx:263`, `onboarding/steps/StepDataConsent.tsx:82-83` | raw GPS |
| 24 / 36 months | `apps/marketing/src/routes/Privacy.tsx:64-67` | waitlist / analytics |

The 12-month and 90-day figures describe the same data and contradict each other.
`e2e/public-pages.spec.ts:40-45` is a test **named**
`'QUIRK: privacy says 12-month raw telemetry retention while trust says 90 days -
both pinned'` which asserts both render. That is correct characterisation
behaviour and it must be flipped, not deleted, when M5 picks one value - the same
trap the premium lift hit when Maestro specs were pinning false-success states.

**No purge or TTL job exists anywhere**, so whichever number is chosen is
currently a claim about behaviour the system does not have. Publishing a
retention period you do not enforce is the compliance-equivalent of the
fabricated-number class this repo already has a gate for.

## 6. Rate limiting / trust proxy - fixed, untested

The `findings.md:91` HIGH finding is **closed**. `server/app.ts:12` sets
`app.set('trust proxy', 1)` with a comment naming this bug class; it landed in
`611717d`. Residual: no test drives `X-Forwarded-For` to prove two client IPs get
two buckets, so a revert would not be caught -
`server/__tests__/rate-limit.characterisation.test.ts` only pins the 429
threshold. Cheap to close, worth closing inside M5 since the limiter is what
protects the erasure endpoint.

## 7. Consent timestamps - web fixed, mobile absent

**Web is stale-fixed.** `dataConsentTimestamp` is stamped once in
`persistDataConsent` (`client/src/pages/quick-onboarding.tsx:191`, step 2), the
completion handler deliberately does not re-stamp (`:286-287`), and the call is
awaited with failure blocking progression
(`onboarding/steps/StepDataConsent.tsx:29-38`).

**Mobile has no consent capture at all.** Zero hits for `dataConsentTimestamp` or
`persistDataConsent` under `mobile/`, and no consent step in
`mobile/app/onboarding/*`. This is worse than the drift the original finding
described: mobile users' consent moment is never recorded. Given mobile is now
the canonical surface and a TestFlight build is in testers' hands, this belongs
in M5 rather than being deferred to M7.

The only test touching the web flow,
`client/src/__tests__/quick-onboarding-flow.test.tsx:64`, **mocks
`StepDataConsent` out entirely**, so none of the persistence or error handling is
actually exercised.

## 8. A live regulatory claim outside the fabrication gate

`apps/marketing/index.html:95` carries JSON-LD FAQ text reading:

> "Application in progress with the FCA Regulatory Sandbox, underwritten by a
> PRA-regulated UK reinsurer."

This is materially stronger than the line every other surface was normalised to
("working towards the FCA regulatory sandbox, not authorised, not under an MGA"),
it is present tense, and it names an underwriting relationship. It is served to
crawlers as structured data and is mirrored into `apps/marketing/dist/`.

`tests/fabrication-laws.mjs` would flag it on sight - but it scans a `DIRS` list
of eight directories (`fabrication-laws.mjs:69-73`) which includes
`apps/marketing/src`, `api` and `public`, and **not the package root**, where
`index.html` sits. Commit `e21f652` ("finish the FCA reconciliation, and fix the
guard that let it revert", 26 Aug) hardened that gate by 172 lines and did not
touch this file - so the reconciliation is not actually finished, and the gate
that is supposed to prevent regression cannot see the surviving instance.

Other confirmed blind spots in the same gate: `mobile/lib`, `hooks`, `contexts`
(only `app` and `components` are scanned), the legacy `marketing-site/` and
`driiva-design-system/` trees, and any non-text channel.

This is the highest-severity item in the module and the cheapest to fix.

## 9. Test surface and where the holes are

Commands: `npx vitest run` (89 files, 1113 passed, 3 todo, verified green on
`b6fe697`), `npm run test:rules` (Firestore emulator), `npm run test:integration`
(Auth + Firestore emulators).

Covered today: Firestore GDPR logic (`functions/src/__tests__/http/gdpr.test.ts`),
`requireAdmin` as a unit (`server/__tests__/auth-middleware.test.ts:168-193`),
admin-collection denial (two rules test files), `policy_audit_log` writes,
Toaster mount, Sentry CSP headers, rate-limit threshold.

Zero coverage: consent persistence (explicitly mocked away), any retention or
purge behaviour (none exists), admin pages executed against real rules, the
`policy_audit_log` read path (no endpoint to test), trust-proxy correctness, and
third-party erasure propagation.

## 10. Carry-forwards from earlier modules that land in M5

- `createPolicyWithAudit` (policy *creation*, as distinct from the now
  transactional `transitionPolicy`) still performs two non-transactional writes -
  logged as a watch-item at the end of M4 and never closed. Same class as the bug
  M4 did fix.
- Migration `0003` (unique constraint on `policies.stripe_subscription_id`) has
  never been applied anywhere and needs a duplicate check first.
- `RootAdapter.cancel()` is dead code with no call sites. M5's erasure work is
  the first thing that would legitimately call it.

## 11. The integration test M5 must add

`rebuild_plan.md:117` already specifies its shape and it is a good spec: an
erasure request leaves **all** stores empty, issues the third-party deletion
calls (mocked), and writes an audit record. Two additions from this grounding:
the test must assert on *arrival* - that each store was actually reached - and
report not-reached as a failure, per the five harnesses in this repo's history
that passed without arriving. And it must cover the Postgres store specifically,
since that is the one that silently survives today.

---

Related: `rebuild_plan.md:113-118` (original scope), `docs/rebuild/audit-auth-paths.md:45`
(independent record of the admin split-brain), `docs/rebuild/audit-web-flows.md:59`
(independent record of the retention contradiction), `findings.md:204,227`.
