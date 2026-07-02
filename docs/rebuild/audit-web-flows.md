# Characterisation audit — Web client flows (WEB-01..WEB-31 + FLOW-01..18)

> Rebuild mission, 2026-07-02. Read-only audit of `client/`. Router: `client/src/App.tsx`; auth state: `client/src/contexts/AuthContext.tsx`.

## Route index (all 32 registered routes)

| WEB-id | Path | Component | Guard |
|---|---|---|---|
| WEB-01 | `/`, `/welcome` | pages/welcome.tsx | none |
| WEB-02 | `/signin`, `/login` | pages/signin.tsx | PublicOnlyRoute→/dashboard |
| WEB-03 | `/signup` | pages/signup.tsx | PublicOnlyRoute |
| WEB-04 | `/forgot-password` | pages/forgot-password.tsx | PublicOnlyRoute |
| WEB-05 | `/verify-email` | pages/verify-email.tsx | ProtectedRoute skipOnboarding+skipEmailVerification |
| WEB-06 | `/demo` | pages/demo.tsx | none |
| WEB-07 | `/terms` | pages/terms.tsx | none |
| WEB-08 | `/privacy` | pages/privacy.tsx | none |
| WEB-09 | `/trust` | pages/trust.tsx | none |
| WEB-10 | `/permissions` | pages/permissions.tsx | none (orphaned in UI graph) |
| WEB-11 | `/onboarding` | pages/onboarding.tsx (legacy flat file) | none (self-guards) |
| WEB-12 | `/quick-onboarding` | pages/quick-onboarding.tsx | ProtectedRoute skip+skip |
| WEB-13 | `/dashboard` | pages/dashboard.tsx | ProtectedRoute |
| WEB-14 | `/trips` | pages/trips.tsx | ProtectedRoute |
| WEB-15 | `/trips/:tripId` | pages/trip-detail.tsx | ProtectedRoute |
| WEB-16 | `/trip-recording` | pages/trip-recording.tsx | ProtectedRoute |
| WEB-17 | `/profile` | pages/profile.tsx | ProtectedRoute |
| WEB-18 | `/settings` | pages/settings.tsx | ProtectedRoute |
| WEB-19 | `/rewards` | pages/rewards.tsx | ProtectedRoute |
| WEB-20 | `/leaderboard` | pages/leaderboard.tsx | ProtectedRoute |
| WEB-21 | `/policy` | pages/policy.tsx | ProtectedRoute |
| WEB-22 | `/checkout` | pages/checkout.tsx | ProtectedRoute (UI-graph dead-end, URL-only) |
| WEB-23 | `/achievements` | pages/achievements.tsx | ProtectedRoute |
| WEB-24 | `/support` | pages/support.tsx | **none** (deliberately public) |
| WEB-25..30 | `/admin`, `/admin/{users,trips,feedback,system,monitoring}` | pages/admin/* | ProtectedRoute + AdminRoute |
| WEB-31 | `/home` | components/HomeRedirect.tsx | none (pure redirect) |

Guards: ProtectedRoute — loading→BrandedLoader; no user→/signin; admin resolution from `user.isAdmin===true` OR `VITE_ADMIN_EMAILS` (parsed independently in 3 files: AuthContext.tsx:51-54, ProtectedRoute.tsx:15-18, verify-email.tsx:29-32); unverified→/verify-email (unless skip flag / `sessionStorage['driiva-skip-email-verification']` / admin); `onboardingComplete===false`→/quick-onboarding. **Universal bypass: `sessionStorage['driiva-demo-mode']==='true'` skips every check.** AdminRoute (App.tsx:51-92): waits ≤8s for isAdmin then children or "Access denied".

## Page highlights and quirks (full detail per page)

### WEB-01 /welcome
Public splash; carousel (3 cards, 5s auto-advance, global keydown listener, touch swipe); auto-redirect to /dashboard if onboarded. "Continue as {name}" from `localStorage['driiva-last-user']`. CTAs → /signup, /demo, /signin; footer → /privacy, /support, /terms. Quirks: silent localStorage parse catch; bfcache `.hero-orb` animation workaround; hardcoded "driiva © 2026".

### WEB-02 /signin
Real Firebase only. Username→email via Firestore `usernames/{key}` with fallback GUESS `${raw}@driiva.co.uk` on miss OR network error. `localStorage['driiva-last-user']` written after email+Google sign-ins but NOT biometric. WelcomeBackOverlay auto-dismisses 1.8s. Google path always targets /dashboard regardless of onboarding (differs from email path). "Switch account" = full `window.location.reload()`. BiometricAuth renders only for returning users. Google popup cancel = silent.

### WEB-03 /signup
"Step 1 of 2". Advisory-only username duplicate check (3s race). `createUserWithEmailAndPassword` (8s race) → navigate `/quick-onboarding` immediately → Firestore batch (`users/{uid}` with BOTH `onboardingCompleted` and `onboardingComplete` false + `usernames/{localPart}`) + `updateProfile` + `sendEmailVerification` fired un-awaited, failures swallowed. Blocks example.com/example.org/test.com emails.

### WEB-04 /forgot-password
`sendPasswordResetEmail`; `auth/user-not-found` treated as success (anti-enumeration). Cleanest auth page.

### WEB-05 /verify-email
Link mode (`?mode=verifyEmail&oobCode=`) → `applyActionCode` → /dashboard. Manual "I've verified" → reload+check. Resend limited 1/60s client-side. "Skip for now" → sessionStorage skip flag (permanent for session). Admins auto-redirect to /admin/monitoring. Zero console logging (toast-only — and toasts never render, see Toast section).

### WEB-06 /demo
Sets `sessionStorage['driiva-demo-mode']='true'` + `driiva-demo-user` (hardcoded DEMO_USER_DATA: demo-user-1, score 82, poolTotal 105000, 3 trips with fixed Feb-2026 dates — stale vs today; premium via calculateAnnualPremium(DEMO_PRICING_INPUTS); 4.2% magic refund rate). Sole activator of the app-wide demo bypass. "Entering Demo..." spinner is cosmetic.

### WEB-07/08/09 legal pages
Terms: "Effective: March 2026"; 80/20 personal/community refund prose; score-70+ qualifier; Damoov named. Privacy: **"12-month" raw-telemetry retention vs Trust page's "90 days"** — same fact, two numbers. Privacy claims demo data is "randomised" — contradicted by fixed DEMO_USER_DATA. Trust: static FCA/ICO "Registered" badges (no backing state); unnamed "capacity partner"; back = history.back() (Terms uses setLocation("/") — inconsistent).

### WEB-10 /permissions — DEAD
Entirely cosmetic: no permission API calls at all; grant and skip both just setLocation("/dashboard"); nothing links here.

### WEB-11 /onboarding — LEGACY TRAP
`lazy(import('./pages/onboarding'))` resolves to the flat **onboarding.tsx** (498-line, 4-step, different field model, purple theme) — NOT `onboarding/index.tsx` (a 1-line re-export of quick-onboarding; dead code but a duplicate-name trap: deleting onboarding.tsx silently swaps the route to a different flow). Legacy flow: no onboarding-complete guard (onboarded users can resubmit), `updateDoc` (throws if user doc missing), Terms/Privacy links are dead `href="#"`, no draft persistence.

### WEB-12 /quick-onboarding — the live orchestrator
12 steps (Welcome, DataConsent, GpsPermission, AnnualMileage, AgePostcode, VehicleDetails, NoClaimsBonus, ReferralSource, CurrentInsurer, CurrentPremium, Confirm, Celebration). **Progress bar shows 11 dots / "Step n of 11" for a 12-step flow.** Draft resume: `localStorage driiva-onboarding-draft-{uid}`, hydrates fields+step (never onto Celebration), cleared only on success (no TTL). Step 2 consent writes IMMEDIATELY (`dataConsentGiven`+timestamp, merge). Final submit: PATCH /api/profile/me `{onboardingComplete:true}` ONLY (none of the 8 soft fields reach Postgres) — failure blocks; then best-effort Firestore mirror of all soft fields (failure console-only); `gpsPermissionGranted: gpsStatus==='success'` collapses never-asked into denied. Steps: only DataConsent + Confirm hard-gate; NCB step displays a fake "n% NCB discount applied" never actually applied; insurer skip writes sentinel `'none'` vs premium skip writes null (inconsistent); Celebration = passkey enrolment prompt (failures silent), click-anywhere-continue, `void passkeySupported` dead state.

### WEB-13 /dashboard (1037 lines)
Reads: users, trips limit-3, active policy, communityPool (subscribed TWICE via two hooks), poolShares, leaderboard, betaPricing (all onSnapshot) + tripPoints one-shot. Writes: `calculateBetaEstimateForUser` callable; fcmTokens arrayUnion.
QUIRKS: **CRITICAL — projected refund rendered 100× too large** (`projectedRefundCents()` pence never /100 at dashboard.tsx:908,928; mixed with pounds in bar-width calc :917; Community Pool card above shows the correctly-scaled figure — one screen, two magnitudes). Fabricated "AI" content (DEEP_INSIGHTS 7 hardcoded fake-fact strings picked by Math.random; AI_DRIIVA_TIPS indexed off score). Trip rows have cursor-pointer but NO onClick. Notification dropdown permanently empty. Refresh mostly cosmetic. Stale denormalised recentTrips preferred over live query. Demo literals (1247 participants, rank 14) bypass the demo-user payload.

### WEB-14 /trips
One-shot getDocs, `status=='completed'` only (recording/processing never listed), not realtime. Demo trip cards are dead no-ops. Real cards → /trips/{id}.

### WEB-15 /trips/:tripId
trips onSnapshot + tripPoints one-shot (unconditional, ownership check runs one render late in an effect); AI insights via `getAIInsights` callable polling 10s; AI coach via POST /api/ai/coach on expand. Score-weight percentages hardcoded in JSX. No demo handling → demo users get "Trip not found".

### WEB-16 /trip-recording — most quirk-dense flow
Real GPS (watchPosition, 1s/5m throttle, accuracy>25 rejected, >80m/s spike filter) + real motion listeners. startTrip/endTrip per tripService contract (score NEVER persisted client-side).
QUIRKS: duplicate "Trip Started" toasts (two paths); every stop toasts literal "Trip score: 0/100. Distance: 0.0 miles." (drivingScorer stub returns zeros) then a real-numbers "Trip Completed" toast moments later; motion data collected then DISCARDED; hard braking/accel/sharp turns permanently zero (counters never incremented — only speed + "phone usage" can move); "phone pickup" = document.visibilitychange, not sensors; **Pause does not pause GPS** (isPaused flag never read — points keep streaming while UI says Paused); endTrip/cancelTrip failures console-only while success toast + navigation fire unconditionally; getUserId() falls back to literal 'demo-user' whenever user?.id falsy; wake-lock failures silent.

### WEB-17 /profile
useDashboardData (4 onSnapshots). Edit → updateDoc. QUIRKS: Location/Push toggles purely decorative (no persistence, reset on remount); dead bell; **PolicyDownload generates a fabricated policy document** — fixed July-2025/2026 dates, 'Test Driver'/'test@driiva.co.uk' fallbacks, static coverage, and a fabricated regulatory line "Authorised and regulated by the Financial Conduct Authority. Registration number: DRV123456" — downloaded as .html; CoverageTypeSection static 7-item list + '—' excess placeholders; third divergent refund formula on this page; clearing name/phone silently no-ops; two identity sources (Auth name vs Firestore displayName) can desync.

### WEB-18 /settings
localStorage-only notifications/theme prefs (not wired to usePushNotifications); Language pills fully fake (no-op onClicks, setter not destructured); passkey add silent on failure; passkey remove optimistic (ignores server result); feedback failure console-only; "Light" theme = CSS brightness/contrast filter over dark classes; duplicate theme useEffects.

### WEB-19 /rewards
**`const projectedRefund = 0;` hardcoded** — the tile never shows a real value; computed poolShare variable unused (abandoned wiring). Entire redeem flow fake (toast-only — and toasts don't render); RewardMilestoneDocument schema exists but referenced nowhere. DEFAULT_DRIVING_PROFILE fabricates currentScore 100 for zero-trip users (Progress tab shows perfect score + full bar). Achievements tab real (server-computed); Rewards tab fake.

### WEB-20 /leaderboard
Real server-computed leaderboard doc (onSnapshot). Full hardcoded 15-entry demo leaderboard (rank 14 = current user) with fake stats. "Your Position" card vanishes for top-10 users. Not in BottomNav.

### WEB-21 /policy
QUIRKS (correctness): "Refund Rate %" uses a hand-rolled 5→15% over score 70-100 formula while "Projected Refund" one line above uses canonical refundCalculator (blended, 50-100) — two different numbers side by side (score 85: 10.00% vs ~11.6%); `projectedRefundCents` called with annual premium as BOTH contribution and premium args (inflates refund); fabricated score-100 fallback feeds the calcs; "Policy Start" derived (renewal minus 1 year) presented as fact; static coverage list; zero demo handling (demo session sees all-'—').

### WEB-22 /checkout — URL-only dead-end
Stripe TEST MODE confirmed (pk_test/sk_test in .env; no live keys in repo). Real path: getDoc users → getInsuranceQuote callable (needs ≥1 completed trip) → POST /api/payments/create-subscription → confirmCardPayment. Demo = 1800ms setTimeout fake success, zero network. QUIRKS: two zero-logging swallowed catches (pricing inputs, quote fetch); discount badge can desync from charged price; fabricated always-7-days quote expiry; hardcoded fallback score 75; **clientSecret:null path skips card confirmation entirely and declares "Policy activated!"**; history.back() back button.

### WEB-23 /achievements
One-shot reads; demo data hardcoded with fixed dates; non-demo fallback array derived from the same hardcoded array (zeroed); real users never get progress bars (no code computes progress toward locked achievements); unseeded environment renders the 8 demo-shaped zeroed cards; fetch failure = same UI as new user.

### WEB-24 /support — public by design
No auth calls at all. "Chat with us" card is a non-interactive div (looks tappable); mailto info@driiva.co.uk is the only contact mechanism; 3 hardcoded FAQs.

### WEB-25..30 /admin/*
All read Firestore directly from the browser (no /api/admin endpoints; the server's requireAdmin gate is used by exactly one route, PUT /api/community-pool). No mutations anywhere in the panel (read/browse/export only). Overview: unpaginated users onSnapshot + collectionGroup(trips, limit 5000) + full feedback getDocs (no .catch). Users: full unpaginated getDocs, client-side search/sort; CSV export client-side. Trips: collectionGroup limit 100 — **"Trips Today/This Week" KPIs computed from a 100-trip window: actively wrong past 100 trips/day**. Feedback: reads a collection whose committed rules say `read: if false` — should always permission-deny. System: 7 sequential getDocs; empty-state branch dead. Monitoring: hardcoded absolute health URL (europe-west2-driiva.cloudfunctions.net/health); fetchers swallow all errors into synthetic zeros (isError never true — no error UI possible); avgLatency/invocations/reads/writes hardcoded TODO zeros; **aiUsageTracking reads denied by rules → "AI Spend £0.00" indistinguishable from a broken dashboard**.
Cross-cutting: two disconnected admin identity mechanisms (client env-email/Firestore flag for UI; server env-UID for the one real endpoint); **no admin bypass exists in firestore.rules at all** — taken at face value most admin reads should fail; every failure silently renders as empty/zero, so whether the admin panel works in prod is unknowable from the app (verify deployed rules first).

## Orphans & dead infrastructure

- **Toast system structurally dead**: `ui/toaster.tsx` `<Toaster/>` never mounted anywhere; `useToast()` called from 22+ files; every toast-driven message in the app (incl. DeleteAccount confirmation/errors, all trip-recording toasts) is silently dropped.
- Orphaned pages (no route): login.tsx (self-redirect stub), not-found.tsx (catch-all is an inline Redirect), documents.tsx (fake docs, no onClicks), file-downloads.tsx (debug-era scratch).
- Orphaned components (never mounted): AuthHeader, BottomSheet (the only claims UI — dead; "Take Photo" has no onClick; falls back to userId 0), DRIBackgroundView, FirebaseSignIn (sole importer of DrivvaLogo — whole chain dead; live pages use PNG assets), FloatingActionButton, GamifiedRefundTracker, GradientMesh, InfiniteScrollIndicator, LoadingSpinner, NotificationDropdown (dashboard has its own inline near-duplicate), OptimizedComponents, PageTransition, ParallaxBackground, ProfileDropdown (hardcoded "2023 Tesla Model 3"; links to unrouted /documents), QuickActions (hardcoded `/api/gdpr/export/2`), RecentTrips, ScrollGradient, ScrollHeader, ScrollIndicatorDots, SwipeHint, TripRecorder, TripTimeline.
- Effectively-dead subtree (imported only by orphans): DashboardHeader, LiquidGauge, MetricsGrid, CommunityPool (+LiveInfoPopup), RefundSimulator, Gamification, PolicyStatusWidget, FileDownloader.
- App shell: OfflineBanner (online→null); InstallPrompt (iOS UA-sniffed sheet / Android beforeinstallprompt); SplashScreen (once-ever localStorage gate, fake progress bar, 3200ms); BrandedLoader (Suspense + auth-loading fallback, no timeout).

## FLOW inventory (test seams)

**Global caveat: ZERO `data-testid` attributes exist anywhere** — Playwright must select on text/roles; fragile. Rebuild requirement: testids on every interactive element.

| Flow | Name | Test seam notes |
|---|---|---|
| FLOW-01 | Visitor → signup → 12-step onboarding → dashboard | Real Firebase required (no demo shortcut for signup). Draft resume testable by injecting `driiva-onboarding-draft-{uid}`. |
| FLOW-02 | Email/password sign-in (3 user states) | Needs seeded users; PublicOnlyRoute means start signed-out; username path exercises usernames lookup. |
| FLOW-03 | Google sign-in | MANUAL-VERIFY (real OAuth popup) or SDK-level mock. |
| FLOW-04 | Passkey sign-in | Playwright CDP virtual authenticator + pre-seeded `driiva-last-user` + registered passkey. |
| FLOW-05 | Forgot password | Assert generic success copy only (anti-enumeration). |
| FLOW-06 | Email verification via link | Needs real oobCode → Firebase Auth emulator for CI. |
| FLOW-07 | Verification skip | Set sessionStorage skip flag directly. |
| FLOW-08 | Demo walkthrough | **Best auth-free seam**: set the two sessionStorage keys, navigate. Covers dashboard/trips/leaderboard/checkout demo variants. NOT uniform: policy + trip-detail have no demo handling (render broken/empty). |
| FLOW-09 | Trip recording | `context.setGeolocation` + `grantPermissions(['geolocation'])`; assert `status:'processing'` not score (never persisted client-side). |
| FLOW-10 | Trips list → detail | Needs seeded trips/tripPoints docs (Admin SDK/emulator). Demo cards are dead — don't test nav from demo. |
| FLOW-11 | AI coach expand | Needs /api/ai/coach reachable or mocked + real ID token. |
| FLOW-12 | Profile edit | Emptying a field no-ops — assert "unchanged", not "cleared". |
| FLOW-13 | Account deletion | Assert side effects (doc gone, redirect, signed out) — NOT toasts (never render). |
| FLOW-14 | Passkey add/remove | Virtual authenticator; verify removal server-side (UI is optimistic). |
| FLOW-15 | Feedback submit | Verify via Firestore read, not UI. |
| FLOW-16 | Checkout | Direct URL only; Stripe test cards; two branches (demo fake delay vs real). |
| FLOW-17 | Admin access | Needs admin-flagged user; assertions may fail due to the rules contradiction — verify deployed rules first. |
| FLOW-18 | Non-admin /admin denial | Clean negative-path test, no backend dependency. |
