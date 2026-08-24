/**
 * THE DEPLOYED REFUND CALCULATOR: the copy Cloud Functions actually runs.
 *
 * functions/src/scoring/refund.ts is a build-time COPY of
 * packages/scoring/src/refund.ts. functions/package.json `prebuild` cps the
 * authored file over this one, exactly as it does for tripMetrics.ts.
 *
 * tripMetrics.ts has had a byte-equality guard since the phone-usage wiring
 * landed. refund.ts never got one, which is the same gap one file along: a
 * copy that is only SAID to mirror another drifts the first time somebody
 * hand-edits the deployed side, or edits the authored side and never runs a
 * build. Nothing about that is visible until a real refund is paid from the
 * wrong formula, and refunds are the number this product exists to produce.
 *
 * Two checks, because either alone is weak. The byte comparison catches drift
 * between the two files. The behaviour tests catch the case where both files
 * agree and are wrong together, by exercising the hard cap through the copy
 * that actually deploys.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { calculateRefundCents, projectedRefundCents } from '../../scoring/refund';

describe('functions/src/scoring/refund.ts: byte-identical to the authored source', () => {
  it('matches packages/scoring/src/refund.ts exactly (drift guard)', () => {
    const deployed = readFileSync(
      join(__dirname, '..', '..', 'scoring', 'refund.ts'),
      'utf-8'
    );
    const authored = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'packages', 'scoring', 'src', 'refund.ts'),
      'utf-8'
    );
    expect(deployed).toBe(authored);
  });
});

describe('functions/src/scoring/refund.ts: the hard cap holds from this copy too', () => {
  it('never pays more than 15% of the premium, including at small premiums', () => {
    for (const premium of [0, 1, 4, 7, 10, 99, 100, 60000, 84000]) {
      const refund = calculateRefundCents(100, 100, 10_000_000, 1, premium);
      expect(refund).toBeLessThanOrEqual(premium * 0.15);
      expect(refund).toBeGreaterThanOrEqual(0);
    }
  });

  it('never returns a negative refund or a NaN from a malformed document', () => {
    const refund = calculateRefundCents(
      Number.NaN,
      0,
      Number.POSITIVE_INFINITY,
      Number.NaN,
      -60000,
    );
    expect(Number.isFinite(refund)).toBe(true);
    expect(refund).toBeGreaterThanOrEqual(0);
  });

  it('projects null rather than zero when there is no premium', () => {
    expect(projectedRefundCents(85, 0)).toBeNull();
    expect(projectedRefundCents(85, null)).toBeNull();
    expect(projectedRefundCents(85, 60000)).toBe(5916);
  });
});
