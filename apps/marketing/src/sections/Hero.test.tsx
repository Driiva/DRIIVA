import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

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

import { Hero } from './Hero';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
});

describe('Hero', () => {
  it('renders the canonical headline and the gradient accent span', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Drive well\. Get money back\./i);
    expect(screen.getByText(/Get money back\./i)).toHaveClass('accent-gradient');
  });

  it('renders the waitlist eyebrow, sub-headline and form CTA', () => {
    render(<Hero />);
    expect(screen.getByText(/117\+ drivers on the waitlist/i)).toBeInTheDocument();
    expect(screen.getByText(/AI-powered telematics insurance/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /claim a beta spot/i })).toBeInTheDocument();
  });

  it('rejects an invalid email submission with an inline error', () => {
    render(<Hero />);
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('hero-form'));
    expect(screen.getByRole('status')).toHaveTextContent(/doesn't look right/i);
  });

  it('accepts a valid email and morphs the button to a success state', async () => {
    render(<Hero />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'driver@example.co.uk' },
    });
    fireEvent.submit(screen.getByTestId('hero-form'));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('button')).toHaveTextContent(/you're in/i);
  });
});
