# Driiva beta: reconciliation and core loop

**Date:** 19 August 2026
**Branch:** `task/driiva-beta`
**Baseline verified at:** `main` @ `c713da2`
**System:** 0 (reconciliation), per the driiva-beta implementation brief

This document is the System 0 deliverable. It corrects the brief against the
actual codebase and states the community core loop the rest of the build is
measured against. Where the brief and the repo disagree, the repo wins and the
disagreement is recorded here rather than silently absorbed.

---

## 1. The community core loop

> A driver takes a real trip, which is captured and scored on the drive itself
> rather than on anything they declare. That score moves their standing on a
> leaderboard that recomputes every fifteen minutes and closes weekly. The
> standing is only worth looking at because it is populated by people they
> actually know, so the one social act the product asks for is inviting a
> friend by code, and the one social reward it gives back is seeing that
> friend ranked next to them. A weekly summary brings them back when the
> period closes, and the loop repeats on the next drive.

Said as a sequence: **drive, get scored, see where you stand against your
friends, invite one more, come back when the week closes.**

Three properties make this the loop worth building rather than one of the
alternatives:

- **It needs no insurance product.** Nothing in it touches quotes, policies,
  premiums, claims, Stripe, Root, or the community pool. That satisfies the
  brief's hard constraint that the beta must not depend on a product that
  does not exist yet.
- **Most of its spine is already built and running.** The scoring pipeline,
  the leaderboard computation, the friendship and invite data model, the
  security rules, and the weekly summary job are all real. What is missing is
  concentrated in one place, and it is the same place on every platform: the
  mobile app cannot perform the social write.
- **It has a natural return beat.** The weekly period close is a real event
  produced by a real scheduled job, not an invented streak counter. Retention
  can hang off something true.

**Status of this definition:** the brief states that the loop is the founder's
call and that System 0 surfaces the decision rather than inventing it. Jamal
has not confirmed this wording. It is written here as the decision the evidence
points at, and the rest of the build proceeds against it so that work is not
blocked; it is cheap to re-point if he wants a different loop, because the
work it implies is additive. **This paragraph needs his yes or a correction.**

---

## 2. Corrections to the brief

### 2.1 Onboarding is 15 screens, not 16

The brief's budget line reads `onboarding completion in scripted run: 16/16`.
The brief, `CLAUDE.md`, and `ROADMAP.md` all say "16-screen onboarding". The
repo does not agree with any of them.

- 15 screen files exist under `mobile/app/onboarding/`.
- The flow declares **14** steps. `mobile/app/onboarding/index.tsx:8` sets
  `const TOTAL = 14`, and every screen passes `total={14}` to `ProgressBar`.
- The verified order is: `index` → `goal` → `pain-points` → `social-proof` →
  `tinder` → `solution` → `comparison` → `preferences` → `location-priming` →
  `motion-priming` → `processing` → `trip-demo` → `viral-moment` → `account` →
  `quote` → `(tabs)/dashboard`.

**Correction:** the budget line becomes **15/15 screens traversed**. The "16"
appears to be a number that propagated across three documents without anything
in the code ever holding it.

### 2.2 The progress bar has a duplicated step

`location-priming.tsx:48` and `motion-priming.tsx:48` both render
`ProgressBar step={9} total={14}`. Step 8 is claimed by `preferences.tsx:55`
(`const overallStep = 8`). The consequence is that the bar does not move across
one transition in the middle of the flow, and the declared total of 14 is never
actually reached in 14 distinct increments. This is a real defect against
System 1 and is listed as broken below.

### 2.3 The onboarding flow terminates in a banned screen

This is the sharpest conflict between the brief and the repo, and it needs a
decision rather than a patch.

The brief bans "any feature that requires the insurance product to exist
(quotes, policy screens, claims)". The final screen of onboarding is
`mobile/app/onboarding/quote.tsx`, an insurance quote screen. The screen before
it, `comparison.tsx`, is an insurance price comparison.

Worse, the terminal screen does not reliably terminate:

- The primary button reads "Get notified when quotes go live"
  (`quote.tsx:145`). It calls `handleGetQuote`, which does nothing but raise an
  alert saying quotes are not live (`quote.tsx:28-37`).
- The **only** call to `markOnboardingComplete()` is behind the secondary link
  "Go to my dashboard" (`quote.tsx:147-149`), styled as `skipText` in the muted
  colour.

So the single action that completes onboarding is presented as the
de-emphasised skip, and the emphasised action is a dead end. Under System 5 a
stranger tapping the obvious button gets an alert, no state change, and no way
forward that reads as forward. That is a founder-intervention generator sitting
on the last screen of the flow, which is exactly the metric the design gate
sets to zero.

`quote.tsx:24-26` also renders a refund estimate as "£X to £Y this year" from
`refundEstimate(state.seedScore)`. It is labelled illustrative, but it is a
money figure on a product that has never paid a refund and is not authorised.

**Recommendation, flagged under the brief's prime directive:** the brief says
Stripe and Root code paths stay dormant rather than deleted, so these screens
should not be deleted. They should be **taken out of the onboarding path** for
the beta and the flow should terminate on a community handoff instead, which is
what the loop in section 1 actually needs. This is a requirement break and it is
being surfaced, not taken unilaterally.

### 2.4 The identity cutover is live and is further along than the brief assumes

The brief asks to verify whether the M1 identity cutover is live. It is.
`provisionUserOnSignup` is deployed and active as the Firebase Auth
`user.create` trigger on both `driiva-staging` and production `driiva`, and the
legacy `onUserCreate` is gone. This is confirmed by prior verified deploys
recorded in project memory, and the source state on `main` matches. No work is
required here.

---

## 3. What is live

Verified by reading the source in this worktree, not by trusting documentation.

| Area | State | Evidence |
|---|---|---|
| Scoring pipeline | Live, server-authoritative | `functions/src/scoring/tripMetrics.ts`, `packages/scoring` |
| Leaderboard computation | Live, runs every 15 minutes | `functions/src/scheduled/leaderboard.ts:28-31`, writes `leaderboard/{periodId}` |
| Leaderboard reads (mobile) | Live, real Firestore snapshot | `mobile/app/leaderboard.tsx:137-148` |
| Friendship and invite model | Live: contracts, rules, ids | `packages/contracts/src/friendship.ts`, `firestore.rules:262-276` |
| Invite create and redeem | Live **on web only** | `client/src/hooks/useFriends.ts:105-190` |
| Web invite UI | Live | `client/src/components/InviteSheet.tsx`, `client/src/pages/invite.tsx`, `client/src/hooks/usePendingInvite.ts` |
| Push token registration | Live and correct (real FCM, not Expo) | `mobile/lib/push.ts` |
| Push sending | Live | `functions/src/utils/notifications.ts:59-77` |
| Weekly summary job | Live, Mondays 09:00 | `functions/src/scheduled/notifications.ts:20-22` |
| In-app notification records | Live, written even with no token | `functions/src/utils/notifications.ts:38-56` |
| Phone-usage detection | Live as of 18 Aug, merged | `f520505` on `main` |
| Identity provisioning | Live on staging and production | `provisionUserOnSignup` |
| Test suite | 743 passed, 2 todo, 71 files | `npx vitest run`, this worktree |
| Typecheck | Clean on both surfaces | `tsc --noEmit` exit 0 root and mobile |

## 4. What is broken

1. **Mobile cannot create a friendship.** This is the single biggest gap and it
   is the reason the loop does not close. `mobile/app/leaderboard.tsx:155` reads
   the `friendships` collection and offers a "friends" scope, but there is no
   `createInvite`, no `redeemInvite`, and no invite UI anywhere in `mobile/`.
   A mobile-only user, which is every beta user, can see a friends board they
   have no mechanism to ever populate. The friends tab is permanently empty by
   construction.
2. **Onboarding's last screen does not reliably complete onboarding.** Section
   2.3 above.
3. **The progress bar duplicates step 9.** Section 2.2 above.
4. **Nothing deep-links from a notification.** There is no
   `addNotificationResponseReceivedListener` and no
   `useLastNotificationResponse` anywhere in `mobile/`. The server already
   sends a `data.type` field and the app has a `driiva` scheme registered
   (`mobile/app.json:8`), so the payload and the scheme are both ready; the
   handler that turns a tap into a route simply does not exist. System 3's
   done-when cannot pass today.
5. **Push registration is only reachable from settings.** `registerForPush` is
   called from `mobile/app/settings.tsx:57` and nowhere else. A user who never
   opens settings is never asked, so the retention surface has no audience.
6. **`docs/DRIIVA_BETA_AUDIT_ONEPAGER.md` is a 0-byte placeholder.** Cruft, and
   it is cited by `docs/planning-core-features-gap/findings.md` as a source.

## 5. What is stale

- The "16-screen onboarding" claim in `CLAUDE.md`, `ROADMAP.md`, and the brief.
  Real figure is 15 screens and 14 declared steps.
- `docs/planning-core-features-gap/findings.md` item 2 says phone-usage scoring
  is "functionally neutral everywhere". That was true when written on 18 August
  and is now wrong: `f520505` merged real detection the same day.
- `ARCHITECTURE.md` still points at `helpers.ts` for scoring; that logic lives
  in `functions/src/scoring/tripMetrics.ts`.

---

## 6. Instrumentation: the budget starts at zero

The brief sets `core loop actions instrumented: 100%`. The measured starting
value is **0%**.

There is no analytics module in `mobile/` at all. The only occurrence of the
word "analytics" anywhere under `mobile/app`, `mobile/components`, `mobile/lib`,
`mobile/contexts` or `mobile/hooks` is prose inside `mobile/app/privacy.tsx`.
The web app has Firebase Analytics initialised in `client/src/lib/firebase.ts`
and `@vercel/analytics` on marketing, but the mobile app, which is the canonical
surface and the one the beta ships on, emits nothing.

Consequence for System 5: the design gate is evidenced by "the analytics trail
for that user id". No such trail can exist until mobile can emit events. **The
analytics module is therefore a prerequisite for the design gate, not a
polish item**, and it must be built before the stranger test can prove anything.

---

## 7. Hard external blockers

These are not code problems and cannot be closed by this build.

1. **There is no Driiva app record in App Store Connect.** Verified 11 August:
   the account holds exactly one app, TradeMind. System 5 requires a stranger to
   "install from a build link". On iOS that link does not exist and cannot exist
   until the app record is created, a build is submitted, and external tester
   review passes. Android via an EAS internal-distribution build is the shorter
   path and is the recommended route for the stranger test.
2. **The stranger test needs a stranger.** By definition it cannot be executed
   by this session or by Jamal. It needs one real person on a real device.
3. **No Root or Damoov credentials exist in any Doppler config.** Irrelevant to
   the community loop by design, and recorded here only so nobody re-opens it.

---

## 8. Consequences for the systems

- **System 1** is mostly hardening, not building: the flow exists and both
  typecheck clean. The real work is the terminal-screen defect (2.3), the
  duplicated progress step (2.2), and a scripted run that proves 15/15.
- **System 2** is narrower than it looks. The loop's data model, rules, and
  server side already exist. The work is porting the invite write path to
  mobile as one deep module and instrumenting it.
- **System 3** has its sending half built and its receiving half missing. The
  work is the notification response handler, the route mapping, and moving the
  permission ask out of settings to a moment where it makes sense.
- **System 4** cannot be assessed until 1 to 3 land, since it grades states
  that do not all exist yet.
- **System 5** is externally blocked on an install link and a human. It should
  be planned for Android internal distribution.

## 9. Budget table, measured

| Metric | Target | At System 0 | After this build |
|---|---|---|---|
| Cold start to interactive, mid-tier Android | <= 2500 ms | not measured | NOT REACHED, needs a device |
| Screen transition p95 | <= 300 ms | not measured | NOT REACHED, needs a device |
| Onboarding completion in scripted run | 15/15 (corrected from 16/16) | no scripted run | 15/15 screens in the committed flow |
| Core loop actions instrumented | 100% | **0%** | **100%**, gated by a test |
| Crash-free sessions across the eval run | 100% | no eval run | NOT REACHED, needs a device |
| Serious accessibility violations | 0 | 0 on web, mobile unmeasured | unchanged |
| Founder interventions in a stranger test run | 0 | not runnable | NOT REACHED, needs a person |

`npm run verify:beta` now exists and reports 9 passed, 0 failed, 5 not reached,
exit code 1.

---

## 10. Found while verifying: the loop could not close for anyone

Running the scripted loop against the real `firestore.rules`, rather than
around them with the Admin SDK, surfaced a live bug that no existing test
caught.

The friendships read rule was:

```
allow read: if isAuthenticated() && request.auth.uid in resource.data.users;
```

Redeeming an invite asks "are these two already connected" by getting
`friendships/{pairId}`, and on the happy path that document is absent. On a
missing document `resource` is null, so `resource.data.users` raises a Null
value error. A rules error is not a quiet deny: it reaches the client as a
`FirebaseError`. So every first-time redemption, which is the only kind that
matters, failed. On mobile it surfaced as "we could not connect you just now";
on web the `getDoc` sits outside `useFriends`' try block, so it threw out of
the hook entirely.

**136 rules tests passed while this was live.** The end-to-end rules test
models the writes the flow performs, not the read the client performs first,
and every other friendship test seeds the document before reading it. A test
that seeds a document cannot catch a bug that only exists when it is absent.

Fixed with a `resource == null` guard, which leaks nothing because there is
nothing there, plus two regression tests. The lesson worth keeping: **verify a
flow by performing it in the order the client performs it, not by asserting on
the writes it leaves behind.**

---

## 11. Second pass, from an independent audit of `mobile/`

A parallel audit of the mobile surface corroborated the findings above and
added five more. Each was re-verified against the source before acting.

### 11.1 The new invite screen was unreachable, and it was my bug

`resolveStartRoute` treats any root-level screen absent from
`ROOT_STACK_SCREENS` as "stranded" and replaces the driver onto the dashboard.
`invite` was not in that list, so the leaderboard empty state and the
onboarding handoff both pushed to a screen the router immediately bounced them
out of. The screen existed, typechecked, and bundled. It simply could not be
reached.

Registered, plus the assertion the suite was missing: it enumerated the
registered screens but never checked what happens to an unregistered one.
Plant-checked, it fails when `invite` is removed again.

### 11.2 A "coming this week" placeholder stood in front of the working screen

`mobile/app/achievements.tsx` was an `EmptyState` reading "Coming this week",
reached from the profile menu. The **real** achievements surface already exists
and works: `mobile/app/(tabs)/rewards.tsx` reads `users/{uid}/achievements` and
composes it through `buildAchievementViews`. So the menu item pointed at a
placeholder while the working version sat one tab away.

The brief bans "coming soon" surfaces in the shipped beta outright. Deleted
rather than annotated, with every reader repointed at the real surface: the
profile menu, the routing allow-list, and the `achievement_unlocked`
notification route.

### 11.3 Push delivery would have died silently

`watchTokenRefresh` was written, exported, documented, and **called from
nowhere**. Its own docstring says that without it "the stored token goes stale
and delivery stops with no error anywhere". FCM rotates tokens, so the weekly
summary would simply stop arriving for a driver and nothing would log it. Now
bound to the signed-in user in `NotificationGate`.

### 11.4 Correction to section 9: onboarding state does NOT survive a kill

The scripted loop proves the **community** loop survives kill-and-relaunch,
because that state is in Firestore. Onboarding answers are a different matter
and the claim should not be read as covering them. There is no AsyncStorage in
the project; answers live in a `useReducer` until `processing.tsx` fires
`saveToFirestore().catch(() => {})`, fire-and-forget with the failure
swallowed. Kill the app before that step and the answers are gone; kill it
after and the driver still restarts at screen one, because nothing reads back
what was saved. Not fixed here, and it is a real System 1 gap.

### 11.5 Two writers disagree about the shape of the user document

`OnboardingContext.tsx` calls `.set({...}, {merge:true})` with dotted string
keys (`'onboarding.answers'`, `'onboarding.permissions'`). Firestore expands
dotted paths in `update()`, **not** in `set()`, so under `set()` those become
top-level fields whose names literally contain full stops.
`AuthContext.markOnboardingComplete` uses `.update()` with
`'onboarding.completedAt'`, which does nest. `hooks/usePermissions.ts` repeats
the `set()` pattern.

So the same document gets both a nested `onboarding` map and sibling fields
called `onboarding.answers`. Verified by reading the code, not from a live
write. Not fixed here: it needs a decision about which shape wins and a
migration for any document already written the wrong way.

### 11.6 Caveat to the Android build path in section 7

`mobile/app.json` declares `ios.googleServicesFile`, and neither
`GoogleService-Info.plist` nor `google-services.json` is present in a fresh
worktree, because both are gitignored (the repo is public). They exist on
Jamal's machine. A cloud build will need them supplied as EAS secrets or
restored locally first, so `eas build` is not quite a one-liner.
