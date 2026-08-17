# Driiva - Current sprint (tickets)

**Last updated:** 11 August 2026
**Product Lead:** Keith Cheng (onboarded 27 June 2026)
**External memory for AI sessions:** Work on the next unchecked ticket only; update this list when done.

---

## Sprint: "P0 Release Blockers" (June 2026 - Security + Integrity)

- [x] Close 3 critical security issues found by logic-gap harness (trust proxy, sanitise order, worker recovery) - *done: commit `d7339e0` + batch merge `81d7117` on 2026-06-26*
- [x] Make pricing server-authoritative; enforce +/-15% discount cap server-side - *done: `6853a80`*
- [x] Atomic trip persistence + duplicate rejection + price allow-list - *done: `d12b0ff`*
- [x] Serialise point flushes; atomic startTrip; canonical cancelTrip state machine - *done: `889c8ba`*
- [x] Gate onboarding completion on confirmed server write; add draft resume + consent integrity - *done: `9acbb60`*
- [x] Deterministic scoring output; worker auto-recovery; sanitise pipeline reordering - *done: `611717d`*
- [x] Wire ESLint + secret-safety check into CI; repair false-red - *done: `d7339e0`, `27e1700`*
- [x] Pin Node at root via `engines` + `.nvmrc`; drop deprecated `baseUrl` for TS 6 - *done: `fc83165`, `10ecce3`*
- [x] Remove dead duplicate-trap components; correct package name - *done: `f748d7c`*
- [x] Repaint onboarding to Driiva instrument palette; eliminate re-centre jump - *done: `8fe9e29`*
- [ ] Root Platform credentials - sandbox key needed from Root to activate insurance quote/bind/policy endpoints
- [ ] Stripe end-to-end - dependencies present, webhook handlers and payment flow not wired
- [ ] WebAuthn UI - backend scaffolded, frontend not built
- [ ] Phone pickup detection - scoring weight reserved at 10%, currently hardcoded to 100
- [ ] Decide on the `@google-cloud/storage` major bump. The 2026-08-17 sweep (`0386e00`) took 46 vulnerabilities to 16 and cleared all three criticals, but the 16 left all trace to that package through `retry-request` and `teeny-request` and only clear on a major, so they need a deliberate call rather than another routine `npm audit fix`

## Sprint: "Marketing + SEO" (May-June 2026)

- [x] Scaffold `apps/marketing/` Vite + React 18 Wouter SPA as the live driiva.co.uk surface - *done: `c2898c8`, supersedes `marketing-site/` and Framer split-brain*
- [x] Vercel project `driiva-marketing` rootDirectory set to `apps/marketing` - *done: `87dfa96`*
- [x] Swap Plausible analytics for Vercel Analytics - *done: `dae8f6b`*
- [x] WebGL shader hero background + glass nav - *done: `6cabd27`*
- [x] IndexNow key + sitemap lastmod + FAQPage schema + 1200x630 OG card - *done: `618f495`, `6066bdd`*
- [x] Doppler adopted as canonical secrets source; paste-pollution cleanup scripts added - *done: `16b4456`, `c89415e`*
- [x] 16-screen mobile onboarding shipped in `mobile/` (Expo SDK 52); PWA path superseded - *done: `7b1658c`*
- [x] Design system canonicalized at `design-system/`; hyperframes shipped; logos refreshed - *done: `37012a6`*

## Sprint: "Marketing polish" (August 2026 - driiva.co.uk)

- [x] Swap the hero's synthetic score-ring mockup for the real onboarding screenshot, and take the cofounder-approved FinalCTA copy verbatim - *done: `91bd4de`*
- [x] Fix the scroll lag a cofounder reported: cap the WebGL shader background at 1x DPR and stop its animation loop when the tab is backgrounded - *done: `2e76d3c`*
- [x] Drop the gradient-clip text treatment for legibility - 5 selectors moved to solid `--amber-2` (>9:1 on the dark surfaces); `--grad-brand` stays as a decorative background fill - *done: `76b27a4`, `f5b9b0a`*
- [x] Fix the waitlist, which was accepting signups into a void and saying yes. Both API routes imported `./lib/waitlist-core` with no file extension, which Node's ESM resolver rejects, so each function died at import and 500'd; then with credentials present both failed at init on `require is not defined`, the module being ESM on Vercel. In production the endpoint now refuses rather than pretending, and the count returns null rather than a hardcoded 117 when the store cannot be reached - *done: `4758c61`, `6efa5d3`, `efd6d46`, `ce62818`*
- [x] Build the waitlist confirmation email on the canonical shell. It was hand-rolled and arrived blank: the card was `rgba(30,41,59,0.6)` with no `bgcolor` attribute on either table, and Outlook reads only `bgcolor`, so what landed was an empty white rectangle. Rebuilt on `design-system/email-shell.html` - *done: `72c62da`, plus `d56767c` to pick up the Resend key*
- [x] Publish the driver survey and lighten the FCA drumbeat. Our own UX survey ran to 17 responses between 08/07/25 and 03/08/25 and then sat unread in SurveyMonkey for a year; the most interesting number in it is a zero, since not one respondent picked real-time tracking. Counts live in `src/data/survey.ts` with their provenance and percentages are computed at render. `/uk-survey` publishes the results rather than inviting people to a survey that had already closed. Three promotional FCA mentions removed (TrustRibbon badge, Security card, Comparison row); every protective mention kept - *done: `f5e22d1`, `621fb9d` moved the sample size out of the headline into a marked footnote*
- [x] Rebuild the hero and the background. Wordmark roughly doubled to a 240-400px clamp and the strapline brought down from a 74px cap to 40px so the two stop cancelling each other out; the phone and `PhoneFrame` removed, leaving one centred column; Instrument Sans actually loaded, having been named as the body face since the email shell was written and never shipped; Lenis retuned from 0.9/1.1 to 0.55/1.45; the background rebuilt as a single diagonal amber-to-purple axis with noise demoted to a perturbation, after the noise-driven nebula came out uniformly violet; Amicro reveals ported rather than installed, since its components want Motion and this site ships anime.js alone - *done: `2c90f97`, `9955783`, `002fd93`; contrast measured off the composed frame behind five regions, worst 6.4x against a 4.5x floor, 14 tests and 8 of 8 fabrication laws green*
- [ ] Bring the phone frame back when there is a real app capture to put in it. It was removed rather than updated because no current render exists in the repo and inventing an app screen is not an option - *raised by `002fd93`*

## Sprint: "Premium lift" (August 2026 - waves H to M, `docs/premium-lift/`)

Integrated on `premium-lift/main` and merged to `main` on 10 August. Full record in `docs/premium-lift/progress.md`; only the ticket state lives here.

- [x] Wave H, insurance and payment honesty: a cleared card is not cover and a signup is not a policy; zeros dressed as metrics, a refund that cannot be paid, and a seed one typo from production - *done: `878cc84`, `f673600`*
- [x] Regulatory copy corrected to "working towards the FCA sandbox", not "pending authorisation" - *done: `aaaec97`*
- [x] Drivers start at 70 and the first trip moves the score either way - *done: `bf0f565`*
- [x] Wave I, brand: real app icon in place of the Expo template, body type off Tailwind defaults onto the ladder, Amicro and checklist.design actually applied, and the 404 that asked drivers about the router - *done: `17280f5`, `52036b8`, `2dfeeb8`, `a0594bd`*
- [x] Fix the iOS cold-launch crash: a non-worklet function called on the UI runtime aborted the process, which also explained the dashboard reading zeros - *done: `97d8150`, `9acad43`, `486aaf7`, `b852676`*
- [x] First on-device captures of the mobile app, dashboard included - *done: `58ba33e`, `bd388f3`, `01987d6`*
- [x] EAS build config added now the iOS app is registered in Firebase - *done: `175baea`*
- [x] QA gate: accessibility 80 serious/critical down to 0, banned copy removed, /rewards and /achievements reconciled - *done: `3a72b86`, `6437d4c`, `67c7c3b`*
- [x] Wave K: integration suite green, and "nothing here" separated from "we do not know what is here" - *done: `ee0ca45`, `e7fd6c8`*
- [x] Wave L: the design laws now reach the real product through a seeded emulator sign-in rather than demo mode, and say so when they do not - *done: `dd182ad`*
- [x] Fabrication laws read stylesheets, not just components - the invented waitlist count was reaching the screen a third way, printed straight out of a CSS `content` declaration - *done: `e051e17`*
- [x] Marketing redesign: canonical Driiva wash rendered rather than approximated (mean absolute error 53.5 to 34.0 per channel), living background, real type hierarchy, drawn wordmark in nav, sentence case, FAQ two-column - *done: `32f8c9d`, `3d065d2`, `7661e6b`, `0742e04`, `2c3b654`, `410143d`*
- [x] Marketing accessibility: email error state clears on edit, `aria-invalid` and `aria-describedby` wired, skip link added, one focus ring defined that survives both ends of the wash - *done: `ad097c8`*
- [x] Rendered-behaviour pass on `apps/marketing`, recorded as its own document - *done: `b5a2cfe`, `7f1ca28`*
- [x] `npm run gates`, a one-command runner for the visual gates - *done: `e9dc8d9`*
- [x] The 404 no longer stamps itself with a revision date - *done: `222a5cd`*
- [ ] `npm run gates` is still committed INCOMPLETE, but for one reason now rather than two. The client env was being exported into the dev server, where Vite never reads it, so the gate signed in against the 9099/8080 defaults with nothing listening; it is written to `.env.local` and restored on exit, the emulator is reused when one is already listening, and the axe blocker is fixed. Sign-in itself still does not complete, and the INCOMPLETE notice stays until a run is actually green - *advanced by `316781c`, `299b131`, `69b41cf`*
- [ ] Reduced-motion CSS path unverified: the `.reveal-init` override inside the media query catches every element the JS never reaches, and reading says it resolves, but no browser has confirmed it. jsdom applies no stylesheet so a test there would manufacture a bug. Chrome on 9222 was down for the whole follow-up attempt - *raised by `7f1ca28`*
- [x] Extract the shared hook behind the two near-identical marketing email forms. They have drifted before and now carry the same four changes twice - *done: `3d40acc`, `useWaitlistForm` owns state, validation, submit, analytics tagging and button copy; Hero 258 lines to 163, FinalCTA 132 to 37; FinalCTA gained the three tests extraction put at risk*
- [x] Merge `task/premium-k-dashboard` (`6a01ea7`): 270 degree score gauge on web to match mobile, glass off the app surfaces (`dashboard-glass-card` renamed to `.instrument-card`, 22 glass rule blocks deleted), sentence case headings, and thirteen hand-rolled spinners collapsed onto `ArcTracer` - *done: merged to `main` in `7be1f67`, `1bbb04e`; twenty Lucide icon spinners deliberately left as a separate idiom*
- [x] Gate runner refuses to run when the dev port is already taken. `wait_for()` only checked that something answers, so another worktree's dev server got audited under this branch's name for six hours - an lsof check now turns that silent wrong answer into a loud refusal naming `GATE_PORT` as the escape hatch - *done: `ad6c16b`*
- [x] Put mobile type on the ladder and make the law reach it: 108 hardcoded `fontSize` values across `mobile/app` and `mobile/components` in 16 distinct sizes, now zero. The law had been scoped to `mobile/components/ui`, which is exactly how 108 off-ladder sizes survived a law named after them; it now covers all of `mobile/` with only the theme allowed to state a number - *done: `8fd2e21`, mobile tsc clean, 674 passing, 8 of 8 laws green against a planted violation*

## Sprint: "Damoov & Feedback" (Week 0 - Telematics + Compliance)

- [x] Damoov telematics integration (server-side: user registration on signup, daily sync Cloud Function) - *done: `functions/src/lib/damoov.ts` API client; `onUserCreate` trigger stores deviceToken; `syncDamoovTrips` scheduled function at 00:30 UK daily with maxInstances:10*
- [x] Feedback collection system (Settings → FeedbackModal → Firestore) - *done: star rating + freetext widget in settings; writes to `feedback/{autoId}`; admin dashboard at `/admin/feedback`*
- [x] GDPR-compliant privacy/terms for telematics data - *done: Damoov named as Article 28 data processor; telematics consent clause; rewards framing (FCA-clean)*
- [x] Firestore security rules for feedback + systemLogs - *done: authenticated create on feedback; admin SDK only on systemLogs*
- [ ] XGBoost risk model wired to drivingProfile scores (next sprint)
- [ ] Community pool calculation using aggregated drivingProfile data
- [ ] Rewards eligibility logic (Tesco/Halfords/Nectar thresholds based on overallSafetyScore)

## Sprint: "Make It Real" (Week 1–2)

*If you've already done keys, Firebase login, deploy, or Root contact, check those off.*

- [ ] Create Anthropic account and set API key as Firebase secret
- [ ] Run `firebase login` and authenticate
- [ ] Deploy Cloud Functions (`firebase deploy --only functions`)
- [ ] Deploy Firestore rules and indexes
- [ ] Contact Root Platform for sandbox credentials
- [x] Fix CORS (restrict to driiva.com) - *done: server uses `CORS_ORIGINS` env, no wildcard; set to driiva.com in prod*
- [x] Add password reset flow - *done: /forgot-password page + "Forgot password?" link in signin + route registered in App.tsx*
- [ ] Test full flow: signup → onboarding → record trip → see score → see AI insights

## Sprint: "Make It Safe" (Week 3–4)

- [x] Set up Sentry for error monitoring (frontend + Cloud Functions) - *done: client/src/lib/sentry.ts + functions/src/lib/sentry.ts; SentryErrorBoundary in main.tsx; wrapFunction/wrapTrigger helpers*
- [x] Add Content Security Policy headers - *done: added to server/middleware/security.ts securityHeaders; 'unsafe-inline' for style-src documented (required by Tailwind/Leaflet)*
- [x] Set up GitHub Actions CI/CD pipeline - *done: .github/workflows/ci.yml; jobs: lint-and-typecheck, build (client+server), functions-build, test; triggers on push/PR to main*
- [x] Write first batch of tests (auth flow, scoring algorithm, trip processing) - *done: 197 tests passing across 12 files; covers auth-flow, scoring, trip-metrics, insurance, feature-flags, GDPR, AI analysis, leaderboard, pool scheduling, trip triggers, policy triggers, server API routes*
- [x] Set up staging Firebase project - *done: `driiva-staging` project provisioned; `.env.staging` configured; `.firebaserc` alias set; `build:staging`/`dev:staging` scripts added; `deploy-staging` CI job wired; Firestore rules + indexes deployed; `functions/.env.driiva-staging` created for CF staging overrides. Remaining manual steps: upgrade to Blaze plan → deploy functions; set FIREBASE_TOKEN + VERCEL_* GitHub Secrets; create Neon staging branch; create Vercel staging project.*
- [x] Add Firebase Analytics initialisation - *done: getAnalytics() in client/src/lib/firebase.ts; guarded by VITE_FIREBASE_MEASUREMENT_ID; try/catch for ad-blocker safety*
- [x] Implement email verification - *done: sendEmailVerification() in signup.tsx; emailVerified field on User type in AuthContext; ProtectedRoute hard-redirects unverified users to /verify-email (skipEmailVerificationCheck=true on /quick-onboarding and /verify-email routes); verify-email.tsx page with resend + check flow*
- [x] Backend & database security audit - *done: 12 issues found and fixed across Firestore rules, PostgreSQL, Cloud Functions, and API routes. See DRIIVA_CHANGELOG.md for full details.*

## Sprint: "Make It Payable" (Week 5–6)

- [ ] Build Stripe checkout for premium payments
- [ ] Build Stripe webhook handlers (payment success, subscription changes)
- [ ] Wire premium payments to community pool contributions
- [ ] Test Root Platform quote → accept → policy flow end-to-end
- [ ] Add premium amount display on policy page
- [ ] Set `ENCRYPTION_KEY` env var in production (required - server now refuses to store telematics data without it)

## Sprint: "Make It Polished" (Week 7–8)

- [x] Add push notifications (trip complete, score update, payment due) - *done: FCM init in firebase.ts, firebase-messaging-sw.js service worker, usePushNotifications hook, Cloud Function triggers on trip complete + achievement unlock, sendWeeklySummary scheduled function (Mondays 9AM UK)*
- [ ] Build service worker for offline/PWA support
- [x] Fix dashboard map - was hardcoded to London; now requests device GPS on load, handles permission denied and GPS unavailable states gracefully
- [x] Wire up profile page to real data - *done: Member since reads from Firestore createdAt; policyNumber never hardcoded; displayName falls back to fullName field; memberSince added to DashboardData*
- [x] Tier 3 animation polish (Revolut-level) - *done: ScoreRing radial gauge replaces flat bar; dashboard cards use container/item stagger variants; BottomNav has whileTap spring scale + layoutId sliding indicator; trip cards have whileHover lift; onboarding steps use scaleIn with elastic easing*
- [x] Implement trip route visualisation on map (show the actual driven path, not just current position) - *done: TripRouteMap component with Polyline + start/end markers; TripDetail page at /trips/:tripId; trip cards clickable in trips list*
- [x] AI Driving Coach feedback widget - *done: AIFeedbackWidget component with round-robin engagement comments, Perplexity API integration (8s timeout, 1 retry, silent fallback), Firebase ai_feedback_events logging, glassmorphic UI with pulsing AI orb; wired into trip-detail page*
- [x] Rewards Programme redesign - *done: 5-tier RewardsTimeline component (#Day5 Tesco £5, #Day10 RAC trial, #TeamDriiva Halfords £10, #Month3 500 Nectar pts, #Anniversary Amazon £25); vertical mobile / horizontal desktop; lock/unlock/claimed states; FCA-compliant framing; Web Share API; wired into rewards page*
- [x] Card/Default unification - *done: GlassCard component now uses dashboard-glass-card spec; unified bg/border/radius/padding/shadow across all card instances*
- [ ] Phone usage detection for scoring
- [x] Build achievements backend - *done: 8 achievement definitions in functions/src/utils/achievements.ts; checkAndUnlockAchievements called after trip completion; Firestore collections (achievements/{id}, users/{uid}/achievements/{achId}); seedAchievements admin callable; frontend wired to real data*
- [x] Weather API integration - *done: Open-Meteo archive API in functions/src/utils/weather.ts; maps WMO codes to clear/cloudy/rain/snow/fog/storm; 3s timeout + graceful null fallback; wired into both trip triggers in trips.ts*

## Remaining features not yet in any sprint

These are known gaps that don't have tickets yet:

- [x] **Weather API** - *done: Open-Meteo archive API (free, no key). `functions/src/utils/weather.ts` fetches WMO weather codes and maps to clear/cloudy/rain/snow/fog/storm. Wired into trip processing triggers. 3s timeout, graceful fallback to null.*
- [ ] **Root Platform credentials** - scaffolded but not wired. Needs sandbox creds from Root to test quote → bind → policy flow. Once wired, the `/api/insurance` endpoints become live.
- [ ] **Stripe wiring** - dependencies installed, tables exist, webhooks scaffolded. Premium payments and pool contributions not yet connected end-to-end.
- [x] **Profile page real data** - *done: profile.tsx reads from useDashboardData hook; edit mode for name/phone/vehicle writes to Firestore via updateDoc; loading skeletons on every section; error state with retry*
- [x] **Trip route visualisation** - TripRouteMap component + TripDetail page wired.
- [ ] **Phone pickup detection** - scoring has a 10% weight for phone usage but it's hardcoded to 100 (no penalty). Needs accelerometer pattern recognition to detect phone pickups while driving.
- [x] **Push notifications** - FCM wired end-to-end: trip complete, achievement unlock, weekly summary.
- [x] **Leaderboard rank recalculation** - Firestore scheduled function now filters weekly/monthly by lastTripAt period bounds and uses dense ranking for tied scores. PG table remains stale (not primary).
- [x] GDPR data export - implemented GET /api/gdpr/export/:userId; returns JSON of all user data
- [x] GDPR data delete - implemented DELETE /api/gdpr/delete/:userId; strictly rate-limited
- [x] **Achievements backend** - 8 definitions, unlock logic in Cloud Functions, frontend wired to real Firestore data.
- [ ] **WebAuthn/Passkey login** - `server/webauthn.ts` is scaffolded but not exposed as a real login flow in the frontend.
- [ ] **Staging environment** - `driiva-staging` project provisioned; manual steps remain (Blaze plan, deploy functions, Vercel staging). Recommended before any production payments go live.
- [ ] **Marketing site sync** - live site runs on Framer (no automation API); local `marketing-site/index.html` is the canonical source for editorial hero + waitlist copy. Decide path: (a) manually paste CSS changes into Framer code overrides, (b) migrate the live site off Framer to Vercel (the `marketing-site/` build is deployable as-is), or (c) keep Framer for visual, and serve `/early-access` from the Next app. Current blocker: Framer has no write MCP/API available in this session.
- [x] **Design system canonicalized** - `design-system/` at repo root now holds `colors_and_type.css` (ink ladder, brand gradient, glass, radii, shadows, motion, type stack), `README.md` (voice/tone/visual rules), `source/` (Figma rules + Instrument philosophy), `assets/` (14 brand PNGs). Marketing site + client DriivaLogo component switched to canonical v3 white wordmark. Mobile app theme already aligned to canonical "instrument" mode. Follow-up: rename client Vite CSS variables to match canonical token names.
- [ ] **Client SPA token alignment** - `client/` still uses legacy variable names (`--color-accent-primary` etc.) instead of canonical (`--brand-iris`, `--glass-bg`, etc.). One-pass rename across `client/src/**/*.css` + `tailwind.config.ts` to converge on `design-system/colors_and_type.css`.

## Sprint: "Code Quality & UX Fixes" (Week 9–10)

- [x] Split quick-onboarding.tsx into 12 step components - *done: 1261 → 390 lines; 12 components in `client/src/pages/onboarding/steps/`*
- [x] Add leaderboard in-memory cache (60s TTL) - *done: deduplicates Neon reads; auto-invalidates on score update*
- [x] Implement `/api/auth/firebase` endpoint - *done: was returning 501; now verifies Firebase ID tokens*
- [x] Fix PR template (Next.js → Vite/React) - *done: corrected checklist, env prefix, image optimisation references*
- [x] Add coverage thresholds to vitest - *done: baseline 4/2/7/4%; CI will catch regressions*
- [x] Sign-in integration tests (15 tests) - *done: form validation, auth flows, username resolution, error handling*
- [x] Trip-recording integration tests (37 tests) - *done: full lifecycle, demo mode, error states*
- [x] Fix notification bell button on dashboard - *done: was dead button; now opens dropdown with mutual exclusion*
- [x] Premium mobile UX polish - *done: haptics, pull-to-refresh, shimmer skeletons, swipe cards, animated numbers*
- [x] Fix auth performance (10-20s delay) - *done: localStorage cache, hard timeout, splash screen*
- [x] Un-red CI on `main`. `mobile/tsconfig.json` extended `expo/tsconfig.base`, which resolves through `mobile/node_modules`, and CI installs at the root and in `functions/` only; the root suite imports four mobile modules on purpose, so vite found that tsconfig, could not resolve the extends, and killed five test files before a single assertion ran. Tests, Lint and E2E had been red on main because of it, so no PR could go green. Expo's base is inlined with a guard test that fails on a planted violation, and the Tests job now installs `functions/` deps too since the root suite imports `firebase-functions` at module scope - *done: `efafe39`; verified with `mobile/node_modules` absent, 5 failed / 57 passed before, 63 passed (676 tests) after*
- [ ] Split `server/routes.ts` into domain-specific route modules
- [ ] Add OpenAPI documentation for Express API
- [ ] Set up structured logging with Sentry breadcrumbs
- [ ] Add pre-commit hooks (lint + type-check)

## Sprint: "Observation Mode" (Live Monitoring)

- [x] Complete Sentry wiring - wrapFunction/wrapTrigger on all Cloud Functions; setSentryUser in AuthContext
- [x] Add Firebase Performance Monitoring - client SDK + custom trace utility (`performanceTraces.ts`)
- [x] Add structured metrics logging - trip pipeline, classifier, AI analysis with `[metric]` tags for Cloud Monitoring
- [x] Add Vercel Analytics + Speed Insights - Web Vitals, page latency, geographic distribution
- [x] Configure alerting - watchdog function (`monitorTripHealth`) for failed trips, GPS drop-off, stuck trips; health endpoint enhanced with version/checks

## Completed (reference)

- [x] Cloud Functions build fixed
- [x] Trips page wired to real Firestore data
- [x] AI insights feature flag
- [x] Root Platform integration scaffolded
- [x] CORS fixed (origin allowlist via `CORS_ORIGINS`; no wildcard)
- [x] CLAUDE.md, ROADMAP.md, and ARCHITECTURE.md added; trip-processor source of truth; regression report and investor doc
- [x] Dashboard map now uses device GPS instead of hardcoded London coordinates
- [x] AI Risk Scoring & Insights engines finalized
- [x] GDPR export/delete endpoints live
- [x] Sentry set up (error monitoring)

---

*Update the checkbox when a ticket is done. Add new tickets at the top of the relevant sprint. Product roadmap owned by Keith Cheng.*
