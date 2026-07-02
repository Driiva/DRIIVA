# Characterisation audit — Auth & Authorization (AUTH-01..AUTH-16)

> Rebuild mission, 2026-07-02. Read-only audit vs `main` @ `81d7117`. Two corrections to the mission brief up front: (1) AuthContext's fast path reads **Firestore directly**, not localStorage — no localStorage auth cache exists on web. (2) The frontend **does** have passkey UI: `BiometricAuth.tsx`, wired into `signin.tsx` and `settings.tsx` (mobile has none).
> NOTE (main session, empirically resolved): this report's AUTH-10/quirk-15 claim that "the first GET /api/profile/me creates the Postgres row" is WRONG — verifyFirebaseAuth 401s token-valid-no-row users before the handler, so `getOrCreateUserByFirebase` is unreachable over HTTP (pinned in api-contract.characterisation.test.ts). Neon rows are created only by FN-06 `syncUserOnSignup` (Auth trigger — deploy-state unconfirmed).

### AUTH-01 — Email/password signup (web)
`client/src/pages/signup.tsx:126-174`. Validates full name, email regex (`:37-40`), rejects `example.com`/`example.org`/`test.com` domains (`:64-68`), 8-char min password, confirm match. `createUserWithEmailAndPassword` wrapped in an 8s `Promise.race` timeout (`:126-131`). On success: sets local `user` state and **navigates to `/quick-onboarding` immediately** (`:136-149`), *before* any Firestore write completes. The Firestore user-doc write (`batch.set(doc(db,'users',uid),...)`), `updateProfile`, and `sendEmailVerification` fire as an un-awaited `Promise.all(...).catch(()=>{})` (`:154-174`) — errors swallowed, comment cites Cloud Function `onUserCreate` as safety net. But that function (`functions/src/triggers/users.ts:46-200`) is a **Firestore `onCreate` trigger on the `users/{userId}` doc**, not an Auth trigger — if the fire-and-forget `batch.commit()` never lands, no `users` doc exists, the trigger never fires: live Auth account with no profile, no drivingProfile, no default policy, no Damoov registration. Both `onboardingCompleted` AND `onboardingComplete` written (`:159-160`).

### AUTH-02 — Email verification gating
Send: `sendEmailVerification(user, {url: origin+'/verify-email'})` fire-and-forget at signup (`signup.tsx:171`); resend on `/verify-email` rate-limited client-side 1/60s (`verify-email.tsx:83-91`). Two verification paths (`verify-email.tsx`): link-click (`?mode=verifyEmail&oobCode=`) → `applyActionCode` with the app's own key (`:16-19`), `markEmailVerified()`, reload, redirect `/dashboard` (`:55-75`); manual check → `reload(auth.currentUser)` + `.emailVerified` (`:115-144`). Admin bypass: `user.isAdmin` or email in `VITE_ADMIN_EMAILS` → immediate redirect `/admin/monitoring` (`:39-44`). **Skip escape hatch**: `handleSkipForNow` sets `sessionStorage['driiva-skip-email-verification']='true'` (`:153-157`), respected by ProtectedRoute for the whole session (`ProtectedRoute.tsx:48-50,71`) — no re-arm short of a new session.

### AUTH-03 — ProtectedRoute gating precedence
`client/src/components/ProtectedRoute.tsx:36-116`. Order: (1) `loading` → BrandedLoader; (2) demo mode → pass through; (3) `!user` → `/signin`; (4) **admin grace period** — `user.isAdmin === undefined` + not env-allowlisted → wait up to 2s (`:59-68`) before gates (avoids verify-email loop for Firestore-flagged admins); (5) unverified (unless skip flags/admin) → `/verify-email`; (6) onboarding incomplete **only if `=== false`** (not undefined), unless `skipOnboardingCheck`/admin → `/quick-onboarding`. `hasRedirected` ref = one redirect per mount. `/quick-onboarding` + `/verify-email` both carry `skipOnboardingCheck skipEmailVerificationCheck` (`App.tsx:206,210`; by design onboarding precedes email verification, comment `App.tsx:205`). `PublicOnlyRoute` (`:129-156`) bounces authed non-demo users off `/signin|/login|/signup|/forgot-password` → `/dashboard`; demo excluded ("so users can create real accounts from demo", `:127`).

### AUTH-04 — Sign-in (web), redirect behaviour by state
`client/src/pages/signin.tsx:87-205`. `signInWithEmailAndPassword` only — deliberate single round-trip (`:134-135`). Non-blocking Firestore read of `users/{uid}` purely for `WelcomeBackOverlay` (failures swallowed `:159-161`).
- Unverified: sign-in succeeds; navigates `/dashboard`; **ProtectedRoute** bounces to `/verify-email` on next render.
- Verified not onboarded: `/dashboard` → ProtectedRoute → `/quick-onboarding`.
- Fully onboarded: welcome overlay → `/dashboard`.
Error copy normalised (`:182-194`) — invalid-credential message name-drops "test accounts" (stale demo-era copy in prod).

### AUTH-05 — Username→email resolution: client-side ONLY
`signin.tsx:103-124`. Identifier without `@` → `usernames/{lowercased}` Firestore lookup → `.email`; on not-found OR read failure, falls back to guessing `${raw}@driiva.co.uk` (`:116,119,122`). `usernames` rules: `read: if true` (`firestore.rules:70`, comment flags enumeration risk). **No server-side username resolution exists**; `server/routes.ts:4` documents `/api/auth/login`+`/api/auth/register` which do not exist.

### AUTH-06 — Google sign-in
`signin.tsx:207-256`. `signInWithPopup(auth, googleProvider)` (`client/src/lib/firebase.ts:179`). No scopes. Success → welcome overlay → `/dashboard`; ProtectedRoute handles gates. Popup-cancel errors silently absorbed (`:233-236`). **No client code writes a Firestore `users/{uid}` doc for Google sign-in**, and `onUserCreate` is doc-triggered not Auth-triggered → Google-only users likely never get drivingProfile/default-policy bootstrap (needs targeted verification). No Google sign-in on mobile at all.

### AUTH-07 — Password reset
`forgot-password.tsx:36-90`. `sendPasswordResetEmail`. **Anti-enumeration**: `auth/user-not-found` treated as success (`:65-72`). No server round-trip → server `authLimiter` never applies; only Firebase's own `auth/too-many-requests`. Mobile: `mobile/contexts/AuthContext.tsx:84-86` (screen body unverified).

### AUTH-08 — AuthContext (web) in detail
- **No localStorage cache.** `logout()` removes `driiva-auth-token` (`:228`; also `AuthHeader.tsx:33`) but nothing ever writes it — vestigial.
- **Fast path** (`:120-155`): on `onAuthStateChanged`, `Promise.all([readOnboardingFromFirestore, readAdminFlagFromFirestore])` → sets `user`, `setLoading(false)`. On ANY error → fallback user with `onboardingComplete:false, isAdmin:false` (`:144-154`) — **a transient Firestore failure silently demotes an onboarded admin** until the slow path corrects it.
- **Slow path** (`:160-198`, background): `reload()` (5s race), `getIdToken()` (5s race), `fetch('/api/profile/me')` (5s abort). On success patches `user.onboardingComplete` from **Postgres** (`:187`) — the dual-source overwrite; Firestore-true/Postgres-false yanks an in-app user back into onboarding mid-session.
- No global watchdog if `onAuthStateChanged` never fires — app hangs on BrandedLoader.
- `setSentryUser` on both paths' successes; not on fast-path error branch.
- **Logout** (`:217-238`): `loading=true` → clear user/Sentry/demo keys → `signOut(auth)` in background; signOut failure only console.error'd, UI already logged out.

### AUTH-09 — onboardingComplete: three sources
1. Firestore `users/{uid}.onboardingComplete` — fast path read; written by quick-onboarding + mobile `markOnboardingComplete`.
2. Postgres via `GET /api/profile/me` — slow path; `checkOnboardingStatus()` (`:244-258`) has **zero callers — dead code**.
3. Firestore `onboardingCompleted` (extra -ed) — written at signup (`signup.tsx:159-160`), **never read anywhere**.

### AUTH-10 — Server middleware
`verifyFirebaseAuth` (`server/middleware/auth.ts:37-72`): Bearer token → `verifyFirebaseToken` → `storage.getUserByFirebaseUid`. **Valid token + no Neon row → `req.auth` left undefined entirely** (`:59-64`) → requireAuth 401s. `requireResourceOwner(param)` compares `req.auth.userId` (**Postgres integer id**, not Firebase uid) to the path param. `requireAdmin` checks Firebase uid vs `ADMIN_FIREBASE_UIDS` env — one of **four independent admin mechanisms** (server env-UID list; client `VITE_ADMIN_EMAILS`; functions `ADMIN_EMAILS`; Firestore `isAdmin` boolean) with no single source of truth.
`server/lib/firebase-admin.ts`: real Admin SDK verify (path 1); dev-only REST fallback `verifyViaRestApi` (`:40-60`) **hard-refused in production** (`:74-77`) — prod without Admin creds = every authed request 401s, by design.

### AUTH-11 — `/api/auth/firebase`
Public, authLimiter. Pure verify-and-echo; issues no session; **zero client callers found — dead endpoint**.

### AUTH-12 — WebAuthn/passkeys (server)
Registration `requireAuth`-gated on main (`server/routes.ts:203,216`), email derived from token only (`:205,218`; client still sends body email at `client/src/lib/webauthn.ts:96` — ignored server-side). authenticate/start+complete public by design. Challenge store DB-backed with 5-min TTL + sweep (`server/webauthn.ts:45-75`) — serverless-safe. On auth success mints Firebase custom token (`webauthn.ts:271-283`) — **requires Admin SDK; if absent, `customToken:null`** and the client (`BiometricAuth.tsx:74-76`) skips `signInWithCustomToken` but still fires `onSuccess` + "Welcome back!" toast (`:79`) — **false-positive success with no real Firebase session**. Credential counter updated per auth (`webauthn.ts:258-264`).

### AUTH-13 — Frontend passkey UI EXISTS
`client/src/components/BiometricAuth.tsx` — full register/auth component; shown in `signin.tsx` for returning users (`localStorage['driiva-last-user']`, `signin.tsx:486-511`) and in `settings.tsx` (passkey list/add/remove, `:52-120+`). `client/src/lib/webauthn.ts` does the browser dance + attaches Firebase ID token for enrolment calls. **Mobile has zero passkey/biometric-auth code.**

### AUTH-14 — Mobile auth
`@react-native-firebase/auth` (native). Genuine cache: `expo-secure-store` key `driiva-auth-cache` (`mobile/contexts/AuthContext.tsx:30,38-43,51,54,81,98`), hydrated before `onAuthStateChanged`. `resolveUser` (`:117-129`) = one Firestore read; single source of truth (no Postgres leg). `AuthGate` (`mobile/app/_layout.tsx:26-55`): `!user && !inAuthGroup` → signin; `user && inAuthGroup` → dashboard or onboarding. **No email-verification gate on mobile**; mobile signup **never calls sendEmailVerification** (`:65-77`). **Expo Go dev bypass**: `isExpoGo` skips auth entirely → `/onboarding` (`_layout.tsx:14,38-41`). No Google, no passkeys, no username login (plain email/password form, `mobile/app/(auth)/signin.tsx:62-72`).

### AUTH-15 — Firestore rules auth model + CRITICAL find
**`firestore.rules:212-215` contains an unresolved git merge conflict** (`<<<<<<< HEAD` / `=======` / `>>>>>>> dde6db6`), introduced by commit `6f6b280`. VERIFIED by main session 2026-07-02. Rules with these markers cannot deploy — either prod rules are stale (pre-`6f6b280`) or deployment has been failing since. What is live in prod Firestore is unknowable from the repo → needs `firebase firestore:rules get` (manual-verify).
Rest of file: `request.auth.uid`-keyed ownership. `isOwner(userId)` gates `users/**` (`betaPricing`, `achievements`, `pendingPayments` — the latter `write: if false` anti-fraud). `trips`/`tripPoints` key on the `userId` FIELD not the doc path (`:124,126-127,155-156`). Client trip transitions locked to `recording→processing|failed` with `score/scoreBreakdown/events/anomalies/context` unchanged()-locked (`:54-59,137-141`). Admin-SDK-only: `driver_stats`, `policies`, `communityPool` (world-readable), `poolShares`, `leaderboard`, `tripSegments`, `tripAiInsights`, `aiUsageTracking` (deny-all), `counters`, `systemLogs` (deny-all, "FCA audit trail"). Catch-all deny (`:287-289`). `usernames` = deliberate public read.

### AUTH-16 — Session lifecycle
- Persistence: no `setPersistence()` call — default `browserLocalPersistence`, sessions survive restarts indefinitely; no "remember me" toggle.
- Refresh: SDK automatic; explicit `getIdToken(true)` only in `useFirestoreQuery.ts:67`/`useFirestoreDoc.ts:60` (stale-token recovery).
- **Revocation: no server-initiated revocation path exists.** `revokeRefreshTokens` appears only in test mocks. No "log out everywhere", no disable→session-kill.
- Deep-links: web = per-route ProtectedRoute; mobile = root AuthGate on segment change (unauth deep link into `(tabs)/...` caught).

### QUIRKS (auth)
1. Fast/slow path race on onboardingComplete — dashboard→onboarding yank mid-session (mechanism: slow path `setUser` at `AuthContext.tsx:183-189`).
2. Fast-path Firestore failure silently demotes admins/onboarded users (`:144-154`).
3. `onboardingCompleted` dead-written at signup, never read.
4. `checkOnboardingStatus()` dead code.
5. `driiva-auth-token` localStorage key deleted in two places, written nowhere.
6. `/api/auth/firebase` dead endpoint (no callers).
7. routes.ts:4 documents nonexistent login/register routes.
8. Passkey auth without Admin SDK creds = false-positive "Welcome back!" with no session.
9. Four independent admin-designation mechanisms.
10. **firestore.rules live merge conflict on main** — highest severity of this audit.
11. Mobile: no verification email sent, no verification gate.
12. Google sign-in likely never bootstraps a users doc (needs targeted check).
13. Orphaned `useOnboardingGuard.ts` checks localStorage demo-mode while everything else uses sessionStorage (zero callers today).
14. `requireResourceOwner` compares Postgres integer id, not Firebase uid.
15. New-user 401 window (see NOTE at top — resolved empirically: it's not a window, it's a wall until FN-06 or a script creates the row).

### Appendix — characterisation-test mapping
| ID | How to test |
|---|---|
| AUTH-01 | Playwright + Auth/Firestore emulator; throttle Firestore write, assert user still lands on /quick-onboarding |
| AUTH-02 | Playwright + Auth emulator; 60s resend throttle unit-testable |
| AUTH-03 | Component test (Testing Library) mocking useAuth across the gating matrix — no emulator needed |
| AUTH-04 | Playwright + emulator, seed 3 user states, assert final route |
| AUTH-05 | Playwright + Firestore emulator (found/not-found/timeout) |
| AUTH-06 | MANUAL-VERIFY (real Google OAuth popup) |
| AUTH-07 | Playwright + Auth emulator, assert identical UI real-vs-nonexistent email |
| AUTH-08 | Vitest unit with controllable delays to force the fast/slow race |
| AUTH-09 | Vitest unit seeding divergent Firestore vs Postgres values |
| AUTH-10 | Extend existing server/__tests__/auth-middleware.test.ts |
| AUTH-11 | Supertest (but confirm endpoint survives the rebuild at all) |
| AUTH-12 | Server unit with @simplewebauthn test vectors; client navigator.credentials = Chrome virtual authenticator |
| AUTH-13 | Playwright + Chrome DevTools WebAuthn virtual authenticator (automatable) |
| AUTH-14 | Maestro vs emulator (SecureStore needs simulator) |
| AUTH-15 | @firebase/rules-unit-testing — BLOCKED until the merge conflict is fixed/confirmed |
| AUTH-16 | Playwright persistence/logout; revocation N/A (no code path exists) |

Blind spots: mobile forgot-password screen body; verifyFirebaseAuth mount point (confirmed by main session: `routes.ts:76-78`, global); Auth-native onCreate functions (audit-functions found FN-06 syncUserOnSignup IS an Auth trigger — Neon mirror only); live-vs-repo rules diff.
