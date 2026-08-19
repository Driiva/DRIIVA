/**
 * NOTIFICATION ROUTING
 * ====================
 * Turns a push payload into the screen it promised.
 *
 * WHY THIS EXISTS
 * The server has sent pushes carrying a `data.type` since Wave D
 * (functions/src/utils/notifications.ts) and the app has registered a real FCM
 * token for just as long, so notifications arrived and did nothing. There was
 * no response listener anywhere in mobile/, so tapping one opened the app
 * wherever it happened to be. A notification that says "your trip is scored"
 * and then drops you on whatever screen you left open is worse than no
 * notification, because it spends the one bit of attention it was given.
 *
 * The mapping is pure and separate from the listener so it can be tested
 * against the type strings the server ACTUALLY sends. A route map that invents
 * its own names typechecks perfectly and never fires, which is exactly the
 * class of bug that survives review.
 */

/**
 * Every `type` the server puts in a push payload today, copied from the `data`
 * arguments in functions/src/utils/notifications.ts.
 *
 * Kept as an explicit list so a server-side addition shows up as a failing
 * test rather than as a notification that quietly lands on the wrong screen.
 */
export const SERVER_NOTIFICATION_TYPES = [
  'trip_complete',
  'achievement_unlocked',
  'weekly_summary',
  'policy_confirmed',
  'policy_not_confirmed',
  'general',
] as const;

export type ServerNotificationType = (typeof SERVER_NOTIFICATION_TYPES)[number];

/** The payload as it comes off the wire: untyped, and not to be trusted. */
export interface NotificationData {
  type?: unknown;
  tripId?: unknown;
  policyId?: unknown;
  [key: string]: unknown;
}

/** Where a tap lands when the payload says nothing useful. */
const FALLBACK_ROUTE = '/notifications';

/**
 * The screen a notification of this type promised.
 *
 * Always returns a real route. There is no null case and no throw: the user
 * has already tapped, and the only question left is where they land. Defining
 * the error out of existence here means no call site needs a branch for
 * "we could not work out where to go".
 */
export function routeForNotification(data: NotificationData | undefined): string {
  const type = typeof data?.type === 'string' ? data.type : '';

  switch (type) {
    case 'trip_complete': {
      const tripId = typeof data?.tripId === 'string' ? data.tripId : '';
      // A trip push with no id is a server bug, but the user still tapped
      // something and the trips list is the honest nearest thing.
      return tripId ? `/trips/${tripId}` : '/(tabs)/trips';
    }

    // The achievements a driver has actually unlocked live in the Rewards
    // tab, reading users/{uid}/achievements. The old standalone /achievements
    // route was a "coming this week" placeholder sitting in front of the real
    // surface, and has been deleted rather than left to rot.
    case 'achievement_unlocked':
      return '/(tabs)/rewards';

    // "This week: N trips, M miles, average score X" is the dashboard's
    // content. The leaderboard would be a livelier return beat and a lie about
    // what the notification just said; if the retention beat should be the
    // board, the copy has to change with it.
    case 'weekly_summary':
      return '/(tabs)/dashboard';

    case 'policy_confirmed':
    case 'policy_not_confirmed':
      return '/policy';

    default:
      return FALLBACK_ROUTE;
  }
}
