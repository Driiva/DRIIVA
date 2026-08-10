# Driiva Premium Lift - task plan (2026-08-09)

> Mission: transition Driiva from working MVP to premium, investor-and-user-ready product.
> Repo: ~/Documents/Driiva (mrshippers/Driiva). main @ e124d7b. Root task_plan.md/findings.md = the 2026-06/07 rebuild dossier (KEEP, read-only input).
> Jamal's brief: pick up where telematics core left off; page pagination; community pool visuals; micro-animations (from a git "micro-transitions" source, LOCATE); UI/UX hierarchy putting Driiva targets first; checklist.design as QA reference; keep brand gradient; body font a touch cleaner than Inter; port best parts of Shippers/StrydeOS/TradeMind; big iOS UI lift. Fable plans, Opus/Sonnet subagents execute token-efficiently.

## Known state (from memory + verified 9 Aug)
- Rebuild: M0/M1/M2 merged to main; **M4 (payments/policy) built + review-clean on rebuild/m4-payments @ 986b820, STILL UNMERGED** - Jamal's merge gate.
- M3 (pool) blocked on D6 (pool money rules), M8 (claims) on D11. D14 Sharia / D15 FCA open.
- Mobile: Expo SDK 54, ~25% complete "polished shell" per rebuild audit; web client ~70%.
- Instrument Glass = brand law (design-system/): near-monochrome darks, colour earned, amber→indigo gradient hairline only, Inter/Inter Tight/JetBrains Mono, no gradient-clipped headlines, no em dashes, no AI pill shapes.

## Phases
- [x] P0 Setup - planning files, memory retrieve, repo located
- [ ] P1 Recon (parallel)
  - [x] 1a product-state sweep DONE (findings.md)
  - [x] 1b best-parts inventory DONE (findings.md)
  - [x] 1c Keith email context (5 threads + MVP Discussion doc captured in findings.md)
  - [x] 1d micro-transitions = github.com/Subhan-code/Amicro--Micro-transitions- (npm @subhanhq/amicro, 163 components)
- [x] P2 harness DONE-DEGRADED: 13 confirmed findings -> Wave 0 in the brief
- [x] P3 feature-plan.md written
- [x] P4 implementation-brief.md written (contract, budgets, 16 systems, design gate)
- [~] P5 build waves: A-web + A-mobile agents launched (worktrees)
- [~] P6 Verify: suites green (597 passed vs 518 baseline, rules 136, integration 29, tsc clean, design laws green). OUTSTANDING: on-device screenshots (blocked on the iOS native build), axe, checklist.design pass, and a clean logic-gap-harness re-run over the finished lift.
- [ ] P7 GATED ON JAMAL (cannot proceed without him): FCA wording -> counsel; starting score 100 vs Keith's 70 and replaced-not-averaged; `firebase login --reauth` so an iOS app can be registered (no GoogleService-Info.plist exists); background-location plist decision; D6 pool money model.

## Decisions
- Planning files live in docs/premium-lift/ (root files belong to the rebuild dossier).
- Body font: candidates cleaner than Inter, keep Instrument Glass law → shortlist in findings, decide in P4.
- M4 merge is Jamal's gate: do NOT merge rebuild/m4-payments as part of this mission unless he says so.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| ~/Documents/AI/Driiva not found | 1 | canonical path is ~/Documents/Driiva |
| No Gmail MCP tools in session | 1 | use CDP Chrome (localhost:9222) for Driiva Gmail |
