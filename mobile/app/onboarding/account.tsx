import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ScoreRing } from '@/components/onboarding/ScoreRing';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

export default function Account() {
  const router = useRouter();
  const { user } = useAuth();
  const { state } = useOnboarding();

  const firstName = user?.name?.split(' ')[0] ?? 'Driver';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={13} total={14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.scorePreview}>
          <ScoreRing score={state.seedScore} size={120} label="Your score" animate={false} />
        </View>

        <Text style={styles.headline}>You're in, {firstName}.</Text>
        <Text style={styles.sub}>
          Your driving profile is saved. Your score is locked in. One step left — get your quote.
        </Text>

        <View style={styles.summaryCard}>
          <SummaryRow label="Driving profile" value={state.drivingProfile.frequency} />
          <SummaryRow label="Primary goal" value={state.primaryGoal ?? 'Better value'} />
          <SummaryRow
            label="Location"
            value={state.permissions.location ? 'Enabled' : 'Not yet enabled'}
            valueColor={state.permissions.location ? Colors.success : Colors.warning}
          />
          <SummaryRow
            label="Motion"
            value={state.permissions.motion ? 'Enabled' : 'Not yet enabled'}
            valueColor={state.permissions.motion ? Colors.success : Colors.warning}
            last
          />
        </View>

        <View style={styles.shariahBadge}>
          <Text style={styles.shariahText}>
            Our insurance product is pending FCA authorisation. Driiva is structured as a
            Shariah-compliant mutual benefit pool. No interest, no speculation.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/quote')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>Get my quote</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({
  label, value, valueColor, last,
}: {
  label: string; value: string; valueColor?: string; last?: boolean;
}) {
  return (
    <View style={[styles.summaryRow, !last && styles.summaryRowBorder]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : undefined]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  progress: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 100 },
  scorePreview: { alignItems: 'center', marginBottom: 28 },
  headline: {
    color: '#fafafa', fontSize: 28, fontWeight: '600',
    letterSpacing: -0.025, lineHeight: 34, marginBottom: 10,
  },
  sub: {
    color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 23, marginBottom: 28,
  },
  summaryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  summaryRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  summaryLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  summaryValue: { color: '#fafafa', fontSize: 14, fontWeight: '500' },
  shariahBadge: {
    backgroundColor: 'rgba(107,95,220,0.08)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(107,95,220,0.18)',
    padding: 14,
  },
  shariahText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 19 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.lg },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600', letterSpacing: -0.005 },
});
