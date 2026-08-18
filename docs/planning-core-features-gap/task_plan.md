# Driiva core features gap analysis

## Goal
Find the original blueprint/spec, compare against current repo state, produce
a ranked list of what core features are missing before Driiva is "finished."
Triggered by Jamal: "ci want us to finish the core features for driiva."

## Phases
1. [done] Locate env vars + telemetry data location (Doppler `driiva` project,
   firestore-backup/ snapshot) - answered inline, see findings.md.
2. [in_progress] Explore agent reading ARCHITECTURE.md / CONTEXT.md /
   rebuild_plan.md / docs/TECH_ROADMAP.md / DRIIVA_BETA_AUDIT_ONEPAGER.md +
   grepping source for TODO/stub/hardcoded markers across feature areas.
3. [pending] Synthesize ranked gap list, present to Jamal.

## Key facts locked in so far
- Doppler project `driiva`, 4 configs (dev, dev_personal, stg, prd) is the
  CANONICAL secrets source per repo CLAUDE.md. Root-level .env/.env.staging
  files are local only, not canonical.
- CONFIRMED (checked all 3 configs): DAMOOV_INSTANCE_ID/KEY and
  ROOT_API_KEY/ROOT_API_URL/ROOT_ENVIRONMENT/ROOT_PRODUCT_MODULE_KEY are
  ABSENT from dev, stg, AND prd. Not even placeholders. The two core
  integrations (telematics scoring input, insurance quote/bind) have code
  but zero live credentials anywhere.
- Telemetry DATA (not code): only `firestore-backup/2026-03-03T20-06-12/`,
  a single old local Firestore export, gitignored, not a separate repo.
  No evidence of a separate "telemetry git" - that memory doesn't match
  what's on disk.
