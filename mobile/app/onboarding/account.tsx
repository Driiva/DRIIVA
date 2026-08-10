import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { C, F, S, R, RGB, alpha } from '@/components/ui/theme';

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
          <ScoreRing score={state.seedScore} size={120} label="Your score" animated={false} />
        </View>

        <Text style={styles.headline}>You're in, {firstName}.</Text>
        <Text style={styles.sub}>
          Your driving profile is saved. Your score is locked in. One step left: get your quote.
        </Text>

        <View style={styles.summaryCard}>
          <SummaryRow label="Driving profile" value={state.drivingProfile.frequency} />
          <SummaryRow label="Primary goal" value={state.primaryGoal ?? 'Better value'} />
          <SummaryRow
            label="Location"
            value={state.permissions.location ? 'Enabled' : 'Not yet enabled'}
            valueColor={state.permissions.location ? C.success : C.warning}
          />
          <SummaryRow
            label="Motion"
            value={state.permissions.motion ? 'Enabled' : 'Not yet enabled'}
            valueColor={state.permissions.motion ? C.success : C.warning}
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
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 100 },
  scorePreview: { alignItems: 'center', marginBottom: 28 },
  headline: {
    color: C.text.hero, fontSize: 28, fontFamily: F.bodySemiBold,
    letterSpacing: -0.025, lineHeight: 34, marginBottom: 10,
  },
  sub: {
    color: C.text.sec, fontFamily: F.body, fontSize: 15, lineHeight: 23, marginBottom: 28,
  },
  summaryCard: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
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
    borderBottomColor: C.hairline,
  },
  summaryLabel: { color: C.text.sec, fontFamily: F.body, fontSize: 14 },
  summaryValue: { color: C.text.hero, fontSize: 14, fontFamily: F.bodySemiBold },
  shariahBadge: {
    backgroundColor: alpha(RGB.primary, 0.08),
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: alpha(RGB.primary, 0.18),
    padding: 14,
  },
  shariahText: { color: C.text.mut, fontFamily: F.body, fontSize: 13, lineHeight: 19 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: S.lg },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: C.text.hero, fontSize: 15, fontFamily: F.bodySemiBold, letterSpacing: -0.005 },
});
