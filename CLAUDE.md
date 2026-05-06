# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

Driiva Ltd is a telematics insurtech app targeting young UK drivers.
Core proposition: telematics-driven cashback premiums, postcode penalty reduction, fraud mitigation.
Sharia-compliant angle — targets young drivers and Muslim communities.
Solo founder build. Pre-raise. Demo-prep phase with Keith Cheng.

**Current priorities:**
- Keith Cheng demo prep
- Firebase auth delay fix (~27s signup — critical blocker)
- CI pipeline stabilisation
- PWA conversion consideration
- Q2–Q3 2026 raise (angels + seed, insurtech OR Muslim/ethical finance)
- Waitlist growth (1,000 signups = raise accelerant)

**The raise story:**
- 30,000 policies = ~£18M gross premium (£600 avg)
- £60M conservative valuation at 3-4x GWP multiple
- One broker/MGA letter of intent = investor gold
- Channel distribution over volume marketing post-raise

---

## Repository Layout

This is a **monorepo with three deploy targets** sharing one root `package.json`:

- **`client/`** — React 18 + Vite SPA (alias `@/*`). Entry `client/index.html` → `client/src/main.tsx` → `App.tsx`. Routing via Wouter. Pages in `client/src/pages/`, design components in `client/src/components/`, Firebase SDK init + Firestore helpers in `client/src/lib/`.
- **`server/`** — Express API (TypeScript, ESM via `tsx` in dev, esbuild bundle in prod). `server/index.ts` is the dev entry; `server/app.ts` is the bundled handler that Vercel imports through `api/index.ts`. Routes registered in `server/routes.ts`; security/rate-limit middleware in `server/middleware/`; business logic (telematics, scoring, AI insights, refund maths, Stripe) in `server/lib/`.
- **`functions/`** — Firebase Cloud Functions (Node 20, **own `package.json` and `tsconfig`**). Triggers in `functions/src/triggers/`, scheduled jobs in `functions/src/scheduled/`, HTTP callables in `functions/src/http/`. `functions/src/index.ts` is the only public entry — read its top comment block for the canonical list of exported triggers/jobs.
- **`shared/`** — Cross-runtime TypeScript (alias `@shared/*`). **Canonical source for trip metric maths** (`tripProcessor.ts`) and refund maths (`refundCalculator.ts`). Drizzle/Postgres schema in `schema.ts`. **Cloud Functions cannot import from `shared/` at runtime** — `functions/package.json` has a `prebuild` script that copies `shared/tripProcessor.ts` and `shared/refundCalculator.ts` into `functions/src/shared/`. Edit only the originals; the copy is regenerated.
- **`mobile/`** — Expo / React Native app (own `package.json`). Tokens at `mobile/components/ui/theme.ts` are the **source of truth for the mobile/instrument design system**. See `mobile/DESIGN_SYSTEM.md`.
- **`api/`** — Vercel serverless wrapper. `api/index.ts` dynamically imports the bundled `api/_server.js` (produced by the build) and forwards requests. The build command in `vercel.json` produces this bundle.
- **`functions-python/`** (referenced by ARCHITECTURE.md) — Python Stop-Go-Classifier; called over HTTP from `functions/src/http/classifier.ts` via `CLASSIFIER_URL`.
- **`migrations/`** — Drizzle SQL migrations. Generated from `shared/schema.ts`, applied to Neon Postgres.
- **`marketing-site/`** — Static `index.html` mirror of the live Framer site (live site has no write API). Treat as the editorial source; manually mirror into Framer.
- **`design-system/`** — Brand tokens (colours, type, gradient stops, logo assets). Authoritative for marketing-mode visuals.
- **`scripts/`** — Ops helpers (Doppler audit/clean, DB verify, Stripe webhook listen, load test, Firebase test users, admin grant, etc.).

Vite path aliases (`vite.config.ts`, `tsconfig.json`): `@/*` → `client/src/*`, `@shared/*` → `shared/*`, `@assets/*` → `attached_assets/*`.

---

## Common Commands

All from repo root unless noted.

**Develop:**
- `npm run dev` — Express + Vite dev server on `PORT` (default 3001). Vite middleware serves the client.
- `npm run dev:staging` — same, but loads `.env.staging`.

**Build / typecheck:**
- `npm run check` — `tsc --noEmit` across `client/`, `server/`, `shared/`, `api/` (root `tsconfig.json`).
- `npm run build` — Vite build of client → `dist/public`, then esbuild bundle of `server/index.ts` → `dist/`.
- `npm run build:staging` — same, with `--mode staging` for Vite env loading.
- `npm start` — runs the production build (`node dist/index.js`).

**Test (Vitest, jsdom):**
- `npm test` — runs all tests in `client/src/**/*.test.{ts,tsx}`, `server/**/*.test.ts`, `functions/src/**/*.test.ts`, `shared/**/*.test.ts` (one test is excluded; see `vitest.config.ts`).
- `npm run test:watch` / `npm run test:coverage`.
- Single file: `npx vitest run path/to/file.test.ts`. Single name: `npx vitest run -t "test name substring"`.
- Coverage thresholds in `vitest.config.ts` are intentionally low (lines 4, branches 7) — do not raise them in unrelated PRs.

**Cloud Functions** (run inside `functions/`):
- `npm run build` — runs `prebuild` (copies `shared/tripProcessor.ts` + `shared/refundCalculator.ts` into `functions/src/shared/`) then `tsc`. **Always run from `functions/`, never copy these files manually.**
- `npm run serve` — Firebase emulators (functions on 5001, firestore on 8080, auth on 9099, UI on 4000; see `firebase.json`).
- `npm test` — Vitest for functions only.
- `npm run deploy` — `firebase deploy --only functions` (CI usually does this; do not deploy from a dev box without explicit approval).

**Database (Drizzle / Neon Postgres):**
- `npm run db:push` — push `shared/schema.ts` to the DB at `DATABASE_URL`.
- `npm run db:schema` — runs `scripts/run-schema.ts`.
- `npm run verify:db` — sanity check connection + table presence.

**Other scripts of note:** `npm run create-firebase-test-users`, `npm run load-test`, `npm run test:root-api`, `npm run test:auth`, `scripts/audit-doppler-pollution.sh`, `scripts/clean-doppler-pollution.sh`.

**Mobile:** `cd mobile && npm start` (Expo). EAS build via `npm run build:ios|android`.

---

## Architecture Essentials

Read `ARCHITECTURE.md` for the full data model and scoring spec; the points below are the parts you can't infer from a single file.

### Two backends, one frontend

Driiva ships **both** an Express API (Vercel) and Firebase Cloud Functions, and they overlap on purpose:

- **Express (`server/`) on Vercel** — the SPA's REST API. Handles auth gating, profile, trip submission, Stripe webhooks, GDPR endpoints. All routes mount under `/api/*` (`vercel.json` rewrites). Auth is **always derived from the Firebase ID token**, never from request headers — see `verifyFirebaseAuth` in `server/middleware/auth.ts` and the doc-comment at the top of `server/routes.ts`.
- **Firebase Cloud Functions (`functions/`)** — Firestore triggers and scheduled jobs. The trip lifecycle, pool finalisation, leaderboard rebuilds, AI analysis, and Damoov sync run here. See the JSDoc block at the top of `functions/src/index.ts` for the canonical list.

When adding a feature, decide which side owns it: synchronous request/response from the SPA → Express; reactive-on-write or scheduled → Functions. Don't duplicate business logic across both — extract into `shared/` (and remember the `prebuild` copy step for Functions).

### Storage split

- **Firestore** is the runtime store for trips, GPS points, pool shares, leaderboard, user profiles. Rules in `firestore.rules` enforce that aggregated/computed collections (`driver_stats`, `communityPool`, `leaderboard`, `poolShares`, `tripSegments`) are **read-only for clients** — only Cloud Functions (Admin SDK) write them.
- **Neon Postgres** (via Drizzle ORM, `shared/schema.ts`) is used by the Express server for user accounts, Stripe linkage, and structured records that benefit from SQL. Both stores coexist; do not assume one is canonical for a given entity without checking.

### Trip → score → refund pipeline (canonical)

1. Client batches GPS points and writes to `tripPoints/{tripId}` (Firestore). Long trips spill into `tripPoints/{tripId}/batches/{i}`.
2. `onTripStatusChange` (Functions) runs when a trip moves `recording → processing`; calls `computeTripMetrics()` and `detectDrivingEvents()` from `functions/src/utils/helpers.ts`.
3. The Python Stop-Go-Classifier filters non-driving segments (walking, dwelling) — invoked over HTTP from `functions/src/http/classifier.ts`.
4. `computeDrivingScore()` produces a deterministic 0–100 score with weights **Speed 25 / Braking 25 / Acceleration 20 / Cornering 20 / Phone 10**. Phone is hard-coded to 100 until phone-pickup detection lands.
5. `updateDriverProfileAndPoolShare()` writes the user's profile and the matching `poolShares/{period_userId}` doc.
6. Refund maths (`shared/refundCalculator.ts` and `server/lib/telematics.ts::calculateRefund`): 80% personal + 20% community weighted score; 5% rate at 70 → 15% rate at 100, scaled by pool safety factor, capped at `premium × 15%`.

**Hard rules** (enforced by tests; do not break without a written ADR):
- Distance in **metres**, duration in **seconds**, money in **integer cents**. Timestamps ISO 8601.
- `shared/tripProcessor.ts` is the **single source of truth** for trip metrics — Cloud Functions, Express, and offline tools all derive from it. Changes need unit tests in `shared/__tests__/`.
- Scoring is **deterministic and historic-write-once**: same inputs produce the same score, and stored scores are not silently rewritten.
- Sensitive/financial documents must include `createdBy` / `updatedBy` audit fields.

### Express request pipeline

`server/app.ts` wires, in order: `securityHeaders` → CORS allowlist (`CORS_ORIGINS` env, comma-separated) → `apiLimiter` → `sanitizeInput` → **raw-body** parsers for `/api/webhooks/stripe` and `/api/webhooks/root` (must come before `express.json()` for signature verification) → `express.json({ limit: '5mb' })` for `/api/trips`, `1mb` elsewhere. Routes are registered async via `registerRoutes(app)` and the resulting `ready` promise gates startup. The Vercel handler awaits it before forwarding the first request.

### Auth

Firebase Auth client-side. Server verifies the Firebase ID token via Admin SDK (`server/middleware/auth.ts`). **Identity comes from the token only** — never trust user IDs from headers, query strings, or bodies. Resource-scoped routes additionally use `requireResourceOwner` so user A cannot access user B's data. `requireAdmin` checks a custom claim. WebAuthn/passkey backend lives at `server/webauthn.ts` (UI pending).

### Frontend

- React 18 + TypeScript + Vite. Routing: **Wouter** (not React Router). State: **TanStack Query** for server state, React Context for auth/feature flags.
- Styling: Tailwind 4 + shadcn/Radix primitives (`components.json`). Glassmorphism utilities in `client/src/styles/glass.css`.
- Animation: Framer Motion variants centralised in `client/src/lib/animations.ts` — prefer reusing variants over inline ad-hoc animations. Respect `prefers-reduced-motion`.
- Maps: Leaflet + React-Leaflet (OpenStreetMap), no API key.
- Performance traces and Sentry init in `client/src/lib/performanceTraces.ts` and `client/src/lib/sentry.ts`.

---

## Stack Reference

- **Frontend:** React 18 / TypeScript / Vite (Wouter, TanStack Query, Tailwind 4, Radix, Framer Motion, Leaflet)
- **Backend:** Express on Vercel (`server/`) + Firebase Cloud Functions Node 20 (`functions/`)
- **Auth:** Firebase Auth (known issue: ~27s signup delay — fix before demo). WebAuthn/Passkeys backend complete, UI pending.
- **Database:** Firebase Firestore (runtime) + Neon Postgres (relational) via Drizzle ORM
- **Payments:** Stripe (deps installed, webhook handler exists, full flows pending)
- **Insurance Platform:** Root Insurance Platform API (scaffolded, credentials pending)
- **AI:** Anthropic Claude Sonnet 4 for trip analysis (feature-flagged, not on critical path)
- **Classifier:** Python Stop-Go-Classifier called over HTTP from TS Functions
- **Mobile:** Expo / React Native (separate workspace)
- **Deploy:** Vercel (web + API) + Firebase (Firestore rules/indexes + Functions) + Cloudflare DNS

---

## Skill Router

The `skill-router` skill governs all dispatch in this project. On every task, check the skill
registry below and load the appropriate SKILL.md before responding. Never answer from general
knowledge when a purpose-built skill exists.

## Skill Registry

### Core Dispatch
| Skill | Trigger |
|---|---|
| `skill-router` | Boot sequence — runs first on every message |
| `founder-ops` | Prioritisation, sprint planning, "what next", feeling stuck |
| `planning-with-files` | Multi-step projects, >5 tool calls, complex builds |
| `dispatching-parallel-agents` | 2+ independent parallelisable tasks |

### Build & Ship
| Skill | Trigger |
|---|---|
| `stack-ship` | Deploy, Vercel, Firebase, Cloudflare DNS, Stripe, CI/CD, auth |
| `systematic-debugging` | Bugs, errors, broken flows — especially auth delay and CI failures |
| `test-driven-development` | Any new feature or bugfix — before writing code |
| `test-fixing` | Failing tests, make tests pass |
| `project-bootstrapper` | New project setup, scaffold, init |
| `plan-implementer` | Implementing from a spec or plan |
| `feature-planning` | Breaking down features into tasks |

### Agent Orchestration (Ruflo)
| Skill | Trigger |
|---|---|
| `sparc-methodology` | Complex reasoning tasks, structured problem solving |
| `flow-nexus-neural` | Neural agent coordination |
| `flow-nexus-platform` | Platform-level agent orchestration |
| `flow-nexus-swarm` | Swarm-mode multi-agent execution |
| `swarm-advanced` | Advanced parallel agent workflows |
| `swarm-orchestration` | Coordinating multiple agents on one task |
| `stream-chain` | Chained agent pipelines |
| `pair-programming` | Structured pair-programming mode |
| `verification-quality` | Automated output quality checking |

### Memory & Reasoning (Ruflo)
| Skill | Trigger |
|---|---|
| `v3-memory-unification` | Cross-session memory, persistent context |
| `reasoningbank-agentdb` | Agent knowledge base, persistent agent memory |
| `reasoningbank-intelligence` | Intelligence layer for reasoning tasks |
| `agentdb-advanced` | Advanced agent database operations |
| `agentdb-learning` | Agent learning patterns |
| `agentdb-memory-patterns` | Memory pattern management |
| `agentdb-optimization` | Agent performance optimisation |
| `agentdb-vector-search` | Vector search across agent knowledge |

### Architecture & Code Quality (Ruflo v3)
| Skill | Trigger |
|---|---|
| `v3-core-implementation` | Core feature implementation, clean architecture |
| `v3-ddd-architecture` | Domain-driven design — use for Root API integration layer |
| `v3-cli-modernization` | CLI tooling |
| `v3-integration-deep` | Deep integration work — Root Platform API, telematics data |
| `v3-mcp-optimization` | MCP server optimisation |
| `v3-performance-optimization` | Performance profiling — auth speed, onboarding latency |
| `v3-security-overhaul` | Security audit — critical for insurtech regulatory compliance |
| `v3-swarm-coordination` | Swarm coordination at architecture level |

### GitHub & DevOps (Ruflo)
| Skill | Trigger |
|---|---|
| `github-code-review` | PR code review |
| `github-multi-repo` | Multi-repo operations |
| `github-project-management` | GitHub Projects, issues, milestones |
| `github-release-management` | Release tagging, changelogs |
| `github-workflow-automation` | GitHub Actions, CI/CD automation — fix pipeline failures |
| `hooks-automation` | Git hooks, pre-commit, pre-push |
| `monitoring` | Monitoring setup, alerting — critical for demo readiness |

### GTM & Investor Relations
| Skill | Trigger |
|---|---|
| `gtm-engine` | Investor outreach, broker emails, waitlist copy, pitch materials |
| `qa-gate` | Any output with Driiva metrics, projections, policy numbers |
| `humanizer` | Long-form copy, investor emails, public-facing text |
| `internal-comms` | Internal docs, briefings, demo prep notes |

### Frontend & Design
| Skill | Trigger |
|---|---|
| `frontend-design` | UI components, onboarding flow, PWA shell, glassmorphism system |
| `web-artifacts-builder` | Complex multi-component artifacts |
| `canvas-design` | Marketing assets, pitch deck visuals |
| `dashboard-creator` | Telematics data dashboards, KPI views, investor metrics |

### Documents & Files
| Skill | Trigger |
|---|---|
| `docx` | Word documents, reports, investment memos |
| `pdf` | PDF creation — pitch deck export, term sheets |
| `pdf-reading` | Reading/extracting from PDFs |
| `pptx` | Investor pitch deck |
| `xlsx` | Financial models, policy projections, cap table |
| `file-reading` | Any uploaded file not yet in context |

### Research & Intelligence
| Skill | Trigger |
|---|---|
| `last30days` | Insurtech trends, telematics regulation, competitor moves |
| `conversation-analyzer` | Analysing Claude Code conversation patterns |
| `code-auditor` | Codebase health, tech debt, security — pre-demo audit |
| `ensemble-orchestrator` | Architecture decisions, multiple approaches |
| `ensemble-solving` | Parallel solution generation |

### Specialist
| Skill | Trigger |
|---|---|
| `mcp-builder` | Building MCP servers — Root API, telematics data pipeline |
| `skill-creator` | Creating or editing skills |
| `prompt-engineer` | System prompt design, AI feature prompting |
| `schedule` | Demo scheduling, raise timeline planning |
| `sonnet-opus-prompt` | Model-specific prompting strategies |

---

## Design System (canonical)

- **Location:** `design-system/` at repo root for marketing tokens; `mobile/components/ui/theme.ts` for instrument-mode tokens. Web tokens are duplicated as CSS custom properties in `client/src/index.css` and Tailwind utilities in `tailwind.config.ts` — there is no token-transform pipeline, so changes must be mirrored. See `.figma/design-system-rules.md` and `mobile/DESIGN_SYSTEM.md`.
- **Tokens:** ink ladder `#050509→#222238`, brand gradient (amber `#d4850a` → burnt `#a04c2a` → violet `#6b3fa0` → indigo `#3b2d8b`), iris accent `#6366f1`, score-tier green/teal/amber/red at 80/70/50/<50.
- **Two visual modes — never mix:**
  - **Marketing mode** (driiva.co.uk) — glassmorphism, `rgba(30,41,59,0.60)` + `blur(20px) saturate(180%)`, animated gradient halos, pill CTAs.
  - **Instrument mode** (mobile + client SPA) — solid dark surfaces `#12111f` on `#0a0a14`, single accent `#5b4dc9`, 16px radius, tabular figures, 270° arc gauges. No glass except hero.
- **Type:** Inter Tight (display), Inter (UI), JetBrains Mono (eyebrows/tags). Sentence case everywhere. Headlines end in full stops. UK spelling. No emoji, no exclamation marks.
- **Voice:** Plain-English confident. Em dashes liberally. Contractions in microcopy. Forbidden: "revolutionary", "game-changing", "your journey starts here", anything that sounds like a fintech TV ad.
- **Motion:** `--spring: cubic-bezier(0.34, 1.56, 0.64, 1)` for hover/press, `--ease-fast: cubic-bezier(0.22, 1, 0.36, 1)` for reveals. Respect `prefers-reduced-motion`.
- **Icons:** Lucide inline SVG, 24×24, `stroke-width 2`, `currentColor`. Never emoji.
- **Logos:** `design-system/assets/logo-wordmark-gradient.png` (primary), `logo-wordmark-white-v3.png` (dark backgrounds), `logo-ii-mark.png` (iconmark/favicon).

## Secrets (canonical)

**Doppler is the single source of truth for secrets across all products** (driiva, strydeos, …). Workspace: "Driiva Stryde". Do NOT set secrets directly in Vercel / Firebase / GitHub Actions — set them in Doppler, let integrations sync downstream.

- **Project:** `driiva` — Configs: `dev`, `dev_personal`, `stg`, `prd`.
- **Downstream sinks:** Vercel (via Doppler integration), Firebase Functions (via `doppler secrets download --no-file --format json` at deploy), GitHub Actions (via Doppler service token).
- **Adding/rotating a secret:** set in Doppler prd → Doppler → Vercel sync propagates within ~30s → push a trivial commit to trigger rebuild, or `vercel redeploy`.
- **NEVER `vercel env pull` or `doppler secrets download` to disk for inspection** — audit via `scripts/audit-doppler-pollution.sh` (value-free: key name + length + pollution flag only). Never echo secret values to stdout/chat/logs.
- **Known pattern:** paste pollution leaves a literal 2-char `\n` escape at value ends, silently breaks Firebase Installations (400 INVALID_ARGUMENT), CORS matching, WebAuthn origin matching. Re-run `scripts/clean-doppler-pollution.sh driiva prd` if symptoms return.
- **Client-side env vars must be `VITE_`-prefixed** (bundled into the browser — public). Anything sensitive must be unprefixed and read server-side only. The PR template and `secret-safety.yml` workflow scan for leaks; do not bypass.

## CI / Deploy

- `.github/workflows/ci.yml` runs `lint-and-typecheck` (`tsc --noEmit`), `build` (root), `functions-build` (functions only, includes its own tests), and `test` (root vitest + coverage) on every PR and push to main. Staging deploys (`deploy-staging`) auto-run on push to `main`; production (`deploy-production`) requires either a `v*` tag or manual `workflow_dispatch` and is gated by the `production` GitHub Environment (required reviewer).
- The build step injects placeholder `VITE_FIREBASE_*` values so Vite can build without real credentials — keep these placeholders in mind when debugging "works locally, fails in CI" issues.
- `.github/workflows/secret-safety.yml` scans for hardcoded secrets and validates `.env.example` coverage on every PR; it also runs weekly to flag stale Firebase service-account keys.
- `.github/workflows/claude-review.yml` triggers Claude PR reviews. `neon_workflow.yml` handles Neon branching for previews.

## Known Blockers

1. **Firebase auth delay (~27s)** — critical, must fix before Keith demo. _(Partially addressed 2026-04-18: Doppler pollution in `VITE_FIREBASE_*` was causing Installations 400s on every init, likely a major contributor. Re-measure post-cleanup.)_
2. **CI pipeline failures** — Firebase org policy blocking SA key creation
3. **WebAuthn UI** — backend complete, frontend pending
4. **Waitlist** — exists but not actively driven to 1,000 target
5. **Marketing site split-brain** — live site is on Framer (no write API available to Claude). Canonical editorial source is `marketing-site/index.html`; changes must be mirrored into Framer by hand, or the live site migrated off Framer. See ROADMAP → "Marketing site sync".
6. **Public GitHub repo** — `github.com/mrshippers/Driiva` is public. Reconcile against CLAUDE.md "Private repos" rule: either flip to private, or confirm no secrets have ever been committed + scrub history. Doppler now ensures future secrets don't land in git, but historical commits may need audit.

## Raise Context

- **Target:** Q2–Q3 2026
- **Investor profile:** Angels + seed funds in insurtech OR Muslim/ethical finance
- **Key signal:** One broker/MGA letter of intent changes investor conversations
- **Channels post-raise:** Price comparison sites, IslamicFinanceGuru, Muslim community platforms
- **Exit thesis:** Aviva, Admiral, LV pay for distribution + clean telematics data

## Constraints

- Private repos — nothing public until explicitly ready
- Security-conscious: insurtech = regulatory sensitivity, audit everything
- ADHD-optimised workflow: reduce friction, eliminate initiation overhead
- Never ask "want me to draft that?" — produce deliverables inline immediately
- Anonymous monetisation preferred — no loud personal branding
- Raise timeline is real: every week of delay = raise pushed back
