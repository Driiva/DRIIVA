# Characterisation audit — Cloud Functions + scoring pipeline (FN-01..FN-30)

> Rebuild mission, 2026-07-02. All 30 exports wired via functions/src/index.ts:44-97, region europe-west2. **No functions-python directory exists** (the only Python is the dead api/main.py FastAPI app).

## Triggers
- **FN-01 onTripCreate** (trips.ts:188-263, onCreate trips/{id}, minInstances:1) — status 'recording' → return (normal client path). Any other status (Damoov sync creates pre-scored docs): detectAnomalies + weather → status processing|completed; completed → updateDriverProfileAndPoolShare + checkAchievementsAsync. Error → 'failed' + rethrow. NOT idempotent.
- **FN-02 onTripStatusChange** (trips.ts:271-335, onUpdate trips/{id}) — same-status guard. CASE 1 recording→processing → **finalizeTripFromPoints** (the authoritative scoring call). CASE 2 processing→completed → processedAt + updateDriverProfileAndPoolShare + checkAchievementsAsync AGAIN + classifyCompletedTripAsync + analyzeCompletedTripAsync. **NOT idempotent — see double-fire.**
- **FN-03 onPolicyWrite** (policies.ts:20-95) — denormalises ActivePolicySummary to user doc; clears on delete/cancelled/expired. Idempotent.
- **FN-04 onPoolShareWrite** (pool.ts:23-82) — denormalises PoolShareSummary. Idempotent.
- **FN-05 onUserCreate** (users.ts:46-200, onCreate users/{id}, secrets DAMOOV_*) — admin auto-promote from ADMIN_EMAILS; idempotency guard (existing policy → skip); sequential policy number via counter transaction; default 'pending' £0 policy; drivingProfile/activePolicy/poolShare/settings init; silent Damoov registration. Whole handler swallows errors.
- **FN-06 syncUserOnSignup** (syncUserOnSignup.ts:13-38, **Firebase AUTH onCreate**, secret DATABASE_URL) — mirrors user into Neon, 10s race (Neon cold start 20-27s), failure logged+swallowed ("server upserts on next login" — NOTE: main session proved that upsert is unreachable over HTTP; this trigger is the only real Neon-row creator).
- **FN-07 syncTripOnComplete** (onUpdate trips/{id}, secret DATABASE_URL) — only on →'completed'; insertTripSummary ON CONFLICT DO NOTHING (idempotent); **silently skips if no PG user row** (warn, no retry/backfill); other errors rethrown (CF retry).
- **FN-08 onPendingPaymentWrite** (payments.ts:51-160, onCreate pendingPayments) — status 'pending' only; dup-policy guard; quoteId resolution (doc or latest open quote); acceptInsuranceQuoteInternal bind; FCM push; doc marked completed/failed (doc = idempotency ledger). No retry primitive (Firestore triggers don't redeliver).
- **FN-09 onUserUpdateRecalcBetaEstimate** (betaEstimate.ts:125-174) — recompute on users update when age+postcode present; writes betaPricing subdoc (no self-loop). Idempotent.

## Scheduled
- **FN-10 updateLeaderboards** — every 15 min, **timezone UNSET → America/Los_Angeles default**. Ranks users by drivingProfile over period bounds; dense ranking; full overwrite.
- **FN-11 finalizePoolPeriod** — monthly, **tz America/New_York** (UK product on US wall-clock). min(proportional, score-based) refund per share; advances pool period.
- **FN-12 recalculatePoolShares** — daily 06:00, **tz America/New_York**. Recomputes sharePercentage + projectedRefundCents via shared/refundCalculator.
- **FN-13 sendWeeklySummary** — Mon 09:00 Europe/London; per-user failures non-fatal.
- **FN-14 syncDamoovTrips** — daily 00:30 Europe/London, maxInstances 10, 540s, 512MB. 7-day window per damoovDeviceToken user; trips keyed damoov_{Id} (idempotent per trip); **uses Damoov's Rating100 fields verbatim as score/scoreBreakdown** (no our-algorithm scoring); **directly overwrites drivingProfile.currentScore/totalTrips/lastTripAt with a flat 30-day average**, bypassing the weighted-average transaction (two formulas stomp the same profile). Audit log to systemLogs.
- **FN-15 monitorTripHealth** — hourly Europe/London watchdog: ≥5 failed trips/hr; zero trips in 24h; stuck-in-processing >1h → captureError (Sentry if DSN set). Observational only.

## Callables
- **FN-16 initializePool** — admin; force flag to reinit.
- **FN-17 addPoolContribution** — self-scoped; amount 1..1,000,000 cents; single transaction across pool + share + user denorm.
- **FN-18 cancelTrip** — self + ownership; only 'processing' trips; sets 'failed'.
- **FN-19 classifyTrip / FN-20 batchClassifyTrips** — self/admin; **CLASSIFIER_URL set nowhere → always short-circuit no-op**.
- **FN-21 exportUserData** — self; 300s/512MB; aggregates users/trips/tripPoints(+batches)/tripSegments/policies/poolShares/driver_stats to JSON (Firestore only).
- **FN-22 deleteUserAccount** — self; batched deletes (500-op chunks) across the same set + user doc, THEN auth.deleteUser — **partial-failure possible: Firestore gone, Auth account orphaned** (throws "contact support").
- **FN-23 analyzeTripAI / FN-24 getAIInsights** — inline auth; ownership; 1-hr cache; ANTHROPIC_API_KEY secret.
- **FN-25 getInsuranceQuote** — inline auth; ≥1 completed trip; Root POST /quotes; stores quotes/{id}.
- **FN-26 acceptInsuranceQuote** — inline auth; ensurePolicyholder; Root /applications → /policies; writes policies WITH coverageDetails; **near-duplicate of insuranceInternal.ts (webhook path) which OMITS coverageDetails** — two doc shapes by bind path.
- **FN-27 syncInsurancePolicy** — refetch from Root, update status/premium.
- **FN-28 calculateBetaEstimateForUser** — self; deterministic; writes betaPricing.
- **FN-29 seedAchievements** — header says "Admin-only" but code checks ONLY `context.auth` — **any signed-in user can reseed the global achievements catalogue** (requireAdmin never called).
- **FN-30 health** — public GET; Firestore probe, 5s race; 200/503.

## Deep trace: trip scoring end to end
1. Client stop (trip-recording.tsx:387-435): stop tracker + streamer final flush; computes a client score via calculateDefaultScoreBreakdown — **discarded** (endTrip writes status/end fields only; rules lock scoring fields). calculateDefaultScoreBreakdown has no other caller — dead computation.
2. Write A: recording→processing → fires FN-02 CASE 1 (and FN-07 which no-ops).
3. **finalizeTripFromPoints** (trips.ts:348-473): readTripPoints (inline or batches); <2 points → 'failed'; DPIA drift check (fire-and-forget); **computeTripMetrics (utils/helpers.ts:224-489) = THE single authoritative scoring call**: Haversine distance; speed stats from spd/100; events — hard braking <-3.5 m/s², hard accel >3.0, sharp turn >30°/s at >5 m/s, speeding >31.3 m/s (~70mph); **phonePickupCount initialised 0, never incremented → phoneUsage always 100** (10% weight neutral); weights Speed 25 / Braking 25 / Accel 20 / Cornering 20 / Phone 10. detectAnomalies (impossible >200mph, GPS-jump ratio); weather (best-effort). Write B: Admin update {score, breakdown, events, anomalies, context, status completed|processing, processedAt}; if completed → updateDriverProfileAndPoolShare + checkAchievementsAsync IN THIS INVOCATION.
4. **DOUBLE-FIRE (HIGH)**: Write B (processing→completed) retriggers FN-02 → CASE 2 → **updateDriverProfileAndPoolShare + checkAchievementsAsync run a SECOND time**, racing the first. The profile transaction is not idempotent (totalTrips/totalMiles/minutes/streakDays double-counted; weighted average over-weights the latest trip; recentTrips can duplicate; two "Trip Scored" pushes; achievement double-write race). Classification/AI were deliberately protected from this exact pattern (comment trips.ts:436-439) — the protection was never extended to profile/achievements. Anomaly-flagged path (finalStatus 'processing') does NOT double-fire (same-status guard).
5. FN-09 also refires on each user-doc write (harmless, idempotent).
6. Leaderboard decoupled: 15-min poll; inherits whatever the race left.
7. Classifier: fired once from CASE 2; CLASSIFIER_URL unset → silent no-op always. Results would land in tripSegments + trips.segmentation; only consumed as optional AI context.
8. AI analysis: 1-hr cache; skips <0.8km or <2min; 3-attempt backoff; never throws; cost→aiUsageTracking.
9. **Four divergent scoring implementations**: authoritative (helpers.ts computeTripMetrics) / dead client (tripService calculateDefaultScoreBreakdown) / parallel legacy (server/lib/telematics.ts TelematicsProcessor — different physical thresholds, e.g. 0.3 raw-accel-delta vs -3.5 m/s²; weight fractions synced only by comment) / Damoov Rating100 passthrough.

## Deploy-state evidence (no firebase commands run)
- ROADMAP.md: "firebase login" + "Deploy Cloud Functions" UNCHECKED.
- ci.yml deploy-production job gated on workflow_dispatch(deploy_target=production) OR v* tag; **zero v* tags exist; zero workflow_dispatch events in the last 100 runs (56 PR + 44 push, 63/100 failures)** → the production-deploy job has structurally never executed.
- deploy-staging.yml deploys functions to driiva-staging on push to `staging` branch with **continue-on-error: true** on the deploy step — green CI proves nothing about staging deploy success.
- No .firebase/ deploy cache; functions/lib (compiled output, 172 files) IS committed (stale-artifact risk).
- functions/.env.example missing CLASSIFIER_URL, DAMOOV_*, DATABASE_URL despite runWith secrets requiring them.
**Conclusion: no positive evidence Cloud Functions have ever been deployed to the production Firebase project.** The entire scoring pipeline above may not run in prod at all.

## QUIRKS
1. Double-fire profile/achievements per completed trip (HIGH — details above).
2. Four divergent scoring implementations.
3. seedAchievements missing requireAdmin.
4. Classifier fully unwired.
5. Duplicate insurance-accept implementations with divergent doc shapes.
6. Damoov sync bypasses/overwrites the weighted-average profile transaction.
7. Damoov trips never classified/AI-analysed (created via FN-01 whose completed-branch doesn't call them); FN-01's anomaly check can flip a pre-completed Damoov trip back to 'processing' with nothing to resolve it.
8. Timezone chaos: Europe/London ×3, America/New_York ×2 (pool money-math), unset (leaderboard → LA).
9. "TODO: Rate limiting" ×7 across callables, never implemented.
10. functions/lib committed.
11. Two refund formulas: real payout (refundCalculator, 0.8/0.2 blend) vs beta estimate (betaEstimateService, 0.7/0.3).
12. deleteUserAccount partial-failure (Firestore gone, Auth orphaned).

## FN test-coverage table
Covered by existing tests: FN-01/02 (trips.test.ts), FN-03 (policies.test.ts), FN-05 partial (damoovRegistration), FN-10 (leaderboard), FN-11/12 (pool), FN-14 (damoovSync), FN-21/22 (gdpr), FN-23/24 (aiAnalysis). **No test file: FN-04, 06, 07, 08, 09, 13, 15, 16, 17, 18, 19, 20, 25, 26, 27, 28, 29, 30 — 18+ of 30 uncovered** (incl. the entire insurance callable surface and the payment→bind glue).
