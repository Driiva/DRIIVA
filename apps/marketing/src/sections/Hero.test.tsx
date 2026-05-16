import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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

import { animate as animeAnimate, createTimeline } from 'animejs';
import { Hero } from './Hero';

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
  setReducedMotion(false);
});

describe('Hero', () => {
  it('renders the wordmark, subhead and CTA', () => {
    render(<Hero />);
    expect(screen.getByAltText('driiva')).toBeInTheDocument();
    expect(
      screen.getByText(/safe drivers, systematically mispriced/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /join the waitlist/i }),
    ).toBeInTheDocument();
  });

  it('dispatches the entrance timeline on mount under normal motion', () => {
    render(<Hero />);
    expect(createTimeline).toHaveBeenCalledTimes(1);
    expect(animeAnimate).toHaveBeenCalled();
  });

  it('skips animations and sets resting state under prefers-reduced-motion', () => {
    setReducedMotion(true);
    render(<Hero />);
    expect(createTimeline).not.toHaveBeenCalled();
    expect(animeAnimate).not.toHaveBeenCalled();
    const wordmark = screen.getByAltText('driiva') as HTMLImageElement;
    expect(wordmark.style.opacity).toBe('1');
  });
});
