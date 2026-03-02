/**
 * TESTS: Feedback Widget
 * =======================
 * Tests the FeedbackModal component: rendering, star selection,
 * message input, and Firestore write on submit.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Ensure React is available globally for components that use automatic JSX transform
globalThis.React = React;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'feedback-001' });
const mockCollection = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _type: 'SERVER_TIMESTAMP' }));

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock('../lib/firebase', () => ({
  db: { type: 'mock-firestore' },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-001', name: 'Test Driver', email: 'test@driiva.co.uk' },
    loading: false,
  }),
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

import FeedbackModal from '../components/FeedbackModal';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FeedbackModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', () => {
    render(<FeedbackModal open={true} onClose={vi.fn()} />);
    expect(screen.getByText('Share Feedback')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(<FeedbackModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByText('Share Feedback')).toBeNull();
  });

  it('renders 5 star buttons', () => {
    render(<FeedbackModal open={true} onClose={vi.fn()} />);
    const stars = screen.getAllByRole('button').filter(
      (btn) => btn.querySelector('svg'),
    );
    // 5 stars + Submit + Cancel + Close = at least 5 with SVGs
    expect(stars.length).toBeGreaterThanOrEqual(5);
  });

  it('renders textarea with placeholder', () => {
    render(<FeedbackModal open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("What's on your mind?")).toBeTruthy();
  });

  it('submit button is disabled when no stars selected', () => {
    render(<FeedbackModal open={true} onClose={vi.fn()} />);
    const submit = screen.getByText('Submit');
    expect(submit).toHaveProperty('disabled', true);
  });

  it('writes to Firestore on submit with correct fields', async () => {
    render(<FeedbackModal open={true} onClose={vi.fn()} />);

    // Select 4 stars (the 4th star button)
    const allButtons = screen.getAllByRole('button');
    // Stars are the first 5 buttons with SVG children
    const starButtons = allButtons.filter((btn) => {
      const svg = btn.querySelector('svg');
      return svg && btn.className.includes('active:scale-90');
    });

    if (starButtons.length >= 4) {
      fireEvent.click(starButtons[3]); // 4th star (0-indexed)
    }

    // Type a message
    const textarea = screen.getByPlaceholderText("What's on your mind?");
    fireEvent.change(textarea, { target: { value: 'Great app, love the safety score!' } });

    // Click submit
    const submit = screen.getByText('Submit');
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });

    const writtenDoc = mockAddDoc.mock.calls[0][1];
    expect(writtenDoc.uid).toBe('test-user-001');
    expect(writtenDoc.rating).toBe(4);
    expect(writtenDoc.message).toBe('Great app, love the safety score!');
    expect(writtenDoc.platform).toBe('web');
    expect(writtenDoc.screenContext).toBe('settings');
    expect(writtenDoc).toHaveProperty('timestamp');
  });

  it('shows success message after submit', async () => {
    render(<FeedbackModal open={true} onClose={vi.fn()} />);

    // Select a star
    const allButtons = screen.getAllByRole('button');
    const starButtons = allButtons.filter((btn) => {
      return btn.className.includes('active:scale-90');
    });
    if (starButtons.length >= 1) {
      fireEvent.click(starButtons[0]);
    }

    // Submit
    const submit = screen.getByText('Submit');
    fireEvent.click(submit);

    await waitFor(() => {
      expect(
        screen.getByText("Thanks — you're helping make Driiva better"),
      ).toBeTruthy();
    });
  });

  it('limits message to 500 characters', () => {
    render(<FeedbackModal open={true} onClose={vi.fn()} />);
    const textarea = screen.getByPlaceholderText("What's on your mind?");
    expect(textarea.getAttribute('maxLength')).toBe('500');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<FeedbackModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
