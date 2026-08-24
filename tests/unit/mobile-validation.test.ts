/**
 * Lives in the root test tree rather than beside the module, same reason as
 * tests/unit/mobile-waitlist.test.ts: mobile/ has its own Expo tsconfig and
 * dependency set the root vitest run cannot resolve.
 *
 * mobile/lib/validation.ts is the boundary for the two free-text answers
 * onboarding collects that go on to price a policy: the driver's age and the
 * postcode their rating area comes from. Both arrive from a TextInput, so both
 * arrive as strings, and both have historically been trusted.
 *
 * What these tests pin is that the boundary is where the coercion happens once
 * and where the shapes are rejected, so no screen downstream has to guess
 * whether it is holding 25 or "25" or "" or NaN.
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_AGE,
  MAX_AGE,
  ageSchema,
  postcodeOutwardSchema,
  parseAge,
  parsePostcodeOutward,
} from '../../mobile/lib/validation';

describe('age: the insurable range', () => {
  it('states the range it enforces', () => {
    expect(MIN_AGE).toBe(17);
    expect(MAX_AGE).toBe(99);
  });

  it('accepts both ends of the range', () => {
    expect(ageSchema.parse(17)).toBe(17);
    expect(ageSchema.parse(99)).toBe(99);
  });

  it('rejects the value either side of each end', () => {
    expect(ageSchema.safeParse(16).success).toBe(false);
    expect(ageSchema.safeParse(100).success).toBe(false);
  });

  it('coerces the string a text field actually produces', () => {
    expect(ageSchema.parse('25')).toBe(25);
    expect(ageSchema.parse(' 25 ')).toBe(25);
  });

  it('rejects an empty field rather than reading it as zero', () => {
    // Number('') is 0, so a bare coercion turns "left blank" into an age of 0
    // and then into "too young" instead of "not answered".
    expect(ageSchema.safeParse('').success).toBe(false);
    expect(ageSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects a non-integer age', () => {
    expect(ageSchema.safeParse(25.5).success).toBe(false);
    expect(ageSchema.safeParse('25.5').success).toBe(false);
  });

  it('rejects what is not a number at all', () => {
    for (const bad of ['abc', null, undefined, Number.NaN, {}, [], true]) {
      expect(ageSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('parseAge returns the value or a message a driver can read', () => {
    expect(parseAge('30')).toEqual({ ok: true, value: 30 });

    const failed = parseAge('9');
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error).toContain('17');
      expect(failed.error).toContain('99');
      expect(failed.error).not.toContain('!');
    }
  });
});

describe('postcode: the outward code a rating area comes from', () => {
  it('accepts every shape of UK outward code', () => {
    for (const code of ['M1', 'M60', 'CR2', 'DN55', 'W1A', 'EC1A', 'B33', 'SW1A']) {
      expect(postcodeOutwardSchema.parse(code)).toBe(code);
    }
  });

  it('normalises case and surrounding whitespace', () => {
    expect(postcodeOutwardSchema.parse('  sw1a  ')).toBe('SW1A');
    expect(postcodeOutwardSchema.parse('ec1a')).toBe('EC1A');
  });

  it('takes the outward half when a driver types the whole postcode', () => {
    // Nobody types half a postcode. Rejecting the full one as invalid would be
    // the bug, so the boundary narrows it instead.
    expect(postcodeOutwardSchema.parse('SW1A 1AA')).toBe('SW1A');
    expect(postcodeOutwardSchema.parse('sw1a1aa')).toBe('SW1A');
    expect(postcodeOutwardSchema.parse(' m1  1ae ')).toBe('M1');
  });

  it('rejects what is not a UK postcode', () => {
    for (const bad of ['', '   ', '1234', 'LONDON', 'S', 'ABC123XYZ', '90210', 'SW1A 1A']) {
      expect(postcodeOutwardSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('rejects what is not a string', () => {
    for (const bad of [null, undefined, 1234, {}, []]) {
      expect(postcodeOutwardSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('parsePostcodeOutward returns the value or a message a driver can read', () => {
    expect(parsePostcodeOutward('sw1a 1aa')).toEqual({ ok: true, value: 'SW1A' });

    const failed = parsePostcodeOutward('nope');
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.error.length).toBeGreaterThan(0);
      expect(failed.error).not.toContain('!');
    }
  });
});
