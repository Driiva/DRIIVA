/**
 * COMMUNITY HANDOFF
 * =================
 * The last screen of onboarding, and the first touch of the core loop.
 *
 * WHY THIS REPLACED THE QUOTE SCREEN
 * The flow used to end on an insurance quote whose primary button, "Get
 * notified when quotes go live", did nothing but raise an alert saying quotes
 * are not live. The only call that actually completed onboarding was the muted
 * skip link beneath it. A first-time user tapping the obvious button got no
 * state change and no way forward that read as forward, which is precisely the
 * founder intervention the design gate sets to zero. The beta also ships the
 * community play, so a quote screen is a promise the product cannot keep yet.
 *
 * What ends onboarding now is the thing the driver is actually here to do:
 * start driving, and see where they stand against people they know.
 *
 * The primary action completes onboarding. There is exactly one primary
 * action, and it is the one that moves the user forward.
 */
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { DriivButton } from '@/components/ui/DriivButton';
import { C, F, S, R, FS, LH, TR, T } from '@/components/ui/theme';
import { ONBOARDING_TOTAL, stepNumber } from '@/lib/onboardingFlow';
import { track } from '@/lib/analytics';
import { getPushPermission, registerForPush, type PushPermission } from '@/lib/push';

const POINTS = [
  {
    title: 'Drive as you normally would.',
    body: 'Trips are captured and scored on the drive itself, not on anything you tell us.',
  },
  {
    title: 'See where you stand.',
    body: 'Your score moves a leaderboard that recomputes through the week.',
  },
  {
    title: 'Bring someone you know.',
    body: 'A board of strangers is a scoreboard. A board of friends is a reason to come back.',
  },
];

export default function Community() {
  const router = useRouter();
  const { user, markOnboardingComplete } = useAuth();
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushState, setPushState] = useState<PushPermission | 'asking'>('undetermined');

  useEffect(() => {
    getPushPermission().then(setPushState);
  }, []);

  useEffect(() => {
    track('onboarding_step_viewed', { step: stepNumber('community'), name: 'community' });
  }, []);

  /**
   * Completion is gated on the write landing. The previous screen flipped a
   * client flag and navigated regardless, so a failed write left a user who
   * had "finished" onboarding being sent back through it on next launch with
   * no explanation.
   */
  const finish = async (destination: '/(tabs)/dashboard' | '/invite') => {
    if (finishing) return;
    setFinishing(true);
    setError(null);

    try {
      await markOnboardingComplete();
      router.replace(destination);
    } catch {
      setError('We could not finish setting up your account. Try again.');
      setFinishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={stepNumber('community')} total={ONBOARDING_TOTAL} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>You're set up. Here's how it works.</Text>

        <View style={styles.list}>
          {POINTS.map((point) => (
            <View key={point.title} style={styles.card}>
              <Text style={styles.cardTitle}>{point.title}</Text>
              <Text style={styles.cardBody}>{point.body}</Text>
            </View>
          ))}
        </View>

        {/*
          The permission ask lives here, user-initiated, rather than firing on
          launch. iOS gives an app exactly one system prompt, and spending it
          before the person knows what the app does is how you earn a permanent
          denial. By this point the weekly beat has just been explained, so the
          notification has a reason the driver can actually judge.
        */}
        {pushState === 'undetermined' || pushState === 'asking' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tell me when my week closes.</Text>
            <Text style={styles.cardBody}>
              One notification a week with your score, trips and miles. Nothing else.
            </Text>
            <View style={styles.cardAction}>
              <DriivButton
                title="Turn on weekly summary"
                variant="secondary"
                loading={pushState === 'asking'}
                disabled={pushState === 'asking'}
                onPress={async () => {
                  if (!user?.id) return;
                  setPushState('asking');
                  track('push_permission_requested');
                  const result = await registerForPush(user.id);
                  track('push_permission_resolved', { result });
                  setPushState(result);
                }}
              />
            </View>
          </View>
        ) : null}

        {pushState === 'granted' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Weekly summary is on.</Text>
            <Text style={styles.cardBody}>You can turn it off in settings at any time.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <DriivButton
          title="Go to my dashboard"
          onPress={() => finish('/(tabs)/dashboard')}
          loading={finishing}
          disabled={finishing}
        />
        <DriivButton
          title="Add a friend first"
          onPress={() => finish('/invite')}
          variant="secondary"
          disabled={finishing}
        />
        {error !== null && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.xl },

  headline: {
    ...T.h0,
    color: C.text.hero,
    marginBottom: S.lg,
  },

  list: { gap: S.sm, marginBottom: S.sm },
  card: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.md,
    gap: S.xs,
  },
  cardTitle: {
    color: C.text.hero,
    fontFamily: F.bodySemiBold,
    fontSize: FS.base,
    lineHeight: LH.base,
    letterSpacing: TR.base,
  },
  cardBody: {
    color: C.text.sec,
    fontFamily: F.body,
    fontSize: FS.md,
    lineHeight: LH.md,
    letterSpacing: TR.md,
  },
  cardAction: { marginTop: S.sm },

  footer: {
    padding: S.lg,
    gap: S.sm,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  error: {
    color: C.error,
    fontFamily: F.body,
    fontSize: FS.sm,
    lineHeight: LH.sm,
    letterSpacing: TR.sm,
    textAlign: 'center',
  },
});
