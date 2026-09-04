/**
 * A second locked-card contrast bug on /rewards, same shape as the one
 * `tests/unit/rewards-locked-card-contrast.test.ts` already pins on
 * `RewardsTimeline`, but in a different component the earlier fix never
 * touched: the Achievements grid on the same page.
 *
 * `npm run gates` ran for real tonight (Chrome was up on :9222, the QA
 * emulator stood itself up, the seeded driver signed in) and axe still
 * failed /rewards with 5 SERIOUS color-contrast nodes, all matching
 * `.opacity-50.p-5.instrument-card`. That selector is `GlassCard`
 * (`instrument-card ${className}`) wrapping a locked achievement, where
 * `!achievement.unlocked ? 'opacity-50' : ''` dims the whole card. CSS
 * opacity on an ancestor multiplies every descendant's alpha rather than
 * sitting beside it, so the description text (`text-white/60`) painted
 * inside a locked card renders far dimmer than its own alpha states.
 *
 * The card's locked state is already signalled two other ways that do not
 * touch text opacity: the icon switches from `--app-primary-text` to the
 * muted `--app-text-sec`, and the unlocked-only green check badge is
 * absent. Dropping the whole-card opacity removes only the thing crushing
 * the description's contrast, not the locked cue itself - the same
 * reasoning the RewardNode fix already used.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const REWARDS_PAGE = 'client/src/pages/rewards.tsx';
const INDEX_CSS = 'client/src/index.css';

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const m = hex.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

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

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function readHexToken(css: string, token: string): string {
  const m = css.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token not found in ${INDEX_CSS}: ${token}`);
  return m[1];
}

const WHITE: Rgb = [255, 255, 255];
const WCAG_AA_NORMAL_TEXT = 4.5;

describe('rewards achievement-card contrast', () => {
  const css = read(INDEX_CSS);
  const appBg = hexToRgb(readHexToken(css, '--app-bg'));
  const cardBg = hexToRgb(readHexToken(css, '--app-surface-1'));

  // The achievement description is text-white/60, same as the RewardNode bug.
  const textAlpha = 0.6;

  it('text-white/60 directly on the card background clears AA on its own', () => {
    const rendered = compositeOver(WHITE, textAlpha, cardBg);
    expect(contrastRatio(rendered, cardBg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it('the same text under a compounding 50% ancestor opacity fails AA - this was the bug', () => {
    // What the browser paints for `opacity-50` on the ancestor: the whole
    // card (text over card background) is flattened to one opaque layer,
    // and that layer is composited at 50% over the page background.
    const cardLayer = compositeOver(WHITE, textAlpha, cardBg);
    const renderedText = compositeOver(cardLayer, 0.5, appBg);
    const renderedCardBg = compositeOver(cardBg, 0.5, appBg);

    const ratio = contrastRatio(renderedText, renderedCardBg);
    expect(ratio).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });

  it('the achievements GlassCard no longer puts a whole-card opacity on the locked state', () => {
    const source = read(REWARDS_PAGE);
    const cardBlock = source.match(/<GlassCard className=(\{`p-5[^`]*`\}|"p-5")>/);
    expect(cardBlock, 'achievement GlassCard className expression not found - has it been restructured?').not.toBeNull();
    expect(cardBlock![0]).not.toMatch(/opacity-\d+/);
  });

  it('the locked state still signals itself - muted icon colour and no check badge', () => {
    const source = read(REWARDS_PAGE);
    expect(source).toMatch(/achievement\.unlocked[\s\S]{0,40}\?\s*'var\(--app-primary-text\)'[\s\S]{0,40}:\s*'var\(--app-text-sec\)'/);
    expect(source).toMatch(/\{achievement\.unlocked && \(/);
  });

  it('the pin fires on a planted regression', () => {
    const planted = "<GlassCard className={`p-5 ${!achievement.unlocked ? 'opacity-50' : ''}`}>";
    const cardBlock = planted.match(/<GlassCard className=\{`p-5[^`]*`\}>/);
    expect(cardBlock![0]).toMatch(/opacity-\d+/);
  });
});
