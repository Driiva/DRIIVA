import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ONBOARDING_TOTAL, stepNumber } from '@/lib/onboardingFlow';
import { track } from '@/lib/analytics';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { C, F, S, R, RGB, alpha, FS, LH, T, TR } from '@/components/ui/theme';
import { scorePercentile, refundEstimateRange, DEMO_REFUND_DISCLOSURE } from '@/hooks/useTripSeed';
import { formatPoundsWhole } from '@/lib/money';

// FCA DISCLOSURE REQUIRED - refund estimates are illustrative, not guaranteed
export default function ViralMoment() {
  useEffect(() => {
    track('onboarding_step_viewed', { step: stepNumber('viral-moment'), name: 'viral-moment' });
  }, []);

  const router = useRouter();
  const { state } = useOnboarding();
  const { seedScore } = state;

  const percentile = scorePercentile(seedScore);
  // Same range calculation as quote.tsx, delegating to the real
  // projectedRefundCents. See refundEstimateRange for why the 15% cap has to
  // be applied after the spread rather than before it.
  const { min: minRefund, max: maxRefund } = refundEstimateRange(seedScore);

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
        <ProgressBar step={stepNumber('viral-moment')} total={ONBOARDING_TOTAL} />
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
            <Text style={styles.refundValue}>
              {formatPoundsWhole(minRefund * 100)} to {formatPoundsWhole(maxRefund * 100)}
            </Text>
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
            {DEMO_REFUND_DISCLOSURE}
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
    ...T.h1,
    color: C.text.hero, marginBottom: 24,
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
    color: C.text.sec, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm,
    textAlign: 'center', marginBottom: 4,
  },
  refundValue: {
    ...T.statLg,
    color: C.success,
  },
  poolRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: C.hairline,
    alignSelf: 'stretch', justifyContent: 'center',
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.success,
  },
  poolText: { color: C.text.sec, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm },
  shareBtn: {
    backgroundColor: alpha(RGB.primary, 0.15),
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: alpha(RGB.primary, 0.35),
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  shareBtnText: { color: C.primaryLight, fontSize: FS.md, fontFamily: F.bodySemiBold, lineHeight: LH.md, letterSpacing: TR.md },
  shareHint: {
    color: C.text.mut, fontFamily: F.body, fontSize: FS.sm, textAlign: 'center',
    lineHeight: LH.sm, letterSpacing: TR.sm, marginBottom: 20,
  },
  disclaimer: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    padding: 14,
  },
  disclaimerText: { color: C.text.mut, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: S.lg },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: C.text.hero, fontSize: FS.md, fontFamily: F.bodySemiBold, lineHeight: LH.md, letterSpacing: TR.md },
});
