# Driiva Foundation Harness — Progress Log

## 2026-06-13 — Phase 0 (Ground Truth)
- Located canonical repo: `~/Documents/DriivaMVP` (remote `mrshippers/Driiva`). `~/Documents/Driiva` is an assets/docs folder (ignore). Branch `feat/marketing-site-v1`, tree clean (1 untracked `.claude/`).
- Established stack from CLAUDE.md + manifests (see findings.md).
- Ran deterministic checks: tsc, node-pinning, env-tracking, gitignore, CI workflows, entrypoints, eslint.
  - **tsc --noEmit FAILS** at `tsconfig.json:16` (TS5101 baseUrl deprecated under TS6.0.2) → P0-1. CI typecheck red, zero real type coverage until fixed.
  - No root eslint config / lint script. `.env` not tracked (good). engines only in `functions/`.
- Fanned out 4 read-only sweeps: client surface, mobile surface, backend+Root+DB, deps+CI. All returned.
- Verified load-bearing claims: `@upstash` "phantom dep" = FALSE POSITIVE (comment-only). Severity-corrected.
- Wrote `findings.md` register (1×P0, 10×P1, 6×P2, 3×P3) + surface inventory + target recommendation (`client/` web SPA).
- **STOPPED at GATE 0.** Awaiting: (a) target-surface confirmation, (b) eradication-order approval.

### Errors encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `timeout: command not found` (macOS) | 1 | Dropped `timeout`; ran `npx tsc` direct |
| tsc exit 2 but 0 `error TS` matches | 1 | Read full log → single TS5101 config error (baseUrl), not a code error |
| deps sweep flagged `@upstash` as HIGH phantom | 1 | Verified: comment-only refs → false positive, downgraded to note |

## GATE 0 decision (user)
- Target = **Both, web first then mobile** (Phase 3 hardens+ships web client on wired backend, then mobile).
- Eradication order = **approved** as proposed.
- Cadence: ultracode ON (user). Stacked fix branches (tsconfig is a prerequisite for tsc), one class each, pushed for merge. Workflows used within units for exhaustive find+adversarial-verify, never to auto-merge.

## Phase 1 — branch log
- [x] **Branch 1 `fix/config-tsc-baseurl` (P0-1)** — removed deprecated `baseUrl` from tsconfig.json. tsc --noEmit now exits 0, **0 errors** (no hidden type errors). Prod build green (client + dist/index.js). Commit `10ecce3`, pushed. **Vercel preview READY**: driiva-git-fix-config-tsc-baseurl-mrshippers.vercel.app. Awaiting merge.
- [x] **Branch 2a `fix/ci-lint-gate` (P1-10 part 1)** — eslint flat config (eslint 10 + typescript-eslint + react-hooks), scoped to client/server/shared/api, real-bug rules=error / hygiene=warn → **0 errors, 218 warnings**. Added `lint` script. Fixed 6 genuine errors (prefer-const x3, no-case braces, error-chaining `cause` x2). tsc clean, build green. **Pushed** (off fix/config-tsc-baseurl). Awaiting merge + preview.
- [~] **Branch 2b `fix/ci-workflows` (P1-10 part 2)** — ci.yml lint step + secret-safety repair (gcloud→schedule-only, grep→value-patterns). Committed locally. **BLOCKED on push: token lacks `workflow` scope.** Needs user: `gh auth refresh -h github.com -s workflow` (then I push). Does NOT block other branches.
- [ ] **Branch 3 `fix/toolchain-pinning` (P2-5/P2-4)** — in_progress: root engines + .nvmrc (off fix/ci-lint-gate to stay pushable).

## BLOCKER (needs user, non-fatal)
`workflow` scope to push `.github/workflows/*`. Command: `! gh auth refresh -h github.com -s workflow`. Until then, fix/ci-workflows stays local; CI won't run the new lint step or the secret-safety fix, but the lint infra + `npm run lint` are in place.

## Next
Branch 3 (toolchain) → 4 (dead-code, verified deletes) → 5 (entrypoint drift) → Phase 2 foundation. Push fix/ci-workflows once scope granted.

---

# REBUILD MISSION — session log

## 2026-07-02 — Phase 0 + Phase 1 kickoff (overnight)
- Mission reframe: ground-up rebuild prep; current codebase = behavioural spec. task_plan.md rewritten for the new mission (old Foundation-Harness plan superseded; its findings retained as inputs).
- Phase 0 done: market-ready bar extracted from docs/TECH_ROADMAP.md (+ ROADMAP.md tickets + CLAUDE.md/CONTEXT.md constraints) into findings.md §0.2; 11 under-specification gaps listed in §0.3 for Jamal sign-off (claims/GAP undefined, launch surface undecided, device matrix missing, FCA-via-Root unconfirmed, pool money handling unspecced, etc.).
- Noted: repo main tip 81d7117 (P0 criticals merged). Local uncommitted edits to ROADMAP.md/DRIIVA_CHANGELOG.md/docs/TECH_ROADMAP.md are NOT mine — leaving untouched.
- Kicked off baseline `npm test` (background) + Phase 1a audit fan-out (Sonnet subagents: web flows, API contracts, auth paths, data shapes, functions, mobile, third-party edges).
- **P1-11 FIXED (test-infra only):** vitest.config.ts was missing `@vitejs/plugin-react` (tsconfig `jsx:preserve` left JSX untransformed under rolldown). One-line fix → **21/21 test files pass, 338 tests + 2 todo** (was 16 files/248 tests + 5 parse-fail). 90 previously-dead tests all pass against current behaviour.
- **Playwright harness LIVE:** playwright.config.ts (webServer = `PORT=4310 npm run dev:staging`, mobile-chrome + desktop-chrome projects) + e2e/smoke.spec.ts → 4/4 pass against the real dev server on staging Firebase env. Auth seam identified: scripts/create-firebase-test-users.ts creates emailVerified users (needs Admin creds).
- Verified mobile = Expo SDK 54 (`~54.0.33`), NOT 52 as docs/brief say.
- **API contract characterisation suite GREEN: 43/43** (server/__tests__/api-contract.characterisation.test.ts) — real Express app + middleware, service boundaries mocked, quirks pinned. Two DEAD-ON-ARRIVAL discoveries pinned as tests + findings §0.4: (1) POST /api/trips can never succeed over HTTP JSON (z.date() vs JSON strings, swallowed to generic 500) — 409/encryption/atomic branches unreachable; (2) token-valid-but-no-Neon-row users 401 everywhere — profile auto-provision unreachable, onboarding PATCH gate cannot pass for fresh users via this API.
- **Rate-limit characterisation GREEN: 1/1** (rate-limit.characterisation.test.ts) — authLimiter 10/min: 10×400 then 429, real in-memory store (the documented no-Upstash fallback).
- audit-api report saved verbatim → docs/rebuild/audit-api-contracts.md. iOS sim build running. Maestro CLI installed.
- **Phase 1a COMPLETE**: all 7 audit reports delivered + persisted verbatim to docs/rebuild/ (api, auth, web, data, functions, mobile, edges). Critical distillation → findings.md §0.5 (14 items; headline: firestore.rules merge conflict on main VERIFIED; no evidence functions ever deployed to prod; scoring double-fire; dead Toaster; dashboard refund ×100; fabricated FCA reg number in PolicyDownload).
- **Pricing engine suite 18/18** (calendar-repricing quirk + single-letter postcode over-match discovered and pinned). **Trip service suite 12/12** (streamer batching, endTrip rule-lock contract, scoring weights).
- **Dev-server killer found + fixed (harness-enabling, dev-only)**: server/vite.ts customLogger process.exit(1) fired on any forwarded browser console.error — reproducibly killed by demo /policy's Firestore permission-denied. Exit removed with explanatory comment; prod (Vercel) never loads this file.
- **E2E COMPLETE for the unauthenticated + demo surface: 25 tests × 2 viewports, 49 green + 1 skipped-with-unblock-condition.** Demo checkout cross-validates the pricing suite (£1,210 / score 82 → 4% off). Staging reality pinned: Email/Password provider NOT enabled on driiva-staging (auth/configuration-not-found leaks raw to UI) — blocks authenticated-flow E2E; walker test parked with explicit unskip condition.
- **Maestro: 6 flows authored, blocked** — iOS unbuildable from source on this toolchain (gRPC/Xcode 26; retry produced a hollow .app), ios/ not git-tracked, no eas.json, no Firebase native config. All documented in mobile/.maestro/README.md.
- **Unit total: 412 passed + 2 todo (from 248 at session start).** Coverage report + manual-verify list (17 items) + needs-input list (3 items) → findings.md §1c.
- Errors log: create-firebase-test-users.ts needs Admin creds (absent from .env.staging) → seeding on needs-input list. First Playwright mass-failure = parallel workers vs dev-server cold transforms (fixed: workers 1, 60s timeout); second = the vite.ts process.exit (fixed).
