/**
 * TESTS: Signup Page (client/src/pages/signup.tsx)
 * =================================================
 * Pins the catch block's error-handling behaviour: mapped Firebase codes
 * show friendly copy, and any UNMAPPED code (or a non-Firebase throw) must
 * fall back to a safe generic message - never the raw err.message or an
 * `auth/...` code string.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Router, Route, Switch } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import React from 'react';

globalThis.React = React;

// ---------------------------------------------------------------------------
// Mocks -- must be declared before component imports
// ---------------------------------------------------------------------------

const mockSetLocation = vi.fn();

vi.mock('wouter', async () => {
  const actual = await vi.importActual<typeof import('wouter')>('wouter');
  return {
    ...actual,
    useLocation: () => ['/signup', mockSetLocation] as const,
  };
});

const mockCreateUserWithEmailAndPassword = vi.fn();
const mockUpdateProfile = vi.fn().mockResolvedValue(undefined);
const mockSendEmailVerification = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUserWithEmailAndPassword(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  sendEmailVerification: (...args: unknown[]) => mockSendEmailVerification(...args),
  getAuth: vi.fn(),
}));

const mockGetDoc = vi.fn().mockResolvedValue({ exists: () => false, data: () => null });
const mockWriteBatch = vi.fn((..._args: unknown[]) => ({
  set: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  getFirestore: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  auth: {},
  db: {},
  isFirebaseConfigured: true,
}));

const mockSetUser = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    setUser: mockSetUser,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock framer-motion: render motion.* as plain elements (follows signin-flow.test.tsx pattern)
vi.mock('framer-motion', () => {
  const makeMotionComponent = (tag: string) => {
    const Comp = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
      const { children, initial, animate, transition, exit, whileHover, whileTap, variants, ...rest } = props;
      return React.createElement(tag, { ...rest, ref } as React.HTMLAttributes<HTMLElement>, children as React.ReactNode);
    });
    Comp.displayName = `motion.${tag}`;
    return Comp;
  };
  return {
    motion: {
      div: makeMotionComponent('div'),
      button: makeMotionComponent('button'),
    },
  };
});

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks
// ---------------------------------------------------------------------------

import Signup from '../pages/signup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderSignup() {
  const { hook } = memoryLocation({ path: '/signup' });
  return render(
    <Router hook={hook}>
      <Switch>
        <Route path="/signup"><Signup /></Route>
        <Route path="/quick-onboarding"><div data-testid="onboarding">Onboarding</div></Route>
      </Switch>
    </Router>,
  );
}

async function fillAndSubmit() {
  // delay: null types the whole string in one go instead of awaiting a timer
  // between keystrokes. Forty-five characters of simulated typing, each one
  // re-rendering the form, was overrunning the 5s default whenever the full
  // 48-file suite ran in parallel: these three tests failed under load and
  // passed in isolation, which reads as a real regression every time.
  const user = userEvent.setup({ delay: null });
  await user.type(screen.getByPlaceholderText(/enter your full name/i), 'Test User');
  await user.type(screen.getByPlaceholderText(/enter your email/i), 'test@gmail.com');
  await user.type(screen.getByPlaceholderText(/create a password/i), 'password123');
  await user.type(screen.getByPlaceholderText(/confirm your password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /create account/i }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Signup error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });
  });

  it('shows friendly copy for a mapped Firebase code (auth/email-already-in-use)', async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue({ code: 'auth/email-already-in-use' });

    renderSignup();
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/already registered/i)).toBeInTheDocument();
    });
  });

  it('never leaks a raw auth/... code or err.message for an UNMAPPED Firebase error', async () => {
    // auth/configuration-not-found is not one of the six mapped codes in the
    // catch block - it must fall through to the safe generic branch.
    mockCreateUserWithEmailAndPassword.mockRejectedValue({
      code: 'auth/configuration-not-found',
      message: 'Firebase: Error (auth/configuration-not-found).',
    });

    renderSignup();
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/auth\//)).not.toBeInTheDocument();
    expect(screen.queryByText(/configuration-not-found/)).not.toBeInTheDocument();
  });

  it('never leaks a raw err.message for a non-Firebase throw with no code', async () => {
    mockCreateUserWithEmailAndPassword.mockRejectedValue(
      new Error('ECONNRESET: internal Firestore transport detail'),
    );

    renderSignup();
    await fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/ECONNRESET/)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal Firestore transport detail/)).not.toBeInTheDocument();
  });
});
