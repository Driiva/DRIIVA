# Characterisation audit — Persistent data shapes (DATA-01..DATA-36)

> Rebuild mission, 2026-07-02, vs main @ 81d7117. Sources: firestore.rules, shared/firestore-types.ts (client), functions/src/types.ts (hand-mirrored copy), shared/schema.ts + migrations (Drizzle), all writer/reader code cross-checked.

## 1. Firestore collections

- **DATA-01 `usernames/{username}`** — {email, uid}. Writer: client signup batch (signup.tsx:165). Reader: signin username lookup. Rules: PUBLIC read (deliberate, enumeration risk flagged in-file), owner create/update, no delete (firestore.rules:69-74).
- **DATA-02 `users/{userId}`** (id = Firebase uid) — UserDocument (firestore-types.ts:147-194): identity + onboarding fields + drivingProfile + activePolicy + poolShare + recentTrips[≤3] + fcmTokens + settings. Writers: client signup (partial, fire-and-forget), onUserCreate (full init + isAdmin + damoovDeviceToken), trip pipeline (drivingProfile/recentTrips), onPolicyWrite (activePolicy), onPoolShareWrite (poolShare), insurance callables (rootPolicyholderId + a malformed activePolicy — quirk 6.6). Rules (80-117): create requires uid==userId && email==token.email; update LOCKS uid, createdAt, createdBy, drivingProfile, poolShare, recentTrips, activePolicy (Admin-SDK-only fields).
- **DATA-03 `users/{uid}/betaPricing/{docId}`** — beta estimate; writer calculateBetaEstimateForUser; owner read, write:false.
- **DATA-04 `users/{uid}/achievements/{achId}`** — unlock records; writer checkAndUnlockAchievements; owner read, write:false.
- **DATA-05 `users/{uid}/pendingPayments/{subscriptionId}`** — {stripeSubscriptionId, stripeCustomerId, quoteId?, status, error?, createdAt, processedAt?}. Writer: Express Stripe webhook (Admin SDK). Reader/2nd writer: onPendingPaymentWrite (quote→bind glue; the doc IS the idempotency ledger). Rules: owner read, write:false (anti-forge).
- **DATA-06 `trips/{tripId}`** — TripDocument. Writers: client startTrip/endTrip/cancelTrip (non-scoring fields only) + Functions (score/breakdown/events/anomalies/context/status). Rules (123-148): create status ∈ {recording,processing}; client update ONLY recording→processing|failed with score/scoreBreakdown/events/anomalies/context/userId/createdBy/createdAt unchanged()-locked. Ownership by userId FIELD, not doc path.
- **DATA-07 `tripPoints/{tripId}` + `/batches/{n}`** — compressed GPS. Writers: client startTrip (parent) + TripPointStreamer (batches, sync-reserved index). Reader: finalizeTripFromPoints. Rules (154-166): create-only, NO update/delete ever (why cancelTrip must route via Cloud Function).
- **DATA-08 `driver_stats/{userId}`** — rules-protected, typed (client COLLECTION_NAMES only), read+deleted by GDPR functions — **ZERO writers anywhere** (quirk 6.4).
- **DATA-09 `policies/{policyId}`** — writers: onUserCreate (default pending £0 policy per user), acceptInsuranceQuote, syncInsurancePolicy. Owner read; ALL client writes forbidden.
- **DATA-10 `communityPool/current`** — writers: finalizePoolPeriod (monthly cron) + recalculatePoolShares (daily cron). **World-readable incl. unauthenticated** (rules 193-196).
- **DATA-11 `poolShares/{period_userId}`** — writers: updateDriverProfileAndPoolShare + the two pool crons. Owner read, write:false.
- **DATA-12 `leaderboard/{period_periodType}`** — writer updateLeaderboards (15-min cron over all users). Authenticated read (tightened from public — the exact lines carrying the UNRESOLVED MERGE CONFLICT, quirk 6.1). Live UI source via useCommunityData onSnapshot.
- **DATA-13 `tripSegments/{tripId}`** — classifier output; writer classifier.ts (unwired — CLASSIFIER_URL unset); owner read, write:false.
- **DATA-14 `tripAiInsights/{tripId}`** — Claude analysis; writer tripAnalysis.ts (FEATURE_AI_INSIGHTS-gated); owner read. Subset embedded at trips.aiAnalysis.
- **DATA-15 `aiUsageTracking/{docId}`** — per-call cost; writer tripAnalysis. Rules: **read, write: if false** — yet admin/monitoring.tsx:216-222 reads it client-side → always permission-denied (quirk 6.8).
- **DATA-16 `counters/policy`** — sharded counter for policy numbers (transaction in users.ts:206-222). Authenticated read provisioned, unused.
- **DATA-17 `feedback/{docId}`** — writer FeedbackModal addDoc. Rules: create-only, read:false — yet admin/feedback.tsx + admin/index.tsx read it client-side → always denied (quirk 6.8).
- **DATA-18 `ai_feedback_events`** — writer DrivingAIFeedbackWidget:154 (fire-and-forget). Create-only, no read. Consistent.
- **DATA-19 `systemLogs/{date}/damoovSync/...`** — writer damoovSync cron. Rules: deny-all ("FCA audit trail") — yet admin/index.tsx:202 + admin/system.tsx:55 read it client-side → always denied (quirk 6.8).
- **DATA-20 `quotes/{quoteId}`** — Root quote handoff {quoteId, userId, coverageType, premiumCents, expiresAt, createdAt}. Writer getInsuranceQuote; readers accept paths + onPendingPaymentWrite fallback query. **Zero mention in firestore.rules** (safe via catch-all deny; all access Admin SDK) (quirk 6.9).
- **DATA-21 `admin/dpiaAlerts`** — DPIA field-drift alerts (checkDpiaCompliance, trips.ts:61-91). Not in rules (catch-all).
- **DATA-22 `achievements/{achId}` (top-level)** — badge definitions; writer seedAchievements; reader client getAchievementDefinitions. **No rules block exists → catch-all deny → client reads ALWAYS permission-denied — the badge catalogue is live-broken** (quirk 6.9, most severe).
- **DATA-23 `users/{uid}/rewardMilestones/{rewardId}`** — typed in firestore-types.ts:602-611; **zero writer/reader/rules — pure vestige** (rewards page reads drivingProfile fields instead).

## 2. Neon/Postgres (shared/schema.ts; single baseline migration, no drift)

- **DATA-24 `users`** — id serial PK, firebase_uid unique, username unique, email unique, password (DEAD legacy column), onboarding_complete, premium_amount default '500.00', stripe ids, timestamps. Writers: storage.getOrCreateUserByFirebase (upsert), storage.createUser, FN-06 syncUserOnSignup (Auth trigger, 10s race, non-fatal give-up), PATCH /api/profile/me.
- **DATA-25 `driving_profiles`** — per-user score aggregates; writers via storage create/update (legacy path).
- **DATA-26 `trips`** — LEGACY trip table; sole writer POST /api/trips → recordTripAtomic (transaction) — endpoint unreachable over JSON (see api-contract audit): **transaction hardening protects dead code**.
- **DATA-27 `trips_summary`** — "synced from Firestore on completion; API reads from here". Sole writer insertTripSummary (FN-07 syncTripOnComplete), ON CONFLICT DO NOTHING (idempotent). Reader getTripSummariesByUserId — the live trip-history read-model.
- **DATA-28 `policies`** — **no writer exists** (IStorage has no policy methods). Firestore is the only policy store.
- **DATA-29/30 `achievements` / `user_achievements`** — dead (methods declared, never routed).
- **DATA-31 `incidents`** — writer POST /api/incidents; sole client caller BottomSheet.tsx (never mounted). The ENTIRE claims entity; no Firestore equivalent.
- **DATA-32 `leaderboard` (PG)** — written only via recordTripAtomic (dead path); GET /api/leaderboard has zero client callers. Split-brain with DATA-12.
- **DATA-33/34 `webauthn_credentials`/`webauthn_challenges`** — live passkey storage (June-hardened).
- **DATA-35 `community_pool` (PG)** — GET public/PUT admin endpoints exist; zero client callers. Split-brain with DATA-10.

## 3. Firestore→Neon projection + split-brains

- **DATA-36 `syncTripOnComplete`** (FN-07): onUpdate trips → only on transition INTO 'completed' → insertTripSummary. **If no Postgres user row exists, silently skips (warn only, no retry/backfill).** One-way, eventually consistent.
- **Trip split-brain (current)**: LIVE = client tripService → Firestore trips → CF scoring → trips_summary projection. LEGACY = POST /api/trips → PG trips/driving_profiles/leaderboard (unreachable over JSON).
- **Leaderboard/pool split-brain (new finding)**: Firestore DATA-12/10 (what UI renders) vs PG DATA-32/35 (REST endpoints with zero client callers).

## 4. shared/ contracts
- `shared/tripProcessor.ts` — genuinely shared distance/duration primitives (no scoring logic). Mirrored into functions/src/shared by prebuild script.
- `shared/firestore-types.ts` (client) vs `functions/src/types.ts` — hand-maintained near-identical copies ("Keep in sync" comment); COLLECTION_NAMES diverge (functions adds TRIP_AI_INSIGHTS/AI_USAGE_TRACKING, omits DRIVER_STATS; client reverse).
- `shared/types.ts` — a THIRD older User/Trip interface set with different shapes; callers not audited (follow-up).
- `shared/refundCalculator.ts` vs `functions/src/shared/refundCalculator.ts` — two files, not diffed (follow-up).

## 5. Authoritative store per entity
| Entity | Authoritative | Drift risk |
|---|---|---|
| User identity/profile | Firestore users | PG mirror via FN-06 can silently timeout |
| Trip | Firestore trips | PG trips legacy; trips_summary can silently skip |
| GPS points | Firestore tripPoints | never projected |
| Score/profile | Firestore drivingProfile | PG driving_profiles only via dead path; mobile reads nonexistent field (6.2) |
| Leaderboard | Firestore leaderboard | PG copy unread |
| Policy | Firestore policies | PG policies writer-less |
| Payment glue | Firestore pendingPayments | one-shot doc, no ledger |
| Pool | Firestore communityPool | PG copy unread |
| Achievements catalogue | Firestore achievements (top) — client-unreadable (6.9) | PG dead |
| Feedback | Firestore feedback | admin read rules-broken (6.8) |
| Waitlist | **no store exists** (mobile quote.tsx:39 TODO; optimistic "joined") | — |
| Consent | Firestore dataConsentTimestamp | web hardened 9acbb60; mobile saveToFirestore unhandled (June P1-3) |
| Claims/incidents | PG incidents (sole) | UI trigger never mounted |

## 6. Quirks
- **6.1 firestore.rules:212-215 unresolved merge conflict on main** (introduced 6f6b280; VERIFIED by main session). Deploy would fail to parse → prod rules stale or deploys broken. The repo's only "rules test" (functions/src/__tests__/rules/firestoreRules.test.ts) is a hand-written TS re-implementation that never loads the actual file — invisible to CI. No @firebase/rules-unit-testing emulator suite exists.
- **6.2 Mobile dashboard score permanently 0 = field-name mismatch**: mobile reads `drivingProfile.overallSafetyScore` (dashboard.tsx:54-56); every writer uses `currentScore`. Even a fully-scored user sees 0 on mobile forever.
- **6.3** Mobile onboarding writes literal dotted key `'onboarding.answers'` via .set(merge:true) (OnboardingContext.tsx:86-96) — nested-vs-literal behaviour unresolved statically; nothing reads it back (write-only data).
- **6.4** driver_stats fully wired-for-nothing (typed, ruled, GDPR-read/deleted, zero writers).
- **6.5** rewardMilestones typed-only vestige.
- **6.6** acceptInsuranceQuote's direct activePolicy write malformed vs ActivePolicySummary (missing premiumCents/coverageType/renewalDate, adds startDate) — silently corrected by the onPolicyWrite trigger it fires; latent race. Client wrapper acceptInsuranceQuote has zero callers (June P1-6 confirmed).
- **6.7** Entire PG leaderboard/pool REST pipeline implemented+cached+rate-limited with zero client callers.
- **6.8** Three admin surfaces read rules-denied paths (systemLogs deny-all; feedback read:false; aiUsageTracking deny-all). No admin custom-claim exists in rules — isAdmin is a Firestore field rules can't see. All these reads permission-deny in production regardless of who's logged in.
- **6.9** Collections in code with zero rules mention: quotes, admin/dpiaAlerts (safe by catch-all), and top-level achievements (LIVE BREAK: every getAchievementDefinitions() call denied).
- **6.10** `onboardingCompleted` (extra -ed) still written today at signup.tsx:159-160 (June fix covered quick-onboarding only); never read.
- **6.11** QuickActions.tsx:42 hardcodes `/api/gdpr/export/2` (literal userId 2) — the only client caller of the PG GDPR export route (and the component is orphaned).
- **6.12** GDPR split-brain: shipped UI (ExportDataButton/DeleteAccount) → Cloud Functions → **Firestore only**; Express /api/gdpr/* → **Postgres only** (client trigger hardcoded to user 2, orphaned). A real erasure request via the UI never touches Postgres — users/driving_profiles/trips/user_achievements/incidents/leaderboard/webauthn_credentials all survive indefinitely.

## 7. DATA-ID index (test seams)
| DATA-ID | Entity | Seam |
|---|---|---|
| 01 usernames | rules-emulator | 02 users | rules-emulator + type snapshot | 03 betaPricing | type snapshot |
| 04 user achievements | rules-emulator | 05 pendingPayments | trigger test | 06 trips | rules-emulator status matrix + trigger |
| 07 tripPoints | batch-index race test | 08 driver_stats | confirm-absence | 09 policies | onPolicyWrite trigger test |
| 10 communityPool | scheduled-fn test | 11 poolShares | trigger test | 12 leaderboard | scheduled-fn test |
| 13 tripSegments | classifier integration | 14 tripAiInsights | mocked-Claude | 15 aiUsageTracking | rules-emulator (confirm admin break) |
| 16 counters | transaction test | 17 feedback | rules-emulator (confirm admin break) | 18 ai_feedback_events | rules-emulator |
| 19 systemLogs | rules-emulator (confirm break) | 20 quotes | rules-emulator catch-all | 21 dpiaAlerts | rules-emulator |
| 22 achievements top-level | rules-emulator (should FAIL) | 23 rewardMilestones | confirm-absence | 24-35 PG tables | drizzle schema snapshot + confirm-no-callers for dead ones |
| 36 sync pipeline | trigger test incl. silent-skip path |

Follow-ups not audited: byte-diff of the two refundCalculator.ts copies; shared/types.ts live imports; functions/src/http/auth.ts; mobile vs web signup doc shape diff.
