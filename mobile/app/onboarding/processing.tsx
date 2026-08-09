import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
} from 'react-native-reanimated';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ScoreRing } from '@/components/onboarding/ScoreRing';
import { Colors, Spacing } from '@/constants/theme';

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
      <Text style={styles.checkMark}>✓</Text>
      <Text style={styles.checkLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function Processing() {
  const router = useRouter();
  const { state, saveToFirestore } = useOnboarding();
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setStarted(true);
    saveToFirestore().catch(() => {}); // fire and forget — non-blocking
    const timer = setTimeout(() => {
      router.push('/onboarding/trip-demo');
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={10} total={14} />
      </View>

      <View style={styles.content}>
        <Text style={styles.headline}>Building your driving profile…</Text>

        <View style={styles.ringWrap}>
          {started && (
            <ScoreRing score={state.seedScore} size={180} label="Your score" animate />
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
  container: { flex: 1, backgroundColor: Colors.bg },
  progress: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  headline: {
    color: '#fafafa', fontSize: 22, fontWeight: '600',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  checkMark: { color: Colors.success, fontSize: 14, fontWeight: '700' },
  checkLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
});
