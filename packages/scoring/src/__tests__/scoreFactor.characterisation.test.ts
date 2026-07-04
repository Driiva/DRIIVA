/**
 * CHARACTERISATION — scoreFactor / scoreDiscountPercent (M0 Task 2).
 * Reproduces the scoreFactor/scoreDiscountPercent cases from
 * `client/src/__tests__/pricing-engine.characterisation.test.ts` against the
 * ported functions — same inputs, same expected outputs. (The premium/GBP
 * cases in that suite exercise `calculateAnnualPremium` etc., which are not
 * part of this task's scope — see the M0 Task 2 brief.)
 */
import { describe, it, expect } from 'vitest';
import { scoreFactor, scoreDiscountPercent } from '../scoreFactor';

describe('scoreFactor — the single ±15% source of truth', () => {
  it('maps the documented anchor points: 75 neutral, 100 → 0.85, 50 → 1.15', () => {
    expect(scoreFactor(75)).toBe(1.0);
    expect(scoreFactor(100)).toBe(0.85);
    expect(scoreFactor(50)).toBeCloseTo(1.15, 10);
  });

  it('clamps outside 50..100 (score 0 prices like 50; 120 like 100)', () => {
    expect(scoreFactor(0)).toBeCloseTo(1.15, 10);
    expect(scoreFactor(120)).toBe(0.85);
  });

  it('no score → neutral 1.0', () => {
    expect(scoreFactor(null)).toBe(1.0);
    expect(scoreFactor(undefined)).toBe(1.0);
  });
});

describe('scoreDiscountPercent — display figure derived from the charged factor', () => {
  it('15% at score 100, 0% at neutral 75', () => {
    expect(scoreDiscountPercent(100)).toBe(15);
    expect(scoreDiscountPercent(75)).toBe(0);
  });

  it('QUIRK: loadings (score < 75) are displayed as 0% discount, never negative', () => {
    expect(scoreDiscountPercent(50)).toBe(0);
    expect(scoreDiscountPercent(60)).toBe(0);
  });

  it('rounds to whole percent (score 90 → 9%)', () => {
    expect(scoreDiscountPercent(90)).toBe(9);
  });
});
