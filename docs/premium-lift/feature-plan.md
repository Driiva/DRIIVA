# Driiva Premium Lift - Feature Plan (P3)

> Source of truth for WHAT ships. The implementation brief (implementation-brief.md) covers HOW.
> Scope canon = Keith's 26 Jun MVP doc (12 items). Persona: young UK driver, tech-savvy, record-rebuilder. iOS app IS the product; website is distribution only.

## E2E userflows vs today's reality

### Flow 1 - Discover -> Install -> First open
Marketing site -> App Store/TestFlight -> 16-screen onboarding -> signup -> permissions -> home.
- WORKS: onboarding screens render, auth real (M1), permissions screens exist.
- GAPS: quote.tsx waitlist write is a TODO (signups silently lost); social-proof.tsx ships FAKE testimonial names (compliance + trust risk); no explainer for the starting score (Keith Q1: what score do I begin on?); marketing hero still has the phone frame Keith asked to remove; sticky nav illegible on scroll.

### Flow 2 - Record a trip (THE telematics core)
Open app -> drive detected (or manual start) -> live recording -> trip processed -> score + refund moment.
- WORKS: server pipeline is real (triggers/trips.ts: scoring, anomaly, achievements, AI insights); web trip list/detail real.
- GAPS: mobile record.tsx is a setTimeout FAKE - no GPS capture on device; no mode confirmation ("Start my journey" - Keith Q2, bus/bike false-positive risk); mobile deep links to trip-recording + trips/[tripId] CRASH (files don't exist); the "refund moment" (score -> money) has no celebratory surface anywhere.

### Flow 3 - Check my standing (daily habit loop)
Open app -> score, refund earned, pool share, trend.
- WORKS: mobile dashboard + trips read live Firestore; web dashboard real.
- GAPS: hierarchy is flat - the three Driiva targets (Score, Cashback earned, Pool share) don't lead; no count-up/monotony-breaking motion on numbers; web client runs an OFF-BRAND purple/blue palette and ignores the design system entirely.

### Flow 4 - Community (MVP items 2, 4, 7)
Leaderboard global + friends; payout pool; add/invite friends.
- WORKS: leaderboard cron every 15 min server-side; pool collections + rollover exist.
- GAPS: web leaderboard = hardcoded demo array; mobile has NO leaderboard screen; **friends/invite does not exist anywhere** (no data model, no UI) - biggest missing MVP feature; pool visuals are static stat cards + one gauge, no history, no "community is winning" narrative.

### Flow 5 - Rewards + achievements (MVP item 3)
- GAPS: mobile rewards tab = hardcoded array; web achievements = DEMO_ACHIEVEMENTS; server unlocks achievements for real but users never see truth.

### Flow 6 - Notifications + feedback (MVP items 8, 9)
- WORKS: weekly notification cron exists server-side.
- GAPS: no push registration, no in-app notification centre, no feedback/rating prompt (expo-store-review) anywhere.

### Flow 7 - Settings / legal / profile (MVP items 5, 6, 11)
- GAPS: mobile profile menu - 8 of 9 items are dead no-ops (Settings, Vehicle, Policy, Achievements, Leaderboard, Support, Privacy, Terms, Trust). Web has real pages to link/port.

## Feature plan - waves (priority order)

### Wave A - Foundation: brand truth + resilience (unblocks everything)
A1. Token unification: client adopts design-system/colors_and_type.css canon (ink ladder, #5b4dc9 app accent, amber-indigo gradient as hairline/brand-surface only). Kill the parallel purple/blue palette. Same for mobile theme.ts drift check.
A2. Typography: body font -> Instrument Sans (variable), Inter Tight display, JetBrains Mono data/eyebrows, tabular-nums on all stats. Web + mobile (expo-font; fixes the Poppins->SpaceMono bug).
A3. Motion system: adopt Amicro primitives (fade-up, blur-text, character-stagger, spring presets) + StrydeOS PageTransition port as the web route shell; central motion vocabulary file both platforms; prefers-reduced-motion everywhere.
A4. Resilience: ErrorBoundary (web root + route level), shared Skeleton/EmptyState/loading system (StrydeOS EmptyState pattern, brand-tinted).
A5. Mobile route repair: create trips/[tripId].tsx + trip-recording.tsx (or remove refs), wire all 9 profile menu items to real screens (Settings, Support, Privacy, Terms, Trust can port web content).
A6. Design-law tests: port TradeMind design-laws.mjs - no capsules, live-token colour checks, no em dashes in UI copy.

### Wave B - Community real (MVP 2/4/7 - the soul of the product)
B1. Leaderboard real: web page reads leaderboard collection (global + friends tabs, pagination); NEW mobile leaderboard screen; your-rank pinned row, movement indicators.
B2. Friends + invites: friendships model (Firestore subcollection + invite codes), invite flow (share sheet + referral deep link), friends leaderboard filter, rules + tests. THE missing MVP feature.
B3. Pool visuals: pool history chart (recharts web / lightweight SVG mobile), animated LiquidGauge v2, "pool grew this week" moments, per-user share breakdown with count-up.

### Wave C - Telematics UX completion (pick up the core)
C1. Real on-device capture v1: expo-location based recording in record.tsx (GPS fallback path; Damoov native = later phase, D10), background-safe minimal loop, writes trips the existing pipeline scores.
C2. Mode confirmation UX: auto-detect prompt + "Start my journey" manual start (Keith Q2), post-trip "was this you driving?" correction affordance.
C3. Trip detail mobile screen: score breakdown by the 5 factors, map polyline, AI insight card - the web trip-detail ported to instrument mode.
C4. Pagination everywhere: port StrydeOS firestore-pagination (cursor + hasMore), infinite scroll on web trips/admin + mobile FlashList adoption, leaderboard pages.
C5. Refund moment: when a trip lands, animate score delta + pence earned (count-up + haptic) - the emotional core of "get paid to drive well".

### Wave D - Engagement loop (MVP 3/8/9)
D1. Rewards/achievements truth: mobile rewards tab + web achievements read real unlocks; locked/unlocked states, progress bars.
D2. Notifications: expo-notifications push registration + in-app notification centre (weekly summary, achievement unlocks, pool events); notification prefs in Settings.
D3. Feedback + rating: expo-store-review prompt post positive moment (high-score trip); in-app feedback form -> Firestore.
D4. Starting-score explainer: base score answer (Keith Q1) surfaced in onboarding + dashboard first-run state.
D5. Waitlist write fix (quote.tsx TODO) + replace fake testimonials with compliant copy.

### Wave E - iOS premium polish + ship-readiness
E1. Tab-screen motion: reanimated entrances, ScoreRing sweep on focus, haptics vocabulary (port TradeMind Button/Toast/SegmentedControl patterns), pull-to-refresh polish.
E2. TradeMind component ports where useful: ExpandStack (trip cards), StepProgress, Reveal, Skeleton, Toast.
E3. checklist.design QA pass across every screen (buttons, forms, empty states, a11y, dark handling).
E4. App Store prep: icons/splash audit, screenshots, TestFlight build for Keith (his invite is pending).

### Wave M - Marketing quick hits (Keith's direct asks, small)
M1. Hero: remove outer phone frame, keep hand-holding-phone image.
M2. Sticky nav scrim: dim/darken gradient behind nav on scroll.
M3. CTA copy: "Ready to get paid for driving safely? Sign up now - early access is limited." (FCA pass first.)

## Explicitly OUT (respect gates)
- M4 payments merge (Jamal's call), M3 pool money model (D6), claims (D11), Sharia/FCA (D14/D15), Damoov native SDK on-device, insurance/KYC/Stripe surfaces (post-MVP per Keith doc).

## Open product questions for Jamal/Keith (do not block build)
- Base score number (D4 assumes 70 unless told otherwise; ship explainer copy around "provisional score").
- Pool money presentation while D6 is undecided: show points/share %, avoid hard GBP promises in UI copy (FCA).
- Friends invite incentive (none for MVP, just social graph?).

## Testing strategy
- Unit: token/motion utils, pagination cursor, friendships rules (rules-emulator suite exists from M0).
- Integration: leaderboard read path, invite accept flow, record->trip->score loop against emulator.
- E2E: extend Playwright critical flows (dashboard, leaderboard, trips pagination); Maestro flows for mobile remain authored-only (iOS build gate) - on-device verification per feedback_shipped_means.
- Design-law tests in CI (A6).
