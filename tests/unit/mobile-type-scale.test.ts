/**
 * The mobile type scale is calibrated, so the calibration is asserted.
 *
 * Before this, only `body` carried a lineHeight. Every other preset inherited
 * whatever leading its font file happened to ship, and Instrument Sans,
 * Inter Tight and JetBrains Mono do not agree, so a card mixing a heading, a
 * number and a caption ran three different rhythms and read as untuned.
 *
 * These tests exist to stop a preset losing its leading or its tracking again.
 * They deliberately assert the shape of the scale rather than exact pixel
 * values, so retuning a step stays a one-line change, but dropping a property
 * cannot pass.
 */
import { describe, expect, it } from 'vitest';

import { F, FS, LH, T, TR } from '../../mobile/components/ui/theme';

const NUMERIC_PRESETS = ['hero', 'statLg', 'stat', 'number', 'numberSm'] as const;

describe('mobile type scale', () => {
  it('every preset states a family, a size, a leading and a tracking', () => {
    const incomplete = Object.entries(T)
      .filter(([, style]) => {
        const s = style as Record<string, unknown>;
        return (
          typeof s.fontFamily !== 'string' ||
          typeof s.fontSize !== 'number' ||
          typeof s.lineHeight !== 'number' ||
          typeof s.letterSpacing !== 'number'
        );
      })
      .map(([name]) => name);

    expect(incomplete).toEqual([]);
  });

  it('every preset takes its size and leading from the ladder', () => {
    const sizes = new Set<number>(Object.values(FS));
    const leadings = new Set<number>(Object.values(LH));

    const offLadder = Object.entries(T)
      .filter(([, style]) => {
        const s = style as { fontSize: number; lineHeight: number };
        return !sizes.has(s.fontSize) || !leadings.has(s.lineHeight);
      })
      .map(([name]) => name);

    expect(offLadder).toEqual([]);
  });

  it('every numeric readout holds its columns', () => {
    for (const name of NUMERIC_PRESETS) {
      const style = T[name] as { fontVariant?: readonly string[] };
      expect(style.fontVariant, `${name} must be tabular`).toContain('tabular-nums');
    }
  });

  it('numbers are set in the mono face so a digit never changes width', () => {
    for (const name of NUMERIC_PRESETS) {
      expect([F.mono, F.monoSemiBold]).toContain((T[name] as { fontFamily: string }).fontFamily);
    }
  });

  it('the ladder rises, with no two steps sharing a size', () => {
    const steps = Object.values(FS);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
    expect(new Set(steps).size).toBe(steps.length);
  });

  it('tracking tightens as type grows and opens on mono labels', () => {
    expect(TR.display).toBeLessThan(TR.xxl);
    expect(TR.xxl).toBeLessThan(TR.base);
    expect(TR.base).toBeLessThanOrEqual(0);
    expect(TR.eyebrow).toBeGreaterThan(TR.label);
    expect(TR.label).toBeGreaterThan(0);
  });

  it('leading opens at reading sizes and tightens as type grows structural', () => {
    const ratio = (size: number, leading: number) => leading / size;
    expect(ratio(FS.base, LH.base)).toBeGreaterThan(1.4);
    expect(ratio(FS.display, LH.display)).toBeLessThan(1.1);
    expect(ratio(FS.base, LH.base)).toBeGreaterThan(ratio(FS.xxl, LH.xxl));
  });

  it('the hero number is the largest thing on the scale', () => {
    const largest = Math.max(...Object.values(T).map((s) => (s as { fontSize: number }).fontSize));
    expect((T.hero as { fontSize: number }).fontSize).toBe(largest);
  });
});
