# M2-DEC-3: Flagged-trip resolution - decision needed

Status: OPEN. Awaiting Jamal's sign-off. Nothing has been changed in the
anomaly-detection logic or the scoring of flagged trips. M2 Task 8 only made the
current stuck state honestly visible in the UI, pinned today's behaviour with a
test, and wrote this up.

## TL;DR

When a trip trips the anomaly detector (impossibly high average speed, or a GPS
track that jumps far further than the straight-line distance), we do not reject
it and we do not score it into the driver's profile. We "persist-flag" it: the
trip is left sitting in `processing` status forever. There is no automatic way
back out. The driver's only real lever is to cancel the trip, which is framed to
them as "cancel my trip", not "this trip is being reviewed".

Until Task 8, a flagged trip was indistinguishable from a normal trip that is
just still computing - both showed the same pulsing "Processing" badge. Task 8
gives flagged trips their own honest "Under review" state so a driver can tell
"this will finish in a moment" apart from "this is held and may be stuck". But
the underlying question - what actually happens to a flagged trip in the end -
is a data-trust decision only you can make.

## What is happening today, precisely

- `detectAnomalies` sets `flaggedForReview = true` on two conditions: average
  speed over ~200mph, or a GPS-jump ratio over 10x the straight-line distance.
- When a trip finishes computing, the pipeline picks its final status as
  `flaggedForReview ? 'processing' : 'completed'`. So a flagged trip is held in
  `processing`; a clean trip goes to `completed`.
- A flagged trip IS still scored. The pipeline computes its score and breakdown
  and writes them onto the trip document. That score is just never applied: the
  driver profile (`totalTrips`, `totalMiles`, streak, the blended score that
  drives the refund) is only updated for trips that reach `completed`, and a
  flagged trip never does. So the score exists on the trip but counts for
  nothing.
- Nothing moves a flagged trip forward. The pipeline's completion step only
  fires on a `processing -> completed` transition, and no code ever writes that
  transition for a flagged trip. The admin panel is read/browse/export only - it
  has no mutation that could approve a trip. A grep of the whole repo for
  `flaggedForReview` finds only the detector that sets it and the schema that
  declares it; there is no reviewer workflow anywhere.
- The only two ways a flagged trip's status ever changes again:
  1. The driver self-cancels it (`cancelTrip`), which sets it to `failed`. This
     works, but it is presented as "cancel my trip", so a driver would only do
     it if they wanted rid of the trip, not because they understand it was
     flagged.
  2. A monitoring function alerts Sentry after the trip has been stuck in
     `processing` for an hour. That is observability only - it tells us, it does
     nothing for the driver.
- Net effect: a flagged trip silently vanishes into permanent limbo. It never
  counts toward the driver's score or refund, and until Task 8 the driver had no
  honest signal that anything unusual had happened - just a spinner that never
  resolves.

The type system even hints at an intended-but-unbuilt exit: `TripStatus`
declares a `disputed` value, and the pipeline's completion branch is commented
"Manual review completion (processing -> completed)". Both are vestiges - there
is zero code that writes `disputed` and nothing that performs a manual approval.
The scaffolding for a reviewer path was anticipated and never built.

## What Task 8 did and did NOT do

- DID: give flagged trips a distinct "Under review" card state in the trips list
  (steady alert indicator and honest copy, visually separate from the pulsing
  "Processing" badge a normally-computing trip shows), driven off the
  `anomalies.flaggedForReview` field which is already readable client-side.
- DID: add an integration test (`tests/integration/trips.test.ts`) pinning
  today's behaviour - a flagged trip is scored but held in `processing`, the
  profile is untouched, and a later touch to the document does not advance it.
- DID NOT: change `detectAnomalies` (thresholds or logic), change the scoring of
  a flagged trip, add any resolution mechanism, or change `firestore.rules`. No
  path out of limbo is created in this task's diff.

## Why this needs your sign-off

Deciding what finally happens to a flagged trip is a data-trust and fairness
call, not an engineering cleanup:

- If we ever let a flagged trip's score count, we are letting a trip our own
  detector called "impossible" contribute to the driver's profile and, through
  the blended score, their cashback refund. That is a money and fairness
  question in a regulated insurance product.
- If we never let it count, some drivers permanently lose legitimate trips to a
  false positive (a genuine motorway drive misread as impossible, a tunnel GPS
  glitch), with no way to appeal beyond deleting the trip.

Either way it shapes what a score and a refund mean, so it should be an explicit
decision, not a default that happened because nobody built the exit.

## The two real options

### Option A - A genuine reviewer / admin path

Build a mechanism that lets a flagged trip be explicitly approved (scored in) or
rejected (marked `failed` / `disputed`). The pipeline already listens for the
`processing -> completed` transition, so the missing piece is a trusted
mutation - an admin action, or a support tool - that performs it after a human
(or a rule) has looked at the trip.

- Pro: keeps a human in the loop on exactly the trips we are least sure about;
  lets a genuine false positive be rescued; nothing anomalous counts toward a
  refund without a decision.
- Con: real new scope. This rebuild's admin surface is currently read-only with
  no mutations anywhere, so this means standing up a trusted write path,
  auth/permissions for it, and an audit trail (insurtech). Realistically its own
  later module, not a fold-in here. And it needs someone to actually do the
  reviewing, which is an ops cost that scales with volume.

### Option B - Auto-resolve after N hours

If a flagged trip is still in `processing` after some window (say 24-48h), let
the pipeline resolve it automatically: score it anyway, record the anomaly
alongside the score for later analysis, and stop blocking the driver.

- Pro: simple, no new admin surface, no ops burden, no permanent limbo. The
  driver is never left with a trip stuck forever.
- Con: an anomalous trip DOES eventually count toward the driver's profile and
  refund. That is the exact data-trust line - we would be paying (in cashback)
  partly on the basis of a trip our detector flagged as impossible. Mitigations
  exist (resolve it with the anomaly recorded so it can be audited or clawed
  back; or resolve-but-exclude-from-refund while still clearing the limbo), but
  the base version means trusting flagged data.

## Recommendation (a recommendation, NOT a decision)

Lean Option B, in a conservative form: auto-resolve after a window, but resolve
the trip to a state that clears the driver's limbo WITHOUT letting an
"impossible" trip silently inflate their refund - e.g. mark it resolved and keep
the anomaly flag on the record so refund logic can exclude it, or route it to a
lightweight review queue only if volume ever justifies one. This gets drivers
out of permanent limbo now, needs no new admin write-surface, and keeps the
door open to Option A later if flagged volume ever warrants real human review.
Option A is the right answer if the false-positive rate turns out high enough
that individual rescue matters, but it is a lot of surface to build before we
have any signal on how often trips actually get flagged.

Whichever you pick: it is a deliberate change to what a flagged trip becomes,
and should be its own task with your explicit go-ahead. Until then, today's
"scored but held, no path out" behaviour is locked in by the pinning test in
`tests/integration/trips.test.ts`, so no one can give flagged trips an automatic
exit by accident - that change would turn the test red and force this
conversation.
