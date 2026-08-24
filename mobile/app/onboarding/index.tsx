import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ONBOARDING_TOTAL, stepNumber } from '@/lib/onboardingFlow';
import { track } from '@/lib/analytics';
import { C, F, S, R, FS, T, LH, TR } from '@/components/ui/theme';


/**
 * The proposition, stated plainly. This card used to be a mock leaderboard
 * with two invented drivers, two invented refunds and a ticker claiming a
 * GBP 47 refund was processing. None of it was real, and Driiva has never
 * paid a refund, so the first screen a driver saw opened with a fabrication.
 */
const STEPS = [
  { title: 'Drive as you already do', text: 'Your phone scores each trip. No black box to fit.' },
  { title: 'Your score sets your share', text: 'Safer driving earns a larger share of the community pool.' },
  { title: 'The surplus comes back', text: 'What the pool does not pay out in claims returns to safe drivers.' },
];

export default function Welcome() {
  useEffect(() => {
    // Both: the funnel needs a denominator, and the first step needs a view.
    track('onboarding_started');
    track('onboarding_step_viewed', { step: stepNumber('index'), name: 'index' });
  }, []);

  const router = useRouter();
  const { setStep } = useOnboarding();

  const handleContinue = () => {
    setStep(2);
    router.push('/onboarding/goal');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={stepNumber('index')} total={ONBOARDING_TOTAL} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Text style={styles.eyebrow}>Driiva</Text>
          <Text style={styles.headline}>Your driving is worth more than you're being paid for.</Text>
          <Text style={styles.sub}>
            Safe drivers subsidise risky ones. Driiva is built the other way round.
          </Text>
        </View>

        <View style={styles.previewCard}>
          <View style={styles.leaderboardHeader}>
            <Text style={styles.leaderboardTitle}>How it works</Text>
          </View>
          {STEPS.map((step, i) => (
            <View key={step.title} style={[styles.stepRow, i === STEPS.length - 1 && styles.stepRowLast]}>
              <Text style={styles.stepIndex}>{i + 1}</Text>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.caveat}>
          Refunds depend on your policy, your claims and how the pool performs. Driiva Ltd is
          not authorised by the FCA and our insurance product is pending FCA authorisation.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue} activeOpacity={0.8}>
          <Text style={styles.primaryBtnText}>See how it works</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(auth)/signin')}>
          <Text style={styles.secondaryLink}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: { paddingHorizontal: S.lg, paddingTop: S.xl, paddingBottom: S.lg },
  top: { marginBottom: 28 },
  eyebrow: {
    ...T.eyebrow,
    color: C.primary,
    marginBottom: 12,
  },
  headline: {
    ...T.h0,
    color: C.text.hero,
    marginBottom: 12,
  },
  sub: {
    color: C.text.sec,
    fontFamily: F.body,
    fontSize: FS.md,
    lineHeight: LH.md,
    letterSpacing: TR.md,
  },
  previewCard: {
    backgroundColor: C.surface1,
    borderRadius: R.sheet,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    marginBottom: 16,
  },
  leaderboardHeader: {
    marginBottom: 14,
  },
  leaderboardTitle: {
    ...T.eyebrow,
    color: C.text.sec,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  stepRowLast: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 },
  stepIndex: {
    ...T.numberSm,
    color: C.text.mut,
    width: 14,
  },
  stepBody: { flex: 1, minWidth: 0 },
  stepTitle: { color: C.text.hero, fontFamily: F.bodySemiBold, fontSize: FS.md, lineHeight: LH.md, letterSpacing: TR.md },
  stepText: { color: C.text.sec, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm, marginTop: 2 },
  caveat: {
    color: C.text.mut,
    fontFamily: F.body,
    fontSize: FS.sm,
    lineHeight: LH.sm,
    letterSpacing: TR.sm,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: S.lg,
    paddingBottom: S.lg,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: R.card,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: C.text.hero, fontSize: FS.md, fontFamily: F.bodySemiBold, lineHeight: LH.md, letterSpacing: TR.md },
  secondaryLink: {
    color: C.text.mut,
    fontFamily: F.body,
    fontSize: FS.md,
    lineHeight: LH.md,
    letterSpacing: TR.md,
    textAlign: 'center',
  },
});
