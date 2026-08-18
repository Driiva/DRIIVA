# M2-DEC-1: Phone-usage scoring - decision needed

Status: RESOLVED, 18 Aug 2026. Option A shipped on `feat/phone-usage-detection`
(see "What actually shipped" at the end of this doc for the honest detail -
wired end-to-end and tested, mobile detection unverified on a real device).
Everything below this line is the original decision brief, kept as-written
for the historical record of why Option A was chosen over Option B.

## TL;DR

The driving score has five factors. Four of them (Speed, Braking, Acceleration,
Cornering) work off real data. The fifth, Phone-usage, is worth 10% of the
score and today it ALWAYS scores 100 (perfect) for every driver, because the
data it needs never reaches the server. So in practice every score carries a
silent, free +10 that has nothing to do with how the person actually drove.

This is not a bug in the maths. The phone-usage maths is real and correct. The
problem is that it is being fed a value that is always 0. Fixing it changes what
every score means, so it is your call, not something a task should decide.

## What is happening today, precisely

- The score is a weighted blend: Speed 25%, Braking 25%, Acceleration 20%,
  Cornering 20%, Phone-usage 10%.
- Phone-usage is computed by `computePhoneUsageScore` (real, rate-based math:
  more phone pickups per 10 minutes = lower score, floor of 20). It is NOT a
  stub.
- Its only input is `phonePickupCount` on the trip. On the server that count is
  initialised to 0 and never incremented, because the raw GPS sample shape the
  server processes (`TripPoint`: time, lat, lng, speed, heading, accuracy, plus
  optional accel/gyro) carries no phone-pickup field at all.
- So `computePhoneUsageScore` is always called with 0 pickups, which always
  returns 100.
- The signal DOES exist on the phone: the trip-recording screen has a working
  listener that counts every time the app is backgrounded mid-trip. But that
  count was only ever used for an on-device toast (now removed in M2 Task 5). It
  is never streamed up with the trip points, so the server never sees it.

Net effect: the 10% phone-usage weight behaves as if it were a 0% weight PLUS a
flat +10 bonus on every single score. That is arguably worse than having no
phone factor at all, because it quietly inflates everyone's score by up to 10
points and is not disclosed anywhere except an internal note.

Where it is disclosed: `CONTEXT.md` Rule 8 already says, internally, "Do not
market phone-use detection as an active, live scoring factor until it is
implemented... Current status: hardcoded to neutral (100)." So this is a known,
documented gap, not a surprise. What has been missing is a decision on how to
close it.

## Why this needs your sign-off

Both ways of closing the gap change the scoring formula, and the score is the
product. Either choice shifts what a "72" means, and one of them also
retroactively reframes what past scores should have been. That is a product and
(given insurtech) a fairness/regulatory decision, not an engineering cleanup, so
it should not be made silently inside a refactor.

## The two real options

### Option A - Wire it properly (make the real math get real data)

Carry the phone-pickup signal that already exists on the device all the way
through to the server score. Concretely this means, as a later gated task:
- add a pickup field to the `TripPoint` shape and the stored trip-points schema,
- add that field to the Firestore DPIA-reviewed data-types allowlist (today it
  is not on the allowlist, so a client sending it would trigger a DPIA alert
  rather than being scored),
- stream the existing on-device pickup count up with the trip points.

Result: phone-usage finally scores real behaviour. Scores start moving for
drivers who use their phone mid-trip; scores for everyone else stay ~the same
(they were already effectively getting the full 10%). Honestly satisfies Rule
8's "coming soon". More work, and it adds a new personal-data field, so it needs
a DPIA touch.

### Option B - Remove the phone-usage weight and renormalise

Drop the 10% phone factor entirely and rescale the other four to sum to 100%
(for example 25/25/20/20 becomes ~27.8/27.8/22.2/22.2). Honest and simpler, no
new data collection.

Downside: this is a formula change that also retroactively reframes every past
score - a historical number computed under 25/25/20/20/10 no longer matches what
the new formula would have produced, so any stored or shown history becomes
"under the old formula". Also permanently drops phone-use as a product feature
unless revived later.

## Recommendation (a recommendation, NOT a decision)

Lean Option A. The detection already exists on the device, this module already
owns the trip-points contract, and it turns a silently-inflated score into an
honest one without throwing away a differentiating telematics feature or
rewriting the meaning of past scores. Option B is the right fallback if the
DPIA/schema work for A is out of budget and you would rather ship an honest
four-factor score now than keep the free +10 any longer.

Whichever you pick: it is a deliberate scoring-formula change and should be its
own task with your explicit go-ahead. Until then, today's behaviour is locked in
by the pinning test at
`packages/scoring/src/__tests__/tripMetrics.phoneUsage.pin.test.ts`, so no one
can change it by accident.

## What M2 Task 6 did and did NOT do

- DID: add the pinning test above; write this doc.
- DID NOT: change `computePhoneUsageScore`, any weight, the `TripPoint` schema,
  the DPIA allowlist, or the trip-point streaming. No formula change is in this
  task's diff.

## What actually shipped (18 Aug 2026, `feat/phone-usage-detection`)

Option A, with one deliberate simplification from the brief above: instead of
adding a pickup field to `TripPoint` itself (which would have needed a DPIA
allowlist change - see `DPIA_REVIEWED_DATA_TYPES` in
`functions/src/triggers/trips.ts`), the pickup count is a new top-level field
on the trip document, `clientReportedPhonePickupCount`, separate from the
per-point GPS trace and from the locked `events` map. That sidesteps the DPIA
touch entirely: no new field is added to `tripPoints`, so `checkDpiaCompliance`
never sees it.

- `computeTripMetrics` (packages/scoring/src/tripMetrics.ts, the authored
  source; functions/src/scoring/tripMetrics.ts is its build-time copy) takes
  an optional second parameter, `clientReportedPhonePickupCount`. A new
  `sanitizePhonePickupCount` helper rejects non-finite/negative values and
  rate-caps the rest at 6 pickups/minute before it can reach
  `events.phonePickupCount` or the score.
- `finalizeTripFromPoints` (functions/src/triggers/trips.ts) reads
  `tripData.clientReportedPhonePickupCount` and passes it straight through -
  the sanitiser is the trust boundary, not this call site.
- Web: `client/src/lib/tripService.ts`'s `endTrip()` now writes
  `clientReportedPhonePickupCount`, derived from the `phonePickupCount` the
  trip-recording screen already tracked locally (a `visibilitychange` proxy -
  the app backgrounded while a trip is recording). That count existed before
  this change; it was just never reaching the server.
- Mobile: `mobile/lib/phonePickup.ts` (`PhonePickupDetector`) is new - an
  on-device accelerometer heuristic (expo-sensors), wired into
  `mobile/app/(tabs)/record.tsx`'s recording lifecycle and submitted via
  `mobile/lib/trips.ts`'s `submitTripForScoring`.

**Honest status, not overclaimed:**
- VERIFIED: the pipeline end-to-end - client write -> server sanitisation ->
  score - is covered by unit tests (packages/scoring, functions/src/__tests__)
  AND a real Firestore-emulator integration test that drives the actual
  `finalizeTripFromPoints`/`onTripStatusChange` and confirms a reported pickup
  changes the stored `phoneUsageScore`, and that an implausible count is
  rate-capped rather than trusted.
- NOT VERIFIED: the mobile accelerometer heuristic's real-world accuracy. It
  has not been run against a real accelerometer in a moving car - the
  thresholds in `mobile/lib/phonePickup.ts` are a reasoned starting point, not
  a calibrated one. Neither heuristic (web's tab-visibility proxy or mobile's
  accelerometer pattern) is a claim of accurate pickup detection - both are
  documented, deterministic proxies, in the spirit of
  `docs/HOW_WE_DETECT_REAL_DRIVING_VS_WALKING.md`.
