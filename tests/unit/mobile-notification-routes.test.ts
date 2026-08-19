/**
 * Lives in the root test tree for the same reason as the other mobile unit
 * tests: mobile/ has its own Expo tsconfig the root vitest run cannot resolve
 * through.
 *
 * WHY THIS EXISTS
 * Nothing on mobile handled a notification tap. The server has been sending
 * pushes with a `data.type` since Wave D and the app registers a real FCM
 * token, so notifications arrived and did nothing: tapping one opened the app
 * wherever it happened to be. System 3 of the beta brief requires a scheduled
 * notification to deep-link to the correct screen, five times out of five.
 *
 * The mapping is pure so it can be asserted against the types the server
 * ACTUALLY sends, which is the failure worth guarding. A route map that
 * invents its own type names typechecks perfectly and never fires.
 */
import { describe, it, expect } from 'vitest';

import {
  routeForNotification,
  SERVER_NOTIFICATION_TYPES,
} from '../../mobile/lib/notificationRoutes';

describe('routeForNotification', () => {
  it('sends a completed trip to that trip, not to a list', () => {
    expect(routeForNotification({ type: 'trip_complete', tripId: 'trip-1' })).toBe('/trips/trip-1');
  });

  // A trip notification with no id is the server's bug, but the user still
  // tapped something and must land somewhere sensible rather than nowhere.
  it('falls back to the trips list when a trip id is missing', () => {
    expect(routeForNotification({ type: 'trip_complete' })).toBe('/(tabs)/trips');
  });

  it('sends an unlocked achievement to the surface that actually lists them', () => {
    // Rewards, not a standalone /achievements route: that one was a "coming
    // this week" placeholder standing in front of the working surface.
    expect(routeForNotification({ type: 'achievement_unlocked' })).toBe('/(tabs)/rewards');
  });

  /**
   * The weekly summary reads "This week: N trips, M miles, average score X".
   * That is the dashboard's content, so that is where it goes. Routing it to
   * the leaderboard would be a livelier retention beat and a lie about what
   * the notification just said.
   */
  it('sends the weekly summary to the dashboard its copy describes', () => {
    expect(routeForNotification({ type: 'weekly_summary' })).toBe('/(tabs)/dashboard');
  });

  it('sends policy notifications to the policy screen', () => {
    expect(routeForNotification({ type: 'policy_confirmed', policyId: 'p1' })).toBe('/policy');
    expect(routeForNotification({ type: 'policy_not_confirmed', reason: 'x' })).toBe('/policy');
  });

  it('sends anything unrecognised to the notification list rather than nowhere', () => {
    expect(routeForNotification({ type: 'general' })).toBe('/notifications');
    expect(routeForNotification({ type: 'something_new_the_server_added' })).toBe('/notifications');
    expect(routeForNotification({})).toBe('/notifications');
    expect(routeForNotification(undefined)).toBe('/notifications');
  });

  it('never returns an empty route', () => {
    for (const type of [...SERVER_NOTIFICATION_TYPES, 'nonsense']) {
      const route = routeForNotification({ type });
      expect(typeof route).toBe('string');
      expect(route.startsWith('/')).toBe(true);
    }
  });

  /**
   * This is the test that matters most. These strings are copied from the
   * `data` payloads in functions/src/utils/notifications.ts. If the server
   * adds or renames a type and this list is not updated, the new type falls
   * through to the notification list silently. Keeping the list here makes
   * that a visible decision rather than an accident.
   */
  it('covers every type the server actually sends', () => {
    expect([...SERVER_NOTIFICATION_TYPES].sort()).toEqual(
      [
        'achievement_unlocked',
        'general',
        'policy_confirmed',
        'policy_not_confirmed',
        'trip_complete',
        'weekly_summary',
      ].sort(),
    );
  });

  it('is not confused by a non-string type', () => {
    // @ts-expect-error the payload comes off the wire, so it is not trusted
    expect(routeForNotification({ type: 42 })).toBe('/notifications');
  });
});
