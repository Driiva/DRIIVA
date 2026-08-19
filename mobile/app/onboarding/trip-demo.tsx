import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ONBOARDING_TOTAL, stepNumber } from '@/lib/onboardingFlow';
import { track } from '@/lib/analytics';
import { TripReplay } from '@/components/onboarding/TripReplay';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { C, F, S, R, RGB, alpha, FS, LH, TR } from '@/components/ui/theme';
import { ecoGrade } from '@/hooks/useTripSeed';

export default function TripDemo() {
  useEffect(() => {
    track('onboarding_step_viewed', { step: stepNumber('trip-demo'), name: 'trip-demo' });
  }, []);

  const router = useRouter();
  const { state } = useOnboarding();
  const [phase, setPhase] = useState<'replay' | 'result'>('replay');

  const handleReplayComplete = () => {
    setTimeout(() => setPhase('result'), 300);
  };

  const grade = ecoGrade(state.seedScore);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={stepNumber('trip-demo')} total={ONBOARDING_TOTAL} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>
          {phase === 'replay' ? 'Your first trip.' : 'Your first trip: complete.'}
        </Text>
        <Text style={styles.sub}>
          {phase === 'replay'
            ? 'Driiva scored your drive silently in the background.'
            : "Here's how you did."}
        </Text>

        {phase === 'replay' && (
          <TripReplay onComplete={handleReplayComplete} />
        )}

        {phase === 'result' && (
          <View style={styles.result}>
            <View style={styles.ringWrap}>
              <ScoreRing score={state.seedScore} size={180} label="Trip score" animated />
            </View>

            <View style={styles.ecoCard}>
              <Text style={styles.ecoLabel}>Eco grade</Text>
              <Text style={styles.ecoGrade}>{grade}</Text>
              <Text style={styles.ecoSub}>Eco Driver</Text>
            </View>

            <View style={styles.breakdown}>
              <BreakdownRow label="Smooth braking" value="+8 pts" />
              <BreakdownRow label="Speed limit observed" value="+5 pts" />
              <BreakdownRow label="Eco-efficient acceleration" value="+4 pts" />
              <BreakdownRow label="Night Owl detected (11 pm)" value="+2 pts" special />
            </View>

            <Text style={styles.simNote}>
              {/* Simulated score - not based on actual driving data until account is active */}
              Score simulated based on your driving profile. Real scores activate after your first live trip.
            </Text>
          </View>
        )}
      </ScrollView>

      {phase === 'result' && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/onboarding/viral-moment')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>See how I rank</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function BreakdownRow({ label, value, special }: { label: string; value: string; special?: boolean }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={[styles.breakdownValue, special && styles.breakdownValueSpecial]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 100 },
  headline: {
    color: C.text.hero, fontSize: FS.xxl, fontFamily: F.bodySemiBold,
    letterSpacing: TR.xxl, lineHeight: LH.xxl, marginBottom: 6,
  },
  sub: {
    color: C.text.sec, fontFamily: F.body, fontSize: FS.md, marginBottom: 24,
  },
  result: { gap: 16 },
  ringWrap: { alignItems: 'center', paddingVertical: 8 },
  ecoCard: {
    backgroundColor: alpha(RGB.success, 0.08),
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: alpha(RGB.success, 0.2),
    padding: 18,
    alignItems: 'center',
  },
  ecoLabel: {
    color: C.text.mut, fontSize: FS.xs, fontFamily: F.bodySemiBold,
    letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 4,
  },
  ecoGrade: { color: C.success, fontSize: FS.xxxl, fontFamily: F.bodyBold, letterSpacing: -0.03 },
  ecoSub: { color: C.success, fontFamily: F.body, fontSize: FS.sm, marginTop: 2 },
  breakdown: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  breakdownLabel: { color: C.text.pri, fontFamily: F.body, fontSize: FS.md },
  breakdownValue: { color: C.success, fontSize: FS.md, fontFamily: F.bodySemiBold },
  breakdownValueSpecial: { color: C.warning },
  simNote: {
    color: C.text.mut, fontFamily: F.body, fontSize: FS.sm,
    lineHeight: 18, textAlign: 'center',
    paddingHorizontal: 8,
  },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: S.lg },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: C.text.hero, fontSize: FS.md, fontFamily: F.bodySemiBold, letterSpacing: -0.005 },
});
