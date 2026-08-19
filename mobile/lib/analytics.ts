/**
 * ANALYTICS BINDING
 * =================
 * Wires the pure core (mobile/lib/analyticsCore.ts) to Firestore and to the
 * app's idea of who is signed in. All behaviour lives in the core; this file
 * only resolves what the core cannot know by itself, which is whether the
 * sink can actually persist and where the events go.
 *
 * WHY IT WRITES TO FIRESTORE RATHER THAN FIREBASE ANALYTICS
 * The design gate needs the trail for one named user id, readable now, to
 * prove that a specific person completed the loop unaided. Firebase Analytics
 * is aggregated and sampled, and getting per-user event rows out of it means
 * a BigQuery export and a wait. Firestore is already the datastore, already
 * has rules, already has offline persistence that survives app restart, and
 * answers "what did this user do, in order" as a single query. It is also no
 * new infrastructure, which the brief requires a written reason to add.
 *
 * The cost tradeoff is deliberate and bounded: one small document per user
 * action, on a beta with a handful of users. If the user count ever makes
 * that the wrong shape, the migration is to keep this interface and change
 * the sink, which is the whole reason the sink is a parameter.
 */
import { firestore, isExpoGo } from '@/lib/firebase';
import {
  createAnalytics,
  type AnalyticsEnvelope,
  type AnalyticsEvent,
  type AnalyticsParams,
} from '@/lib/analyticsCore';

/**
 * Writes one event under the user it belongs to.
 *
 * recordedAt is the server's own timestamp and the rules require it. The
 * device clock can be wrong or deliberately set, so occurredAt is kept for
 * ordering within a session and recordedAt is what anything load-bearing
 * should be settled on.
 */
async function firestoreSink(envelope: AnalyticsEnvelope): Promise<void> {
  if (!envelope.userId) return;

  await firestore()
    .collection('users')
    .doc(envelope.userId)
    .collection('events')
    .add({
      event: envelope.event,
      params: envelope.params,
      userId: envelope.userId,
      sessionId: envelope.sessionId,
      occurredAt: envelope.occurredAt,
      durable: envelope.durable,
      recordedAt: firestore.FieldValue.serverTimestamp(),
    });
}

/**
 * In Expo Go the firebase shim is a mock whose add() resolves without storing
 * anything, so every write "succeeds" and nothing exists. Marking the sink
 * non-durable there is what stops a preview session being mistaken for
 * evidence: the verification path counts durable writes only.
 */
const analytics = createAnalytics({
  sink: isExpoGo ? async () => {} : firestoreSink,
  durable: !isExpoGo,
});

/** Record that something happened. Never throws, never blocks the caller. */
export function track(event: AnalyticsEvent, params?: AnalyticsParams): void {
  analytics.track(event, params);
}

/**
 * Point the trail at a user, or clear it on sign-out.
 *
 * Call with the uid as soon as auth resolves: events emitted before this are
 * held and back-filled, so the pre-account half of onboarding is still
 * attributed to the person who did it.
 */
export function setAnalyticsUser(userId: string | null): void {
  analytics.setUser(userId);
}

/** Waits for everything queued to be written. For verification, not for UI. */
export function flushAnalytics(): Promise<void> {
  return analytics.flush();
}

/** Queue depth and durable/preview write counts. Used by the beta harness. */
export function analyticsStats() {
  return analytics.stats();
}

export type { AnalyticsEvent, AnalyticsParams } from '@/lib/analyticsCore';
