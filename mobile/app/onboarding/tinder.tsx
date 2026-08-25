import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ONBOARDING_TOTAL, stepNumber } from '@/lib/onboardingFlow';
import { track } from '@/lib/analytics';
import { SwipeCard } from '@/components/onboarding/SwipeCard';
import { C, F, S, FS, LH, TR, T } from '@/components/ui/theme';

const STATEMENTS = [
  "I've driven carefully for years and never once been rewarded for it.",
  "My insurance premium went up at renewal, even though I didn't claim.",
  "I have no idea what happens to my premium money.",
  "I'd switch insurers if I actually trusted the alternative.",
];

export default function TinderCards() {
  useEffect(() => {
    track('onboarding_step_viewed', { step: stepNumber('tinder'), name: 'tinder' });
  }, []);

  const router = useRouter();
  const { addPainScore } = useOnboarding();
  const [current, setCurrent] = useState(0);

  const handleSwipe = (agreed: boolean) => {
    if (agreed) addPainScore(1);
    const next = current + 1;
    if (next >= STATEMENTS.length) {
      router.push('/onboarding/solution');
    } else {
      setCurrent(next);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={stepNumber('tinder')} total={ONBOARDING_TOTAL} />
      </View>

      <View style={styles.content}>
        <Text style={styles.headline}>Do you relate to this?</Text>
        <Text style={styles.sub}>Swipe right if yes, left if not.</Text>

        <View style={styles.cardArea}>
          <SwipeCard
            key={current}
            statement={STATEMENTS[current]}
            index={current}
            total={STATEMENTS.length}
            onSwipe={handleSwipe}
          />
        </View>

        <Text style={styles.hint}>
          {STATEMENTS.length - current - 1 > 0
            ? `${STATEMENTS.length - current - 1} more to go`
            : 'Last one.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: {
    flex: 1,
    paddingHorizontal: S.lg,
    paddingTop: S.xl,
    alignItems: 'center',
  },
  headline: {
    ...T.h0,
    color: C.text.hero, marginBottom: 8,
    alignSelf: 'flex-start',
  },
  sub: {
    color: C.text.sec, fontFamily: F.body, fontSize: FS.md,
    lineHeight: LH.md, letterSpacing: TR.md,
    marginBottom: 36, alignSelf: 'flex-start',
  },
  cardArea: { width: '100%', alignItems: 'center' },
  hint: {
    color: C.text.mut, fontFamily: F.body, fontSize: FS.sm,
    lineHeight: LH.sm, letterSpacing: TR.sm,
    marginTop: 24,
  },
});
