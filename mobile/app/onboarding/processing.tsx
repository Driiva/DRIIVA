import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
} from 'react-native-reanimated';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ONBOARDING_TOTAL, stepNumber } from '@/lib/onboardingFlow';
import { track } from '@/lib/analytics';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { C, F, S, FS } from '@/components/ui/theme';

// Wave 0 (0a): 'Community pool match found' claimed a matching step that
// does not exist anywhere in the product. The two remaining lines describe
// what the seed questionnaire actually does.
const ITEMS = [
  { label: 'Driving style assessed', delay: 600 },
  { label: 'Your EcoScore baseline set', delay: 1200 },
];

function CheckItem({ label, delay }: { label: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-10);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    translateX.value = withDelay(delay, withTiming(0, { duration: 400 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[styles.checkItem, style]}>
      <Ionicons name="checkmark" size={28} color={C.success} />
      <Text style={styles.checkLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function Processing() {
  useEffect(() => {
    track('onboarding_step_viewed', { step: stepNumber('processing'), name: 'processing' });
  }, []);

  const router = useRouter();
  const { state, saveToFirestore } = useOnboarding();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setStarted(true);
    saveToFirestore().catch(() => {}); // fire and forget - non-blocking
    const timer = setTimeout(() => {
      router.push('/onboarding/trip-demo');
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={stepNumber('processing')} total={ONBOARDING_TOTAL} />
      </View>

      <View style={styles.content}>
        <Text style={styles.headline}>Building your driving profile…</Text>

        <View style={styles.ringWrap}>
          {started && (
            <ScoreRing score={state.seedScore} size={180} label="Your score" animated />
          )}
        </View>

        <View style={styles.items}>
          {ITEMS.map((item, i) => (
            <CheckItem key={i} label={item.label} delay={item.delay} />
          ))}
        </View>
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
    color: C.text.hero, fontSize: FS.xl, fontFamily: F.bodySemiBold,
    letterSpacing: -0.025, lineHeight: 28,
    marginBottom: 40, alignSelf: 'flex-start',
  },
  ringWrap: {
    marginBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
  },
  items: { width: '100%', gap: 12 },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: C.surface1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  checkLabel: { color: C.text.pri, fontFamily: F.body, fontSize: FS.md },
});
