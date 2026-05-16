import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders the wordmark, contact link and copyright', () => {
    render(<Footer />);
    expect(screen.getByAltText('driiva')).toBeInTheDocument();
    expect(screen.getByText(/© 2026 Driiva Technologies Ltd/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /hello@driiva\.co\.uk/i })).toHaveAttribute(
      'href',
      'mailto:hello@driiva.co.uk',
    );
  });
});
