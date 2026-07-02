# Driiva Ground-Up Rebuild — Prep Harness (supersedes Foundation Harness plan, 2026-07-02)

> Repo: `~/Documents/DriivaMVP` (remote `mrshippers/Driiva`). Branch discipline: **main is untouched throughout**. All characterisation work lands on `rebuild/characterisation`. Current codebase = behavioural spec: a failing characterisation test is a wrong test, not a bug report.
> Prior mission (Foundation Harness, June 2026) is COMPLETE — its register + logic-gap findings live in findings.md and are inputs to this mission.

## Goal
Prepare a ground-up rebuild of Driiva (React+Vite web, Expo mobile — actual SDK version verified in findings). Capture current behaviour as an executable spec, define done-when from the roadmap's market-ready bar, and produce a strangler-pattern rebuild plan for sign-off.

## Phases
- [x] **Phase 0 — Roadmap extraction** — market-ready definition pulled from docs/TECH_ROADMAP.md + ROADMAP.md + CLAUDE.md + CONTEXT.md; under-specification gaps listed in findings.md §Rebuild for Jamal's sign-off. DO NOT invent the bar.
- [ ] **Phase 1a — Characterisation audit** — code-auditor pass via Sonnet explorer subagents: every user-facing flow, API contract, auth path, data shape → findings.md flow map.
- [ ] **Phase 1b — Characterisation suite** — unit + integration + E2E (Playwright web, Maestro mobile). Tests MUST PASS against current code; quirks captured as behaviour, not fixed.
- [ ] **Phase 1c — Coverage report** — every flow in the flow map has ≥1 E2E; third-party edges that can't be automated (Root/GAP claim integrations, external auth) → manual-verify list, never silently skipped.
- [ ] **Phase 1d — Rebuild plan** — /superpowers:writing-plans → rebuild_plan.md (target architecture with per-workstream stack proposals + one-line justifications; strangler module order; per-module done-when = its suite slice green + 1 new integration test + bug-hunt pass). Then /logic-gap-harness the plan.
- [ ] **GATE — Jamal sign-off on suite + plan** (and on the Phase 0 gap list).
- [ ] **Phase 2 — Execution (BLOCKED on gate)** — /goal module-by-module, TDD for new code, feature branches only, commit per module, code-review per module before merge to the rebuild branch.

## Hard rules
- main untouched. Branch `rebuild/characterisation` for suite + docs.
- A characterisation test that fails against current code is WRONG — rewrite the test to match reality (quirks included).
- Do not invent the market-ready bar; gaps go to findings.md for sign-off.
- Test-infra-only changes (e.g. vitest jsx parse config for the 5 pre-existing broken suites) are allowed — they change no product behaviour.
- Local modified docs (ROADMAP.md, DRIIVA_CHANGELOG.md, docs/TECH_ROADMAP.md) are NOT mine — do not commit or revert them.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| session-catchup.py missing from skill dir | 1 | Skipped; recovered context by reading existing planning files directly |

## Current step
Phase 1a: dispatching audit subagents; baseline `npm test` running in background.
