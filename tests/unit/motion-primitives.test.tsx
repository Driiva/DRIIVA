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

/**
 * ─── MOBILE ──────────────────────────────────────────────────────────────────
 *
 * The mobile app cannot be rendered in this suite: there is no react-native
 * transform here and the vite alias for `@` points at client/src. So the
 * mobile primitives keep their arithmetic in a plain module with no react-native
 * import (mobile/components/ui/motionCore.ts) and motion.tsx is the thin
 * Reanimated shell over it.
 *
 * That split is not a testing convenience. The reduced-motion decision is the
 * one thing in a motion system that a driver actually depends on, and it is the
 * first thing lost when someone edits choreography. Keeping it in a pure
 * function means it can be asserted rather than eyeballed in a simulator.
 */
import {
  MOTION,
  enterFrom,
  pressFeedback,
  staggerDelay,
} from '../../mobile/components/ui/motionCore';

describe('mobile stagger', () => {
  it('starts the first item immediately', () => {
    expect(staggerDelay(0, 6)).toBe(0);
  });

  it('steps by the stagger token between neighbours in a short list', () => {
    expect(staggerDelay(1, 6) - staggerDelay(0, 6)).toBe(MOTION.stagger.step);
  });

  it('caps the total so a long list does not trickle in behind the reader', () => {
    for (const index of [7, 20, 60]) {
      expect(staggerDelay(index, 60)).toBeLessThanOrEqual(MOTION.stagger.cap);
    }
  });

  it('never goes backwards as the index grows', () => {
    let previous = -1;
    for (let i = 0; i < 40; i++) {
      const delay = staggerDelay(i, 40);
      expect(delay).toBeGreaterThanOrEqual(previous);
      previous = delay;
    }
  });

  it('holds every item at zero when the driver asked for less motion', () => {
    for (const index of [0, 3, 30]) {
      expect(staggerDelay(index, 40, true)).toBe(0);
    }
  });
});

describe('mobile entrances', () => {
  it('never starts from nothing: a card is already its own size before it fades', () => {
    // scale(0) is the tell of an element that came out of nowhere. Nothing in
    // the real world does that.
    expect(enterFrom(false).scale).toBeGreaterThanOrEqual(0.9);
  });

  it('drops the movement but keeps the fade under reduced motion', () => {
    const reduced = enterFrom(true);
    expect(reduced.translateY).toBe(0);
    expect(reduced.scale).toBe(1);
    // Reduced motion means gentler, not absent: an opacity transition still
    // bridges the gap between nothing and content.
    expect(reduced.opacity).toBe(0);
  });

  it('moves upward into place, never downward', () => {
    expect(enterFrom(false).translateY).toBeGreaterThan(0);
  });
});

describe('mobile press feedback', () => {
  it('is subtle: a press dips the card, it does not shrink it', () => {
    const { scale } = pressFeedback(false);
    expect(scale).toBeGreaterThanOrEqual(0.95);
    expect(scale).toBeLessThan(1);
  });

  it('swaps the transform for an opacity dip under reduced motion', () => {
    const reduced = pressFeedback(true);
    expect(reduced.scale).toBe(1);
    expect(reduced.opacity).toBeLessThan(1);
  });

  it('leaves opacity alone when it can use the transform', () => {
    expect(pressFeedback(false).opacity).toBe(1);
  });

  it('keeps press feedback inside the 100-160ms band', () => {
    expect(MOTION.duration.press).toBeGreaterThanOrEqual(100);
    expect(MOTION.duration.press).toBeLessThanOrEqual(160);
  });

  it('keeps every entrance inside the 300ms UI budget', () => {
    expect(MOTION.duration.enter).toBeLessThanOrEqual(300);
  });
});
