/**
 * TESTS: Privacy Policy + Terms of Service Render Tests
 * ======================================================
 * Verifies both legal pages render without error and contain
 * the required compliance strings (Damoov, Article 28, telematics).
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Ensure React is available globally for components that use automatic JSX transform
globalThis.React = React;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('wouter', () => ({
  useLocation: () => ['/privacy', vi.fn()],
}));

vi.mock('framer-motion', () => {
  const MotionDiv = (props: Record<string, unknown>) => {
    const { children, initial, animate, transition, exit, whileHover, whileTap, ...rest } = props;
    return React.createElement('div', rest as React.HTMLAttributes<HTMLDivElement>, children as React.ReactNode);
  };
  return {
    motion: { div: MotionDiv },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

vi.mock('@/components/FinancialPromotionDisclaimer', () => ({
  FinancialPromotionDisclaimer: ({ className }: { className?: string }) =>
    React.createElement('div', { className, 'data-testid': 'disclaimer' }, 'Disclaimer'),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import Privacy from '../pages/privacy';
import Terms from '../pages/terms';

// ---------------------------------------------------------------------------
// Privacy Policy Tests
// ---------------------------------------------------------------------------

describe('Privacy Policy Page', () => {
  it('renders without error', () => {
    const { container } = render(React.createElement(Privacy));
    expect(container.querySelector('h1')?.textContent).toContain('Privacy Policy');
  });

  it('contains "Damoov" as a named data processor', () => {
    const { container } = render(React.createElement(Privacy));
    expect(container.textContent).toContain('Damoov');
  });

  it('contains "Article 28" reference (GDPR)', () => {
    const { container } = render(React.createElement(Privacy));
    expect(container.textContent).toContain('Article 28');
  });

  it('mentions telematics sensor data collection', () => {
    const { container } = render(React.createElement(Privacy));
    expect(container.textContent).toContain('accelerometer');
    expect(container.textContent).toContain('gyroscope');
  });

  it('mentions in-app feedback data handling', () => {
    const { container } = render(React.createElement(Privacy));
    expect(container.textContent).toContain('feedback');
    expect(container.textContent).toContain('product improvement');
  });

  it('provides info@driiva.co.uk as contact for data rights', () => {
    const { container } = render(React.createElement(Privacy));
    expect(container.textContent).toContain('info@driiva.co.uk');
  });

  it('mentions right to erasure including Damoov-held data', () => {
    const { container } = render(React.createElement(Privacy));
    expect(container.textContent).toContain('deletion');
  });

  it('mentions rolling 12-month retention for telemetry', () => {
    const { container } = render(React.createElement(Privacy));
    expect(container.textContent).toContain('rolling 12-month basis');
  });
});

// ---------------------------------------------------------------------------
// Terms of Service Tests
// ---------------------------------------------------------------------------

describe('Terms of Service Page', () => {
  it('renders without error', () => {
    const { container } = render(React.createElement(Terms));
    expect(container.querySelector('h1')?.textContent).toContain('Terms of Service');
  });

  it('contains telematics consent clause', () => {
    const { container } = render(React.createElement(Terms));
    expect(container.textContent).toContain('passive detection of driving trips');
    expect(container.textContent).toContain('telematics data');
  });

  it('contains rewards framing clause (FCA-clean)', () => {
    const { container } = render(React.createElement(Terms));
    expect(container.textContent).toContain('community-based behaviour incentives');
  });

  it('does NOT describe rewards as guaranteed premium reductions', () => {
    const { container } = render(React.createElement(Terms));
    expect(container.textContent).toContain('do not constitute a guaranteed reduction');
  });

  it('mentions Damoov in telematics consent section', () => {
    const { container } = render(React.createElement(Terms));
    expect(container.textContent).toContain('Damoov');
  });
});
