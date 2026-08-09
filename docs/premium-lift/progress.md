# Driiva Premium Lift - progress

## 2026-08-09 session 1 (background job, Fable planning)
- Retrieved Driiva memories; located repo ~/Documents/Driiva; confirmed M4 unmerged.
- Created docs/premium-lift/ planning set.
- P1c done: Keith threads + MVP scope doc captured (Chrome CDP relaunched for this; Gmail = jamal@driiva.co.uk).
- P1d done: Amicro micro-transitions repo found + cloned to job tmp.
- P2 harness launched (wf_72cc1d37-aaf); recon agents recon-driiva + recon-bestparts running.
- Brand law re-read: Instrument Philosophy + colors_and_type.css; CLAUDE.md two-mode rule (marketing glass vs instrument) noted.

## 2026-08-09 session 1 (cont)
- P2 harness ran DEGRADED (account session limit 09:03 killed verify panel + synthesis + ledger save; 54/74 agents errored). 13 confirmed findings banked into findings.md; ledger NOT persisted so a re-run re-derives.
- Wave 0 (Truth and Trust) inserted into the brief as top priority: fabrications, FCA copy, undeliverable rewards, waitlist tick with no write, score/recentTrips schema mismatch, unmounted Toaster, dead route map, pool honesty.
- Build agents: wave-0-truth (opus, task/premium-0-truth), wave-a-web (opus, task/premium-a-web), wave-a-mobile (sonnet, task/premium-a-mobile), wave-m-marketing (sonnet, task/premium-m-marketing). All resumed after the limit.

## Verified numbers (team-lead independent checks, 9 Aug)
- main baseline: vitest 518 passed | 2 todo; mobile tsc 54 errors.
- Wave 0 (task/premium-0-truth, 9 commits 0a-0h + toast assert): vitest 542 passed | 2 todo (+24 tests, 0 fails); npm run check CLEAN; Toaster mounted App.tsx:259; fabrication grep clean (DEEP_INSIGHTS/Main Street/Oak Road/12.40/117 all 0 live hits, remaining hits are explanatory comments only).
  - 0b went WIDER than briefed: found THREE conflicting regulatory positions (onboarding "Driiva is FCA-supervised" x2, quote screen "Our FCA-authorised product is in final review", disclosure "pending FCA authorisation") plus an "FCA Registered" badge on the web trust page. All aligned to "pending FCA authorisation". NEEDS COUNSEL CONFIRMATION. Files: client/src/pages/trust.tsx, mobile/app/onboarding/account.tsx, mobile/app/onboarding/comparison.tsx.
- Wave A mobile (task/premium-a-mobile, 3 commits): mobile tsc 54 -> 5 errors; 0 dead onPress in profile.tsx; 0 SpaceMono/Poppins refs; fonts shipped = InstrumentSans Regular/SemiBold/Bold, InterTight SemiBold/Bold, JetBrainsMono Regular/SemiBold.
- Wave M (task/premium-m-marketing, 4 commits): build clean, vitest 8/8, nav legible at 3 scroll depths (screenshots in job tmp).

## Open items for Jamal
1. FCA copy diff needs counsel sign-off before anything deploys.
2. CTA financial-benefit claim needs an FCA pass.
3. LiveStrip.tsx (marketing) = dead code holding invented metrics incl. "GBP 18.4k refunds tracked" - delete or wire to real data.
4. mobile/components/ui/AppBackground.tsx (PRE-EXISTING on main) imports expo-linear-gradient which is NOT in package.json and NOT installed. Currently dead (nothing imports the ui barrel) so it is a latent trap, not a live crash. Delete it or add the dep.
5. Footer links instagram.com/driiva; Keith said no Instagram existed as of 3 Aug and the handle differs from @driiva_ai. Unverifiable from here (Instagram 200s everything).

## Integration (9 Aug) - branch premium-lift/main
Merged CLEANLY, zero conflicts: task/premium-0-truth -> task/premium-a-mobile -> task/premium-m-marketing.
Verified on the merged branch:
- npm run check (root tsc): CLEAN
- npx vitest run: 48/48 files, 542 passed | 2 todo, 0 FAILED (main baseline 518)
- mobile npx tsc --noEmit: 5 errors (main baseline 54), all pre-existing, 0 new
- apps/marketing: build clean (6 routes prerendered), vitest 8/8
GOTCHA: a fresh worktree fails 2 test files (mobile-waitlist tsconfig, firebase-functions unresolved) until you ALSO run npm install inside functions/ and mobile/. Root install is not enough. Do this before believing any red suite in a new worktree.
NOT merged yet: task/premium-a-web (still mid-flight, uncommitted work incl. the design-law harness at tests/design-laws.mjs).
Nothing pushed. Nothing deployed. repo main untouched.

## Full integration COMPLETE (9 Aug) - premium-lift/main, all four waves
Merged: task/premium-0-truth + task/premium-a-mobile + task/premium-m-marketing + task/premium-a-web.
ONE CONFLICT, in client/src/pages/trust.tsx, and taking either side would have lost a real fix:
  Wave 0 had  <RegBadge label="Pending FCA authorisation" color="#6366F1" />      (right label, hardcoded hex)
  Wave A web had <RegBadge label="FCA Registered" color="var(--app-primary)" />   (false label, right token)
  Resolved to label="Pending FCA authorisation" color="var(--app-primary)" - both fixes kept.

VERIFIED ON THE MERGED BRANCH:
- npm run check (root tsc): CLEAN
- npx vitest run: 48/48 files, 542 passed | 2 todo, 0 failed (main baseline 518)
- mobile npx tsc --noEmit: 5 errors (main 54), all pre-existing
- apps/marketing: build clean 6 routes, vitest 8/8
- design laws: ALL GREEN across 5 routes; planted violation correctly fails 5 of 6 laws (harness is not vacuous)
  RUN IT WITH: DEV_URL=http://localhost:<port> npm run design:laws   (it reads DEV_URL, NOT BASE_URL; defaults to 5173)
- The dev-only /__boundary-check throw is gated behind import.meta.env.DEV, cannot reach prod.

BUDGET TABLE (brief P4) - measured:
  vitest >= baseline, 0 new fails ....... 542 vs 518, 0 fails      PASS
  tsc clean ............................. clean                   PASS
  design-law violations ................. 0 (5 routes)            PASS
  web route transition <= 350ms ......... 320ms (160 exit+enter)  PASS
  bundle growth <= +120 kB gz ........... +0.1 kB (626.4 vs 626.3) PASS
  mobile dead menu items 0 of 9 ......... 0                       PASS
  mobile missing routes 0 ............... 0                       PASS
  fabricated user-facing data 0 ......... 0 live instances        PASS
  axe serious/critical 0 ................ NOT RUN                 OPEN
  count-up on score/refund/pool ......... web yes, mobile pending  PARTIAL
  leaderboard real Firestore reads ...... Wave B, not started      OPEN
  trips pagination ...................... Wave C, not started      OPEN

NOT VISUALLY VERIFIED (auth-gated, redirect without credentials): dashboard, trips, leaderboard, rewards on web;
all new mobile screens (sandbox lacks UI-automation permission + AuthGate forces Expo Go to onboarding).
Per feedback_shipped_means, these are NOT "shipped" until seen running with a real session.

## Waves B and C launched (9 Aug, off premium-lift/main)
- task/premium-b-community (wave-a-web agent, resumed with full Wave A context): B1 leaderboard real (global+friends, paginated, delete demoLeaderboard, reuse Wave 0's week-convention helper), B2 friends+invites (schema, rules, invite/accept proven in emulator) = THE missing MVP feature, B3 pool visuals under a hard no-invented-economy constraint (D6 open), plus the real mobile leaderboard screen.
- task/premium-c-telematics (opus): C4 pagination (StrydeOS cursor helper -> web trips + admin + mobile FlashList), C1+C2 real expo-location capture replacing the setTimeout fake + "Start my journey" and post-trip correction (Keith Q2), C3 mobile trip detail 5-factor + polyline sourced from SCORE_WEIGHTS, C5 the refund moment.
Both told: install deps in root + functions + mobile; Expo Go mock-Firebase trap; write points to the batches subcollection; never retype score weights.

## Wave C merged into premium-lift/main (9 Aug)
Clean merge, no conflicts. Verified on the merged branch: tsc CLEAN; vitest 564 passed | 2 todo | 0 failed (was 542, main baseline 518).
Wave C's own gates: test:integration 15 passed (was 9), test:rules 99 (was 96), lint byte-identical to baseline, mobile tsc 5 -> 3 errors, expo export iOS bundle 5.16 MB with new copy confirmed present in the Hermes bytecode.

## Wave E (iOS unblock) launched (9 Aug)
task/premium-e-ios off premium-lift/main, assigned to the wave-c-telematics agent (it diagnosed the failure). Scope: (1) apply the proven use_modular_headers! Podfile fix + bump react-native-gesture-handler past the iPhoneSimulator26.5 incompatibility, authorised as a shared-dep change on this branch only; (2) capture EVERY mobile screen - no mobile screen in this entire lift has been seen running; (3) judge them against the design gate (Score -> Cashback -> Pool hierarchy, Instrument Glass vs generic dark mode) and name what falls short.
This closes the biggest verification gap in the lift. Per feedback_shipped_means, nothing mobile is "shipped" until this lands.

## ALL SIX WAVES INTEGRATED (9 Aug) - premium-lift/main
Wave B merged clean (no conflicts). Final verified state on the integration branch:
- npm run check (root tsc): CLEAN
- npx vitest run: 584 passed | 2 todo | 0 FAILED (main baseline 518, so +66 tests)
- design laws: ALL GREEN across 5 routes
- Wave B's own gates: test:rules 117 passed (9 files), test:integration 19 passed (5 files)
- Wave C's own gates: test:integration 15, test:rules 99, expo iOS export 5.16 MB
Merge order: 0-truth -> a-mobile -> m-marketing -> a-web (1 conflict, trust.tsx, both fixes kept) -> c-telematics -> b-community.

## Wave B notes worth keeping
- B3 deviation: there was NO pool history to chart because communityPool/current was a single mutable doc that finalizePoolPeriod rolled forward IN PLACE, destroying each closed period. Now archives to communityPool/current/history/{period} before rolling. Invents nothing, adds no funding path (D6 untouched). Consequence: the chart is honestly empty until the first period closes; 8-period case proven in the emulator, not the UI. PoolPanel plots PARTICIPATION not money, because participation is real today and pool value is not.
- Wave B found and closed a hole in its OWN work: /invite/:code redirected a signed-out visitor to /signup?invite=CODE and NOTHING consumed the parameter - account created, code dropped, friendship never formed, no error to either person. Caught only by driving the redirect in a real browser. usePendingInvite now stashes it in sessionStorage and redeems once a user exists. LESSON: a link that "works" is not a flow that works.
- Wave B also fixed getPreviousPeriod in the leaderboard cron - it still used the calendar-year+ISO-week divergence Wave 0 fixed elsewhere. It feeds movement indicators, so it fails QUIETLY: around New Year every change reads 0 and the board looks frozen, not broken.
- Deleted CommunityPool.tsx and OptimizedComponents.tsx: unreachable, and CommunityPool carried invented fallbacks (105,000 pool, 1,000 participants, 800 safe drivers, "4.2% of premium"). Dead code that fabricates is one import from shipping.
- Design laws caught two things on the merged branch that eyes missed: SplashScreen painted retired-slate gradient stops (#0f172a/#1e293b) over EVERY route, and Wave 0's new FCA line on /trust rendered at 12px, under the body floor. Both fixed.
- Known limit: redeemInvite is two writes not a transaction (invite and friendship sit under different rule blocks). Reports honestly if the second fails; atomicity belongs in a callable. Leaderboard pagination is in-memory by design (a board is ONE doc, max 100 rankings).

## REMAINING
- Wave E (iOS unblock + on-device capture): task/premium-e-ios created, agent hit the account session limit at 17:30, resets 19:30. NOT started.
- axe accessibility: never run.
- Wave D (rewards truth, notifications, feedback prompt, starting-score explainer): not started.
