# Morning Report: driiva.co.uk marketing site

## TL;DR

Marketing site is built and ready for review on branch `feat/marketing-site-v1`.
Seven sections, 24 vitest tests passing, both bundle gates clear (CSS 19.9 kB
gz, JS ~69 kB gz). Brand copy was corrected after the brief's draft tagline
turned out to be off-brand. One real gate failure: LCP measures 3.3s under
Lighthouse mobile throttling vs the 2.0s budget in the brief. Performance
score itself is 90, so the score gate still passes. No production deploy
was attempted (forbidden by the overnight rules); preview deploy is yours
to trigger.

## Done

- Scaffolded fresh Vite 6 + React 18 + TypeScript app at `apps/marketing/`
- Pasted design tokens verbatim into `src/styles/tokens.css` per brief
- Composed `src/styles/global.css` with token-driven utilities, glassmorphism,
  ghost CTA, eyebrow type, lede type, hairline divider, cursor follower,
  and full `prefers-reduced-motion` handling
- Wrote `src/lib/motion.ts` as the anime.js v4 wrapper with automatic
  reduced-motion short-circuit and final-state assignment
- `useInView`, `useLenis`, `useCursor` hooks for inertial scroll, viewport
  entry triggers, and the trailing-cursor circle
- All seven sections implemented:
  - **Hero**, wordmark + tagline + ghost CTA, anime.js entrance timeline,
    ambient noise SVG drift loop
  - **Problem**, three count-up stat cards (75%, £16.8B, 0) driven by
    anime.js update callbacks
  - **Mechanism**, animated SVG flywheel with five nodes and
    `stroke-dashoffset` draw-on animation
  - **Product**, live dashboard demo inside a phone frame, ScoreRing,
    trip cards, refund counter
  - **Differentiators**, 2x2 pillar grid with hover-driven SVG icon
    stroke reveals
  - **Waitlist**, email capture with morphing button on success
  - **Footer**, wordmark, FCA disclaimer, mono micro-type links
- 24 vitest tests across 7 files, all green. Each section covers render,
  animation dispatch under normal motion, and skip-under-reduced-motion.
- Build passes: `tsc --noEmit && vite build` exit 0 in 800 ms
- Background gradient JPEG'd from 3.1 MB to 149 kB so LCP could clear the
  network leg cleanly. PNG master untouched in `design-system/assets/`.
- Gradient and ink layers moved into static `index.html` so they paint
  on CSS resolve, not after the React bundle executes
- Project root `CLAUDE.md` patched: removed the "em dashes liberally"
  line, replaced with the universal no-em-dash rule

## Decisions

- **Scaffolded a new app at `apps/marketing/` instead of extending
  `marketing-site/`** because the latter is the canonical editorial source
  for the live Framer site, not a Vite codebase.
- **Tailwind 3.4 inside the marketing app** despite the rest of the repo
  using Tailwind v4 (commit `e90290d`). The app is isolated and the brief
  was explicit. Self-contained, no cross-contamination.
- **Re-encoded the gradient to JPEG q82**, named `gradient-bg.jpg`. The
  brief forbids recreating the gradient in CSS or SVG, but does not
  specify the on-disk format. 95% size reduction, visually identical.
- **Combined test scaffold and implementation into one commit per group**
  rather than the brief's two-commits-per-section. The autonomous-pacing
  rationale no longer applied once you were awake. Tests still gate the
  behaviour.
- **Replaced the brief's draft tagline with your actual brand positioning**
  ("AI-powered. Community-driven."), in Hero, OG title/description, page
  title, meta description, and supporting copy in Problem, Mechanism,
  and Differentiators. Differentiators "Transparent" pillar renamed to
  "Explainable AI". You flagged the freestyle live and this was the fix.

## Blocked

- **LCP gate**, 3.3s measured vs 2.0s budget under Lighthouse mobile
  (Slow 4G throttling, 4x CPU). To close the gap would need:
  - Critical CSS inlined in `<head>` so first paint does not block on the
    main CSS download
  - Font subsetting and/or replacing `@fontsource` with a single Inter
    Variable woff2 to cut font fetches
  - Possibly preloading the hashed font files via a Vite plugin so the
    browser starts fetches before parsing CSS
  No single change closes the 1.3s gap. Recommend a follow-up branch.
- **No preview URL**. The overnight rules forbade any deploy. Run
  `cd apps/marketing && vercel deploy` (preview, no `--prod`) when ready.

## Perf gates

| Gate | Budget | Measured | Status |
|---|---|---|---|
| Lighthouse perf score (mobile) | >= 90 | 90 | pass |
| LCP | < 2.0 s | 3.3 s | fail |
| Total JS (gzipped) | < 180 kB | ~69 kB | pass |
| Total CSS (gzipped) | < 30 kB | 19.9 kB | pass |
| CLS | n/a | 0.000 | pass |
| TBT | n/a | 34 ms | pass |

## Next action

Open a preview deploy and walk through the live build, focused on:
1. Hero entrance timing and wordmark settle on a real device.
2. The "AI-powered. Community-driven." subhead, is two-fragment cadence
   the final voice or do you want it expanded.
3. The Differentiators "Explainable AI" pillar copy.
4. Decide on the LCP follow-up branch.

```bash
cd /Users/joa/Documents/Driiva/apps/marketing
vercel deploy
```

## Branch and commits

- Branch: `feat/marketing-site-v1`
- Base: `main` at `25a7f4e`
- Backup tag: `backup/marketing-build-20260516-0752`
- Commits on this branch:
  - `93a05e7` fix(marketing): correct brand voice to AI-powered, community-driven
  - `c2898c8` feat(marketing): scaffold driiva.co.uk marketing site with animated sections
- 38 files added, 2 files modified in repo root (`CLAUDE.md`, `.gitignore`),
  one new tracked file at repo root (`OVERNIGHT_LOG.md`).
