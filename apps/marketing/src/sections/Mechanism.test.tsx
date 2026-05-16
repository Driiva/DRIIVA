import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';

vi.mock('animejs', () => {
  const animate = vi.fn();
  const timeline = { add: vi.fn(), pause: vi.fn() };
  timeline.add.mockReturnValue(timeline);
  return {
    animate,
    createTimeline: vi.fn(() => timeline),
    stagger: vi.fn((d: number) => d),
    svg: { createDrawable: vi.fn(() => [null]) },
  };
});

import { animate as animeAnimate } from 'animejs';
import { Mechanism } from './Mechanism';
import { fireIntersect, resetIOInstances } from '@/test/io';

function setReducedMotion(reduced: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reduced && q.includes('reduce'),
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetIOInstances();
  setReducedMotion(false);
  // jsdom does not implement SVG geometry; stub getTotalLength on the path prototype
  if (typeof SVGPathElement !== 'undefined') {
    const proto = SVGPathElement.prototype as unknown as { getTotalLength?: () => number };
    if (typeof proto.getTotalLength !== 'function') {
      proto.getTotalLength = () => 200;
    }
  }
});

describe('Mechanism', () => {
  it('renders the flywheel svg with five nodes', () => {
    render(<Mechanism />);
    expect(screen.getByRole('img', { name: /premium pool flywheel/i })).toBeInTheDocument();
    expect(screen.getByText('Driver')).toBeInTheDocument();
    expect(screen.getByText('Refund')).toBeInTheDocument();
  });

  it('animates flow paths when the section intersects', async () => {
    render(<Mechanism />);
    await act(async () => {
      fireIntersect();
      await Promise.resolve();
    });
    expect(animeAnimate).toHaveBeenCalled();
  });

  it('does not animate under prefers-reduced-motion', async () => {
    setReducedMotion(true);
    render(<Mechanism />);
    await act(async () => {
      fireIntersect();
      await Promise.resolve();
    });
    expect(animeAnimate).not.toHaveBeenCalled();
  });
});
