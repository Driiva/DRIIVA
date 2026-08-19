/**
 * Lives in the root test tree rather than beside the module: mobile/ has its
 * own Expo tsconfig and dependency set, which the root vitest run cannot
 * resolve. Same reason as tests/unit/mobile-waitlist.test.ts.
 *
 * These pin the cold-launch bug that put every signed-in driver on "This
 * screen does not exist". Three defects produced it and the first test here is
 * the one that matters: a signed-in session on an unrecognised route must be
 * sent somewhere real. Before the fix that case matched no branch at all, so
 * nothing moved the driver and they sat on the not-found screen indefinitely.
 *
 * The routing decision was extracted into a pure function precisely so this
 * case could be tested. A cold launch onto a stale route is exactly what no
 * suite covered and what eyeballing the running app kept mis-attributing to
 * dead taps.
 */
import { describe, it, expect } from 'vitest';

import {
  ROUTE_DASHBOARD,
  ROUTE_ONBOARDING,
  ROUTE_SIGN_IN,
  resolveStartRoute,
  type RoutingSession,
} from '../../mobile/lib/routing';

const onboarded = { onboardingComplete: true };
const newDriver = { onboardingComplete: false };

function session(overrides: Partial<RoutingSession> = {}): RoutingSession {
  return {
    isExpoGo: false,
    loading: false,
    user: onboarded,
    segments: ['(tabs)', 'dashboard'],
    ...overrides,
  };
}

describe('cold launch onto a route with no screen', () => {
  it('rescues a signed-in driver stranded on +not-found', () => {
    // THE BUG. segments[0] was neither '(auth)' nor a known home, so the old
    // AuthGate matched no branch, issued no redirect, and left the driver
    // looking at "This screen does not exist" on every launch.
    expect(resolveStartRoute(session({ segments: ['+not-found'] }))).toBe(ROUTE_DASHBOARD);
  });

  it('rescues a signed-in driver on the root route, which had no file behind it', () => {
    // `/` produces empty segments. There was no app/index.tsx, so expo-router
    // fell through to the catch-all.
    expect(resolveStartRoute(session({ segments: [] }))).toBe(ROUTE_DASHBOARD);
  });

  it('sends a stranded driver who has not finished onboarding to onboarding, not the dashboard', () => {
    expect(resolveStartRoute(session({ user: newDriver, segments: ['+not-found'] }))).toBe(
      ROUTE_ONBOARDING,
    );
  });

  it('sends a signed-out driver on any unknown route to sign-in', () => {
    expect(resolveStartRoute(session({ user: null, segments: ['+not-found'] }))).toBe(
      ROUTE_SIGN_IN,
    );
    expect(resolveStartRoute(session({ user: null, segments: [] }))).toBe(ROUTE_SIGN_IN);
  });
});

describe('leaves a valid session where it is', () => {
  it('does not redirect a signed-in driver already in the tabs', () => {
    expect(resolveStartRoute(session())).toBeNull();
  });

  it('does not redirect away from a trip detail opened by deep link', () => {
    expect(resolveStartRoute(session({ segments: ['trips', '[tripId]'] }))).toBeNull();
  });

  it.each([
    'settings',
    'vehicle',
    'policy',
    'invite',
    'leaderboard',
    'support',
    'privacy',
    'terms',
    'trust',
    'notifications',
    'trip-recording',
  ])('does not redirect away from the root stack screen "%s"', (screen) => {
    // These hang off the app root rather than a group. Treating "not in a
    // group" as "stranded" would have bounced a driver out of Settings the
    // moment they opened it.
    expect(resolveStartRoute(session({ segments: [screen] }))).toBeNull();
  });

  /*
   * The other half of the rule above, and the one that was missing. A root
   * screen absent from ROOT_STACK_SCREENS reads as "stranded" and the driver
   * is replaced onto the dashboard: the screen still exists, still typechecks,
   * still bundles, and is simply unreachable. /invite shipped in exactly that
   * state until this list was updated.
   */
  it('bounces a driver off a root screen nobody registered', () => {
    expect(resolveStartRoute(session({ segments: ['not-registered'] }))).toBe(ROUTE_DASHBOARD);
  });

  it('does not redirect a signed-out driver already on a sign-in screen', () => {
    expect(resolveStartRoute(session({ user: null, segments: ['(auth)', 'signin'] }))).toBeNull();
  });

  it('does not redirect while onboarding is in progress', () => {
    expect(resolveStartRoute(session({ user: newDriver, segments: ['onboarding'] }))).toBeNull();
  });
});

describe('signed in but still on an auth screen', () => {
  it('sends an onboarded driver to the dashboard', () => {
    expect(resolveStartRoute(session({ segments: ['(auth)', 'signin'] }))).toBe(ROUTE_DASHBOARD);
  });

  it('sends a new driver to onboarding', () => {
    expect(resolveStartRoute(session({ user: newDriver, segments: ['(auth)', 'signin'] }))).toBe(
      ROUTE_ONBOARDING,
    );
  });
});

describe('holds still while auth is resolving', () => {
  it('routes nowhere on any route while loading', () => {
    // Routing on a half-resolved session would bounce a signed-in driver
    // through sign-in on every cold start.
    for (const segments of [[], ['+not-found'], ['(tabs)', 'dashboard'], ['(auth)', 'signin']]) {
      expect(resolveStartRoute(session({ loading: true, user: null, segments }))).toBeNull();
    }
  });
});

describe('Expo Go preview', () => {
  it('keeps the preview in onboarding, since it has no real Firebase to sign into', () => {
    expect(resolveStartRoute(session({ isExpoGo: true, user: null, segments: ['+not-found'] }))).toBe(
      ROUTE_ONBOARDING,
    );
    expect(resolveStartRoute(session({ isExpoGo: true, user: null, segments: ['onboarding'] }))).toBeNull();
  });
});
