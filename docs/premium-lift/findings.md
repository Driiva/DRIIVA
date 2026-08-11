# Driiva Premium Lift - findings

## Repo state (verified 9 Aug 2026)
- main @ e124d7b (SSR prerender for driiva.co.uk merged). Recent work = marketing fixes (gradient-text removal, hero).
- rebuild/m4-payments @ 986b820 NOT merged to main (git branch --no-merged confirms).
- Untracked: .claude/, hyperframes/09-app-walkthrough + 2 renders.

## Keith email context (P1c) - pulled 9 Aug via CDP Gmail (jamal@driiva.co.uk)
Keith Cheng = Driiva **Product Lead** (keithcheng0406@gmail.com; GitHub write access to mrshippers/Driiva invited 3 Aug; TestFlight invite pending Jamal's App Store Connect setup).

### 5 Aug (latest, "Fwd: Driiva - access and one for you to think about")
- Promo video: better with real screenshots but "still a bit flat... not exciting enough".
- Website hero: REMOVE the outer phone frame, keep just "a hand holding the phone" image.
- Sticky nav bar overlaps/loses legibility on scroll → add dim/darken scrim at top so nav always readable.
- Jamal replied earlier (3 Aug) promising "a bigger UI polish and overhaul coming for the site and the app" = THIS mission. Also: gradient text removed site-wide (merged), scroll-lag shader fixed (merged), demo image swapped to real screenshot (merged).

### 3 Aug thread (Keith's full review)
- Social: TikTok 60% / Instagram 20% / Reddit 20% (trust: r/UKPersonalFinance), register handles everywhere ASAP; park X + YouTube.
- Brand: "I like the current gradient brand tone... polished and professional... high-tech and exciting" → gradient stays (matches Jamal's brief).
- CTA copy suggestion: "Ready to get paid for driving safely? Sign up now - early access is limited."
- Video ask: combine cuts to show actual app screens → flow: open app → weekly score → refund moment → slogan+logo.

### 21 Jul "Driiva FAQ" thread - Keith's open PRODUCT QUESTIONS (feature-planning inputs)
1. Base score at signup (assumes 70) - needs a product answer + UX (starting-score explainer).
2. Mode detection: driving vs bike/bus/tube - considered a "Start my journey" confirm button?
3. AIRiskScoringEngine environmental data (weather, road type) - which external APIs?
4. Compliance requirements fully satisfied?
5. Latest app status / key missing features. Keith offers to test dev env.
- FAQ site exists: https://driivainfo.netlify.app/

### 27 Jun starter pack (canon)
- Score = 0-100: speed discipline 25%, smooth braking 25%, smooth acceleration 20%, gentle cornering 20%, phone-free 10%. Calc in ARCHITECTURE.md §5 + shared/tripProcessor.ts.
- Test login web: test@driiva.co.uk / driiva1. Admin: admin.driiva.co.uk.
- Palette: bg #0a0a14, surface #12111f, accent #5b4dc9, gradient #d4850a→#a04c2a→#6b3fa0→#3b2d8b. Type: Inter Tight display / Inter UI / JetBrains Mono data.
- Standing rule: every marketing copy piece needs an FCA-compliance pass.
- Notion "Driiva HQ" = product hub (UX copy, edge cases).
- 26 Jun "Driiva MVP Discussion" Google Doc shared by Keith (see below).

### 26 Jun MVP Discussion doc (Keith's, = SCOPE CANON)
- Target: UK, young tech-savvy early-day drivers + rusty drivers (Muslim segment phase 2, low emphasis).
- MVP goals: PRIMARY = collect driving data + feedback + in-app behaviour, community building, user acquisition. SECONDARY = engagement/return.
- **MVP scope (12)**: 1 Driiva Score (algo) · 2 Community leaderboard (Global & Friends) · 3 Rewards · 4 Payout pool · 5 Permissions · 6 Disclaimer/T&C · 7 Add/invite friends · 8 System + in-app notifications · 9 Feedback & rating prompt · 10 Sign-up/sign-in · 11 Settings · 12 iOS App Store listing. "Use website for distribution only."
- **POST-MVP**: insurance policies, KYC, AI driving coaching, repair network, Islamic-friendly, Stripe payment, membership benefits.
- Data tracking wanted: downloads, signups, session duration, in-app activity events (leaderboard clicks, score checks), signup→first-use time, retention, feedback; driving data accuracy proof = "job one".
- Implication: iOS app IS the product for MVP; M4 payments/insurance is post-MVP scope; leaderboard+pool+rewards+invites are the premium-lift priority surfaces.

## Product-state sweep (P1a) - recon agent, 9 Aug
### Web client (client/, wouter router in App.tsx)
- Routes real+wired: dashboard (useDashboardData/usePoolState), trips (Firestore limit(50)), trip-detail, rewards defs, profile, checkout, admin/*.
- MOCK: leaderboard.tsx = hardcoded demoLeaderboard array (line ~221, zero Firestore despite polished tabs); achievements.tsx = DEMO_ACHIEVEMENTS.
- Pagination: MISSING everywhere (trips/admin hard caps limit(50)/limit(100), no load-more/infinite).
- Pool UI: components/CommunityPool.tsx (stat cards), LiquidGauge.tsx (pool score gauge), LiveInfoPopup (static "every 5 min" copy, not live). No pool history chart.
- No ErrorBoundary anywhere; loading/empty ad hoc per page (leaderboard has 0 isLoading refs).
- framer-motion ^11 in 78 files, partial central lib/animations.ts. recharts ^2.15 available.
- FONTS: only Inter loaded; NO Inter Tight, NO JetBrains Mono. Client ignores design-system/ entirely - parallel palette --brand-purple-500 #8B5CF6 / --brand-blue-500 #3B82F6 (DIVERGES from canon amber-indigo).
- Orphans: pages/documents.tsx, file-downloads.tsx, login.tsx unrouted.
### Mobile (mobile/, Expo SDK 54, expo-router)
- 5 tabs: dashboard + trips REAL (onSnapshot); record.tsx = STUB (setTimeout fake, TODO Damoov/GPS); rewards.tsx = hardcoded REWARDS; NO leaderboard screen (dead menu item) though functions cron computes it every 15 min.
- profile.tsx: 8 of 9 menu items dead onPress={()=>{}} (Settings/Vehicle/Policy/Achievements/Leaderboard/Support/Privacy/Terms/Trust).
- BROKEN ROUTES: _layout + trips.tsx reference app/trip-recording.tsx + app/trips/[tripId].tsx - files DO NOT EXIST (crash/404).
- FONT BUG: _layout.tsx:58 "Poppins-Regular" key actually loads SpaceMono-Regular.ttf.
- reanimated ~4.1 only in onboarding + ProgressBar/ScoreRing/TripReplay; tab screens static. Haptics only auth/record/DriivButton/ScoreRing. No moti/lottie/chart lib/FlashList.
- Onboarding: 16 screens; social-proof.tsx PLACEHOLDER fake testimonials; quote.tsx waitlist write stubbed (3 TODOs).
- Mobile trip data today = seeded/demo (useTripSeed.ts); Damoov is server-side only (D10).
### Scoring/telematics
- THREE engines: packages/scoring (canonical) + functions/src/scoring fork (byte-identical, deliberate M2 interim) + client/src/lib/scoring.ts legacy drivingScorer still wired into useTelematics.ts.
- Server pipeline real: functions/src/triggers/trips.ts (scoring, anomaly, achievements, AI insights); scheduled: damoovSync daily, leaderboard 15-min, notifications weekly, pool rollover, watchdog->Sentry.
- Collections: users, trips, tripPoints, tripSegments, tripAiInsights, policies, communityPool, poolShares, leaderboard, counters.
### Design system notes
- driiva-design-system/ = stale Apr dupe (only preview HTML gallery useful). Canon = design-system/.
- Figma rules doc: the amber-indigo brand WASH is a PNG asset (Gradient_background.png), never recreated in CSS; the CSS gradient var is for hairlines only.
- Two modes law (CLAUDE.md): marketing = glass; app = instrument (solid surfaces, #5b4dc9 single accent).


## Best-parts inventory (P1b) - recon agent, 9 Aug
Port priority for Driiva:
1. **BrightnessStackToggle** (strydeos dashboard/src/components/ui/BrightnessStackToggle.tsx) - canonical aperture toggle, pure SVG+React, verbatim web port; RN via Reanimated withTiming.
2. **StatCard** (strydeos .../ui/StatCard.tsx) - count-up via IntersectionObserver+RAF, digit-aware font sizing, radial hover glow, 80ms stagger, sparkline, colour-blind-safe status. Best value-to-effort for Driiva readout tiles.
3. **PageTransition** (strydeos .../PageTransition.tsx) - motion/react AnimatePresence, opacity+y+blur, ease [0.22,1,0.36,1], reduced-motion aware. Drop-in web route shell. (NB fixed-positioning portal gotcha memory.)
4. **Design-law tests** (TradeMind web/tests/design-laws.mjs) - machine-checkable CSS laws incl. capsule detector + live-token colour check. Port to enforce no-pill + token rules mechanically.
5. **XMB category strip** (Shippers shippers-studio-site src/access/index.html) - PS3-style scale-1.28 active category + slide-in detail + breathing pips; bespoke adapt for a distinctive mobile home/browse if wanted.
- StrydeOS also: EmptyState w/ module-tinted wash + skeleton-shimmer, CommandPalette (Cmd+K fuzzy), lib/firestore-pagination.ts (base64 cursor + fetch-one-extra hasMore) - USE for Driiva pagination backend.
- Shippers house eases: --ease cubic-bezier(.2,.7,.2,1) + --easeout cubic-bezier(.16,1,.3,1) (0.3-0.5s); Driiva already has --spring + --ease-fast in CLAUDE.md - keep Driiva's own.
- TradeMind RN components proven on SDK 54 (55-155 lines each, Reanimated): ExpandStack (flexGrow accordion), GlowCard, StepProgress, Skeleton, Toast, Reveal, StatusPill; haptics call-site patterns in Button/Toast/SegmentedControl.
- No FlashList anywhere in TradeMind; if Driiva needs long lists use FlashList fresh.


## Micro-transitions source (P1d) - RESOLVED
- **github.com/Subhan-code/Amicro--Micro-transitions-** = npm `@subhanhq/amicro`. 163 registry components, Motion (framer-motion successor) powered React micro-interactions: apple-* loaders, text reveals (blur-text, character-stagger), page transitions (PageTransitionCard/Modal/Overlay), card-hover, dynamic-island, face-id-scan, breathing/pulse primitives, spring presets + hooks.
- Install per component: `npx shadcn add https://raw.githubusercontent.com/Subhan-code/Amicro--Micro-transitions-/main/registry/ui/<name>.json` or `npx @subhanhq/amicro add <name>`; or npm package.
- Cloned for reference at $CLAUDE_JOB_DIR/tmp/micro-transitions (job-temp, do not rely on persistence).
- Web client: use directly (React+Tailwind). Mobile: port the timing/spring language to reanimated; Motion itself is web-only.
- Brand law still applies: animations must serve Instrument Glass (restraint, earned colour) - pick fade/blur/spring primitives, skip novelty spinners.

## Font shortlist (body only - "a deft touch cleaner than Inter"; Inter Tight stays display, JetBrains Mono stays data)
1. **Instrument Sans** (Google Fonts, OFL, variable) - RECOMMENDED. Shares the brand philosophy's name ("Instrument Glass"); cleaner apertures, slightly narrower than Inter, warmer without going soft; reads premium on dark. Variable weight + width axes.
2. Geist (Vercel, OFL) - cleanest engineering-grade alternative, superb tabular numerics; risk: reads "Vercel house style".
3. Switzer (Fontshare, ITF Free) - crisp Swiss neo-grotesque, close to Inter but cleaner terminals.
- Constraint: must not collide with Shippers identity (Hanken Grotesk 300). Mobile: expo-font; web: self-host woff2, font-display swap; keep tabular-nums for stats.


## Logic-gap-harness sweep (P2) - 9 Aug, run wf_72cc1d37-aaf
13 CONFIRMED (10 HIGH / 3 MEDIUM), 32 refuted, 46 raw. Run DEGRADED at the end: account session limit killed the verify panel + synthesis + ledger save at 09:03 (54 of 74 agents errored). The 13 below cleared their skeptic gate before the cut; the ledger was NOT persisted, so a re-run will re-derive rather than compound.

### [HIGH][MISSING_STEP] Toaster never mounted - every toast() in the app silently renders nothing
- where: client/src/App.tsx:135
- gap: The render step is absent: client/src/components/ui/toaster.tsx:11 defines <Toaster/> but it is imported and rendered nowhere (grep across client/src finds only its own definition; no sonner/react-hot-toast alternative exists). 27 files call useToast()/toast() - dashboard foreground push notifications (dashboard.tsx:241), rewards redemption feedback (rewards.tsx:87), signup/signin/verify-email/forgot-password error toasts - and all dispatch into use-toast.ts memoryState that no component ever reads to the screen.
- impact: Every user-facing toast in the web app is invisible: push notifications received in foreground show nothing, auth error feedback vanishes, 'Redemption Coming Soon' never appears - the June-audit 'broken toast wiring' regression is still live today.
- fix: Import Toaster from '@/components/ui/toaster' and render it once inside AppContent in App.tsx.

### [HIGH][COMMON_SENSE] AI Driiva 'Deep Insight' shows fabricated trip events (Main Street, Oak Road, GBP 12.40 pool contribution) to real users
- where: client/src/pages/dashboard.tsx:636
- gap: Fully wired but the output is invented: DEEP_INSIGHTS (dashboard.tsx:636-644) is a hardcoded array containing 'you went 8mph over the limit on Main Street yesterday', 'Sharp turns detected on Oak Road', 'Your safe driving has contributed GBP 12.40 to the community pool this month', 'You're on a 5-trip streak above 85 points' - picked by Math.random() at dashboard.tsx:215 and rendered at line 684 under a card labelled 'AI Driiva ... Personalised driving insights'. A real user with zero trips and a GBP 0.00 pool share (shown on the SAME page in the Community Pool card) is told they contributed GBP 12.40 and sped on a street that does not exist in their history. A sharp human - or an FCA review
- impact: The dashboard presents invented driving events and money figures as personalised AI analysis, directly contradicting the real GBP 0 pool data rendered centimetres below; trust and regulatory exposure for an insurance product.
- fix: Gate the Deep Insight button on real data (trip count > 0) and derive insight text from dashboardData/trip events, or delete the hardcoded DEEP_INSIGHTS array.

### [HIGH][MISSING_STEP] Route map never renders for any real trip - client reads parent tripPoints doc, recorder only ever writes batches subcollection
- where: client/src/pages/trip-detail.tsx:79
- gap: tripService.startTrip (tripService.ts:308-316) creates tripPoints/{tripId} with points: [] and TripPointStreamer.flushOnce (tripService.ts:203-215) writes every GPS point exclusively to tripPoints/{tripId}/batches/{n}. But trip-detail.tsx:79-84 and dashboard.tsx:338-345 read only the parent doc's points array ((data?.points ?? [])), so points.length >= 2 is false for every real recorded trip and the Route card (trip-detail.tsx:224) and dashboard last-trip polyline never appear. The batch-aware reader getTripPoints (client/src/lib/firestore.ts:484) handles this exact case and has zero callers. The Cloud Function side (functions/src/triggers/trips.ts:479 readTripPoints) does fall back to batch
- impact: The trip route map - a headline telematics feature - is dead on the entire happy path: users record trips, scoring works, but no map ever shows their route.
- fix: Use getTripPoints() from lib/firestore.ts (batches fallback) in trip-detail.tsx and dashboard.tsx instead of raw getDoc on the parent doc.

### [HIGH][MISSING_STEP] Community pool economy rendered to users has no funding path - addPoolContribution has zero callers and trip triggers never create shares
- where: client/src/lib/firestore.ts:868
- gap: The contribution seam is unwired on main. The only writer that funds the pool or creates poolShares is the addPoolContribution callable (functions/src/http/admin.ts:223); its client wrapper (firestore.ts:868) is called by no page, hook, or checkout flow, and the Stripe payment trigger (functions/src/triggers/payments.ts) never touches the pool. The trip-completion transaction only updates a share 'if (poolShare)' exists (functions/src/triggers/trips.ts:647) - it never creates one. provisionUserOnSignup creates no share, and the client-side createUser->initializePoolShare fallback (firestore.ts:131) is both dead code and blocked by firestore.rules:216 (poolShares allow write: if false). Net r
- impact: Dashboard renders a full pool economy nothing funds - 'Total Pool GBP 0', 'Your Projected Refund GBP 0.00', Safety Factor bar, participants - and the leaderboard header stat shows 'GBP 0k Pool Refunds' permanently; the flagship cashback proposition is inert on main (the seam lives on unmerged rebuild/m4-payments).
- fix: Wire addPoolContribution into the payment success path (checkout/onPendingPaymentWrite) or create the pool share server-side in updateDriverProfileAndPoolShare when absent.

### [HIGH][COMMON_SENSE] Unlocked rewards promise named partner vouchers (GBP 5 Tesco, RAC trial, GBP 25 Amazon) but Redeem Now does nothing at all
- where: client/src/pages/rewards.tsx:86
- gap: Fully wired but human-wrong: RewardsTimeline (RewardsTimeline.tsx:44-110) shows concrete third-party rewards - 'GBP 5 Tesco Clubcard Voucher', 'Free RAC Roadside Rescue Trial', 'GBP 10 Halfords', '500 Nectar Points', 'GBP 25 Amazon Gift Card' - with an emerald 'Redeem Now' CTA when unlocked. handleRewardRedeem (rewards.tsx:86-91) only fires a toast admitting 'Reward redemption will be available when partnerships go live', and because Toaster is never mounted (finding 1) even that apology is invisible. A user who earns the GBP 5 Tesco voucher taps Redeem Now and gets literally zero response.
- impact: The app makes specific monetary promises under named brands with no fulfilment path and no visible explanation - a silent dead button on a money promise, plus brand/legal exposure for naming partners that do not exist.
- fix: Replace 'Redeem Now' with an inline 'Partnerships launching soon' state (or remove named-brand values) until redemption exists, and mount the Toaster.

### [MEDIUM][MISSING_STEP] Weekly leaderboard doc ID: client uses ISO week-year, server uses calendar year - board goes empty around New Year
- where: client/src/hooks/useCommunityData.ts:168
- gap: Client getCurrentWeekPeriod (useCommunityData.ts:161-169) returns `${d.getUTCFullYear()}-W..` where d has been shifted to the ISO week's Thursday (true ISO week-year). Server getCurrentPeriodForType (functions/src/utils/helpers.ts:50-56) returns `${now.getFullYear()}-W..` - calendar year with ISO week number. In the days each year where ISO week-year differs from calendar year (e.g. 29-31 Dec belonging to W01, or 1-3 Jan belonging to W52/53), the scheduled function writes leaderboard/2026-W53_weekly while the client subscribes to leaderboard/2027-W53_weekly (or vice versa).
- impact: Every New Year window the weekly leaderboard reads a document that is never written and shows 'No rankings yet this period' despite fresh server data existing under the other ID.
- fix: Use the same ISO week-year derivation (the Thursday-shifted year) in functions/src/utils/helpers.ts getCurrentPeriodForType.

### [MEDIUM][COMMON_SENSE] Leaderboard 'Pool Refunds' stat floors any pool under GBP 500 to 'GBP 0k' and mislabels total pool as refunds
- where: client/src/pages/leaderboard.tsx:348
- gap: Wired but human-wrong at real scale: `GBP {Math.round(poolRefunds / 1000)}k` renders the pool total in thousands - correct only for the demo's 127000. Any plausible early-stage real pool (GBP 40, GBP 300, GBP 499) displays as 'GBP 0k', and the label says 'Pool Refunds' while the value is pool?.totalPoolPounds (total pool, not refunds paid).
- impact: Real users see 'GBP 0k Pool Refunds' - which reads as 'this product pays nothing' - even once the pool holds real money below GBP 500.
- fix: Format adaptively (GBP 340 below 1k, GBP 1.2k above) and label it 'Community Pool'.

### [MEDIUM][COMMON_SENSE] UK pool finalisation scheduled in America/New_York timezone with a comment claiming midnight UTC, and user-facing 'dollars' error copy
- where: functions/src/scheduled/pool.ts:34
- gap: pool.ts:33-34 schedules '0 0 1 * *' with the inline comment '1st of each month at midnight UTC' but sets .timeZone('America/New_York') - so a UK insurtech finalises its monthly pool at 04:00/05:00 UK time on the 1st, and recalculatePoolShares (pool.ts:167-168) runs at '6 AM UTC' per its comment but actually 6 AM New York. Companion copy gap: addPoolContribution's validation error (functions/src/http/admin.ts:246) tells the user 'Contribution cannot exceed 10000 dollars' in a pounds-denominated product.
- impact: Period boundaries drift 4-5 hours from what the code claims (trips completed 00:00-05:00 UK on the 1st land in the wrong period's share), and any surfaced contribution error talks dollars to UK drivers.
- fix: Set timeZone('Europe/London') (or drop it and fix comments) and reword the HttpsError message to pounds.

### [HIGH][MISSING_STEP] June finding still holds: dashboard score reads drivingProfile.overallSafetyScore, every writer writes currentScore
- where: mobile/app/(tabs)/dashboard.tsx:56
- gap: dashboard.tsx:56 reads `profile.overallSafetyScore ?? 0`, but the only writers of the user driving profile write `drivingProfile.currentScore`: provisionUser.ts:77 (currentScore: 100), functions/src/triggers/trips.ts:633 ('drivingProfile.currentScore'), damoovSync.ts:155. `overallSafetyScore` has never been written anywhere; packages/contracts/src/user.ts:21-27 explicitly documents this as Quirk 6.2 ('mobile shows 0 forever until that reader is fixed'). Verified still unfixed at HEAD e124d7b.
- impact: Every mobile user sees Safety Score 0 in the red tier forever, regardless of real trips or scores - the headline number of a telematics insurance app is permanently wrong.
- fix: Change dashboard.tsx:56 to read profile.currentScore (the contracts-package field).

### [HIGH][MISSING_STEP] Dashboard recentTrips reads id/distanceMeters/durationSeconds; functions write tripId/distanceMiles/durationMinutes
- where: mobile/app/(tabs)/dashboard.tsx:122-131
- gap: The RecentTripSummary written by functions/src/triggers/trips.ts:601-609 has fields {tripId, distanceMiles, durationMinutes, score, routeSummary} (matching functions/src/types.ts:115-120). Mobile renders trip.id (undefined React key), `trip.distanceMeters / 1609.34` and `trip.durationSeconds / 60` (dashboard.tsx:127) - both undefined, so undefined/1609.34 = NaN.
- impact: Once a user completes a real trip, the Recent Trips card renders 'NaN mi · NaN min' for every row, plus duplicate-key warnings; the first moment real telematics data arrives is the moment the dashboard visibly breaks.
- fix: Read tripId/distanceMiles/durationMinutes in the recentTrips mapper (or normalise in the snapshot handler).

### [HIGH][COMMON_SENSE] Waitlist join on the quote screen writes nothing but shows '✓ You're on the list'
- where: mobile/app/onboarding/quote.tsx:35-47
- gap: handleJoinWaitlist contains only `// TODO: write to waitlist Firestore collection`, then unconditionally setJoined(true) and renders the green joined badge (quote.tsx:94-97). handleGetQuote (lines 26-33) similarly alerts "You'll be first in line - we'll email you as soon as quotes go live" while capturing nothing. Every gate passes, the user sees confirmed success, and zero data is persisted anywhere.
- impact: Users are told they joined the waitlist and will be emailed; neither is true. The waitlist is the raise-critical metric (1,000 signups = raise accelerant per CLAUDE.md) and mobile signups silently evaporate.
- fix: Write to the same waitlist collection/API the marketing SPA uses before setting joined, and remove the promise-to-email until an address is actually stored.

### [HIGH][COMMON_SENSE] Hardcoded fabricated social proof: '117 drivers ahead of you - and growing'
- where: mobile/app/onboarding/quote.tsx:83
- gap: The waitlist position 117 is a string literal in the JSX, shown to every user identically and forever. Combined with the no-op join (previous finding), the screen invents both the queue and the user's place in it. Processing.tsx:15 does the same with 'Community pool match found' - no pool matching exists.
- impact: Fabricated numbers shown as live product data in an FCA-sensitive insurance funnel; directly violates the standing no-fabricated-fallback-data rule and is indefensible in a demo or due diligence.
- fix: Read the real waitlist count (or drop the number and say 'Join the waitlist'), and cut the fake 'pool match' checklist line.

### [HIGH][COMMON_SENSE] Onboarding claims 'Driiva is FCA-supervised' two screens before disclosing 'pending FCA authorisation'
- where: mobile/app/onboarding/account.tsx:50-53
- gap: account.tsx:51 and comparison.tsx:57 both assert 'Driiva is FCA-supervised' as fact, while quote.tsx:115 (the very next screen after account) states 'Our insurance product is pending FCA authorisation'. Both strings are fully wired and shown to the same user minutes apart - a self-contradiction, and the 'FCA-supervised' claim is a false statement of regulatory status for a pre-authorisation firm.
- impact: Untrue regulated-status claim inside the product; FS-promotion breach risk and an obvious credibility hit if a broker, investor, or the FCA sees the flow.
- fix: Change comparison.tsx and account.tsx copy to match the quote.tsx disclosure ('pending FCA authorisation').

## Wave M extra findings (9 Aug, team-lead direct)
- **Published score weights were WRONG on driiva.co.uk**: site claimed "We publish the full scoring algorithm" then listed Smooth acceleration 25% / Speed discipline 20%. Real SCORE_WEIGHTS (packages/scoring/src/tripMetrics.ts:45) are speed .25, braking .25, acceleration .20, cornering .20, phoneUsage .10. Speed and acceleration were transposed. FIXED (790bf07). Treat any published algorithm claim as needing a code-sourced test.
- **Hardcoded "117" waitlist count** in FinalCTA + StickyCta while a real /api/waitlist-count endpoint and fetchWaitlistCount() existed with ZERO callers. FIXED (a2fec0c) via useWaitlistCount hook; omits the number entirely when unreadable rather than fabricating.
- **LiveStrip.tsx is dead code** (zero imports) carrying three invented metrics: "117 on the waitlist", "84/100 avg driver score", "GBP 18.4k refunds tracked". Not currently rendered so not user-facing; DELETE it or wire to real sources before it ever gets mounted.
- **M3 CTA copy was already on main** - Jamal shipped Keith's wording earlier; no change needed.
- Footer links instagram.com/driiva while Keith's 3 Aug email said no Instagram exists yet; handle also inconsistent with @driiva_ai used for X and TikTok. HTTP 200 from Instagram is a login wall, not proof of existence - needs Jamal to confirm, left unchanged.
- Screenshot gotcha: Page.captureScreenshot HANGS on this site after scrolling (WebGL background shader keeps the compositor busy). Workaround: remove canvases via CDP, force .reveal-init elements visible, then capture. Do NOT also disable animations globally or the whole page captures blank.

## CRITICAL: five conflicting FCA positions (consolidated 9 Aug)
The product asserted FIVE different regulatory statuses simultaneously. Only "pending FCA authorisation" is accurate pre-authorisation. ALL now aligned, ALL need counsel sign-off before deploy:
1. mobile/app/onboarding/account.tsx - "Driiva is FCA-supervised" -> "Our insurance product is pending FCA authorisation"
2. mobile/app/onboarding/comparison.tsx - "Driiva is FCA-supervised and Shariah-compliant" -> same correction
3. mobile/app/onboarding/quote.tsx - "Our FCA-authorised product is in final review" -> same correction
4. client/src/pages/trust.tsx - badge "FCA Registered" -> "Pending FCA authorisation" + explicit no-permission line
5. apps/marketing/api/lib/waitlist-core.ts - confirmation EMAILS said "Driiva is in the FCA Regulatory Sandbox application phase". This was going to real signups. -> "Driiva Ltd's insurance product is pending FCA authorisation." (fixed 8574b00)

## CRITICAL: the waitlist number was padded at source
WAITLIST_BASE_COUNT defaulted to 117 in apps/marketing/api/lib/waitlist-core.ts and was added to BOTH the published count AND the position in every confirmation email - the first real signup was emailed "You are #118". This is the ORIGIN of the "117" that also appeared hardcoded in four mobile screens and two marketing components. Default now 0 (fixed 8574b00); env var retained so padding is a deliberate act. Jamal decides whether any off-platform cohort justifies a non-zero value.

## Other cross-wave notes
- In-app scoring weights are CORRECT and match SCORE_WEIGHTS canon (mobile dashboard ScoreBar verified). The transposition was marketing-site-only. Fixed.
- Wave 0 found stale Maestro characterisation tests (05-rewards-static.yaml, 06-quote-waitlist-false-success.yaml) that PINNED the bugs it removed; both updated to assert fixed behaviour. Lesson: characterisation tests become bug-preservers once the bug is fixed.
- Expo Go runs a MOCK Firebase layer that resolves without persisting - writing to it recreates the false-success bug behind a real-looking call. joinWaitlist now refuses there explicitly.
- 0e consequence: recentTrips is a FIFO cache of 3 rebuilt per trip completion, so user docs written pre-fix show stale rows until three new trips land. Acceptable pre-launch.
- DEPLOY DEPENDENCY: 0d added a firestore.rules entry for marketing_waitlist (create-only, no client reads). Committed, NOT deployed. Mobile waitlist writes fail permission-denied until rules ship.

## Wave C findings (9 Aug)
- **APP STORE RISK: mobile/app.json:23 declares UIBackgroundModes ["location","fetch","remote-notification"] but NONE of the three is implemented.** No expo-task-manager dep, no registered background task, no push registration (that is Wave D). Apple asks submitters to justify background location and rejects capabilities the binary does not use. MVP item 12 is the App Store listing, so this blocks it. Wave C left capture foreground-only and made the copy honest ("keep Driiva open" + a warning if backgrounded mid-trip) rather than change the plist unilaterally. DECISION NEEDED: remove the unused modes, or implement background capture.
- **iOS native build is blocked (pre-existing, not Wave C):** (1) pod install fails on the Firebase Swift static-library issue - a one-line `use_modular_headers!` in the Podfile fixes it, PROVEN, pods then install cleanly; (2) still blocking: react-native-gesture-handler 2.24.0 will not compile against iPhoneSimulator26.5 SDK ("use of undeclared identifier 'shadowNodeFromValue'", xcodebuild exit 65). Fixing means bumping a shared dep = Wave E, affects every wave. THIS is why no mobile screen has been verified on-device.
- **The emulator suite was testing a schema nothing writes:** it seeded GPS into the tripPoints PARENT doc points array; every real point lands in the batches subcollection, which had zero coverage until Wave C added it. Same class of bug as the dead route map (0g).
- Discarding a trip on mobile ORPHANS its GPS batches: rules forbid client deletes on tripPoints/batches and mobile has no callable-functions client, so the web cancelTrip function is unreachable from the phone. Storage owed, not a correctness hole. Wants a callable or a sweeper.
- Admin trip KPI cards compute over the LOADED WINDOW, not the fleet - already true at limit(100); pagination makes the window variable so Wave C labelled it rather than silently changing what the numbers mean.
- Refund moment deliberately shows NO pence unless a real policy premiumCents exists (D6 unwired). Where a real premium exists it counts up projectedRefundCents labelled as a projection. Correct call - inventing pence is exactly what Wave 0 removed.

## Wave E (iOS) findings, 9 Aug - from SOURCE, not pixels (build still red)
### Native build: 2 of 3 fixed, third located precisely
- FIXED pod install: a local Expo config plugin mobile/plugins/with-modular-headers.js marks Firebase's Swift pods modular. Deliberately a PLUGIN not a Podfile edit, because ios/ is gitignored and regenerated by every prebuild so a hand edit evaporates.
  CORRECTION TO AN EARLIER CLAIM: use_modular_headers! was only ever proven to fix `pod install`, NOT the build. Do not treat it as a build fix.
- FIXED gesture-handler: 2.24.0 will not compile against iPhoneSimulator26.5. Bumped to ~2.28.0 = what `npx expo install --check` says SDK 54 wants (NOT npm's latest 3.1.0). One package.json line, nothing cascaded, suite unaffected.
- STILL RED: build reaches the last pods then fails x4 with `'FirebaseAuth/FirebaseAuth-Swift.h' file not found` at ios/Pods/Headers/Private/Firebase/Firebase.h:40. FirebaseAuth is itself a Swift pod and its generated header is not visible to RNFBMessaging through the Firebase umbrella. Next move: add FirebaseAuth to the plugin's MODULAR_PODS list (attempt 4, AUTHORISED).
- DEAD ENDS, do not repeat: blanket use_modular_headers! -> 38x "module map file gRPC-Core.modulemap not found" (gRPC cannot be forced modular and Firestore depends on it); expo-build-properties useFrameworks:"static" -> 6 non-modular-header errors in RNFBApp whose headers import <React/RCTConvert.h> under -Werror.
### FOURTH BLOCKER - NEEDS JAMAL
There is **no GoogleService-Info.plist in the repo and no iOS app has ever been registered against the driiva Firebase project**. Even a green build launches into a Firebase-init crash. Registering one needs an interactive `firebase login --reauth` (expired creds, OAuth). A gitignored placeholder plist + emulator wiring exists for LOCAL REVIEW ONLY, gated behind BOTH __DEV__ and EXPO_PUBLIC_FIREBASE_EMULATOR=1 so a release build can never point at a laptop. This is a real road-to-TestFlight gap.
### Mobile design findings (source-level, now Wave F)
- **THEME SPLIT-BRAIN**: dashboard, profile, rewards, sign-in still on legacy @/constants/theme; 12 other screens on the Wave A instrument theme. Differ in bg (#0c0a1a vs #0a0a14), cards (translucent rgba vs solid #12111f), secondary text (#94a3b8 vs #8b8b9e). Legacy theme defines NO font families, so those four screens render in the iOS SYSTEM FONT - including the home screen. The translucent cards also put the dashboard in marketing glass mode on an instrument-mode surface.
- **HIERARCHY FAILS THE DESIGN GATE**: mobile leads with Score then stops. Cashback appears nowhere on the dashboard (only in Wave C's transient post-trip modal). Community pool has NO mobile surface at all - "pool" appears on mobile only in legal copy, onboarding prose and one rewards line. Web got pool visuals in B3; mobile did not. Two of the three headline targets are absent from the main screen.
- dashboard.tsx:126-130 HARDCODES the five score weights as strings; they agree with SCORE_WEIGHTS by luck. Exact retyping hazard that produced the transposed marketing weights.
- Dashboard's third stat card is a literal "--" for Rank, dead now that the leaderboard is real.
- Dashboard draws its own 160px circular border instead of the canonical ScoreRing, breaking the 270-degree-arc rule on the screen where the score is the hero.
- **17 em dashes + 2 exclamation marks in shipped mobile copy** (onboarding tinder/quote/viral-moment/solution/motion-priming/index; "Start driving to see your score!"; "Oops!"). STRUCTURAL CAUSE: the design-law harness only runs against WEB routes, so mobile copy has never been linted for anything. Wave F adds a static mobile lint.
- Legacy screens use fontWeight '800', outside the three-weight rule.
- Credit: Wave A stack screens and the Wave B leaderboard read well from source - honest empty states throughout, leaderboard distinguishes "no friends yet" from "no rankings yet", rewards refuses to name vouchers it cannot honour.

## iOS build: attempts 3, 4 and the actual mechanism (9 Aug)
- Attempt 4 (add FirebaseAuth/FirebaseFirestore/FirebaseMessaging to MODULAR_PODS) FAILED, byte-identical to attempt 3: 4x `'FirebaseAuth/FirebaseAuth-Swift.h' file not found` at ios/Pods/Headers/Private/Firebase/Firebase.h:40, xcodebuild exit 65.
- **WHY IT COULD NEVER HAVE WORKED, and the cheap diagnostic that proved it:** FirebaseAuth-Swift.h does not exist ANYWHERE under ios/Pods - zero files. It is emitted by the Swift compiler into build products when the pod is built as a MODULE; under static libraries it is never generated at all. So this was never a header-search-path problem and `:modular_headers => true` cannot fix it. Lesson: when an error says "file not found", check whether the file exists on disk before theorising about search paths.
- **The real mechanism:** attempts 1 and 4 are two halves of one answer. useFrameworks:"static" IS the configuration under which Firebase's Swift pods emit their generated headers (frameworks produce them). Attempt 1 failed for a smaller unrelated reason: 6 errors where RNFBApp's headers import <React/RCTConvert.h>, a non-modular include inside a framework module, promoted by -Werror. That class is switched off by CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES in a post_install hook. Attempt 5 = static frameworks + that setting.
- **Do NOT drop @react-native-firebase/messaging as a shortcut.** It has zero app-code usages and RNFBMessaging is the only pod that failed, so removing it looks cheap - but RNFBAuth and RNFBFirestore import the same umbrella header and would hit the same wall once messaging is gone; they only survived by compiling first. Wave D needs push anyway.
- Progress that survives regardless: pod install works, gesture-handler ~2.28.0 compiles, and the build now gets through ~2,300 compile units (gRPC, BoringSSL, Firestore, reanimated, gesture-handler, codegen, screens, svg, maps) before dying on the final Firebase pod. mobile/ios left in place (gitignored, ~1 GB) so the next attempt skips a fresh pod install.
- **Bundle sizes, corrected:** 4.93 MB = PRODUCTION (expo export, minified, Hermes) and is DOWN 0.23 MB from Wave C's 5.16 MB despite Wave B landing. 11.7 MB = the DEV bundle Metro serves unminified, ships to nobody. Always label which build a size came from.
- Review tooling is written and exercised except the final capture: the emulator seed RUNS and was verified through the admin SDK (seed-trip-000, score 74, 40 GPS points in its batch, all three leaderboard periods), driiva:// is confirmed registered in the built Info.plist, and scripts/review-mobile.sh does launch + sign-in + sweep in one command. It needs only a working build.

## Wave F findings (9 Aug) - the mobile UI lift
### THE WORST FABRICATION IN THE PRODUCT, and Wave 0's scan missed it
**mobile/app/onboarding/index.tsx - the FIRST screen any new driver sees - opened with a fabricated leaderboard**: two invented drivers with invented refunds of GBP 182 and GBP 167, plus a live ticker reading "GBP 47 refund processing now". **Driiva has never paid a refund.** Wave 0's 0a killed the fake social proof further down the onboarding flow and missed this one entirely. Now a plain three-step explanation of the model with the FCA-safe caveat.
LESSON: the Wave 0 fabrication scan was grep-driven off KNOWN literals (DEEP_INSIGHTS, "117", Meera/Jordan/Marcus). It could not find a fabrication whose literals nobody had named yet. A source-level lint that runs over ALL mobile copy is what caught this - which is why F4's mobile-source-laws harness matters more than the em dashes it was commissioned for.
### The theme split-brain was worse than reported: THREE themes, not two
constants/theme (dashboard, profile, sign-in, sign-up, both auth layouts, tab layout, ALL 16 onboarding screens), components/ui/theme, and the Expo starter's light/dark constants/Colors behind components/Themed. All 29 importers now on @/components/ui/theme. DELETED: constants/theme.ts, constants/Colors.ts, Themed, useColorScheme(.web), useClientOnlyValue(.web), ExternalLink, AppBackground - all had zero callers left (retired means deleted).
- fontWeight removed from the ENTIRE mobile codebase, not just the '800' cases: React Native picks a face by family NAME, so a weight on top of a named face either does nothing or synthesises a fake bold. The three allowed weights are three families. Enforced by law 5.
- GlassCard -> SurfaceCard on solid surfaces across 12 callers (glass is marketing-mode only).
- TWO ScoreRings became one, and it is now a genuine 270-degree arc (SVG path opening at the bottom), not a 360-degree ring. Reduce-motion aware, accessibility label.
- Four rgba(107,95,220) tints were the OLD accent hue, retained after it became #5b4dc9. Now alpha(RGB.primary, x) off triplet tokens. (Exactly the stranded-alpha-literal class from feedback_token_retune_strands_alpha_literals.)
### F2: how the hierarchy and honesty requirements were resolved
**The hierarchy requirement decides POSITION; the honesty constraint decides CONTENT. An empty tile in the right place, never a plausible number.** Dashboard now leads Score -> Cashback -> Pool. Cashback shows projectedRefundCents ONLY where a real premium exists (same helper + guard as Wave C's refund moment), labelled a projection; no policy means no figure plus a line on what has to happen first. Deliberately NO "earned to date" figure - no refund has ever been paid, so it would be a zero dressed as a metric. Pool shows participants + share PERCENTAGE, never pounds, "Opens at launch" when empty.
### NO iOS BUNDLE HAD BUILT SINCE WAVE D
`expo export --platform ios` failed at 96% with "Unable to resolve module zod from packages/contracts/src/money.ts". Sources under packages/ are watched but live OUTSIDE the Metro project root, so Metro walks up from their directory and never reaches mobile/node_modules. Broken since D1 pointed the rewards tab at @driiva/contracts. **Nothing caught it**: tsc resolves zod from the repo root and stays clean, and no unit suite bundles. One line in mobile/metro.config.js (resolver.nodeModulesPaths naming both roots) fixes it. With it, the iOS JS bundle exports clean: 5.6 MB Hermes, 1932 modules, all seven brand font faces present.
LESSON: typecheck-clean plus tests-green does NOT prove a React Native app can be bundled. Only a bundle proves that. Add an export to CI.
### Also fixed
21 emoji and dingbats standing in for icons (back arrows, ticks, refresh glyph, four onboarding bullets) -> Ionicons, colour-matched so no new colour was spent. An arrow used as punctuation in a trip detail title -> the word "to". 17 em dashes + 2 exclamation marks.
### F4 harness
tests/mobile-source-laws.mjs = 7 laws (dashes, exclamations, emoji, colour literals outside the palette file, fontWeight, capsules with a square-box exemption, legacy-theme imports). Zero deps, no simulator, no Metro. Wired as npm run design:laws:mobile (+ :plant), into ci.yml, AND as a vitest test so the default suite covers it - the plant case is a test, not a flag someone has to remember to run.

## Wave G - web/marketing fabrication sweep (9 Aug). THE MOST SERIOUS SET IN THE LIFT.
### HEADLINE: a downloadable "policy document" asserting FCA authorisation with an INVENTED registration number
client profile had a "Download My Policy" button generating an HTML document the driver KEEPS, reading "Driiva Ltd. Authorised and regulated by the Financial Conduct Authority. Registration number: DRV123456", plus policy start/end dates, unlimited third-party liability, GBP 100,000 personal injury cover, and a "Claims Hotline" 0800 number nobody answers. **Every fact except the driver's own name and email is invented.** There is no honest edit of a policy document for a company with no policies: component and call site DELETED.
**THIS WAS A KNOWN FINDING.** project_driiva_rebuild.md's July audit already listed "PolicyDownload fabricates an FCA registration number" among its biggest findings. It sat unfixed for a month. A finding that is recorded but not ticketed is not a finding.
### Fixed (4 commits)
- G1 regulatory: trust.tsx CONTRADICTED ITSELF - a "Pending FCA authorisation" badge with, forty lines below, "authorised and regulated by the Financial Conduct Authority". A Wave 0 comment sits directly above the badge recording that this same correction was already made once, to the badge, and the disclaimer was missed. Also removed present-tense "underwritten by our capacity partner". On marketing, three loud surfaces stated reinsurance backing as fact while the FOOTER already carried the truthful conditional; two promised claims would be paid, incl. the FAQ answering "What happens if I have an accident?" with "Your claim is paid immediately and in full by our reinsurance capital" to a visitor who by definition holds no policy. Killed "our modelling shows the top 40% of drivers save 8 to 15%" - no model, no book, no renewal data.
- G2 counts: "Join thousands of safer drivers" (signup) and "Join thousands of drivers sharing rewards" (onboarding) deleted. LiveStrip.tsx deleted (its 117 was WAITLIST_BASE_COUNT hardcoded, plus "GBP 18.4k refunds tracked" asserting money has moved). Ten dead client files deleted, zero importers each, tsc+suite green after. QuickActions carried a GDPR export link with **user id 2 hardcoded** - would have exported another account.
- G3 pool: marketing Pool.tsx animated "68% of reserve target" under "Pool funded, Q1 2026" - a funded percentage against a named quarter, the most concrete financial claim on the public site, from a constant called POOL_FILL_PCT. Gone; the worked example survives under "Illustration, not a quote / Nothing is paid until we are FCA-authorised".
- G4: policy.tsx stated four things as TERMS (hardcoded cover list under green ticks, "paid out within 14 days of period close", "refunds ranging from 5% to 15% of your annual premium", plus a cadence that contradicted itself monthly/quarterly). aiInsights.ts returned `betterThan = Math.round((score/100)*100)` - the driver's OWN SCORE relabelled "you drive better than N% of the community". Now null. (Nothing in client/ or marketing calls /api/insights today, but the route is live.)
### THE LINT (tests/fabrication-laws.mjs, npm run fabrication:laws, in ci.yml + vitest)
Does NOT grep for known lies - that is the method that failed. Greps for the five SHAPES a lie takes here (regulatory/underwriting claims, how-many-people-use-this claims, money-has-moved claims, placeholder identities/contacts, any pounds figure in a rendered component) and requires every hit to be acknowledged BY NAME in an allowlist WITH A REASON. A new hit does not have to be false, it has to be ARGUED FOR. Already earning it: flagged 0800 023 4567 on the complaints page, which is the REAL Financial Ombudsman number beside their real address - now recorded so nobody re-investigates it.
### REPORTED NOT RESOLVED - needs Jamal
1. **TWO LEGAL ENTITIES.** apps/marketing says "Driiva Technologies Ltd." INCLUDING IN TERMS ("These terms form a contract between you and Driiva Technologies Ltd.") and Privacy. client/ and CLAUDE.md say "Driiva Ltd". One does not exist, and one is named as the counterparty in a contract with every site visitor.
2. **SIGNUP WRITES A FAKE POLICY ONTO EVERY NEW USER.** provisionUserOnSignup.ts:148-150 writes GBP 100,000 liability, GBP 500 collision excess, GBP 250 comprehensive excess, includesRoadside:true to policies/{id}.coverageDetails, mirrored to users/{uid}.activePolicy. Line 63 mints SEQUENTIAL DRV-### numbers from a shared counter, so signup 12 gets DRV-012 and can read it as being the twelfth policyholder. status:'pending' is the only honest field and is one careless renderer from being ignored.
3. **CHECKOUT BINDS A POLICY IT CANNOT BIND.** checkout.tsx shows "Policy activated!" / "Your Driiva insurance policy is now active", labelled "Powered by Root Platform", while the Root call sits in a try/catch silently falling back to the local invented estimate. insuranceInternal.ts:96 hardcodes status 'active'; :99 invents `DRV-${Date.now()}`; payments.ts:128 pushes "Your policy is active!" to the lock screen.
4. **SANDBOX CURRENCY.** functions/src/http/insurance.ts:61 defaults ROOT_ENVIRONMENT to 'sandbox' and the file's own header says the Root sandbox uses **ZAR** cents. It returns as premiumCents and renders with a GBP sign. CHECK WHAT THAT ENV VAR IS IN PRODUCTION - the code default is the wrong one.
5. The quote is invented then charged: pricingEngine.ts invents the whole rating table (base GBP 1,200, age/postcode factors, NCB steps) and clamps to 480-2400. That number is the headline price AND the amount taken from a card.
6. Policyholder records created as "Driver Unknown": insurance.ts:195-204 falls back to firstName 'Driver', lastName 'Unknown', email `${userId}@driiva.internal`. provisionUser deliberately writes displayName null for email signups, so this is the COMMON case - a false identity on an insurance record at a non-deliverable address.
7. Medium: server/seed.ts fabricates a GBP 105,000 pool with 1,000 participants and a test driver with a GBP 100.80 refund at rank 14, and storage.ts throws "seed it first" - the app is DESIGNED to require the fabricated row. betaEstimateService writes a GBP 750-based premium to users/{uid}/betaPricing on every user-doc update, unprompted. Dashboard renders "Safety Factor 100%" off a 1.0 default; leaderboard renders "Avg score 0.0" as a measured community statistic. tripAnalysis.ts asks the model for incident timestamps and weather it never gave it, and compares every first trip against STARTING_SCORE 100 as though it were a measured historical average.
8. Could not verify: whether WAITLIST_BASE_COUNT is SET in Doppler prd (one `doppler secrets --project driiva --config prd --only-names | grep WAITLIST` settles it). And "UK-sovereign servers only" - functions are pinned europe-west2 which supports it, but the Firestore location is not in the repo and the client is on Vercel edge. Unproven, not false.
9. Local-only: apps/marketing `npm run build` fails in a worktree (its lockfile pins TS 5.9.3, hoisted root 6.0.2 wins, TS6 errors on deprecated baseUrl). Vercel installs marketing's own lockfile so the deploy is unaffected. Fails identically at the branch point.

## iOS build: the full five-attempt ledger, and the actual answer (10 Aug)
**Both ends of the axis fail, for opposite reasons.** This is why every single-setting fix "almost" worked:
- STATIC LIBRARIES: Firebase's Swift pods never emit their generated headers at all (FirebaseAuth-Swift.h existed in ZERO places on disk). No amount of `:modular_headers => true` can fix this - the file is not there to find. Attempts 3 and 4 were byte-identical for this reason.
- STATIC FRAMEWORKS (attempt 5): the headers ARE generated exactly as predicted (verified in DerivedData; that error count went 4 -> 0, so the hypothesis was CORRECT). But frameworks turn on Clang modules, and RNFB's Objective-C headers depend on React Native macros/types arriving by TEXTUAL import, which modules do not carry. 44 errors: `declaration of 'RCTPromiseRejectBlock' must be imported from module 'RNFBApp.RNFBAppModule' before it is required`, `unknown type name 'RCT_EXTERN'`, 22x "type specifier missing", then -ferror-limit.
**THIS IS A DOCUMENTED UPSTREAM BUG, NOT A MISCONFIGURATION.** RN 0.81 reorganised internal headers for the New Architecture so they are no longer publicly exposed in the static React-Core framework. See invertase/react-native-firebase #8657, #8960, #8988 and expo/expo #39607 (literally "SDK 54, non-modular header errors with @react-native-firebase/app + auth, useFrameworks static").
**THE ANSWER, per the RNFB maintainer on #8657:** "the main trick is expo-build-properties usage, with configuration to forceStaticLinking for the correct pods" - i.e. PER-POD forceStaticLinking via expo-build-properties, which is a THIRD mechanism, neither useFrameworks nor Podfile modular_headers. A working demonstrator script for Expo 53/54/55 on RN 0.81 is linked in that issue's comments. Attempt 6 follows it.
LESSON for this class: five 40-minute builds bought understanding, and the thing that actually unblocked it was fifteen minutes of reading upstream issues. When a native build fails twice in the same place, search the ecosystem BEFORE the third attempt - a stack this mainstream (Expo 54 + RN 0.81 + react-native-firebase) means someone has already hit it.
### Retired findings (verified against the merged branch, not taken on trust)
- Dashboard now imports SCORE_WEIGHTS from @driiva/scoring; the hardcoded "25%" strings are GONE.
- Mobile copy: zero em dashes, zero exclamation marks. Structural cause fixed by Wave F's tests/mobile-source-laws.mjs (7 laws, CI + default suite).
### Handover state if the build is ever abandoned
scripts/review-mobile.sh does launch + sign-in + sweep in one command and checks its preconditions rather than filing home-screen shots as surfaces. The emulator seed runs and was verified through the admin SDK. driiva:// is registered in the built Info.plist. mobile/ios is left in place (gitignored, ~1 GB) so a follow-up skips pod install. It needs only a green build.
MERGE WATCH: mobile/metro.config.js is touched by BOTH Wave C (original) and Wave F (zod resolution fix). Both changes are additive to the same block; do not let it auto-resolve carelessly.

## iOS BUILD IS GREEN (10 Aug) - "0 error(s), 11 warning(s)", app launches on iPhone 16 Pro sim
**THE FIX: forceStaticLinking AND use_frameworks TOGETHER, not instead of each other.** My relayed summary said forceStaticLinking INSTEAD OF useFrameworks and that was MATERIALLY WRONG - Expo's own docs state forceStaticLinking "is only relevant when use_frameworks! is enabled". They are a pair. **Attempt 5 was ONE PROPERTY SHORT of the documented fix**: it had the frameworks half and none of the per-pod half. The 44 errors matched another user's report in the same upstream thread verbatim.
LESSON: I fetched a summary and relayed it as instruction. It would have sent the agent down a fourth wrong axis if I had not also told it to read the primary source and flag contradictions. **Relay the link, not your paraphrase, when the paraphrase is load-bearing.**
Config that works (Expo SDK 54 / RN 0.81 / react-native-firebase): expo-build-properties FIRST in the plugins array, forceStaticLinking listing only the RNFB pods the app actually uses (RNFBApp, RNFBAuth, RNFBFirestore, RNFBMessaging), plus the @react-native-firebase/app plugin. The bespoke with-modular-headers plugin was DELETED - keeping a hand-rolled fix beside the upstream one is how they drift.
**Verification gotcha:** forceStaticLinking is applied by expo-modules-autolinking inside use_expo_modules!, so it NEVER appears as text in the Podfile and cannot be confirmed by reading it. Confirm via the pod install line: `Forcing static linking for pods: ["RNFBApp", ...]`.
**Harness gotcha:** build 6 ran to zero errors then had its WRAPPER killed by a harness timeout, not a compile failure. Re-run identically under nohup to survive.
### FirebaseApp.configure() WAS NEVER CALLED - latent on main all along
Not exposed by the frameworks change. The RNFB config plugin anchors its Swift insertion on `self.moduleName = "..."`, which the Expo SDK 54 AppDelegate no longer contains (it now uses factory.startReactNative(withModuleName:)). The plugin logs "Unable to determine correct Firebase insertion point in AppDelegate.swift. Skipping Firebase addition." and still adds the import, so **the file LOOKS wired**. Net effect: the mobile app has NEVER initialised Firebase natively, and it was undiscoverable because nobody had ever completed a native build. The symptom would have surfaced much later as "No Firebase App '[DEFAULT]' has been created" on the first Firestore call. Caught by READING THE PREBUILD LOG rather than by launching - fixed in principle, not yet proven at runtime.
### Merge note (resolved as predicted)
premium-lift/main merged into the iOS branch cleanly; mobile/metro.config.js took Wave F's zod line and Wave C's @shared/@driiva aliases without conflict. BUT the merge brought two NEW NATIVE modules from Wave D (expo-notifications, expo-store-review) that were not in the just-built binary, so capturing against it would have crashed or silently no-opped on any screen touching them. Rebuilding incrementally against the merged tree first. **Native modules landing in a JS-only merge invalidate an existing binary.**

## The cold-launch "dead route" - THREE defects, and neither hypothesis was right (10 Aug)
We both assumed persisted navigation state. NOTHING persists navigation state in this app. Three separate defects combined:
1. **There is no app/index.tsx**, so the "/" route genuinely did not exist. A cold launch resolves "/", matches no file, falls through to +not-found. That was the whole "stale route" mystery: the start route had no screen behind it.
2. **AuthGate had no branch for it.** It redirected a signed-OUT user away from any non-auth route (which is why signing out appeared to fix it and sent us both chasing auth state), but a signed-IN user sitting on +not-found matched NEITHER branch, so nothing ever moved them.
3. **The escape hatch pointed at the hole.** +not-found linked to "/", the route that did not exist, so tapping "Go to the dashboard" re-rendered +not-found. We both read that as "the tap did not register". It registered perfectly and looped.
It was ALSO the last remaining mobile tsc error, because "/" is not in the typed route union - the compiler had been pointing at this the whole time.
FIX: routing decision extracted to mobile/lib/routing.ts as a PURE FUNCTION (a cold launch onto an unrecognised route must be testable without a navigator, which is exactly why nothing caught it), app/index.tsx created, +not-found links to the dashboard directly. 23 tests in tests/unit/mobile-routing.test.ts.
THE TRAP IN THE FIX: treating "not in a known group" as stranded would have bounced a driver out of Settings the moment they opened it. Tests cover every root stack screen NOT being treated as stranded.
VERIFIED: two consecutive cold launches signed in, both landing on the dashboard with real data; one signed out reaching sign-in; crash reports unchanged at 6. 07-cold-launch.png.

## A withdrawn finding, worth recording as a pattern
The agent reported "the arc and all three tiles count up, four numbers move at once" and I passed it on. It then CHECKED before changing anything: StatCard has no CountUp, no Animated, no reanimated import at all. Exactly two figures animate - the hero score arc and the cashback value - and the pool CountUp only renders when the pool has participants. The nit was inferred from a still screenshot rather than read from the component.
Third instance of the same shape from this agent (use_modular_headers "proven", the 11.7MB dev-vs-prod bundle, this) - and the first one caught BEFORE it became a code change. That is what checking first is for. Two animated figures, hero plus the emotional payoff, is a defensible arrangement; left as is.

## The design-law harness was reporting green on routes it never reached
design:laws walked /dashboard, /trips, /leaderboard and /rewards, ALL of which redirect to /signin without auth, so four of the five "green" routes were the sign-in page measured four times. Every "design laws green" claim before this was that weak. Now it refuses to report on a route it did not land on, enters the product's own demo mode, and waits for skeletons to clear.
On seeing the real pages for the first time it immediately found: a Demo Mode CAPSULE in four files rendered in the green reserved for an earned score, slate-900 painted by the install prompt, six em dashes standing in for "no value yet", secondary type under the 13px floor, and non-tabular distance readouts.
LESSON: a harness that cannot tell "passed" from "never got there" reports the second as the first. Assert on arrival before asserting on content.

## The font was NOT only a stale binary - I was half wrong
Nine elements set fontFamily inline to "Inter, sans-serif" or "system-ui", and Inter is not one of the three faces the site loads, so all nine rendered in the browser fallback. That is the legacy system font Jamal kept seeing, live in merged code. Separately the app is written almost entirely in text-sm (346) and text-xs (229), so Tailwind's untuned 14/20 and 12/16 WERE the reading experience. Fixed by putting the Driiva ladder in tailwind.config.ts (every existing text- class recalibrated, no component edits) + a law that no component may name a font family.

## TestFlight blocker: iOS app REGISTERED (10 Aug)
The Firebase CLI was already authenticated as jamal@driiva.co.uk, so the "needs an interactive firebase login --reauth" blocker I reported twice was WRONG - it needed no reauth at all. Registered:
  App ID 1:894211619782:ios:a6444d134de5fe2f0490c7, bundle com.driiva.app, project driiva
Real GoogleService-Info.plist downloaded to mobile/GoogleService-Info.plist. app.json already pointed at ./GoogleService-Info.plist, so the placeholder path is now backed by a real config. mobile/eas.json created (dev/preview/production profiles).
**The plist is GITIGNORED and must stay that way: the repo is PUBLIC.** Supply it to EAS as a file secret (`eas secret:create --type file`), not by committing it.
REMAINING for TestFlight, and it is Jamal's: Apple App Store Connect credentials (interactive login), an EAS project link, and the ascAppId in eas.json.

## THE REPO IS PUBLIC, and memory said otherwise
`gh repo view mrshippers/Driiva` returns visibility PUBLIC. reference_strydeos_repo_public / the Driiva memory claimed PRIVATE since 26 Jul. It is not. Every commit pushed today is public, and Jamal's own standing constraint in CLAUDE.md is "Private repos, nothing public until explicitly ready". Secrets live in Doppler so nothing credential-shaped is exposed, but the whole codebase, firestore rules and business logic are.

## Environmental data for scoring (Keith's question 3) - the real options
Contextual signals (weather, road type, posted speed limit per GPS point) are standard in UK telematics ratemaking, and research finds speed limit, weather, temperature and road slope the strongest predictors of risky events.
- **Speed limit / road type per point:** OpenStreetMap via Overpass or an OSRM `nearest` snap reads the `maxspeed` and highway class tags, self-hosted and free. TomTom Snap to Roads is the strongest paid option - low per-1000 cost, a real free daily tier, no monthly subscription. HERE only forces an enterprise plan above 10M requests/month. Google Roads gives speed limits but the Asset Tracking licence is ~$10,000.
- **Weather at a point in time:** Open-Meteo (free, no key, historical + forecast) is the obvious starting point; Met Office DataPoint is the UK-authoritative alternative.
- **Recommendation:** OSM/OSRM self-hosted for road context plus Open-Meteo for weather gets a working v1 at zero marginal cost, with TomTom as the paid upgrade once volume or accuracy justifies it. NB Wave G found tripAnalysis.ts already ASKS the model for weather and incident timestamps it was never given - so the model has been inventing this context. Wiring a real source closes a fabrication as well as adding a feature.

## Behaviour probe closed both open checks (10 Aug, late)
Ran with Chrome relaunched on 9222 + apps/marketing on :5271, `node behaviour.mjs http://localhost:5271`:
- **reduced motion: 31 reveal-init elements, 0 still invisible.** The CSS override DOES resolve, so no content is hidden from anyone with the setting on. This was the check that mattered most - had it failed, content would have been invisible to those users.
- **404 renders correctly**: h1 "Not found.", wordmark present, 16 links, back link.
- **The new focus ring is applied**: outline solid 2px rgb(251,191,36) with a box-shadow outer ring, on buttons and footer links.
FOUND BY THE PROBE, not by reading source: the marketing 404 reuses the legal-document shell, which prints "Last updated <date>" unconditionally, so the not-found page was stamping itself **LAST UPDATED 2026-05-19**. A page with no content to revise has no revision date. Prop is optional now; only documents pass it. (Fixed 222a5cd.)
LESSON REINFORCED: the agent deliberately did NOT write a jsdom test for the CSS reduced-motion path, because jsdom applies no stylesheet and would have reported those elements at opacity 0, manufacturing a bug that does not exist. A green test on a mechanism the test cannot observe is worse than an honest gap. The JS half IS now under test and runs on every commit; the CSS half needed a real browser and got one.

## The regex CSS delete: a green suite against a site that did not boot (10 Aug, late)
Deleting the glass rule blocks by regex tore the middle out of a comma-separated selector list inside a media query, leaving unparseable CSS. PostCSS threw, Vite could not compile the stylesheet, and **the app rendered a blank #root on every route**.
**tsc passed and 673 tests passed straight through it**, because neither parses CSS. The only thing that caught it was the design-law run reporting "nothing rendered" rather than a law being broken. A green suite against a site that does not boot is the whole theme of this lift in one incident.
FIX: the stylesheet is now validated with the parser itself (parses, no empty rules or at-rules left behind). VERIFY A CSS CHANGE BY BOOTING THE APP AND READING #root, not by running tests.
Coordinator verification after merge: postcss parses with 0 empty rules; vite serves 200; CDP read of /welcome shows root with 2 children and real copy, i.e. not blank.

## Dashboard rescue (task/premium-k-dashboard, merged)
- **ScoreRing on web was a 360-degree ring with SIX literal hex values** encoding a tier ramp the design system does not have. Now the same 270-degree arc mobile draws, geometry and polar maths COPIED from mobile/components/ui/ScoreRing.tsx rather than re-derived so the two cannot drift. Gradient from tokens as CSS properties (an SVG attribute will not resolve a var()). 5 tests pin it incl. "dash array is three quarters of the circumference and NOT the whole of it". 0 literal hex remains.
- **Glass was bigger than the three cards**: `dashboard-glass-card` was misnamed twice over - the app is instrument mode AND its background was already opaque, so its backdrop-filter could never show anything through while still costing a compositing layer and a blurred backdrop raster on every card. Renamed `.instrument-card` across 50 call sites. 22 rule blocks removed, `.glass-morphism` was defined THREE times, the last with !important and a real translucent radial gradient. Deleted rather than overridden, because an override leaves the blur live underneath and one specificity change brings it back.
- Sentence case via a transform with a keep-list; Terms of Service keeps its capitals as a document name.
- 13 hand-rolled ring spinners -> ArcTracer (which already draws the 270 sweep). One used border-t-emerald-400: emerald means an earned score on this palette, so spending it on "still loading" broke the colour rule as well as the shape rule. ArcTracer gained a `decorative` option so four beside existing copy do not create a second live region saying the same thing. 20 Lucide icon-in-button spinners left alone as a different idiom.
- **Fresh-worktree gotcha, again**: a fresh worktree reports 614 tests, not 673, because five suites never LOAD until mobile/ and functions/ are installed (mobile/tsconfig extends expo/tsconfig.base; functions needs firebase-functions). That is a load gap, not a regression.
- design:laws sign-in hop still broken and now better diagnosed: **VITE_USE_FIREBASE_EMULATOR must be in .env.local, not the shell** - Vite reads VITE_* from env files rather than process.env, so passing it inline does nothing. Dev server binds 3001 not 5173, so DEV_URL is required. With all three right, sign-in still returns "Network error", so the break is upstream of the harness.

## Mobile typecheck: a stale GENERATED file, not a regression (11 Aug)
After merging the type-ladder work, `cd mobile && npx tsc --noEmit` reported 11 errors, all "Argument of type '/settings' is not assignable" for the screens Wave A created. **All six screens exist.** The cause was `.expo/types/router.d.ts` dated 28 JULY, i.e. generated before those screens were written, so expo-router's typed-route union did not contain them.
Two things worth knowing:
- **`expo export` does NOT regenerate the typed routes.** Only the dev server does. `npx expo start` writes `.expo/types/router.d.ts`; running an export and expecting fresh types wastes a build.
- Regenerating first required `npm install` in mobile/, because the main checkout was behind package.json and missing `expo-build-properties`, which made config resolution fail before typegen ran. The error surfaces as a PluginError about node modules, not as anything type-shaped.
After `npm install` + a 45s `expo start`, mobile tsc is 0 again. The file is gitignored, correctly, so this can recur on any fresh checkout and is NOT a code fault. Earlier "mobile tsc 0" readings were taken where the stale union did not constrain the check.

## Mobile type ladder (task/premium-l-mobile-type, merged)
108 hardcoded fontSize values across mobile/app and mobile/components -> 0. Two thirds were the ladder RETYPED (33 uses of 15 where FS.md is 15, 17 of 13 where FS.sm is 13), so nothing moved on screen.
Read rather than rounded:
- The onboarding headline across TEN screens was fontSize 26 with lineHeight 32, and LH.xxl is 32 - the leading was already a step ahead of the size. Snapping size to FS.xxl makes them agree. Its letterSpacing -0.025 was an em value in a px field, doing nothing visible.
- 14 SPLIT BY ROLE rather than going one way: readable content beside 15px body went UP to FS.md; the three quiet skipText labels went DOWN to FS.sm. Rounding all thirteen the same way would have either shrunk body copy or removed the de-emphasis.
- **THREE OVERRIDES WERE ALREADY STRANDING THEIR LEADING**, two of them pre-existing: `{...T.stat, fontSize: 20}` kept xl's 28px leading under 20px type. Converting a literal to a token WITHOUT pairing the leading preserves the fault in nicer clothes, which is worse because it then looks compliant.
- One real gap: RefundMoment set fontSize 72 over T.hero and inherited LH.display, so a 72px number had 48px leading. FS.mega/T.heroLg added deliberately rather than leaving the literal.
**THE LAW WAS SCOPED TO mobile/components/ui**, which is exactly how 108 off-ladder sizes survived a law named after them. A law that exempts the place the problem lives reports green forever. Now covers all of mobile/, planted sample moved to mobile/app so the plant exercises the widened scope.
Its own new assertion caught the author's first attempt: LH.mega was 76 on 72px type, a 1.06 ratio where display sits at 1.0 - looser rather than tighter, a different curve rather than a bigger step. Second time this week a guard written in the same commit caught the mistake in that commit.
