# Driiva Manual Test Checklist

Use this checklist when testing signup, auth, trip recording, and protected routes. Run tests in order where dependencies exist.

---

## Prerequisites

- [ ] `.env` file exists with: `DATABASE_URL`, `VITE_FIREBASE_*`, `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_KEY`
- [ ] `npm run db:schema` has been run (Neon schema applied)
- [ ] `npm run dev` starts without errors
- [ ] Firebase Console: Authentication → Sign-in method → Email/Password enabled

---

## 1. Signup

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 1.1 | Go to `/` → click **Get Started** | Arrive at signup page | |
| 1.2 | Leave fields empty, click **Create Account** | Validation error (e.g. "Please enter your full name") | |
| 1.3 | Enter `test@example.com` | Error: "Use a real email address..." (test domains blocked) | |
| 1.4 | Enter valid email (e.g. `you@gmail.com`), password 8+ chars, matching confirm | Form accepts input | |
| 1.5 | Click **Create Account** | Loading state → redirect to `/quick-onboarding` | |
| 1.6 | Check Neon: `SELECT * FROM users ORDER BY created_at DESC LIMIT 1` | Row exists for new user | |

**Notes:** If signup hangs on "Creating account...", check Firebase Console → Authentication → Sign-in method and browser console for errors.

---

## 2. Auth (Sign-in)

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 2.1 | Sign out (or clear cookies) → go to `/signin` | Sign-in page loads | |
| 2.2 | Enter wrong password for existing email | Error message visible (scrolls into view) | |
| 2.3 | Enter correct email + password | Redirect to `/dashboard` or `/quick-onboarding` | |
| 2.4 | Sign out, sign in again | Same destination as 2.3 | |

---

## 3. Onboarding

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 3.1 | As new user, complete quick onboarding (all steps) | Redirect to dashboard | |
| 3.2 | Sign out, sign in again | Land on dashboard (not onboarding) | |
| 3.3 | Check Neon: `onboarding_complete = true` for user | Row updated | |

---

## 4. Protected Routes

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 4.1 | Sign out → go to `/dashboard` | Redirect to `/signin` | |
| 4.2 | Sign in → go to `/dashboard` | Dashboard loads | |
| 4.3 | Visit `/trips`, `/profile`, `/trip-recording` | All load (no redirect) | |
| 4.4 | Demo mode: `/demo` → Enter Demo → `/dashboard` | Dashboard with demo data | |

---

## 5. Trip Recording

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 5.1 | As **real user**, go to `/trip-recording` | Page loads | |
| 5.2 | Click **Start Trip** | Location permission prompt (if first time) | |
| 5.3 | Grant location → wait | "Starting Trip..." → "Recording" state | |
| 5.4 | Drive or move briefly, click **Stop Trip** | Trip ends, stats shown | |
| 5.5 | Go to `/trips` | New trip appears in list | |
| 5.6 | **Demo mode** → Start Trip → Grant location | Recording starts (local only, no cloud) | |

**Notes:** Trip recording needs location permission. On mobile, motion sensors may also prompt. If it hangs >25s, a timeout error should appear.

---

## 6. Quick Smokes

| Step | Action | Expected | ✓ |
|------|--------|----------|---|
| 6.1 | Leaderboard `/leaderboard` | Ranks load | |
| 6.2 | Community pool `/policy` | Content loads | |
| 6.3 | Achievements `/achievements` | Achievements shown | |

---

## Bug Report Template

When you find a bug, capture:

- **Step:** (e.g. 1.5)
- **Action:** What you did
- **Expected:** What should happen
- **Actual:** What happened
- **Device:** Desktop / iOS / Android
- **Browser:** Chrome 120, Safari 17, etc.
- **Console errors:** (if any)

---

*Last updated: Feb 2026*
