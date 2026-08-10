/**
 * FinalCTA is the second caller of useWaitlistForm. Hero's suite covers the
 * shared behaviour; this covers the thing extraction actually put at risk,
 * which is a call site wiring itself up wrongly or not at all.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('animejs', () => {
  const timeline = { add: vi.fn(), pause: vi.fn() };
  timeline.add.mockReturnValue(timeline);
  return {
    animate: vi.fn(),
    createTimeline: vi.fn(() => timeline),
    stagger: vi.fn((d: number) => d),
    svg: { createDrawable: vi.fn(() => [null]) },
  };
});

const joinWaitlistMock = vi.fn();
vi.mock('@/lib/api', () => ({
  joinWaitlist: (...args: unknown[]) => joinWaitlistMock(...args),
}));

vi.mock('@/hooks/useWaitlistCount', () => ({ useWaitlistCount: () => null }));

import { FinalCTA } from './FinalCTA';

class FakeIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
  root: Element | null = null;
  rootMargin = '';
  thresholds: ReadonlyArray<number> = [];
}

beforeEach(() => {
  vi.clearAllMocks();
  joinWaitlistMock.mockResolvedValue({ ok: true, position: 42 });
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    FakeIntersectionObserver;
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    FakeIntersectionObserver;
});

describe('FinalCTA', () => {
  it('wires the field to its own status region, not the hero id', () => {
    render(<FinalCTA />);
    const input = screen.getByLabelText(/email address/i);
    const status = screen.getByRole('status');
    expect(status.id).toBe('cta-waitlist-status');
    expect(input).toHaveAttribute('aria-describedby', status.id);
  });

  it('carries the accessibility behaviour the hook owns', () => {
    render(<FinalCTA />);
    const input = screen.getByLabelText(/email address/i);
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('cta-form'));

    expect(screen.getByRole('status')).toHaveTextContent(/doesn't look right/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'driver@example.co.uk' } });
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('reports its own analytics source', async () => {
    render(<FinalCTA />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'driver@example.co.uk' },
    });
    // Awaited: the submit resolves a promise and sets state, and letting that
    // land outside act() prints a warning on an otherwise green run, which is
    // how people learn to ignore warnings.
    await act(async () => {
      fireEvent.submit(screen.getByTestId('cta-form'));
    });
    // The source tag is the one thing that legitimately differs between the
    // two callers, so it is the one thing extraction could quietly unify.
    expect(joinWaitlistMock).toHaveBeenCalledWith('driver@example.co.uk', 'final-cta');
  });
});
