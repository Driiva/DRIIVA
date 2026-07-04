import { describe, it, expect } from 'vitest';

import { ScoreBreakdownSchema } from '../score-breakdown';

describe('ScoreBreakdownSchema', () => {
  // Fixture from functions/src/utils/helpers.ts getDefaultMetrics() fallback.
  const validFixture = {
    speedScore: 70,
    brakingScore: 70,
    accelerationScore: 70,
    corneringScore: 70,
    phoneUsageScore: 100,
  };

  it('parses the getDefaultMetrics() fallback fixture', () => {
    expect(ScoreBreakdownSchema.parse(validFixture)).toEqual(validFixture);
  });

  it('pins the current field set (drift guard: fails if a field is removed/renamed)', () => {
    expect(Object.keys(ScoreBreakdownSchema.shape)).toMatchSnapshot();
  });

  it('rejects a score above 100', () => {
    expect(() => ScoreBreakdownSchema.parse({ ...validFixture, speedScore: 101 })).toThrow();
  });

  it('rejects a non-integer score', () => {
    expect(() => ScoreBreakdownSchema.parse({ ...validFixture, brakingScore: 70.5 })).toThrow();
  });

  it('rejects a missing field', () => {
    const { phoneUsageScore: _phoneUsageScore, ...missingField } = validFixture;
    expect(() => ScoreBreakdownSchema.parse(missingField)).toThrow();
  });
});
