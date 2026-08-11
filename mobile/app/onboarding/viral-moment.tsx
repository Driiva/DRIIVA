import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { C, F, S, R, RGB, alpha, FS, LH } from '@/components/ui/theme';
import { refundEstimate, scorePercentile } from '@/hooks/useTripSeed';

// FCA DISCLOSURE REQUIRED - refund estimates are illustrative, not guaranteed
export default function ViralMoment() {
  const router = useRouter();
  const { state } = useOnboarding();
  const { seedScore } = state;

  const percentile = scorePercentile(seedScore);
  const refund = refundEstimate(seedScore); // ESTIMATE - subject to actuarial review
  const minRefund = Math.round(refund * 0.8);
  const maxRefund = Math.round(refund * 1.2);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I just scored ${seedScore}/100 on Driiva, a fairer way to do car insurance that gives safe drivers their premium back. Join the waitlist: driiva.co.uk`,
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
          {`Score: ${seedScore}/100. You would be in the top ${percentile}% of the Driiva community.`}
        </Text>

        <View style={styles.heroCard}>
          <View style={styles.ringWrap}>
            <ScoreRing score={seedScore} size={160} label="Your score" animated={false} />
          </View>

          <View style={styles.refundRow}>
            <Text style={styles.refundLabel}>Estimated annual refund at this score</Text>
            {/* ESTIMATE - subject to actuarial review */}
            <Text style={styles.refundValue}>£{minRefund} to £{maxRefund}</Text>
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
          Every share brings another safe driver into your community pool, which grows everyone's refund.
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
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 100 },
  headline: {
    color: C.text.hero, fontSize: FS.xl, fontFamily: F.bodySemiBold,
    letterSpacing: -0.025, lineHeight: 30, marginBottom: 24,
  },
  heroCard: {
    backgroundColor: C.surface1,
    borderRadius: R.sheet,
    borderWidth: 1,
    borderColor: alpha(RGB.primary, 0.25),
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  ringWrap: { marginBottom: 24 },
  refundRow: { alignItems: 'center', marginBottom: 16 },
  refundLabel: {
    color: C.text.sec, fontFamily: F.body, fontSize: FS.sm,
    textAlign: 'center', marginBottom: 4,
  },
  refundValue: {
    color: C.success, fontSize: FS.xxl, fontFamily: F.bodyBold,
    letterSpacing: -0.03,
  },
  poolRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: C.hairline,
    alignSelf: 'stretch', justifyContent: 'center',
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.success,
  },
  poolText: { color: C.text.sec, fontFamily: F.body, fontSize: FS.sm },
  shareBtn: {
    backgroundColor: alpha(RGB.primary, 0.15),
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: alpha(RGB.primary, 0.35),
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  shareBtnText: { color: C.primaryLight, fontSize: FS.md, fontFamily: F.bodySemiBold },
  shareHint: {
    color: C.text.mut, fontFamily: F.body, fontSize: FS.sm, textAlign: 'center',
    lineHeight: 19, marginBottom: 20,
  },
  disclaimer: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    padding: 14,
  },
  disclaimerText: { color: C.text.mut, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: S.lg },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: C.text.hero, fontSize: FS.md, fontFamily: F.bodySemiBold, letterSpacing: -0.005 },
});
