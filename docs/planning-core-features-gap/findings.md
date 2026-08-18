# Driiva - Core Feature Gap Findings (18 Aug 2026)

Source: Explore agent sweep of ARCHITECTURE.md, CONTEXT.md, rebuild_plan.md,
docs/TECH_ROADMAP.md, docs/DRIIVA_BETA_AUDIT_ONEPAGER.md,
docs/HOW_WE_DETECT_REAL_DRIVING_VS_WALKING.md, plus a full source grep
(client/server/functions/mobile/shared) for TODO/stub/hardcoded/mock/not-wired
markers, cross-checked file by file. Full detail in the agent transcript;
this file holds the durable findings.

## Which doc is "the blueprint"

`rebuild_plan.md` is the only document that still functions as a live,
decision-driving spec - it gates real work on Jamal's sign-off via 16 named
decision points (D1-D16), several still unanswered. `ARCHITECTURE.md` is the
closest to an original technical spec but has drifted (still points to
`helpers.ts` for scoring; that logic moved to `functions/src/scoring/tripMetrics.ts`).
`docs/TECH_ROADMAP.md` is a dated snapshot, already wrong on several items.
`docs/DRIIVA_BETA_AUDIT_ONEPAGER.md` is empty (0 bytes).

## Ranked gaps (biggest to smallest, by how core to the product working)

1. **Pool has no funding pipe.** Refund calculation/distribution is real
   (`functions/src/scheduled/pool.ts`, `refund.ts`) but `server/lib/poolContribution.ts`
   is a self-documented log-only no-op on Stripe payment success - nothing
   ever writes to `contributionCents`. The core loop (pay premium, drive
   safely, get cashback) is broken at the money-in step. Gated on D6.
2. **Phone-usage scoring is functionally neutral everywhere.** Real formula
   exists (`SCORE_WEIGHTS.phoneUsage = 0.1`) but `phonePickupCount` is never
   incremented anywhere in the server-authoritative pipeline, web or mobile.
   10% of every score is dead weight. NOT decision-gated, buildable now.
3. **Claims flow doesn't exist.** No claim entity, lifecycle, or Root claims
   integration. Only an orphaned `/api/incidents` endpoint called from a
   component (`BottomSheet.tsx`) that's mounted nowhere. Gated on D11.
4. **Root Platform integration unverified end-to-end.** No sandbox creds
   anywhere (confirmed in Doppler dev/stg/prd). Webhook receives events and
   does nothing with them. Pinned ZAR-vs-GBP currency bug (`resolveCurrency()`
   is an identity passthrough) means even a working call would price wrong.
5. **Sharia-compliance is marketing copy, zero product substance.** Claimed
   in onboarding copy 3+ places ("Shariah-compliant", "no interest, no
   speculation") with no backend, no defined structure anywhere. Gated on D14
   - this is a regulatory-adjacent claim shipping with nothing behind it.
6. **Mobile has no phone-usage or background trip detection.** Foreground GPS
   capture is real now (this was fixed since the last audit). Background
   capture explicitly not wired (needs expo-task-manager + entitlement).
7. **Legacy dead scoring path still shipped.** `POST /api/trips` +
   `server/lib/telematics.ts` `TelematicsProcessor` is a second, divergent
   scoring implementation. Confirmed unreachable from any live client, but
   still in the bundle - a footgun if anything re-wires it.
8. **Partner rewards have no redemption path.** Honestly labelled in-code as
   "not live" (`mobile/app/(tabs)/rewards.tsx`) - a stated product feature
   with nothing behind it, but not a hidden lie.
9. **Docs are stale on work that's actually DONE.** WebAuthn frontend
   (fully wired: BiometricAuth.tsx, signin.tsx, settings.tsx, server/webauthn.ts),
   password reset, achievements backend, and Stripe payment endpoints are all
   real and shipped, but CLAUDE.md/CONTEXT.md/TECH_ROADMAP.md still list them
   as open gaps. Will misdirect prioritisation if trusted as-is.
10. **rebuild_plan.md's own decision points are still open**: D6 (pool money),
    D8 (GDPR erasure scope), D11 (claims definition), D14 (Sharia
    requirements), D15 (Root/FCA operating model). Several gaps above can't
    close until these are answered - they're decision-blocked, not unbuilt.

## Split: needs Jamal vs buildable now

**Decision-gated (needs Jamal's call before any code):** #1 pool funding (D6),
#3 claims (D11), #5 Sharia (D14), #10 (D8, D15).

**Buildable now, no decision needed:** #2 phone-usage detection (real
accelerometer work, both platforms), #6 mobile background capture, #7 delete
the dead legacy scoring path, #9 fix the stale docs (WebAuthn/password-reset/
achievements/Stripe no longer belong in the "known blockers" list).

#4 (Root) is partially gated (needs Root to actually issue sandbox creds,
external dependency) but the ZAR/GBP currency bug can be scoped once D15 is
answered.
