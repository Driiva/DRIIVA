# Test Accounts Checklist

After creating the 5 Firebase test accounts (see below), run through this checklist **twice per account** to confirm sync, auth, logout, routing, and in-app behaviour.

---

## Creating the 5 test accounts

From repo root, with Firebase Admin credentials set:

```bash
# Option A: service account file
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"
npm run create-firebase-test-users

# Option B: inline JSON (e.g. in .env)
# Ensure FIREBASE_SERVICE_ACCOUNT_KEY is set, then:
npm run create-firebase-test-users
```

The script prints a credentials table. Default password for all: **TestPass123!**

---

## Credentials (after running the script)

Use either **email** or **username** in the same sign-in box (same user either way).

| # | Display name    | Email                      | Username       | Password   |
|---|-----------------|----------------------------|----------------|------------|
| 1 | Steel Phoenix   | steelphoenix7@driiva.co.uk | steelphoenix7  | TestPass123! |
| 2 | Crimson Shadow  | crimsonshadow99@driiva.co.uk | crimsonshadow99 | TestPass123! |
| 3 | Nova Blade      | novablade42@driiva.co.uk   | novablade42    | TestPass123! |
| 4 | Frost Viper     | frostviper11@driiva.co.uk  | frostviper11   | TestPass123! |
| 5 | Storm Breaker   | stormbreaker5@driiva.co.uk | stormbreaker5  | TestPass123! |

---

## Per-account test (run ×2 per account)

For each of the 5 accounts, run through the following **twice** (e.g. once with **email** and once with **username** in the sign-in box).

### 1. Auth & sign-in

- [ ] Sign in with **email** (e.g. `steelphoenix7@driiva.co.uk`) + password → succeeds.
- [ ] Sign out, then sign in with **username** only (e.g. `steelphoenix7`) + same password → same user, succeeds.
- [ ] No failed auth; no unexpected logout.

### 2. Database sync

- [ ] After sign-in, user appears in Firestore `users/{uid}` and (if sync is deployed) in Neon `users` (e.g. `firebase_uid`, `email`, `username`).
- [ ] `usernames/{username}` doc exists and points to correct `email` and `uid`.

### 3. Logout

- [ ] Logout clears session and redirects (e.g. to welcome/sign-in).
- [ ] After logout, protected routes redirect to sign-in.

### 4. Page routing

- [ ] New user: sign-in → quick-onboarding → dashboard (or as configured).
- [ ] Returning user (onboarding complete): sign-in → dashboard.
- [ ] From dashboard: Profile, Settings, Trips, Leaderboard, Achievements, Trip recording, etc. open correctly.
- [ ] Bottom nav and back navigation behave as expected.

### 5. In-app behaviour

- [ ] Dashboard loads (scores, pool, trips placeholder, etc.).
- [ ] Profile/settings pages load without errors.
- [ ] Start trip / trip recording flow is reachable and behaves correctly.
- [ ] No console errors or failed API calls for normal flows.

---

## Quick reference

- **Login:** One box accepts **email or username**; same user for both (e.g. `johndoe` and `johndoe@driiva.co.uk`).
- **Password (all test accounts):** `TestPass123!`
- **Sentry:** Runs in background; no visible test button. Remove any leftover “Test Sentry” UI if present.
