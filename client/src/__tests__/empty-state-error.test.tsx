/**
 * "Nothing here" and "we do not know what is here" are different sentences.
 *
 * EmptyState could only say the first one, so a failed read rendered the empty
 * copy: the rewards tab told drivers "No achievements yet. Nothing is hidden
 * here, there is simply nothing to show yet" when the read had thrown and been
 * swallowed into a console.error. That is a confident, specific, false claim
 * about someone's own account, which is the same defect class as an invented
 * figure, arriving through a different door.
 *
 * These tests pin the contract the callers rely on, and the source assertions
 * pin the two callers that were getting it wrong, because a component that CAN
 * distinguish the two states is only useful if the callers actually do.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { EmptyState } from '@/components/ui/EmptyState';

function sourceOf(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('EmptyState', () => {
  it('an ordinary empty state is not announced as an alert', () => {
    render(<EmptyState heading="No trips yet" subtext="Your first scored trip appears here." />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('No trips yet')).toBeTruthy();
  });

  it('an error state is announced, so a failed read is not read as an absence', () => {
    render(
      <EmptyState
        tone="error"
        heading="We could not load your achievements"
        subtext="This is a problem reading them, not a sign you have none."
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('could not load');
  });

  it('the error tone derives its colour from the error token, never a pasted hex', () => {
    const source = sourceOf('client/src/components/ui/EmptyState.tsx');

    expect(source).toContain('var(--err-rgb)');
    expect(source).toContain('var(--err)');
    // The wash and the icon are composed from the triplet, so retuning --err
    // moves them too. A literal here would not move.
    expect(source).not.toMatch(/rgba\(\s*239\s*,\s*68\s*,\s*68/);
  });
});

describe('callers distinguish a failed read from an empty one', () => {
  it('rewards shows the error tone rather than "no achievements yet"', () => {
    const source = sourceOf('client/src/pages/rewards.tsx');

    // The error has to be captured, not swallowed into a console.error.
    expect(source).toContain('setAchievementsError');
    // And the error branch has to come BEFORE the empty branch, or an empty
    // list produced by a failed read still renders the empty copy.
    const errorBranch = source.indexOf('achievementsError ?');
    const emptyBranch = source.indexOf('achievements.length === 0 ?');
    expect(errorBranch).toBeGreaterThan(-1);
    expect(emptyBranch).toBeGreaterThan(-1);
    expect(errorBranch).toBeLessThan(emptyBranch);
  });

  it('the pool history chart reads the error its hook has always exposed', () => {
    const source = sourceOf('client/src/components/PoolPanel.tsx');

    expect(source).toContain('error: historyError');
    const errorBranch = source.indexOf('historyError ?');
    const emptyBranch = source.indexOf('series.length < 2 ?');
    expect(errorBranch).toBeGreaterThan(-1);
    expect(errorBranch).toBeLessThan(emptyBranch);
  });
});
