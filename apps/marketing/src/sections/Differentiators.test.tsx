import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

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
import { Differentiators } from './Differentiators';
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
});

describe('Differentiators', () => {
  it('renders the four pillars', () => {
    render(<Differentiators />);
    expect(screen.getByTestId('pillar-no-hardware')).toBeInTheDocument();
    expect(screen.getByTestId('pillar-transparent')).toBeInTheDocument();
    expect(screen.getByTestId('pillar-shariah-compliant')).toBeInTheDocument();
    expect(screen.getByTestId('pillar-community-pool')).toBeInTheDocument();
  });

  it('animates pillars into view on intersect', async () => {
    render(<Differentiators />);
    await act(async () => {
      fireIntersect();
      await Promise.resolve();
    });
    expect(animeAnimate).toHaveBeenCalled();
  });

  it('does not animate on intersect under prefers-reduced-motion', async () => {
    setReducedMotion(true);
    render(<Differentiators />);
    await act(async () => {
      fireIntersect();
      await Promise.resolve();
    });
    expect(animeAnimate).not.toHaveBeenCalled();
  });

  it('draws icon strokes on hover under normal motion', async () => {
    render(<Differentiators />);
    await act(async () => {
      fireIntersect();
      await Promise.resolve();
    });
    vi.mocked(animeAnimate).mockClear();
    fireEvent.mouseEnter(screen.getByTestId('pillar-no-hardware'));
    expect(animeAnimate).toHaveBeenCalled();
  });
});
