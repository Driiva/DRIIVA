# Driiva Premium Lift - Implementation Brief (P4)

> The contract for waves A-E + M in feature-plan.md. Build agents inherit this verbatim; deviations invoke the prime directive and get named in the report.

## PRIME DIRECTIVE
If a requirement here conflicts with the product being genuinely premium (Instrument Glass: restraint, earned colour, calibrated type), break the requirement and say which one you broke. "Looks like a fintech TV ad" is a build failure even if every box below is ticked.

## HARD CONSTRAINTS
- stack: web = React 18 + Vite + wouter + Tailwind v4 (CSS-first) + framer-motion/Motion; mobile = Expo SDK 54 + expo-router + reanimated 4 + expo-haptics; NO Next.js, NO Redux, NO new UI kit deps beyond: Amicro components (vendored per-component, not the npm meta-package), FlashList (mobile lists), expo-notifications, expo-store-review, expo-location.
- brand: design-system/colors_and_type.css is the ONLY palette source. App surfaces = instrument mode (bg #0a0a14, surfaces #12111f/#1a1830/#241f40, single accent #5b4dc9). Marketing = glass mode. NEVER mix modes. The amber->indigo gradient appears ONLY as hairline/brand-surface (the wash is a PNG asset, never recreated in CSS). Headlines never gradient-clipped. Colour is earned: green only on live/positive signal, red only on events.
- banned: em dashes anywhere; capsule/pill shapes (rounded-full badges); emoji in UI; exclamation marks; "revolutionary/game-changing" copy; hardcoded hex where a token exists; fabricated data in any state (empty means empty); GBP promises in pool copy while D6 is open (points/share % only).
- typography: Instrument Sans (variable, self-hosted woff2) = body on BOTH platforms; Inter Tight = display; JetBrains Mono = eyebrows/labels/stats; tabular-nums on every numeric readout; 3 weights max per family. Kill the Poppins/SpaceMono lie in mobile _layout.tsx.
- motion: two eases only - --spring cubic-bezier(0.34,1.56,0.64,1) for press/hover, --ease-fast cubic-bezier(0.22,1,0.36,1) for reveals; 150-450ms; prefers-reduced-motion respected in every animated component; no animation on tab screens > 600ms total entrance.
- units: ms for motion, px for radii (16px app cards - "identical everywhere because deviation is defect"), pence for money (never float pounds).
- git: one worktree per wave via `~/bin/wt new <wave>`; never touch main directly; M4 branch untouched; user merges. UK spelling incl. code comments.

## BUDGET (measured, not described)
| metric | target | measured |
|---|---|---|
| npx vitest run (root) | >= baseline at wave start, 0 new fails | |
| npm run check (tsc) | clean | |
| design-law tests (new, A6) | 0 violations on every routed page | |
| axe serious/critical (dashboard, leaderboard, trips, rewards) | 0 | |
| web route transition | <= 350ms perceived (PageTransition spec) | |
| client bundle growth from lift | <= +120 kB gz total | |
| trips list first page | <= 25 docs fetched, hasMore cursor works at 26+ | |
| leaderboard page | real Firestore reads, 0 refs to demoLeaderboard | |
| mobile dead menu items | 0 of 9 (was 8 of 9) | |
| mobile referenced-but-missing routes | 0 (was 2) | |
| stat number entrances | count-up present on score/refund/pool (web+mobile) | |
| fake/placeholder user-facing data | 0 instances (testimonials, REWARDS array, DEMO_ACHIEVEMENTS) | |


## WAVE 0 - TRUTH AND TRUST (inserted 9 Aug after the logic-gap sweep; runs BEFORE/ALONGSIDE Wave A, highest priority)
The sweep confirmed the app currently shows users invented data and undeliverable promises. Nothing else in this lift matters while that is true. Systems:
0a. **Delete every fabrication** - done when: dashboard DEEP_INSIGHTS hardcoded array (client/src/pages/dashboard.tsx:636) is gone or derived from real trip data and gated on trips>0; onboarding social-proof fake names AND the hardcoded "117 drivers ahead of you" counter are gone (real count or no count); mobile rewards REWARDS array + web DEMO_ACHIEVEMENTS deleted (Wave D wires the real read; until then honest empty state). grep proves zero fabricated user-facing values remain.
0b. **Compliance copy** - done when: the onboarding screen claiming "Driiva is FCA-supervised" is corrected to match the later, accurate "pending FCA authorisation" disclosure; every money/benefit claim in app copy carries an FCA-safe framing. Flag the diff to Jamal, do not invent a new legal position.
0c. **Undeliverable promises** - done when: rewards that name partner vouchers (GBP 5 Tesco, RAC trial, GBP 25 Amazon) either redeem for real or are relabelled as planned/coming with a disabled action and honest copy; no "Redeem Now" button that does nothing.
0d. **Waitlist truth** - done when: the quote-screen waitlist write actually persists (emulator test) before any "You're on the list" confirmation renders; failure shows an error, never a tick.
0e. **Schema truth (the silent zeros)** - done when: dashboard score reads the field writers actually write (drivingProfile.overallSafetyScore vs currentScore - pick ONE canonical field, migrate readers AND writers, add a contracts-level shape guard); recentTrips reader fields (id/distanceMeters/durationSeconds) match what functions write (tripId/distanceMiles/durationMinutes) with an explicit unit convention (metres + seconds, converted at the edge); a test fails if reader and writer shapes diverge again.
0f. **Toaster mounted** - done when: <Toaster/> renders once in App.tsx and a triggered toast is visible (28 files currently dispatch into a void).
0g. **Route map alive** - done when: trip-detail.tsx and dashboard.tsx use getTripPoints() (the batch-aware reader in client/src/lib/firestore.ts:484 that currently has zero callers) so a real recorded trip renders its polyline.
0h. **Pool honesty** - done when: either the pool funding path is wired (addPoolContribution has zero callers; trip triggers never create shares) or every pool surface states plainly that contributions begin at launch; the leaderboard "Pool Refunds" stat stops flooring sub-GBP500 pools to "GBP 0k" and stops labelling total pool as refunds; weekly leaderboard doc ID uses ONE week convention across client and server (ISO week-year vs calendar year currently diverge and empty the board at New Year); pool finalisation cron runs Europe/London, not America/New_York, and error copy says pounds not dollars.
Verify for Wave 0: npm run check + npx vitest run + a grep-based fabrication scan + emulator tests for 0d/0e. This wave gates the design gate (system 16): a beautiful screen showing invented data fails.

## SYSTEMS (each with done-when; build order = dependency order)
1. **Tokens + type foundation (A1+A2)** - done when: client/index.css + tailwind config resolve every colour from design-system tokens (grep finds 0 occurrences of #8B5CF6/#3B82F6 in client/src); Instrument Sans renders as body on web (computed style check) and mobile (font key loads the actual asset); JetBrains Mono on stat labels; vitest + tsc green.
2. **Motion + resilience shell (A3+A4)** - done when: PageTransition wraps the web router (fixed-position portal gotcha handled); Amicro primitives vendored under client/src/components/motion/; root + route ErrorBoundaries render branded fallbacks (throw in dev proves it); shared Skeleton/EmptyState used by dashboard, trips, leaderboard, rewards.
3. **Mobile route + menu repair (A5)** - done when: trips/[tripId].tsx and trip-recording.tsx exist and render; all 9 profile menu items navigate; expo-router typecheck passes; no dead onPress={()=>{}} remains in profile.tsx.
4. **Design-law harness (A6)** - done when: `node tests/design-laws.mjs` (or vitest equivalent) fails on a planted capsule and passes on the real app; wired into CI workflow.
5. **Leaderboard real (B1)** - done when: web + new mobile screen read the leaderboard collection (emulator test proves read path), global/friends tabs, pinned your-rank row, paginated (25/page), demoLeaderboard deleted.
6. **Friends + invites (B2)** - done when: friendships + invites schema in shared contracts; firestore.rules additions pass a new rules-emulator suite; invite share-sheet produces a deep link that a second emulator user can accept; friends tab filters by real friendships.
7. **Pool visuals (B3)** - done when: pool history chart renders >= 8 periods from communityPool data (seeded in emulator); LiquidGauge v2 animates on data change; share breakdown counts up; copy shows share %/points, no GBP promise.
8. **Pagination (C4)** - done when: cursor helper (ported firestore-pagination) unit-tested incl. the fetch-one-extra hasMore trick; web trips infinite scroll fetches page 2 on scroll (Playwright proves it); mobile trips uses FlashList with onEndReached.
9. **On-device capture v1 + mode UX (C1+C2)** - done when: record.tsx starts/stops a real expo-location watch behind the existing UI, writes a trip doc the pipeline scores (emulator integration test); "Start my journey" + post-trip correction UI exist; the setTimeout fake is deleted. (Damoov native stays out - D10.)
10. **Trip detail mobile + refund moment (C3+C5)** - done when: mobile trip detail shows 5-factor breakdown + map polyline; score-delta/pence count-up + haptic fires on a newly landed trip (storybook-style dev trigger acceptable for verify).
11. **Rewards/achievements truth (D1)** - done when: mobile rewards + web achievements read real definitions/unlocks (emulator test); hardcoded arrays deleted.
12. **Notifications + feedback (D2+D3)** - done when: push token registration guarded + stored; in-app notification centre lists real docs; store-review prompt gated behind a high-score trip event; feedback form writes to Firestore (rules-tested).
13. **Onboarding truth + explainer (D4+D5)** - done when: quote.tsx waitlist TODO writes for real (emulator test); fake testimonials replaced with compliant copy; starting-score explainer shown first-run.
14. **iOS polish pass (E1+E2)** - done when: every tab screen has an entrance (<= 600ms), haptics vocabulary applied (Button/Toast/Segmented), TradeMind ports compile on SDK 54; recorded on-device/simulator capture attached (shipped = verified on-device).
15. **Marketing quick hits (M1-M3)** - done when: phone frame gone, nav scrim legible over every section (CDP screenshot at 3 scroll depths), CTA copy swapped post FCA-pass.
16. **DESIGN GATE - the thing, not a scene**: a cold reviewer walking dashboard -> trip -> leaderboard -> pool -> rewards on both platforms scores every checklist.design list for those surfaces (fetch the specific checklist per surface during QA) with 0 unjustified misses, AND the app leads with the three Driiva targets in order: Score, Cashback earned, Community pool. Evidence = annotated screenshots per surface + the filled budget table. If it reads as generic AI gloss, the gate fails regardless of ticks.

## VERIFY
- Per wave: `cd <worktree> && npm run check && npx vitest run` + the system-specific command named above (Playwright for web flows, emulator suites for Firestore paths, `node tests/design-laws.mjs`, CDP screenshots for visual claims).
- Mobile: `cd mobile && npx tsc --noEmit` + Expo start smoke + simulator screenshot per changed screen.
- Final: filled budget table + logic-gap-harness re-run on the lift branches before any deploy claim. Refuse "done" without the numbers.

## STOP
3 failed passes on one system -> stop, hand back with failing numbers and the exact command output. No fourth attempt, no scope-swap to dodge the failure.

## EXECUTION SHAPE (P5)
- Wave A = one worktree `premium-a-foundation` (Opus lead implementer, Sonnet reviewer per task).
- Waves B, C = parallel worktrees `premium-b-community`, `premium-c-telematics` after A merges into an integration branch `premium-lift/main` (NOT repo main; Jamal merges to main).
- Waves D, E, M = sequenced after B/C on the same integration branch; M can run any time (separate worktree, touches apps/marketing only).
- Model policy: Opus = systems 6, 9, 16 (judgement-heavy); Sonnet = the rest; every wave ends with a code-review pass + this brief's verify block.
