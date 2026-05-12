import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { TripReplay } from '@/components/onboarding/TripReplay';
import { ScoreRing } from '@/components/onboarding/ScoreRing';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { ecoGrade } from '@/hooks/useTripSeed';

export default function TripDemo() {
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
        <ProgressBar step={11} total={14} />
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
              <ScoreRing score={state.seedScore} size={180} label="Trip score" animate />
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
              {/* Simulated score — not based on actual driving data until account is active */}
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
  container: { flex: 1, backgroundColor: Colors.bg },
  progress: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 100 },
  headline: {
    color: '#fafafa', fontSize: 24, fontWeight: '600',
    letterSpacing: -0.025, lineHeight: 30, marginBottom: 6,
  },
  sub: {
    color: 'rgba(255,255,255,0.45)', fontSize: 15, marginBottom: 24,
  },
  result: { gap: 16 },
  ringWrap: { alignItems: 'center', paddingVertical: 8 },
  ecoCard: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    padding: 18,
    alignItems: 'center',
  },
  ecoLabel: {
    color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600',
    letterSpacing: 0.08, textTransform: 'uppercase', marginBottom: 4,
  },
  ecoGrade: { color: Colors.success, fontSize: 36, fontWeight: '700', letterSpacing: -0.03 },
  ecoSub: { color: Colors.success, fontSize: 13, marginTop: 2 },
  breakdown: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  breakdownLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 14 },
  breakdownValue: { color: Colors.success, fontSize: 14, fontWeight: '600' },
  breakdownValueSpecial: { color: Colors.warning },
  simNote: {
    color: 'rgba(255,255,255,0.25)', fontSize: 12,
    lineHeight: 18, textAlign: 'center',
    paddingHorizontal: 8,
  },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.lg },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600', letterSpacing: -0.005 },
});
