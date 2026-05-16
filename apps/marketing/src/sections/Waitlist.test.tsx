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
import { Waitlist } from './Waitlist';
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
  vi.useFakeTimers();
});

describe('Waitlist', () => {
  it('renders an email field and submit button', () => {
    render(<Waitlist />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByTestId('waitlist-submit')).toHaveTextContent(/request access/i);
  });

  it('animates the form card into view on intersect', async () => {
    render(<Waitlist />);
    await act(async () => {
      fireIntersect();
      await Promise.resolve();
    });
    expect(animeAnimate).toHaveBeenCalled();
  });

  it('shows an inline error for invalid emails and does not submit', () => {
    render(<Waitlist />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.submit(screen.getByTestId('waitlist-form'));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid email/i);
  });

  it('morphs the button to a success state on valid submit', async () => {
    render(<Waitlist />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'driver@example.co.uk' },
    });
    fireEvent.submit(screen.getByTestId('waitlist-form'));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByTestId('waitlist-submit')).toHaveTextContent(/you are in/i);
  });

  it('does not call anime on submit under prefers-reduced-motion', async () => {
    setReducedMotion(true);
    render(<Waitlist />);
    vi.mocked(animeAnimate).mockClear();
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'driver@example.co.uk' },
    });
    fireEvent.submit(screen.getByTestId('waitlist-form'));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(animeAnimate).not.toHaveBeenCalled();
  });
});
