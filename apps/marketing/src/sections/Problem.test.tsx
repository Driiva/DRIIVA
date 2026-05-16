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
import { Problem } from './Problem';
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

describe('Problem', () => {
  it('renders three stat cards', () => {
    render(<Problem />);
    expect(screen.getByTestId('problem-card-0')).toBeInTheDocument();
    expect(screen.getByTestId('problem-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('problem-card-2')).toBeInTheDocument();
  });

  it('animates cards into view when the section intersects', async () => {
    render(<Problem />);
    await act(async () => {
      fireIntersect();
      await Promise.resolve();
    });
    expect(animeAnimate).toHaveBeenCalled();
  });

  it('skips animation under prefers-reduced-motion and renders final values', async () => {
    setReducedMotion(true);
    render(<Problem />);
    await act(async () => {
      fireIntersect();
      await Promise.resolve();
    });
    expect(animeAnimate).not.toHaveBeenCalled();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('£16.8B')).toBeInTheDocument();
  });
});
