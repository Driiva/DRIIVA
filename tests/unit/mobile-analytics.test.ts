/**
 * Lives in the root test tree rather than beside the module, for the same
 * reason as tests/unit/mobile-background-location.test.ts: mobile/ has its own
 * Expo tsconfig and dependency set that the root vitest run cannot resolve.
 *
 * mobile/lib/analyticsCore.ts is the pure half of mobile analytics, split from
 * mobile/lib/analytics.ts so it carries no firebase or expo-constants import
 * and can be tested here.
 *
 * WHAT MATTERS MOST, and why this file leans on it hard:
 *
 * 1. An event recorded in Expo Go must never be able to pass as proof. The
 *    Expo Go firebase shim hands back a mock whose `add()` resolves without
 *    persisting anything (mobile/lib/firebase.ts), so a sink there succeeds
 *    forever while storing nothing. The design gate is evidenced by an
 *    analytics trail, so a trail that cannot tell "written" from "pretended"
 *    would certify a loop that never happened. Envelopes carry `durable`, and
 *    non-durable ones are counted separately.
 *
 * 2. Events emitted before sign-in still belong to the user who caused them.
 *    Onboarding starts before an account exists, so without back-filling, the
 *    most important half of the funnel is attributed to nobody.
 *
 * 3. track() must never throw and never reject. It is called from render and
 *    from button handlers; an analytics failure must not take a screen down.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  createAnalytics,
  isKnownEvent,
  scrubParams,
  LOOP_EVENTS,
  MAX_QUEUED_EVENTS,
  type AnalyticsEnvelope,
} from '../../mobile/lib/analyticsCore';

function collectingSink() {
  const written: AnalyticsEnvelope[] = [];
  const sink = vi.fn(async (e: AnalyticsEnvelope) => {
    written.push(e);
  });
  return { written, sink };
}

describe('event taxonomy', () => {
  it('is a closed set, so a typo cannot invent a metric', () => {
    expect(isKnownEvent('leaderboard_viewed')).toBe(true);
    expect(isKnownEvent('leaderbaord_viewed')).toBe(false);
    expect(isKnownEvent('')).toBe(false);
  });

  it('covers every action in the committed core loop', () => {
    // The loop is: drive, get scored, see standing, invite a friend, return.
    // If one of these disappears the loop is no longer fully instrumented and
    // the 100% budget line is silently false.
    for (const required of [
      'trip_completed',
      'score_viewed',
      'leaderboard_viewed',
      'invite_created',
      'invite_redeemed',
      'friend_added',
      'onboarding_completed',
      'notification_opened',
    ]) {
      expect(LOOP_EVENTS).toContain(required);
    }
  });
});

describe('scrubParams', () => {
  it('drops values that look like direct identifiers', () => {
    const out = scrubParams({
      email: 'someone@example.com',
      note: 'contact me at someone@example.com',
      phone: '+447700900123',
      score: 82,
    });
    expect(out.email).toBeUndefined();
    expect(out.note).toBeUndefined();
    expect(out.phone).toBeUndefined();
    expect(out.score).toBe(82);
  });

  it('keeps the non-identifying params the loop actually reports on', () => {
    const out = scrubParams({ scope: 'friends', period: 'weekly', rank: 4 });
    expect(out).toEqual({ scope: 'friends', period: 'weekly', rank: 4 });
  });

  it('drops values too long to be a category', () => {
    const out = scrubParams({ blob: 'x'.repeat(500) });
    expect(out.blob).toBeUndefined();
  });
});

describe('track', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes a known event through the sink', async () => {
    const { written, sink } = collectingSink();
    const a = createAnalytics({ sink, durable: true, now: () => 1000 });
    a.setUser('user-1');

    a.track('score_viewed', { score: 82 });
    await a.flush();

    expect(written).toHaveLength(1);
    expect(written[0].event).toBe('score_viewed');
    expect(written[0].userId).toBe('user-1');
    expect(written[0].params.score).toBe(82);
    expect(written[0].occurredAt).toBe(1000);
  });

  it('ignores an unknown event rather than writing a junk metric', async () => {
    const { written, sink } = collectingSink();
    const a = createAnalytics({ sink, durable: true });
    a.setUser('user-1');

    // @ts-expect-error deliberately outside the union
    a.track('not_a_real_event');
    await a.flush();

    expect(written).toHaveLength(0);
  });

  it('never throws when the sink rejects', async () => {
    const sink = vi.fn(async () => {
      throw new Error('offline');
    });
    const a = createAnalytics({ sink, durable: true });
    a.setUser('user-1');

    expect(() => a.track('app_opened')).not.toThrow();
    await expect(a.flush()).resolves.not.toThrow();
  });

  it('preserves the order actions happened in', async () => {
    const { written, sink } = collectingSink();
    const a = createAnalytics({ sink, durable: true });
    a.setUser('user-1');

    a.track('invite_created');
    a.track('invite_shared');
    a.track('invite_redeemed');
    await a.flush();

    expect(written.map((e) => e.event)).toEqual([
      'invite_created',
      'invite_shared',
      'invite_redeemed',
    ]);
  });
});

describe('attribution across sign-in', () => {
  it('back-fills the user id onto events emitted before identity was known', async () => {
    const { written, sink } = collectingSink();
    const a = createAnalytics({ sink, durable: true });

    // Onboarding begins before an account exists.
    a.track('onboarding_started');
    a.track('onboarding_step_viewed', { step: 1 });
    a.setUser('user-42');
    a.track('onboarding_completed');
    await a.flush();

    expect(written).toHaveLength(3);
    expect(written.every((e) => e.userId === 'user-42')).toBe(true);
  });

  it('holds pre-identity events rather than writing them to nobody', async () => {
    const { written, sink } = collectingSink();
    const a = createAnalytics({ sink, durable: true });

    a.track('onboarding_started');
    await a.flush();

    // Nothing is written yet: an event attributed to nobody cannot evidence
    // that a specific stranger completed the loop.
    expect(written).toHaveLength(0);

    a.setUser('user-42');
    await a.flush();
    expect(written).toHaveLength(1);
    expect(written[0].userId).toBe('user-42');
  });

  it('drops the pending queue on sign-out so events cannot cross accounts', async () => {
    const { written, sink } = collectingSink();
    const a = createAnalytics({ sink, durable: true });

    a.track('onboarding_started');
    a.setUser(null);
    a.setUser('someone-else');
    await a.flush();

    expect(written).toHaveLength(0);
  });
});

describe('durability honesty', () => {
  it('marks envelopes non-durable when the sink cannot persist', async () => {
    const { written, sink } = collectingSink();
    const a = createAnalytics({ sink, durable: false });
    a.setUser('preview-user');

    a.track('trip_completed', { score: 90 });
    await a.flush();

    expect(written[0].durable).toBe(false);
  });

  it('reports durable and non-durable counts separately', async () => {
    const { sink } = collectingSink();
    const a = createAnalytics({ sink, durable: false });
    a.setUser('preview-user');

    a.track('app_opened');
    a.track('score_viewed', { score: 70 });
    await a.flush();

    const stats = a.stats();
    expect(stats.durableWritten).toBe(0);
    expect(stats.previewWritten).toBe(2);
  });
});

describe('bounded queue', () => {
  it('never grows without limit while offline', async () => {
    const sink = vi.fn(async () => {
      throw new Error('offline');
    });
    const a = createAnalytics({ sink, durable: true });
    a.setUser('user-1');

    for (let i = 0; i < MAX_QUEUED_EVENTS + 50; i++) a.track('app_opened');

    expect(a.stats().pending).toBeLessThanOrEqual(MAX_QUEUED_EVENTS);
  });

  it('drops oldest first, so the most recent behaviour survives', async () => {
    let failing = true;
    const written: AnalyticsEnvelope[] = [];
    const sink = vi.fn(async (e: AnalyticsEnvelope) => {
      if (failing) throw new Error('offline');
      written.push(e);
    });
    const a = createAnalytics({ sink, durable: true, now: () => Date.now() });
    a.setUser('user-1');

    a.track('onboarding_started');
    for (let i = 0; i < MAX_QUEUED_EVENTS + 10; i++) a.track('app_opened');
    await a.flush().catch(() => {});

    failing = false;
    await a.flush();

    // The very first event was pushed out by newer ones.
    expect(written.some((e) => e.event === 'onboarding_started')).toBe(false);
    expect(written.length).toBeGreaterThan(0);
  });
});
