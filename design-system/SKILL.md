---
name: driiva-design
description: Use this skill to generate well-branded interfaces and assets for Driiva, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

Key files to know:

- `README.md` — the full brief: who Driiva is, the two visual modes (Marketing vs Instrument), content fundamentals, visual foundations, iconography.
- `colors_and_type.css` — drop-in CSS variables for colors, type, radii, shadows.
- `assets/` — logos (wordmark, ii mark, d mark), brand gradient background.
- `ui_kits/marketing/` — recreation of driiva.co.uk (glassmorphism landing).
- `ui_kits/app/` — recreation of the mobile app (instrument glass, 8 screens).
- `source/` — the original codebase materials to cross-reference.

**Before starting any visual work, decide which mode applies:**

- **Marketing mode** — consumer-facing pages, decks for investors, trust-building surfaces. Dark plum (`#1a0f1f`), glassmorphism, animated gradient halos, pill CTAs (`#6366f1` iris), warm amber→indigo brand gradient used liberally. Display: Inter Tight.
- **Instrument mode** — the product itself (mobile + web SPA). Solid dark surfaces (`#12111f` on `#0a0a14`), **one** accent `#5b4dc9` for every interactive element, 16px universal radius, tabular figures everywhere, 270° arc gauges. Score-tier colours (green/teal/amber/red) appear **only** on score data — never as UI chrome.

**Rules that must not be violated:**

1. Never recreate the amber→indigo brand gradient in CSS — use `assets/gradient-background.png`.
2. In Instrument mode, do not introduce a second accent colour. `#5b4dc9` does every job.
3. Score-tier colours only appear on score-related data elements.
4. All numeric displays use tabular figures (`font-variant-numeric: tabular-nums`).
5. Use Inter Tight for display/headings, Inter for body, JetBrains Mono for eyebrows and tags.
6. Capitalisation: sentence case for buttons and headings. Never ALL CAPS except eyebrows and stat labels.
7. UK English spelling throughout.

**Tone of voice:**

Plain, warm, honest British. Direct statements, short sentences. "Drive well. Get money back." beats any feature list. Never hype. Never cute. Avoid emoji unless explicitly requested — the brand uses iconography (lucide/ionicons stroked) and the amber→indigo gradient for expression instead.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc.), copy assets out of this skill and create static HTML files for the user to view. If working on production code, copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts or production code, depending on the need.
