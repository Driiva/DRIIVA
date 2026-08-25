/**
 * EVERY DEMO POUND FIGURE CARRIES ITS BASIS
 * =========================================
 * Onboarding shows a projected refund range twice: on viral-moment.tsx and
 * again on quote.tsx. viral-moment stated the premium the projection came
 * from; quote showed the same range with nothing. The second one is the
 * version that reads as a promise, and it is shipped code even though the
 * screen is currently orphaned.
 *
 * The compliance rule is not satisfied by two of the three parts. A pound
 * figure has to say it is PROJECTED, that it is capped at 15% of premium, and
 * which premium it was projected from. This asserts all three, on both
 * screens, and that they get them from the one constant rather than from two
 * paragraphs somebody typed twice.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { DEMO_PREMIUM_POUNDS, DEMO_REFUND_DISCLOSURE } from '../../mobile/hooks/useTripSeed';

const MOBILE = join(__dirname, '../../mobile');
const read = (rel: string) => readFileSync(join(MOBILE, rel), 'utf8');

/**
 * Comments out before the copy laws run. A note explaining that the local
 * `refund * 0.8` spread was removed is the opposite of the problem, and a law
 * that punishes its own explanation trains people to delete the explanation.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Every screen that renders a projected pound figure during onboarding. */
const SCREENS = ['app/onboarding/quote.tsx', 'app/onboarding/viral-moment.tsx'] as const;

describe('the disclosure itself', () => {
  it('says the figure is projected', () => {
    expect(DEMO_REFUND_DISCLOSURE.toLowerCase()).toContain('projected');
  });

  it('states the 15% cap', () => {
    expect(DEMO_REFUND_DISCLOSURE).toContain('15%');
  });

  it('names the premium it was projected from, from the constant', () => {
    // Interpolated, not typed. Retuning DEMO_PREMIUM_POUNDS without this would
    // leave a sentence naming a premium the numbers above it did not come from.
    expect(DEMO_REFUND_DISCLOSURE).toContain(DEMO_PREMIUM_POUNDS.toLocaleString('en-GB'));
  });

  it('does not promise', () => {
    expect(DEMO_REFUND_DISCLOSURE.toLowerCase()).toContain('not guaranteed');
  });
});

describe.each(SCREENS)('%s', (screen) => {
  const source = codeOnly(read(screen));

  it('renders the shared disclosure rather than its own paragraph', () => {
    expect(source).toContain('DEMO_REFUND_DISCLOSURE');
  });

  it('draws its pound figures through lib/money.ts', () => {
    expect(source).toMatch(/formatPounds(Whole)?\(/);
    // The inline template that used to build the range by hand. A screen that
    // formats its own pounds is a screen that can render the hundredfold bug.
    expect(source).not.toMatch(/£\{/);
  });

  it('takes the range from the one calculator, not a local spread', () => {
    expect(source).toContain('refundEstimateRange');
    expect(source).not.toMatch(/refund \* 0\.8|refund \* 1\.2/);
  });

});

describe('no screen overstates the regulatory position', () => {
  /**
   * THIS SUITE USED TO ENFORCE THE LIE.
   *
   * It asserted that no onboarding screen may say "regulatory sandbox", on the
   * stated grounds that the approved line was "product pending FCA
   * authorisation". That is backwards. "Pending FCA authorisation" is the
   * STRONGER claim: it says an application is in flight and awaiting a
   * decision, which is not true. The agreed position is the weaker and correct
   * one, working towards the sandbox, not authorised, not under an MGA.
   *
   * The test and the revert arrived in the same commit (418e76b), so the four
   * onboarding screens reconciled by aaaec97 were pushed back to the false
   * wording and then held there by a green test. A characterisation test that
   * pins the wrong copy does not protect the copy, it protects the bug.
   *
   * Inverted here: the banned string is the overstatement, and any screen that
   * raises the FCA at all has to frame it the agreed way.
   */
  const files = onboardingScreens();

  it('finds the onboarding screens to inspect', () => {
    // Assert on arrival before asserting on content: an empty list would make
    // the checks below pass while proving nothing.
    expect(files.length).toBeGreaterThan(10);
  });

  /**
   * Copy as the screen renders it, not as the file stores it.
   *
   * Comments come out because "// FCA DISCLOSURE REQUIRED" is a note to a
   * developer, not a claim to a driver, and the same rule already applies to
   * the pound-figure laws above: a law that punishes its own explanation
   * trains people to delete the explanation.
   *
   * Whitespace collapses because JSX wraps. The agreed sentence is one
   * sentence to a reader and three lines to a file, and matching the raw
   * source would fail on the correctly-worded screens while passing anything
   * short enough to fit a line, which is precisely backwards.
   */
  const renderedCopy = (file: string) =>
    codeOnly(readFileSync(join(MOBILE, 'app/onboarding', file), 'utf8')).replace(/\s+/g, ' ');

  it.each(files)('%s does not claim an application is pending', (file) => {
    expect(renderedCopy(file)).not.toMatch(
      /pending FCA|awaiting FCA|FCA application|application phase/i,
    );
  });

  it.each(files)('%s frames the FCA the agreed way, if it raises it at all', (file) => {
    const copy = renderedCopy(file);
    if (!/\bFCA\b/.test(copy)) return;
    expect(copy).toMatch(/working towards the FCA regulatory sandbox/i);
  });
});

function onboardingScreens(): string[] {
  return readdirSync(join(MOBILE, 'app/onboarding')).filter((f) => f.endsWith('.tsx'));
}
