import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders the wordmark and the FCA disclaimer', () => {
    render(<Footer />);
    expect(screen.getByAltText('driiva')).toBeInTheDocument();
    expect(
      screen.getByText(/pending FCA authorisation/i),
    ).toBeInTheDocument();
  });

  it('exposes contact and social links', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: /hello@driiva\.co\.uk/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^x$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /linkedin/i })).toBeInTheDocument();
  });

  it('uses a structurally-correct footer element', () => {
    const { container } = render(<Footer />);
    const footer = container.querySelector('footer[data-section="footer"]');
    expect(footer).toBeTruthy();
  });
});
