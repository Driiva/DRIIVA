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
