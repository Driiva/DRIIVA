/**
 * The reduced-motion contract for the vendored Amicro primitives.
 *
 * Every component under client/src/components/motion is adapted from the
 * Amicro registry, and not one of the upstream originals checks
 * prefers-reduced-motion. That is the single thing most likely to be lost the
 * next time one of them is edited, and it is the one thing a reader who asked
 * the operating system for less motion actually depends on.
 *
 * These tests assert the contract rather than the choreography: content is
 * always present and always reachable, whichever way the preference is set.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ArcTracer, LiveGlow, SettlePulse } from '@/components/motion/Instrument';
import { Pressable, PressCard } from '@/components/motion/Press';
import { FadeIn, FadeUp, RevealOnScroll, ScaleIn } from '@/components/motion/Reveal';
import { Stagger, StaggerItem, useStagger } from '@/components/motion/Stagger';
import { BlurText, CharacterStagger } from '@/components/motion/TextReveal';

/**
 * framer-motion resolves the media query once at import, so stubbing
 * matchMedia inside a test is too late to change what useReducedMotion
 * returns. The hook is therefore driven directly, which is also the only way
 * to exercise both branches inside a single run.
 */
const reducedMotion = { current: false };

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return { ...actual, useReducedMotion: () => reducedMotion.current };
});

function setReducedMotion(reduced: boolean) {
  reducedMotion.current = reduced;
}

/**
 * jsdom has no IntersectionObserver, and the whileInView primitives mount one.
 * The stub reports the target as visible straight away, which is the case the
 * tests care about: the content has to be there once it is scrolled to.
 */
class ImmediateIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
      this,
    );
  }

  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeEach(() => {
  setReducedMotion(false);
  vi.stubGlobal('IntersectionObserver', ImmediateIntersectionObserver);
});
afterEach(() => vi.unstubAllGlobals());

describe.each([false, true])('motion primitives, reduced motion = %s', (reduced) => {
  beforeEach(() => setReducedMotion(reduced));

  it('every entrance renders its children', () => {
    render(
      <>
        <FadeIn>fade in</FadeIn>
        <FadeUp>fade up</FadeUp>
        <RevealOnScroll>on scroll</RevealOnScroll>
        <ScaleIn>scale in</ScaleIn>
      </>,
    );

    for (const text of ['fade in', 'fade up', 'on scroll', 'scale in']) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it('a stagger renders every child, not just the ones that got a turn', () => {
    render(
      <Stagger>
        {['one', 'two', 'three'].map((label) => (
          <StaggerItem key={label}>{label}</StaggerItem>
        ))}
      </Stagger>,
    );

    for (const label of ['one', 'two', 'three']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('text reveals never lose the string', () => {
    const { container } = render(
      <>
        <BlurText text="Score" />
        <CharacterStagger text="Refund" />
      </>,
    );

    // Reduced motion renders a plain span. Otherwise the characters are split
    // into aria-hidden spans behind an aria-label carrying the whole string,
    // so the text is intact either way and a reader never meets a word cut
    // into pieces.
    expect(container.textContent).toContain('Score');
    expect(container.textContent).toContain('Refund');

    if (reduced) {
      expect(container.querySelectorAll('[aria-hidden="true"]').length).toBe(0);
    } else {
      expect(screen.getByLabelText('Score')).toBeTruthy();
      expect(screen.getByLabelText('Refund')).toBeTruthy();
    }
  });

  it('the pending reading is announced, not just drawn', () => {
    render(<ArcTracer label="Loading GPS data" />);
    expect(screen.getByRole('status', { name: 'Loading GPS data' })).toBeTruthy();
  });

  it('a figure that has just landed still renders while it pulses', () => {
    render(<SettlePulse pulseKey={82}>82</SettlePulse>);
    expect(screen.getByText('82')).toBeTruthy();
  });

  it('a press card is a button only when it does something', () => {
    const { rerender } = render(<PressCard label="Open trip">inert</PressCard>);
    expect(screen.queryByRole('button')).toBeNull();

    rerender(
      <PressCard label="Open trip" onClick={() => {}}>
        live
      </PressCard>,
    );
    expect(screen.getByRole('button', { name: 'Open trip' })).toBeTruthy();
  });

  it('a disabled press card does not advertise an interaction it cannot perform', () => {
    render(
      <PressCard label="Open trip" onClick={() => {}} disabled>
        held
      </PressCard>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a pressable wraps its control without replacing it', () => {
    render(
      <Pressable>
        <button type="button">Start trip</button>
      </Pressable>,
    );
    expect(screen.getByRole('button', { name: 'Start trip' })).toBeTruthy();
  });
});

describe('the live glow only signals when something is live', () => {
  it('is muted until the state it describes is true', () => {
    const { container, rerender } = render(<LiveGlow label="Recording" />);
    expect(container.innerHTML).toContain('var(--app-text-mut)');

    rerender(<LiveGlow live colour="var(--err)" label="Recording" />);
    expect(container.innerHTML).toContain('var(--err)');
  });
});

describe('the stagger stays inside the entrance budget', () => {
  it('caps the total so a long list does not trickle in behind the reader', () => {
    const { result } = renderHookDelays(60);
    expect(result[result.length - 1]).toBeLessThanOrEqual(0.32);
  });

  it('keeps a short list on the full step', () => {
    const { result } = renderHookDelays(4);
    expect(result[1] - result[0]).toBeCloseTo(0.04, 5);
  });

  it('starts the first item immediately', () => {
    const { result } = renderHookDelays(10);
    expect(result[0]).toBe(0);
  });
});

/** Tiny harness so useStagger can be exercised without a hook-testing dep. */
function renderHookDelays(count: number): { result: number[] } {
  const captured: { result: number[] } = { result: [] };
  function Probe() {
    captured.result = useStagger(count);
    return null;
  }
  render(<Probe />);
  return captured;
}
