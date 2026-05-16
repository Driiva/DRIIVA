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
  it('renders the canonical eyebrow line and italic headline', () => {
    render(<Hero />);
    expect(screen.getByText(/Insurance, simplified\./i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/AI-Powered\. Community-driven\./i);
    expect(screen.getByText(/Community-driven\./i)).toHaveClass('italic');
  });

  it('renders the motion-blur wordmark with five layered images', () => {
    render(<Hero />);
    const wordmark = screen.getByTestId('hero-wordmark');
    const imgs = wordmark.querySelectorAll('img');
    expect(imgs.length).toBe(5);
  });

  it('renders the canonical sub-headline and the Get Early Access CTA', () => {
    render(<Hero />);
    expect(screen.getByText(/Ready for insurance that rewards you\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get early access/i })).toBeInTheDocument();
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
