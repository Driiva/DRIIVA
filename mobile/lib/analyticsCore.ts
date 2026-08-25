/**
 * ANALYTICS CORE
 * ==============
 * The pure half of mobile analytics. No firebase import, no expo-constants,
 * no native module, so it is testable from the root vitest run and its
 * behaviour is decided here rather than at each call site.
 *
 * WHY THIS EXISTS AT ALL
 * The mobile app, which is the surface the beta ships on, emitted nothing.
 * The design gate is evidenced by "the analytics trail for that user id", so
 * without this there is no way to prove a stranger completed the loop, and no
 * way to tell a silent drop-off from a screen nobody reached.
 *
 * THE THREE THINGS THIS MODULE REFUSES TO GET WRONG
 *
 * 1. It will not let a preview pass as proof. In Expo Go the firebase shim
 *    hands back a mock whose `add()` resolves without storing anything
 *    (mobile/lib/firebase.ts), so a naive sink reports success forever while
 *    writing nothing. Every envelope carries `durable`, preview writes are
 *    counted separately, and the verification path reads durable counts only.
 *    A harness that cannot tell "written" from "pretended" reports the second
 *    as the first.
 *
 * 2. It will not attribute a user's actions to nobody. Onboarding starts
 *    before an account exists. Events emitted before sign-in are held, not
 *    written blank, and are back-filled with the user id once it is known. On
 *    sign-out the pending queue is dropped so one person's actions can never
 *    land on the next person's id.
 *
 * 3. It will not take a screen down. track() is called from render paths and
 *    from button handlers. It validates, never throws, and never returns a
 *    promise a caller might forget to catch. Delivery failure is a queue
 *    problem, not the caller's problem.
 *
 * Offline durability is deliberately delegated to the Firestore sink rather
 * than hand-rolled here. Firestore's own persistence queues writes made
 * offline and flushes them on reconnect, and that queue survives app restart,
 * which is exactly what "loop state survives kill-and-relaunch" needs. A
 * second buffer on top of it would be a cache with no invalidation story.
 */

/**
 * The complete set of events the beta emits, as a closed union.
 *
 * Free-string event names are how a taxonomy rots: a typo produces a new
 * metric that reads as zero rather than as an error, and nothing ever fails.
 * Adding an event means adding it here.
 */
export const LOOP_EVENTS = [
  // Session
  'app_opened',

  // Identity and onboarding
  'onboarding_started',
  'onboarding_step_viewed',
  'onboarding_completed',
  'account_created',
  'signed_in',

  // Drive and score
  'trip_started',
  'trip_completed',
  'score_viewed',

  // Community
  'community_viewed',
  'leaderboard_viewed',
  'invite_created',
  'invite_shared',
  'invite_redeemed',
  'friend_added',

  // Retention
  'push_permission_requested',
  'push_permission_resolved',
  'notification_opened',
] as const;

export type AnalyticsEvent = (typeof LOOP_EVENTS)[number];

/** Values small and categorical enough to group by. Never free text. */
export type AnalyticsParamValue = string | number | boolean;
export type AnalyticsParams = Record<string, AnalyticsParamValue>;

export interface AnalyticsEnvelope {
  event: AnalyticsEvent;
  params: AnalyticsParams;
  /** Null only while queued before sign-in; never null once written. */
  userId: string | null;
  occurredAt: number;
  /**
   * False when the sink physically cannot persist, which today means Expo Go.
   * Verification counts durable writes only.
   */
  durable: boolean;
  sessionId: string;
}

export type AnalyticsSink = (envelope: AnalyticsEnvelope) => Promise<void>;

export interface AnalyticsStats {
  pending: number;
  durableWritten: number;
  previewWritten: number;
}

export interface Analytics {
  track(event: AnalyticsEvent, params?: AnalyticsParams): void;
  setUser(userId: string | null): void;
  flush(): Promise<void>;
  stats(): AnalyticsStats;
}

export interface AnalyticsOptions {
  sink: AnalyticsSink;
  /** Whether the sink can actually persist. False in Expo Go. */
  durable: boolean;
  now?: () => number;
  sessionId?: string;
}

/**
 * A queue this long already means the device has been offline for a long
 * while. Past this point the newest behaviour is worth more than the oldest,
 * so the oldest is dropped. An unbounded queue is a memory leak that only
 * shows up on the users with the worst connectivity.
 */
export const MAX_QUEUED_EVENTS = 200;

/** Longest a param value may be and still be a category rather than content. */
const MAX_PARAM_LENGTH = 64;

const EVENT_SET: ReadonlySet<string> = new Set(LOOP_EVENTS);

export function isKnownEvent(name: string): name is AnalyticsEvent {
  return EVENT_SET.has(name);
}

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** Keys that carry an identifier regardless of what the value looks like. */
const IDENTIFYING_KEYS = new Set([
  'email',
  'phone',
  'name',
  'fullname',
  'displayname',
  'address',
  'postcode',
  'registration',
  'vrn',
]);

function looksLikePhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 && /^\+?[\d\s().-]+$/.test(value.trim());
}

/**
 * Strips anything that identifies a person before it can leave the device.
 *
 * This is a boundary, not a formality: Driiva is regulated-adjacent and the
 * repo's own rule is not to add analytics surfaces without deciding what they
 * retain. Deciding it once, here, is cheaper and safer than trusting every
 * future call site to remember.
 */
export function scrubParams(params: AnalyticsParams): AnalyticsParams {
  const out: AnalyticsParams = {};

  for (const [key, value] of Object.entries(params)) {
    if (IDENTIFYING_KEYS.has(key.toLowerCase())) continue;

    if (typeof value === 'number') {
      if (Number.isFinite(value)) out[key] = value;
      continue;
    }

    if (typeof value === 'boolean') {
      out[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      if (value.length > MAX_PARAM_LENGTH) continue;
      if (EMAIL_PATTERN.test(value)) continue;
      if (looksLikePhoneNumber(value)) continue;
      out[key] = value;
      continue;
    }
    // Anything else (object, null, undefined) is not a category. Drop it.
  }

  return out;
}

let sessionCounter = 0;

export function createAnalytics(options: AnalyticsOptions): Analytics {
  const { sink, durable } = options;
  const now = options.now ?? (() => Date.now());
  const sessionId = options.sessionId ?? `s${++sessionCounter}-${now().toString(36)}`;

  let pending: AnalyticsEnvelope[] = [];
  let userId: string | null = null;
  let durableWritten = 0;
  let previewWritten = 0;

  /**
   * Drains are serialised on a chain rather than guarded by a boolean.
   *
   * A boolean guard made flush() return immediately whenever a background
   * drain was already in flight, so `await flush()` could resolve while the
   * last event of a burst was still unwritten. Every caller that awaits a
   * flush is asking "is it all written yet", and the honest answer has to
   * wait for the drain already running plus one more pass.
   */
  let chain: Promise<void> = Promise.resolve();

  function track(event: AnalyticsEvent, params: AnalyticsParams = {}): void {
    // Guarded at runtime as well as in the types: a call site reached through
    // an `any` would otherwise mint a metric that reads as zero forever.
    if (!isKnownEvent(event)) return;

    pending.push({
      event,
      params: scrubParams(params),
      userId,
      occurredAt: now(),
      durable,
      sessionId,
    });

    if (pending.length > MAX_QUEUED_EVENTS) {
      pending.splice(0, pending.length - MAX_QUEUED_EVENTS);
    }

    // Fire and forget. Callers are render and press handlers; they must not
    // be handed a promise, and a rejection here must not surface as an
    // unhandled rejection.
    void flush();
  }

  function setUser(nextUserId: string | null): void {
    if (nextUserId === null) {
      // Sign-out. Anything still queued belongs to the session that just
      // ended and must not be re-attributed to whoever signs in next.
      pending = [];
      userId = null;
      return;
    }

    if (userId !== null && userId !== nextUserId) {
      pending = [];
    }

    userId = nextUserId;

    // Back-fill: these events are this user's, they just happened before the
    // app could name them.
    for (const envelope of pending) {
      if (envelope.userId === null) envelope.userId = nextUserId;
    }

    void flush();
  }

  function flush(): Promise<void> {
    chain = chain.then(drain, drain);
    return chain;
  }

  async function drain(): Promise<void> {
    while (pending.length > 0) {
      const envelope = pending[0];

      // Unattributed events wait for sign-in rather than being written to
      // nobody. An event with no user id cannot evidence that a specific
      // person did anything.
      if (envelope.userId === null) break;

      try {
        await sink(envelope);
      } catch {
        // Almost always offline. Keep the event queued and stop; the next
        // track() or setUser() retries.
        break;
      }

      pending.shift();
      if (envelope.durable) durableWritten++;
      else previewWritten++;
    }
  }

  function stats(): AnalyticsStats {
    return { pending: pending.length, durableWritten, previewWritten };
  }

  return { track, setUser, flush, stats };
}
