# Characterisation audit — Mobile app (MOB-01..MOB-07 + Maestro table)

> Rebuild mission, 2026-07-02. Expo Router app in mobile/.

## MOB-01 Versions & build config
expo ~54.0.33, RN 0.81.5, React 19.1.0, expo-router ~6.0.23, @react-native-firebase/* ^21 (resolved 21.14.0), reanimated ~4.1.1, maps ^1.18, expo-location ~18, expo-sensors ~15, expo-secure-store ~15. State = React Context/useReducer only.
- **No eas.json anywhere** — package.json build:ios/android + submit scripts reference a nonexistent EAS config (would fail immediately).
- **No Firebase native config**: no GoogleService-Info.plist, no google-services.json, no `googleServicesFile` in app.json; `ios/Driiva/AppDelegate.swift` has **no Firebase.configure()** and no Firebase import. RNFB pods present in the LOCAL prebuild only → a native build throws "No Firebase App '[DEFAULT]' has been created" at runtime.
- `newArchEnabled: true` (app.json:10 + Podfile.properties.json).
- **mobile/ios is NOT git-tracked** (mobile/.gitignore:40 ignores /ios wholesale; `git ls-files mobile/ios/Pods` = 0) — the 14,967-file Pods dir is a machine-local expo prebuild artifact. **No android/ directory exists at all.**
- tsconfig `@shared/*` alias declared but unused — mobile hand-duplicates types per screen instead of importing shared/firestore-types.ts.

## MOB-02 Navigation graph
Root Stack (_layout.tsx:76-88): (auth), (tabs), onboarding, **trip-recording and trips/[tripId] declared but NO files exist** — `trips.tsx:70` pushes `/trips/${id}` = live dead-end (expo-router "screen doesn't exist" fallback).
(auth): signin/signup/forgot-password all real. (tabs): dashboard, trips, record (centre button), rewards, profile + hidden template screens index/two (href:null). onboarding: plain Stack, order implicit from push chain. Loose auto-routes: /modal (unlinked), +not-found, +html.
**AuthGate Expo Go bypass**: `isExpoGo` → force-routes to /onboarding regardless of auth (_layout.tsx:38-41). Real gating only in native builds.

## MOB-03 Onboarding (14 steps, push chain)
1 index (static hardcoded pool leaderboard) → 2 goal (5 options, local ctx) → 3 pain-points (6 options, local) → 4 social-proof (PLACEHOLDER testimonials, "117/£162/4.9" hardcoded) → 5 tinder (4 hardcoded statements, addPainScore local; PanResponder useNativeDriver:false) → 6 solution (pain→fix pairs; "// ESTIMATE — subject to actuarial review" comments) → 7 comparison (static table) → 8 preferences (3-question wizard → setSeedScore via hooks/useTripSeed.ts:3-14 hand-tuned heuristic base 82, clamp 74-96 — not telematics) → 9 location-priming (**real** Location.requestForegroundPermissionsAsync + REAL Firestore write via usePermissions savePermission; copy promises background tracking the request never asks for) → 9-again motion-priming (**ProgressBar step={9} duplicated** — two screens same step) → 10 processing (saveToFirestore fire-and-forget `.catch(()=>{})`, hardcoded 2800ms navigation timer; check-animations cosmetic) → 11 trip-demo (4500ms hardcoded TripReplay; "+8/+5/+4/+2" breakdown is hardcoded JSX, not seedScore-derived; labelled "Simulated trip") → 12 viral-moment (real Share.share(); refundEstimate/scorePercentile flagged ESTIMATE; "117 drivers" again) → 13 account (summary + static Shariah/FCA badge) → 14 quote: `handleGetQuote` = Alert "Quote coming soon" (TODO Root Sprint 5); **waitlist join sets joined=true with `// TODO: write to waitlist Firestore collection` — success UI for a write that never happens**; markOnboardingComplete (real write) → dashboard.
OnboardingContext.saveToFirestore (83-97): merges `'onboarding.answers'.*` + permissions + startedAt onto users/{uid} — the ONLY bulk write, fired once, errors swallowed.

## MOB-04 Tabs
- **Dashboard**: onSnapshot users/{uid}; reads `drivingProfile.overallSafetyScore` etc. **Nothing in mobile writes drivingProfile** (and web/functions write `currentScore`, not `overallSafetyScore` — see audit-data 6.2) → score always renders 0; Rank hardcoded "--".
- **Trips**: REAL query (userId + status completed + orderBy startedAt, limit 50, onSnapshot) — genuinely data-driven; row tap → dead route.
- **Record**: pure UI stub — local state machine, haptics, TODOs at :22/:26, hardcoded 3s setTimeout "processing", no trip doc, no GPS, ever.
- **Rewards**: fully static 5-tier list, all permanently locked, zero data binding.
- **Profile**: avatar/name/email real; **all 9 menu rows are `onPress={() => {}}` no-ops**; only Sign Out works (real signOut + SecureStore clear).

## MOB-05 Auth
Native RNFB auth via lib/firebase.ts shim. SecureStore cache `driiva-auth-cache` hydrated pre-onAuthStateChanged. resolveUser = one Firestore read. signup creates users/{uid} with email/fullName/displayName/onboardingComplete:false/createdAt/createdBy:'mobile-app' (NO drivingProfile). Error-code-mapped alerts for 4 codes. **Expo Go = fully mocked auth/firestore (mock user preview@driiva.local, docs always onboardingComplete:false) — any Expo Go behaviour is fake.** No sendEmailVerification anywhere in mobile signup; no verification gate; no Google; no passkeys.

## MOB-06 Firestore ops inventory
users/{uid}: create (signup), read (resolveUser), update (markOnboardingComplete + 'onboarding.completedAt'), set-merge ('onboarding.answers' dotted-literal key — see audit-data 6.3; permissions.* from priming screens), onSnapshot (dashboard). trips: read-only query (trips tab) — mobile never writes trips. Waitlist: intended write never implemented (quote.tsx:39).

## MOB-07 Quirks
- Font mis-map: `'Poppins-Regular'` key loads SpaceMono-Regular.ttf (_layout.tsx:58-60); latent (no current fontFamily references).
- Progress-bar step 9 duplicated across two screens.
- Uncleared timers: record.tsx:27 (setState-after-unmount risk), dashboard.tsx:73 + trips.tsx:47 cosmetic refresh timers. (processing.tsx and TripReplay DO clean up.)
- quote.tsx false-success waitlist UI.
- **Dead component library**: components/ui/* ("Driiva Component Library v4" — GlassCard, ScoreRing #2, DriivButton, TripCard, StatCard, etc. + own theme.ts) — zero imports anywhere; app uses per-screen inline StyleSheet instead.
- Dead Expo template scaffolding (Themed/EditScreenInfo/ExternalLink/StyledText/useColorScheme/Colors.ts) consumed only by hidden template screens.
- @react-native-firebase/messaging installed, resolved, podded — **zero usage**; UIBackgroundModes declares remote-notification; fcmTokens never populated from mobile.
- Foreground-only location request vs background-tracking copy + background-permission strings in app.json.

## Maestro-testability table
| ID | Flow | Verdict |
|---|---|---|
| MOB-T01 | welcome→goal (Continue gated on selection) | Yes — pure UI |
| MOB-T02 | pain-points multi-select (Skip↔Continue(N)) | Yes |
| MOB-T03 | tinder swipes (threshold width*0.3) | Yes but PanResponder swipes flaky in Maestro — manual backstop |
| MOB-T04 | preferences wizard (180ms auto-advance) | Yes with wait |
| MOB-T05 | location/motion priming | OS dialogs — high friction; manual-verify the dialog leg |
| MOB-T06 | processing→trip-demo (2800+4500ms stub chain) | Yes — locks in the setTimeout choreography |
| MOB-T07 | quote waitlist join | Yes — explicitly locks in the FAKE success state |
| MOB-T08 | dashboard load (score 0, rank --) | Needs seeded Firestore doc (mobile never writes drivingProfile) |
| MOB-T09 | trips list → detail tap → DEAD ROUTE fallback | Yes — highest-value regression lock (known broken) |
| MOB-T10 | record start/stop stub (3s fake processing) | Yes — name the test as stub-lock |
| MOB-T11 | rewards static locked list | Yes — render snapshot |
| MOB-T12 | profile: 9 no-op rows + real Sign Out | Yes |
| MOB-T13 | signin/signup/forgot-password (real Firebase) | **BLOCKED**: no native Firebase config in repo; Expo Go path is mocked (always fake-succeeds) |

Root blocker for T05/T08/T13: no eas.json + no native Firebase config = no native build from source has ever exercised real auth/permissions/data. (Main session empirical note: a local `expo run:ios` build against the machine-local prebuilt ios/ dir initially failed with 38 gRPC-C++ compile errors then compiled clean on an incremental re-run — see progress.md; even when it builds, first-launch Firebase init is expected to throw absent config.)
