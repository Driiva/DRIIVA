/**
 * The dashboard's design-law pins, checked statically.
 *
 * tests/design-laws.mjs measures the RENDERED page in Chrome behind a seeded
 * emulator sign-in, which cannot run in CI, so the dashboard findings from the
 * last gate run (ROADMAP, the dashboard design-law ticket) sat invisible to
 * every automated check. These tests hold the fixes the only way CI can see
 * them: at the source. They are pins, not the law itself - the browser gate
 * stays the authority on what actually renders, and the parent "gates is
 * still INCOMPLETE" ticket stays open until a real run is green.
 *
 * What the gate found, and what each pin holds:
 *  - Law 1, no capsules: five painted oblongs carried a radius reaching half
 *    their short side - the indigo Beta badge and both progress bars, each
 *    bar being a track plus a fill. A painted rounded-full element is only
 *    ever legitimate here as a circle (equal width and height) or as an
 *    inset-0 overlay that takes its shape from a circular parent.
 *  - Law 5, type floors: "Trust Centre" and the rest of the footer row
 *    rendered at 11px against the 13px secondary floor, and the starting
 *    score explainer set its ~330-character body copy at 13px against the
 *    15px body floor.
 *  - Law 5, a second pass (`npm run gates` run for real on 2026-09-04, Chrome
 *    up on :9222): three more strings classed as body copy by length (>=60
 *    characters of own text, the same rule tests/design-laws.mjs uses) were
 *    still on `text-xs` (13px, the secondary tier) instead of the 15px body
 *    floor - the AI tip body, the empty-pool contribution note, and the
 *    "you're on track for a refund" banner.
 *  - Law 6, tabular figures: the dashboard's plain numeric spans (trip score,
 *    trip distance, total miles, pool share, safety factor twice,
 *    participants) computed no tabular-nums while the score breakdown row
 *    beside them already did.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const DASHBOARD = 'client/src/pages/dashboard.tsx';
const EXPLAINER = 'client/src/components/StartingScoreExplainer.tsx';

/**
 * A resting paint: a bg- utility that applies without interaction. hover:bg-
 * and friends paint nothing at rest, which is why the two icon buttons that
 * carry rounded-full plus hover:bg- are not capsules.
 */
const paintsAtRest = (line: string) => /(^|[\s"'`{])bg-/.test(line);

/** An equal explicit width/height pair: a circle, which the law allows. */
const isSquare = (line: string) => {
  const m = line.match(/w-(\[[^\]]+\]|[\w.]+) h-(\[[^\]]+\]|[\w.]+)/);
  return m !== null && m[1] === m[2];
};

/**
 * Line-level reading of design law 1 for this page: a painted rounded-full
 * element that is neither a circle nor an inset-0 overlay is a capsule.
 */
function capsuleOffenders(source: string): string[] {
  return source.split('\n').flatMap((line, i) => {
    if (!line.includes('rounded-full')) return [];
    if (!paintsAtRest(line)) return [];
    if (isSquare(line)) return [];
    if (line.includes('inset-0')) return [];
    return [`${i + 1}: ${line.trim().slice(0, 80)}`];
  });
}

/**
 * The numeric spans are single elements whose className sits on the same line
 * or the line above, so a three-line window around the figure is enough to
 * see whether its span carries the tabular class.
 */
function figureLinesMissingTabular(source: string, anchors: string[]): string[] {
  const lines = source.split('\n');
  const missing: string[] = [];
  for (const anchor of anchors) {
    const hits = lines
      .map((line, i) => (line.includes(anchor) ? i : -1))
      .filter((i) => i >= 0);
    expect(hits.length, `anchor not found in ${DASHBOARD}: ${anchor}`).toBeGreaterThan(0);
    for (const i of hits) {
      const window = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
      if (!/tabular/.test(window)) missing.push(`${i + 1}: ${anchor}`);
    }
  }
  return missing;
}

const FIGURE_ANCHORS = [
  '{trip.score}',
  '{trip.distance} mi',
  '{totalMiles.toLocaleString()} mi',
  '{userSharePercentage.toFixed(2)}%',
  '{Math.round(safetyFactor * 100)}%',
  '{activeParticipants.toLocaleString()}',
];

/**
 * The three long (>=60 own-text characters) strings design-laws.mjs classes
 * as "body" copy, which the browser gate found still painted at text-xs
 * (13px, the secondary floor) instead of the 15px body floor.
 */
const BODY_COPY_ANCHORS = [
  '{tip.tip}',
  'Contributions start when the insurance product launches.',
  "You're on track for £{surplusProjection} back this period.",
];

/**
 * The className carrying each anchor sits on the same line or up to two
 * lines above it, the same window shape figureLinesMissingTabular already
 * uses for law 6.
 */
function bodyCopyStillOnSecondaryFloor(source: string, anchors: string[]): string[] {
  const lines = source.split('\n');
  const offenders: string[] = [];
  for (const anchor of anchors) {
    const hits = lines
      .map((line, i) => (line.includes(anchor) ? i : -1))
      .filter((i) => i >= 0);
    expect(hits.length, `anchor not found in ${DASHBOARD}: ${anchor}`).toBeGreaterThan(0);
    for (const i of hits) {
      const window = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
      if (/text-xs\b/.test(window)) offenders.push(`${i + 1}: ${anchor}`);
    }
  }
  return offenders;
}

describe('dashboard design-law pins', () => {
  it('law 1: no painted oblong on the dashboard is a capsule', () => {
    expect(capsuleOffenders(read(DASHBOARD)).join('\n')).toBe('');
  });

  it('law 5: nothing on the dashboard renders below the 13px secondary floor', () => {
    expect(read(DASHBOARD).includes('text-[11px]')).toBe(false);
  });

  it('law 5: the starting score explainer sets its body copy at the 15px floor, not 13px', () => {
    expect(read(EXPLAINER).includes('text-[13px]')).toBe(false);
  });

  it('law 6: every plain numeric readout span on the dashboard is tabular', () => {
    expect(figureLinesMissingTabular(read(DASHBOARD), FIGURE_ANCHORS).join('\n')).toBe('');
  });

  it('law 5: the three >=60-character body strings sit at the 15px floor, not text-xs', () => {
    expect(bodyCopyStillOnSecondaryFloor(read(DASHBOARD), BODY_COPY_ANCHORS).join('\n')).toBe('');
  });
});

describe('the pins fire on planted violations', () => {
  it('a painted progress-bar capsule trips law 1', () => {
    const planted = '<div className="h-2 w-full bg-white/10 rounded-full mt-2" />';
    expect(capsuleOffenders(planted)).toHaveLength(1);
  });

  it('a painted pill badge trips law 1', () => {
    const planted =
      '<span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 border">Beta</span>';
    expect(capsuleOffenders(planted)).toHaveLength(1);
  });

  it('a circle does not trip law 1, because the design system uses those on purpose', () => {
    const planted = '<div className="w-8 h-8 rounded-full bg-white/10" />';
    expect(capsuleOffenders(planted)).toHaveLength(0);
  });

  it('an unpainted hover target does not trip law 1', () => {
    const planted = '<button className="p-2 rounded-full hover:bg-white/5" />';
    expect(capsuleOffenders(planted)).toHaveLength(0);
  });

  it('a figure span without the tabular class trips law 6', () => {
    const planted = [
      '<span className="text-white font-semibold">',
      '  {activeParticipants.toLocaleString()}',
      '</span>',
    ].join('\n');
    expect(
      figureLinesMissingTabular(planted, ['{activeParticipants.toLocaleString()}']),
    ).toHaveLength(1);
  });

  it('a long body string still on text-xs trips the new law 5 pin', () => {
    const planted = '<p className="text-xs text-white/70 leading-relaxed">{tip.tip}</p>';
    expect(bodyCopyStillOnSecondaryFloor(planted, ['{tip.tip}'])).toHaveLength(1);
  });
});
