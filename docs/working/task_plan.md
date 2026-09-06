# Driiva Ground-Up Rebuild — Prep Harness (supersedes Foundation Harness plan, 2026-07-02)

> Repo: `~/Documents/Driiva` (remote `mrshippers/Driiva`). Branch discipline: **main is untouched throughout**. All characterisation work lands on `rebuild/characterisation`. Current codebase = behavioural spec: a failing characterisation test is a wrong test, not a bug report.
> Prior mission (Foundation Harness, June 2026) is COMPLETE — its register + logic-gap findings live in findings.md and are inputs to this mission.

## Goal
Prepare a ground-up rebuild of Driiva (React+Vite web, Expo mobile — actual SDK version verified in findings). Capture current behaviour as an executable spec, define done-when from the roadmap's market-ready bar, and produce a strangler-pattern rebuild plan for sign-off.

## Phases
- [x] **Phase 0 — Roadmap extraction** — market-ready definition pulled from docs/TECH_ROADMAP.md + ROADMAP.md + CLAUDE.md + CONTEXT.md; under-specification gaps listed in findings.md §Rebuild for Jamal's sign-off. DO NOT invent the bar.
- [x] **Phase 1a — Characterisation audit** — DONE: 7-domain fan-out, verbatim dossier in docs/rebuild/, distilled to findings.md §0.4-0.5.
- [x] **Phase 1b — Characterisation suite** — DONE, ALL GREEN vs current code: vitest 412+2 todo (25 files), Playwright 25 tests ×2 viewports, Maestro 6 flows authored (execution blocked: iOS unbuildable from source + no Firebase native config — mobile/.maestro/README.md).
- [x] **Phase 1c — Coverage report** — DONE: findings.md §1c (flow×suite matrix, 17-item manual-verify list, 3-item needs-input list).
- [x] **Phase 1d — Rebuild plan** — DONE: rebuild_plan.md (decision points D1-D16, strangler M0-M8, migration+cutover workstream, launch gate). Logic-gap harness: 2 HIGH confirmed + folded in; verify pass partial (token limit) — status + resume command in-plan. (/production-bug-hunter doesn't exist on this machine → D12 substitute.)
- [ ] **GATE — Jamal sign-off** on findings.md §0.3 gaps + the suite + rebuild_plan.md D1-D16. ← **YOU ARE HERE**
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
Phase 1 COMPLETE (3 Jul, overnight). Waiting on Jamal's sign-off (rebuild_plan.md D1-D16 + findings §0.3). Phase 2 starts at M0 once signed. Needs-input before authenticated E2E: enable Email/Password on driiva-staging; staging Admin creds for test-user seeding.
