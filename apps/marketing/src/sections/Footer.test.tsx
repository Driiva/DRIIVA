import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders the wordmark, contact link, social links and copyright', () => {
    render(<Footer />);
    expect(screen.getByAltText('Driiva')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute(
      'href',
      'mailto:hello@driiva.co.uk',
    );
    expect(screen.getByRole('link', { name: /x \/ twitter/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /linkedin/i })).toBeInTheDocument();
    expect(screen.getByText(/Registered in England/i)).toBeInTheDocument();
  });
});
