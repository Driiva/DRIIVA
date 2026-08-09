/**
 * Wave 0 (0f): the Toaster must actually reach the DOM.
 *
 * 28 files call toast() from use-toast. Before this wave <Toaster/> was never
 * rendered anywhere, so every one of those calls updated an in-memory store
 * that no component read. These tests fail if that regression returns.
 */
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';

describe('Toaster', () => {
  it('renders a toast dispatched through the shared toast() helper', async () => {
    render(<Toaster />);

    await act(async () => {
      toast({ title: 'Saved', description: 'Your changes are live.' });
    });

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Your changes are live.')).toBeInTheDocument();
  });

  it('is mounted in App.tsx so the whole app has somewhere to render toasts', () => {
    const appSource = readFileSync(
      path.resolve(__dirname, '..', 'App.tsx'),
      'utf8',
    );

    expect(appSource).toMatch(/import \{ Toaster \}/);
    expect(appSource).toMatch(/<Toaster\s*\/>/);
  });
});
