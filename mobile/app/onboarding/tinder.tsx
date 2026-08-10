import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { SwipeCard } from '@/components/onboarding/SwipeCard';
import { C, F, S } from '@/components/ui/theme';

const STATEMENTS = [
  "I've driven carefully for years and never once been rewarded for it.",
  "My insurance premium went up at renewal, even though I didn't claim.",
  "I have no idea what happens to my premium money.",
  "I'd switch insurers if I actually trusted the alternative.",
];

export default function TinderCards() {
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
        <ProgressBar step={5} total={14} />
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
    color: C.text.hero, fontSize: 26, fontFamily: F.bodySemiBold,
    letterSpacing: -0.025, lineHeight: 32, marginBottom: 8,
    alignSelf: 'flex-start',
  },
  sub: {
    color: C.text.sec, fontFamily: F.body, fontSize: 15,
    marginBottom: 36, alignSelf: 'flex-start',
  },
  cardArea: { width: '100%', alignItems: 'center' },
  hint: {
    color: C.text.mut, fontFamily: F.body, fontSize: 13,
    marginTop: 24,
  },
});
