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

import { animate as animeAnimate, createTimeline } from 'animejs';
import { Product } from './Product';
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

describe('Product', () => {
  it('renders the phone frame and dashboard chrome', () => {
    render(<Product />);
    expect(screen.getByTestId('product-phone')).toBeInTheDocument();
    expect(screen.getByText(/driving score/i)).toBeInTheDocument();
    expect(screen.getByText(/refund so far/i)).toBeInTheDocument();
  });

  it('starts the dashboard timeline when the section intersects', async () => {
    render(<Product />);
    await act(async () => {
      fireIntersect();
      await Promise.resolve();
    });
    expect(createTimeline).toHaveBeenCalled();
    expect(animeAnimate).toHaveBeenCalled();
  });

  it('renders final score and refund under prefers-reduced-motion without animating', async () => {
    setReducedMotion(true);
    render(<Product />);
    await act(async () => {
      fireIntersect();
      await Promise.resolve();
    });
    expect(createTimeline).not.toHaveBeenCalled();
    expect(animeAnimate).not.toHaveBeenCalled();
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText('£132.10')).toBeInTheDocument();
  });
});
