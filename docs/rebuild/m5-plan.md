# M5 Plan - Compliance & ops

Companion to `docs/rebuild/m5-grounding.md`, which holds the evidence for every
current-state claim made here. Read that first. Written 26 Aug 2026 against
`main` @ `30f4fd5`.

Execution model is the one M0-M4 used: `superpowers:subagent-driven-development`
- one fresh implementer per task, a task review after each, a fix loop, then one
whole-branch review on the most capable model before merge.

Branch: `rebuild/m5-compliance` off `main`. Work in a worktree
(`wt new m5-compliance`) - the shared checkout is contested and the nightly job
hard-resets it to `origin/main` at 01:30.

---

## Global constraints

These bind every task. A reviewer should treat a violation as a defect even if
the task text does not repeat it.

1. **Never publish a compliance figure the system does not enforce.** A retention
   period in user-facing copy must correspond to code that actually deletes. If
   the enforcement is not built yet, the copy says what is true today.
2. **Assert on arrival before asserting on content.** Every test added here
   reports three states - clean, failing, not reached - and not-reached fails the
   run. This repo has five recorded instances of a harness that passed because it
   never got to the thing it was checking.
3. **One configured value, one reader.** Where a number exists in more than one
   place (retention especially), M5 ends with a single source and every surface
   reading it. Fixing the display without fixing the source is the failure mode
   this project has already hit four times with the waitlist count.
4. **No new admin surface that is enforced only on the client.** Server or rules,
   or it does not ship.
5. **Characterisation tests that pin a defect get flipped, not deleted**, and the
   flip is called out in the commit message.
6. Repo voice: UK spelling, no em dashes, sentence case.
7. Root and Damoov have **no credentials in any Doppler config**. Anything
   touching them is built behind the adapter seam and proven with a mock. Do not
   invent a sandbox.

## Decision this module is gated on

**D8 - GDPR erasure scope.** `rebuild_plan.md:34` proposes erasure propagating to
all stores plus Stripe, Root and Damoov; the fallback is today's Firestore-plus-
Auth behaviour. **Unconfirmed as of 26 Aug.**

This does **not** block starting. Tasks 1, 2, 3, 5, 6 and 7 are independent of
D8. Task 4 is the only one that needs it, and it is structured so the seam gets
built either way - what D8 decides is whether the third-party calls are wired
live or left as a disclosed no-op. Start the module; ask Jamal for D8 in
parallel.

The question to put to him, concretely: *when a user deletes their Driiva
account, should we also tell Stripe to delete their customer record, and issue
deletion requests to Root and Damoov?* The legal default for a UK controller is
yes for processors. The practical constraint is that Root and Damoov have no
credentials, so "yes" means "built and mocked now, wired when creds exist".

---

## Task 1 - Close the surviving FCA claim and the gate blind spot

**Why first:** it is a live public misstatement, it is the cheapest fix in the
module, and the gate that exists to prevent exactly this cannot currently see it.
Everything else in M5 is internal plumbing; this one is on the open web.

- Correct `apps/marketing/index.html:95` to the sanctioned line used everywhere
  else ("working towards the FCA regulatory sandbox, not authorised, not
  operating under an MGA"). Drop the "underwritten by a PRA-regulated UK
  reinsurer" assertion unless Jamal can name the reinsurer and the agreement - if
  he can, it still does not belong in a present-tense FAQ answer while the
  sandbox application is pending.
- Extend `tests/fabrication-laws.mjs` `DIRS` (`:69-73`) so the gate reaches
  `apps/marketing` package-root HTML, `mobile/lib`, `mobile/hooks`,
  `mobile/contexts`. Add `.html` to the scanned extensions if it is not already
  effective there.
- Verify the extension is not vacuous: run the gate against the **pre-fix**
  `index.html` content and watch it go red, then fix and watch it go green.
  Report both halves. A gate written this session does not vouch for itself on
  its first green.
- Check whether `apps/marketing/dist/` is committed; if it is, the built copy
  needs the same treatment or the gate needs to ignore build output explicitly.

**Done when:** the claim is gone from source and any committed build output; the
gate scans the file; the gate has been shown to fail on the old string.

**Model:** cheap. This is transcription plus a scan-scope edit.

## Task 2 - One retention value, enforced

**Depends on:** a product decision from Jamal on the number itself (see below).
It is a smaller question than D8 and can be answered in a sentence.

- Introduce a single configured retention value for raw telematics (GPS points /
  `tripPoints` batches) in `shared/`, and have every surface read it: privacy
  page, trust page, mobile consent copy, and the purge job below. The four
  figures currently in flight are catalogued in the grounding brief §5.
- Distinguish the categories honestly. Raw GPS, derived trip records, and
  waitlist/analytics data can legitimately have different periods; the bug is
  that two different numbers describe the *same* category.
- Build the purge that makes the number true: a scheduled function deleting
  `tripPoints` batches past the retention window. Without it the number is a
  claim, not a behaviour.
- Flip `e2e/public-pages.spec.ts:40-45` from pinning the contradiction to
  asserting the single value. Name the flip in the commit message.

**The question for Jamal:** *how long do we keep raw GPS?* 90 days is the
defensible answer for a telematics scorer - the score is derived and retained,
the raw trace is not needed after scoring settles. 12 months is harder to justify
under data minimisation and is the number the privacy page currently prints.

**Done when:** one value, read everywhere, enforced by a job with a test that
proves old data is actually removed and that the job ran.

**Model:** standard. Multi-surface with a scheduled function.

## Task 3 - Give the audit trail a reader, and a second writer

- Add a server endpoint exposing `policy_audit_log` via the existing
  `getPolicyAuditLog` (`server/storage.ts:532-536`), behind the real admin gate
  from Task 5. Today the trail is written transactionally and can never be read,
  which is not an audit trail.
- Extend audit writes beyond policy transitions to the events an FCA-facing
  posture actually needs: erasure requests, export requests, consent captured and
  withdrawn, admin actions. One table, one writer helper, typed event names - not
  a second parallel mechanism.
- Decide and implement the retention of the audit log itself, and record the
  reasoning. Audit records generally outlive the data they describe; that is a
  legitimate lawful-basis distinction and it should be written down, not
  discovered later.
- Leave `systemLogs` alone in this task other than noting it. It has one narrow
  writer and its readers are dead; Task 5 decides whether it becomes a real
  collection or is retired.

**Done when:** an admin can read the trail through a server-enforced endpoint,
and the erasure flow in Task 4 writes to it.

**Model:** standard.

## Task 4 - Erasure that actually erases (D8)

This is the module's centrepiece and the integration test `rebuild_plan.md:117`
already specifies.

- Make one erasure entry point that spans both current implementations. Today
  Path A (Firestore + Auth) and Path B (Postgres) do not know about each other
  and only Path A is reachable - grounding brief §1.
- Delete from Postgres as part of the same request. This is the concrete user-
  visible bug: accounts "deleted" today leave their Postgres rows behind
  indefinitely.
- Build the third-party propagation behind the adapter seam: Stripe customer
  deletion, `RootAdapter.cancel()` (its first legitimate caller), Damoov deletion.
  Per D8 these are wired live where credentials exist (Stripe) and mocked with a
  disclosed, logged no-op where they do not (Root, Damoov). A no-op must be
  visible in the audit record, never silent.
- Erasure is not atomic across five systems. Decide the failure posture
  explicitly: partial failure must leave a record and a retry path, and must not
  report success to the user. The "charged, no cover" bug M4 fixed is the same
  shape - a downstream write failing while an upstream store already declared
  done.
- Write the audit record from Task 3.
- Same treatment for export: one call returns everything, including Postgres.

**Done when:** the integration test passes - erasure request leaves every store
empty, issues the third-party calls (mocked), writes an audit record, and the
test fails loudly if any store was never reached.

**Model:** most capable. Multi-store coordination with a partial-failure design
question inside it.

## Task 5 - One admin identity, enforced server-side

The grounding brief §3 has the full picture: four disagreeing sources, one
enforced route, `setCustomUserClaims` never called, and no admin concept in
`firestore.rules`.

- Pick one mechanism. The Firebase custom claim is the right one - it is the only
  one that both the rules and the server can read, and it is the one the
  functions already expect. It needs a way to actually be set, which is the piece
  that has never existed.
- Build the claim-setting path: an admin-only callable or a script, seeded from a
  server-side allowlist, writing the claim. Then retire the other three
  mechanisms by deleting them, not by documenting them as deprecated.
  `VITE_ADMIN_EMAILS` in particular is a public build-time variable and must go.
- Teach `firestore.rules` about admin, and put the admin collections behind it
  rather than behind a blanket deny.
- Move admin page reads onto server endpoints, or onto rules that genuinely
  permit an admin - either is defensible, but the current state where the UI
  gate passes and the data read fails is not.
- Flip `tests/rules/deny-by-design-and-catchall.test.ts:32-53`, which currently
  pins the denial as correct behaviour.
- Decide `systemLogs`' fate here: real collection with an admin read rule, or
  retired along with its two broken readers. It has one narrow writer; retiring
  it is defensible. If it stays, fix the `.add()` versus `'latest'` mismatch.

**Done when:** exactly one admin mechanism exists in the codebase, a real user
can hold it, the rules enforce it, and no admin surface depends on a client-side
boolean.

**Model:** most capable. This is a security boundary and a deletion pass across
four subsystems.

## Task 6 - Consent capture on mobile, and a test on web

- Add consent capture to the mobile onboarding flow, writing the same
  `dataConsentTimestamp` the web flow writes, awaited, with failure blocking
  progression. Mobile currently records nothing - grounding brief §7 - and it is
  the canonical surface with builds in testers' hands.
- Own the step order through `mobile/lib/onboardingFlow.ts`, which is already the
  single owner of step order, rather than adding a screen out of band.
- Write the test the web flow never got:
  `client/src/__tests__/quick-onboarding-flow.test.tsx:64` mocks
  `StepDataConsent` out entirely, so the real persistence and error handling are
  unexercised on both platforms.
- Add consent captured / withdrawn to the audit events from Task 3.

**Done when:** both platforms record a consent moment, both are covered by a test
that exercises the real persistence path, and failure to persist blocks
onboarding on both.

**Model:** standard.

## Task 7 - Close the monitoring gaps and the trust-proxy test

Small, independent, batchable into one dispatch.

- Initialise Sentry on the Express server and on mobile. Both currently have no
  `@sentry/*` dependency at all; web and functions are done.
- Before claiming any Sentry surface works, prove an event arrives. Commit
  `b6fe697` is the cautionary tale: web Sentry was initialised and shipping for
  months while the app's own CSP silently blocked every envelope, and it read as
  "no errors" rather than "monitoring broken".
- Add the `X-Forwarded-For` test proving `trust proxy` gives distinct clients
  distinct rate-limit buckets. The fix landed in `611717d` and is untested, so a
  revert would pass CI - and the limiter is what protects the erasure endpoint
  Task 4 builds.
- Close the M4 carry-forward: make `createPolicyWithAudit` transactional, the
  same fix `transitionPolicy` already got.

**Done when:** four surfaces have Sentry with at least one surface proven by a
real delivered event, and the two tests exist.

**Model:** standard, batched as one dispatch.

---

## Sequencing

Task 1 first and alone - it is public and it is fast. Then 5 before 3 and 4, since
both need the real admin gate to put an endpoint behind. Then 2, 6 and 7 in any
order. Task 4 last of the substantive work, because it consumes the audit writer
from 3 and the admin gate from 5, and because D8 has the most time to arrive.

```
1 → 5 → 3 → 4
      ↘ 2, 6, 7 (independent once 1 is in)
```

## What M5 does not cover

- DPIA refresh and the Damoov Article 28 DPA verification
  (`rebuild_plan.md:137` assigns both to M5). These are documents and a
  counterparty conversation, not code. They belong on Jamal's list, and the
  module should surface them rather than silently drop them.
- DPO appointment and processing records (`findings.md:181`). Same category.
- Cookie consent banner. The current position is that analytics is cookieless and
  needs no consent under PECR. M5 should either evidence that claim against
  `@vercel/analytics`' actual runtime behaviour or change the position - but
  building a banner for a site that sets no cookies would be theatre.
- Anything requiring Root or Damoov credentials to execute for real.

## Risks

- **Task 5 is a deletion pass on a security boundary.** Removing three admin
  mechanisms while adding one is exactly the shape that locks everyone out. The
  claim-setting path must work and be verified against a real user before the
  old mechanisms are deleted, not after.
- **Task 4's partial-failure design is the real work**, not the deletes. The easy
  version - delete everything, hope - recreates the M4 money-in/no-cover bug in a
  compliance context, where the failure is unrecoverable because the data is
  already gone.
- **Task 2 will surface that the retention number was never enforced anywhere.**
  Expect the honest interim to be a copy change plus a job, and expect the job to
  find more historical data than anyone assumes.
- **D8 not arriving.** Mitigated by structuring Task 4 so the seam is built
  regardless, but if D8 stays open past Task 4 the module ships with third-party
  propagation mocked and disclosed rather than live.
