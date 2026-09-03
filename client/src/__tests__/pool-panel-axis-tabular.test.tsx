/**
 * TESTS: PoolPanel chart axis figures hold their columns
 * ========================================================
 * Design-law finding from `npm run gates`: the pool-history chart's SVG axis
 * labels (recharts XAxis/YAxis ticks, e.g. the participant counts 0, 7, 14,
 * 21, 28) render without `font-variant-numeric: tabular-nums`, so the digits
 * do not hold their columns the way every other numeric readout in the app
 * does.
 *
 * `.tabular` (client/src/index.css) is the app's existing, working class for
 * this - the tooltip a few lines above the chart in PoolPanel.tsx already
 * uses it. The first attempt at this fix passed `tick={{ ..., className:
 * 'tabular' }}` to XAxis/YAxis, which reads as correct against recharts'
 * public API and even survives a source read of Text.js and filterProps -
 * and does nothing, because CartesianAxis.renderTickItem's default branch
 * (recharts/lib/cartesian/CartesianAxis.js) hardcodes `className:
 * "recharts-cartesian-axis-tick-value"` on the element it builds from a
 * plain tick object, discarding whatever that object set. Only a render test
 * that actually walks the resulting DOM catches it; a type check or a read of
 * the public prop shape cannot, because the discard happens one layer deeper.
 * PoolPanel now renders its own tick via the FUNCTION form of `tick`, which
 * recharts merges rather than overwrites.
 *
 * The live browser design-laws harness (tests/design-laws.mjs) needs Chrome
 * on :9222, a Firebase emulator and a seeded driver, none of which exist in
 * the unattended nightly clone, so this cannot be confirmed there tonight.
 * This test instead pins the DOM wiring directly: that PoolPanel's custom
 * tick really does end up on the rendered axis `<text>` elements. The CSS
 * rule itself is not re-asserted here - jsdom applies no external
 * stylesheet, so a jsdom assertion on computed style would prove nothing
 * real (see the reduced-motion caveat in ROADMAP.md for the same reasoning).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

globalThis.React = React;

// Same shape as client/src/__tests__/legal-pages.test.tsx and score-ring.test.tsx:
// PoolPanel drives motion.div and AnimatedNumber's `animate`, neither of which
// this test is about.
vi.mock('framer-motion', () => {
  const MotionDiv = (props: Record<string, unknown>) => {
    const { children, initial, animate, transition, exit, whileHover, whileTap, ...rest } = props;
    return React.createElement('div', rest as React.HTMLAttributes<HTMLDivElement>, children as React.ReactNode);
  };
  return {
    motion: { div: MotionDiv },
    useReducedMotion: () => true,
    animate: () => ({ stop: () => {} }),
  };
});

// Firestore-backed; a fixed history with two-plus points is what takes the
// panel past its "No closed periods yet" EmptyState and into the chart.
vi.mock('@/hooks/usePoolHistory', () => ({
  usePoolHistory: () => ({
    history: [
      { period: '2026-06', totalPoolCents: 0, activeParticipants: 7, averagePoolScore: 70, safetyFactor: 0.8 },
      { period: '2026-07', totalPoolCents: 0, activeParticipants: 14, averagePoolScore: 74, safetyFactor: 0.85 },
      { period: '2026-08', totalPoolCents: 0, activeParticipants: 28, averagePoolScore: 78, safetyFactor: 0.9 },
    ],
    loading: false,
    error: null,
  }),
}));

import { PoolPanel } from '../components/PoolPanel';

beforeAll(() => {
  // recharts' ResponsiveContainer measures itself via ResizeObserver (which
  // jsdom does not implement - the import throws without this) and then via
  // the container's getBoundingClientRect. jsdom's real implementation
  // always returns an all-zero rect, and recharts refuses to render a chart
  // at width/height <= 0 (util/ReactUtils.js validateWidthHeight), which
  // silently produces an empty <div> rather than an error - the exact "looks
  // fine, proves nothing" failure mode this whole test exists to avoid. A
  // fixed non-zero rect is a test-only DOM stub, not a product change.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  global.ResizeObserver = ResizeObserverStub;
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ width: 400, height: 140, top: 0, left: 0, right: 400, bottom: 140, x: 0, y: 0, toJSON() { return this; } }) as DOMRect;
});

describe('PoolPanel: the pool-history chart axis figures hold their columns', () => {
  it('renders every axis tick through the tabular custom tick, not the object form recharts silently drops', async () => {
    const { container } = render(
      <PoolPanel
        activeParticipants={28}
        averagePoolScore={78}
        safetyFactor={0.9}
        userSharePercentage={3.2}
        userWeightedScore={410}
      />,
    );

    // ResponsiveContainer measures itself in a passive effect, one render
    // after the initial commit - waitFor gives that render room to land
    // rather than asserting on the pre-measurement 0x0 frame.
    await waitFor(() => {
      expect(container.querySelector('svg.recharts-surface')).toBeTruthy();
    });

    const ticks = container.querySelectorAll('text.tabular');
    // At least one period label on the X axis plus recharts' own
    // auto-generated Y-axis ticks: more than the zero the dropped-className
    // bug left, and enough to rule out "coincidentally matched one label".
    expect(ticks.length).toBeGreaterThan(1);
  });
});
