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

const joinWaitlistMock = vi.fn();
vi.mock('@/lib/api', () => ({
  joinWaitlist: (...args: unknown[]) => joinWaitlistMock(...args),
}));

import { Hero } from './Hero';

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
  joinWaitlistMock.mockReset();
  joinWaitlistMock.mockResolvedValue({ ok: true, position: 118 });
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
  // jsdom doesn't ship IntersectionObserver; section reveals need it on mount.
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    FakeIntersectionObserver;
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    FakeIntersectionObserver;
});

describe('Hero', () => {
  /* Queried by textContent rather than getByText, because the Amicro reveals
   * split both lines into per-word and per-character spans on mount. The text
   * and the italic wrapper must both survive that, which is the whole point of
   * the assertions below: an earlier splitter rebuilt the headline from its
   * flattened text and silently dropped the italic span, taking the amber with
   * it. */
  it('renders the canonical eyebrow line and italic headline', () => {
    const { container } = render(<Hero />);

    const eyebrow = container.querySelector('.hero-eyebrow-line');
    expect(eyebrow).not.toBeNull();
    expect(eyebrow).toHaveTextContent(/Insurance, simplified\./i);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /AI-Powered\. Community-driven\./i,
    );

    const italic = container.querySelector('.hero-headline .italic');
    expect(italic).not.toBeNull();
    expect(italic).toHaveTextContent(/Community-driven\./i);
  });

  it('places the wordmark above the headline so the headline reads as the wordmark sub-claim', () => {
    render(<Hero />);
    const wordmark = screen.getByTestId('hero-wordmark');
    const headline = screen.getByRole('heading', { level: 1 });
    const order = wordmark.compareDocumentPosition(headline);
    // DOCUMENT_POSITION_FOLLOWING = 4, headline must come after the wordmark
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.submit(screen.getByTestId('hero-form'));
    expect(screen.getByRole('status')).toHaveTextContent(/doesn't look right/i);
  });

  it('leaves nothing hidden when reduced motion is on', () => {
    // The entrance animates from opacity 0. Under reduced motion the timeline
    // never runs, so anything that relied on it to arrive would stay invisible
    // rather than merely still. Covers the JS half only: the matching
    // .reveal-init rule lives in a CSS media query that jsdom does not apply,
    // and that half needs a real browser.
    window.matchMedia = ((q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    render(<Hero />);
    const headline = screen.getByRole('heading', { level: 1 });
    const wordmark = screen.getByTestId('hero-wordmark');
    const form = screen.getByTestId('hero-form');
    for (const el of [headline, wordmark, form]) {
      expect(el).toHaveStyle({ opacity: '1' });
    }
  });

  it('marks the field invalid and describes it by the status region', () => {
    render(<Hero />);
    const input = screen.getByLabelText(/email address/i);
    expect(input).not.toHaveAttribute('aria-invalid');
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('hero-form'));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // The description has to resolve to the element carrying the message,
    // otherwise a reader who tabs back to the field is told nothing.
    expect(input).toHaveAttribute('aria-describedby', screen.getByRole('status').id);
  });

  it('moves focus to the field that failed', () => {
    render(<Hero />);
    const input = screen.getByLabelText(/email address/i);
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('hero-form'));
    expect(document.activeElement).toBe(input);
  });

  it('retracts the error as soon as the address is edited', () => {
    render(<Hero />);
    const input = screen.getByLabelText(/email address/i);
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.submit(screen.getByTestId('hero-form'));
    expect(screen.getByRole('status')).toHaveTextContent(/doesn't look right/i);

    // Someone who has already fixed their address must not still be told
    // it is wrong. This held until the next submit before.
    fireEvent.change(input, { target: { value: 'driver@example.co.uk' } });
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('accepts a valid email and morphs the button to a success state', async () => {
    render(<Hero />);
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'driver@example.co.uk' },
    });
    fireEvent.submit(screen.getByTestId('hero-form'));
    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(50);
    });
    expect(joinWaitlistMock).toHaveBeenCalledWith('driver@example.co.uk', 'hero');
    expect(screen.getByRole('button')).toHaveTextContent(/you're in/i);
    expect(screen.getByRole('status')).toHaveTextContent(/#118/);
  });
});
