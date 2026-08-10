/**
 * TESTS: ScoreRing
 * ================
 * The score is the hero number of the product and the two surfaces disagreed
 * about its shape: mobile drew the 270 degree automotive arc the design system
 * specifies, the web drew a 360 degree progress ring with four pasted hex
 * values. These tests pin the geometry and the palette rule so they cannot
 * drift apart again silently.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

globalThis.React = React;

// framer-motion's animate() drives a rAF loop that jsdom has no business
// running; the resting geometry is what these tests are about.
vi.mock('framer-motion', () => ({
  animate: () => ({ stop: () => {} }),
  useReducedMotion: () => true,
}));

import ScoreRing from '../components/ScoreRing';

const SOURCE = readFileSync(
  join(process.cwd(), 'client/src/components/ScoreRing.tsx'),
  'utf8',
);

describe('ScoreRing', () => {
  it('draws a 270 degree arc, not a full circle', () => {
    const { container } = render(<ScoreRing score={72} size={140} strokeWidth={8} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBe(2); // track and fill

    const radius = (140 - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const arcLength = (circumference * 270) / 360;

    // The dash array is the arc, so a 100 score fills exactly three quarters
    // of the circle. If this ever equals the circumference it is a 360 ring.
    const dash = Number(paths[1].getAttribute('stroke-dasharray'));
    expect(dash).toBeCloseTo(arcLength, 3);
    expect(dash).not.toBeCloseTo(circumference, 1);
  });

  it('opens the arc at the bottom, matching the mobile gauge', () => {
    const { container } = render(<ScoreRing score={50} size={100} strokeWidth={6} />);
    const d = container.querySelectorAll('path')[0].getAttribute('d') ?? '';

    // 225deg start and 135deg end, both below the centre line: an arc that
    // opens downward is an instrument, a closed one reads as loading.
    const numbers = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
    const [startX, startY] = [numbers[0], numbers[1]];
    const endY = numbers[numbers.length - 1];
    expect(startY).toBeGreaterThan(50); // below centre
    expect(endY).toBeGreaterThan(50);
    expect(startX).toBeLessThan(50); // opening sweeps left to right
    expect(d).toMatch(/^M .* A .* 0 1 1 /); // large-arc, positive sweep
  });

  it('carries no literal hex, only design tokens', () => {
    // index.css states the rule outright: never add a literal hex to a
    // component. This file previously carried six, encoding a tier ramp the
    // design system does not have.
    const hexes = SOURCE.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexes).toEqual([]);
    expect(SOURCE).toContain('var(--brand-amber)');
  });

  it('states the reading for assistive tech once', () => {
    const { container } = render(<ScoreRing score={83} />);
    expect(screen.getByRole('img', { name: 'Safety score 83 out of 100' })).toBeTruthy();
    // The gauge's own label carries the reading, so the figure inside it is
    // hidden from the accessibility tree rather than announced a second time.
    // Asserted on the attribute: queryByText does not honour aria-hidden.
    const figure = container.querySelector('[aria-hidden="true"]');
    expect(figure?.textContent).toContain('83');
  });

  it('shows the figure immediately under reduced motion', () => {
    // The mock returns useReducedMotion() === true. The score is information,
    // never withheld for an effect.
    const { container } = render(<ScoreRing score={64} />);
    expect(container.textContent).toContain('64');
  });
});
