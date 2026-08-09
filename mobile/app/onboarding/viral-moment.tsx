import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ScoreRing } from '@/components/onboarding/ScoreRing';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { refundEstimate, scorePercentile } from '@/hooks/useTripSeed';

// FCA DISCLOSURE REQUIRED — refund estimates are illustrative, not guaranteed
export default function ViralMoment() {
  const router = useRouter();
  const { state } = useOnboarding();
  const { seedScore } = state;

  const percentile = scorePercentile(seedScore);
  const refund = refundEstimate(seedScore); // ESTIMATE — subject to actuarial review
  const minRefund = Math.round(refund * 0.8);
  const maxRefund = Math.round(refund * 1.2);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just scored ${seedScore}/100 on Driiva — a fairer way to do car insurance that gives safe drivers their premium back. Join the waitlist: driiva.co.uk`,
        title: `My Driiva Score: ${seedScore}/100`,
      });
    } catch {
      // user dismissed sheet
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={12} total={14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>
          {`Score: ${seedScore}/100 — you'd be in the top ${percentile}% of the Driiva community.`}
        </Text>

        <View style={styles.heroCard}>
          <View style={styles.ringWrap}>
            <ScoreRing score={seedScore} size={160} label="Your score" animate={false} />
          </View>

          <View style={styles.refundRow}>
            <Text style={styles.refundLabel}>Estimated annual refund at this score</Text>
            {/* ESTIMATE — subject to actuarial review */}
            <Text style={styles.refundValue}>£{minRefund}–£{maxRefund}</Text>
          </View>

          <View style={styles.poolRow}>
            <View style={styles.liveDot} />
            <Text style={styles.poolText}>Your pool opens when the product goes live.</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
          <Text style={styles.shareBtnText}>Share my Driiva score</Text>
        </TouchableOpacity>

        <Text style={styles.shareHint}>
          Every share brings another safe driver into your community pool — growing everyone's refund.
        </Text>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {/* FCA DISCLOSURE REQUIRED before public launch */}
            Refund estimates are illustrative and based on typical premium of £1,200/year.
            Actual refunds depend on your policy, claim history, and pool performance.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/account')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>Save my score</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  progress: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 100 },
  headline: {
    color: '#fafafa', fontSize: 22, fontWeight: '600',
    letterSpacing: -0.025, lineHeight: 30, marginBottom: 24,
  },
  heroCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(107,95,220,0.25)',
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  ringWrap: { marginBottom: 24 },
  refundRow: { alignItems: 'center', marginBottom: 16 },
  refundLabel: {
    color: 'rgba(255,255,255,0.45)', fontSize: 12,
    textAlign: 'center', marginBottom: 4,
  },
  refundValue: {
    color: Colors.success, fontSize: 28, fontWeight: '700',
    letterSpacing: -0.03,
  },
  poolRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'stretch', justifyContent: 'center',
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success,
  },
  poolText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  shareBtn: {
    backgroundColor: 'rgba(107,95,220,0.15)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(107,95,220,0.35)',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  shareBtnText: { color: Colors.primaryLight, fontSize: 15, fontWeight: '600' },
  shareHint: {
    color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center',
    lineHeight: 19, marginBottom: 20,
  },
  disclaimer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.lg,
    padding: 14,
  },
  disclaimerText: { color: 'rgba(255,255,255,0.25)', fontSize: 12, lineHeight: 18 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.lg },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600', letterSpacing: -0.005 },
});
