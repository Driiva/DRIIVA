/**
 * The Rewards locked-card contrast pin, checked statically and by computation.
 *
 * ROADMAP's "npm run gates" design-law ticket named this one directly: five
 * axe SERIOUS colour-contrast nodes, all of them the locked reward cards. The
 * browser gate that found it cannot run in the unattended clone (Chrome on
 * :9222, a Firebase emulator and a seeded driver, none of which exist here),
 * so this test holds the fix the way `tests/unit/web-dashboard-laws.test.ts`
 * and `tests/unit/web-type-source.test.ts` already do for their own tickets:
 * a source-level pin, plus a from-tokens computation standing in for the
 * pixel measurement no browser here can take.
 *
 * The bug: `RewardNode` put `opacity-40` on the outer card that also wraps
 * every descendant, including the "locked" overlay's own `text-white/60`
 * label. CSS opacity on an ancestor multiplies every descendant's alpha
 * rather than sitting beside it, so the overlay text that exists specifically
 * to tell a driver a reward is locked was the thing dimmed hardest. Below,
 * `contrastRatio` (the real WCAG relative-luminance formula, not a stand-in)
 * proves that composition failed AA on the app's own tokens, and that
 * removing the whole-card opacity - leaving the blur overlay and the icon to
 * carry the "locked" signal - clears it by a wide margin.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const REWARDS_TIMELINE = 'client/src/components/RewardsTimeline.tsx';
const INDEX_CSS = 'client/src/index.css';

// ── WCAG 2.x contrast maths, not a stand-in for it. ─────────────────────────

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const m = hex.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** Alpha-composite an rgb foreground at `alpha` over an opaque rgb background. */
function compositeOver(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [
    fg[0] * alpha + bg[0] * (1 - alpha),
    fg[1] * alpha + bg[1] * (1 - alpha),
    fg[2] * alpha + bg[2] * (1 - alpha),
  ];
}

function srgbChannelToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: Rgb): number {
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/** WCAG contrast ratio, 1 to 21. */
function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Read a `--token: #rrggbb;` value straight from the live CSS, never pasted. */
function readHexToken(css: string, token: string): string {
  const m = css.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token not found in ${INDEX_CSS}: ${token}`);
  return m[1];
}

const WHITE: Rgb = [255, 255, 255];
const WCAG_AA_NORMAL_TEXT = 4.5;

describe('rewards locked-card contrast', () => {
  const css = read(INDEX_CSS);
  const appBg = hexToRgb(readHexToken(css, '--app-bg'));
  const cardBg = hexToRgb(readHexToken(css, '--app-surface-1'));

  // The overlay's own "days to go" label and the card's milestone label both
  // use text-white/60 - the least-opaque text colour actually painted on a
  // locked card, and so the one most exposed to a compounding ancestor alpha.
  const textAlpha = 0.6;

  it('text-white/60 directly on the card background clears AA on its own', () => {
    const rendered = compositeOver(WHITE, textAlpha, cardBg);
    expect(contrastRatio(rendered, cardBg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it('the same text under a compounding 40% ancestor opacity fails AA - this was the bug', () => {
    // What the browser actually paints for `opacity-40` on the ancestor: the
    // whole card (text over card background) is rendered as one flattened,
    // opaque layer, and THAT layer is composited at 40% over the page
    // background - never the text colour alone against the page.
    const cardLayer = compositeOver(WHITE, textAlpha, cardBg);
    const renderedText = compositeOver(cardLayer, 0.4, appBg);
    const renderedCardBg = compositeOver(cardBg, 0.4, appBg);

    const ratio = contrastRatio(renderedText, renderedCardBg);
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL_TEXT);
    // Concretely bad, not marginal - this is what five SERIOUS nodes looks like.
    expect(ratio).toBeLessThan(2.5);
  });

  it('RewardNode no longer puts a whole-card opacity on the locked state', () => {
    const source = read(REWARDS_TIMELINE);
    const cardClassBlock = source.match(/const cardClass = \[[\s\S]*?\]/);
    expect(cardClassBlock, 'cardClass array not found - has RewardNode been restructured?').not.toBeNull();
    expect(cardClassBlock![0]).not.toMatch(/isLocked\s*&&\s*['"`]opacity-\d+['"`]/);
  });

  it('the locked state still signals itself - blur overlay and lock icon stay', () => {
    const source = read(REWARDS_TIMELINE);
    expect(source).toMatch(/isLocked && \(/);
    expect(source).toContain('backdrop-blur');
    expect(source).toContain('<Lock');
  });

  it('the pin fires on a planted regression', () => {
    const planted = `
  const cardClass = [
    'instrument-card relative',
    isLocked && 'opacity-40',
    isUnlocked && 'reward-glow-unlocked',
  ]`;
    const cardClassBlock = planted.match(/const cardClass = \[[\s\S]*?\]/);
    expect(cardClassBlock![0]).toMatch(/isLocked\s*&&\s*['"`]opacity-\d+['"`]/);
  });
});
