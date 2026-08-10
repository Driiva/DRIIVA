/**
 * Where a session belongs.
 *
 * WHY THIS EXISTS
 * The app cold-launched into "This screen does not exist" for any signed-in
 * driver. Three defects combined into one behaviour, and none of them was the
 * navigation-state persistence everyone assumed:
 *
 * 1. There is no `app/index.tsx`, so the `/` route genuinely does not exist.
 *    A cold launch resolves `/`, matches nothing, and renders +not-found.
 * 2. AuthGate had no branch for it. It redirected a signed-OUT user away from
 *    any non-auth route, which is why signing out appeared to fix things, but
 *    a signed-IN user sitting on +not-found matched neither branch, so nothing
 *    ever moved them. They stayed on "this screen does not exist" forever.
 * 3. The escape hatch pointed at the hole. +not-found linked to `/`, the very
 *    route that does not exist, so tapping "Go to the dashboard" re-rendered
 *    +not-found. It looked like the tap was not registering. It was.
 *
 * The decision is a pure function so it can be tested directly. The bug it
 * fixes is a cold launch after landing on an unknown route, which is precisely
 * the case no suite covered and no amount of eyeballing the running app made
 * obvious.
 */

/** The subset of the session the routing decision depends on. */
export interface RoutingSession {
  /** Expo Go swaps in a mock Firebase, so it gets the preview path. */
  isExpoGo: boolean;
  /** Auth is still resolving; hold still rather than routing on a guess. */
  loading: boolean;
  /** Null when signed out. */
  user: { onboardingComplete?: boolean } | null;
  /** expo-router segments for the current route. */
  segments: string[];
}

export const ROUTE_SIGN_IN = '/(auth)/signin';
export const ROUTE_DASHBOARD = '/(tabs)/dashboard';
export const ROUTE_ONBOARDING = '/onboarding';

/**
 * Route groups a signed-in driver is legitimately inside. Anything else, plus
 * the empty segments of `/` and the `+not-found` catch-all, counts as stranded.
 */
const SIGNED_IN_HOMES = new Set(['(tabs)', 'onboarding', 'trips']);

/**
 * Stack screens that live at the app root rather than in a group. They are
 * reachable from the profile menu and from deep links, so a signed-in driver
 * on one of them is exactly where they meant to be.
 */
const ROOT_STACK_SCREENS = new Set([
  'achievements',
  'leaderboard',
  'notifications',
  'policy',
  'privacy',
  'settings',
  'support',
  'terms',
  'trip-recording',
  'trust',
  'vehicle',
]);

/**
 * The route this session should be on, or null to stay put.
 *
 * Returning null rather than a route for the common case matters: this runs in
 * an effect on every segment change, and redirecting anyone who is already
 * somewhere valid would fight the user's own navigation.
 */
export function resolveStartRoute(session: RoutingSession): string | null {
  const { isExpoGo, loading, user, segments } = session;

  if (loading) return null;

  // Expo Go cannot reach real Firebase, so it previews onboarding and nothing
  // that needs an account.
  if (isExpoGo) {
    return segments[0] === 'onboarding' ? null : ROUTE_ONBOARDING;
  }

  const top = segments[0];
  const inAuthGroup = top === '(auth)';

  if (!user) {
    return inAuthGroup ? null : ROUTE_SIGN_IN;
  }

  const destination = user.onboardingComplete ? ROUTE_DASHBOARD : ROUTE_ONBOARDING;

  // Signed in but still on a sign-in screen: send them in.
  if (inAuthGroup) return destination;

  // Signed in and somewhere real: leave them alone.
  if (top !== undefined && (SIGNED_IN_HOMES.has(top) || ROOT_STACK_SCREENS.has(top))) {
    return null;
  }

  // Signed in and stranded, which covers `/` (no segments at all) and
  // +not-found. This is the branch whose absence left drivers looking at
  // "This screen does not exist" on every cold launch.
  return destination;
}
