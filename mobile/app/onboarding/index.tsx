import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { C, F, S, R, RGB, alpha } from '@/components/ui/theme';

const TOTAL = 14;

export default function Welcome() {
  const router = useRouter();
  const { setStep } = useOnboarding();

  const handleContinue = () => {
    setStep(2);
    router.push('/onboarding/goal');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={1} total={TOTAL} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Text style={styles.eyebrow}>Driiva</Text>
          <Text style={styles.headline}>Your driving is worth more than you're being paid for.</Text>
          <Text style={styles.sub}>
            Join the community where safe drivers get rewarded — not just insured.
          </Text>
        </View>

        <View style={styles.previewCard}>
          <View style={styles.leaderboardHeader}>
            <Text style={styles.leaderboardTitle}>Community pool</Text>
            <View style={styles.liveDot} />
          </View>
          {[
            { name: 'J. Williams', score: 94, refund: '£182' },
            { name: 'P. Sharma', score: 91, refund: '£167' },
            { name: 'You', score: '—', refund: '?' },
          ].map((row, i) => (
            <View key={i} style={[styles.leaderRow, i === 2 && styles.leaderRowYou]}>
              <View style={styles.leaderLeft}>
                <Text style={styles.leaderRank}>{i + 1}</Text>
                <Text style={[styles.leaderName, i === 2 && styles.leaderNameYou]}>{row.name}</Text>
              </View>
              <View style={styles.leaderRight}>
                <Text style={styles.leaderScore}>{row.score}</Text>
                <Text style={[styles.leaderRefund, i === 2 && styles.leaderRefundYou]}>{row.refund}</Text>
              </View>
            </View>
          ))}
          <View style={styles.tickerRow}>
            <View style={styles.tickerDot} />
            <Text style={styles.tickerText}>£47 refund processing now</Text>
          </View>
        </View>

        <Text style={styles.caveat}>Up to 15% of your premium back. No black box required.</Text>
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
    color: C.primary,
    fontSize: 11,
    fontFamily: F.bodySemiBold,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  headline: {
    color: C.text.hero,
    fontSize: 28,
    fontFamily: F.bodySemiBold,
    letterSpacing: -0.025,
    lineHeight: 34,
    marginBottom: 12,
  },
  sub: {
    color: C.text.sec,
    fontFamily: F.body,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: -0.005,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  leaderboardTitle: {
    color: C.text.sec,
    fontSize: 11,
    fontFamily: F.bodySemiBold,
    letterSpacing: 0.08,
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.success,
  },
  leaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  leaderRowYou: {
    backgroundColor: alpha(RGB.primary, 0.08),
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  leaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leaderRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  leaderRank: { color: C.text.mut, fontFamily: F.body, fontSize: 12, width: 16 },
  leaderName: { color: C.text.hero, fontSize: 14, fontFamily: F.bodySemiBold },
  leaderNameYou: { color: C.primaryLight, fontFamily: F.bodySemiBold },
  leaderScore: { color: C.text.sec, fontSize: 13, fontFamily: F.bodySemiBold, width: 30, textAlign: 'right' },
  leaderRefund: { color: C.success, fontSize: 14, fontFamily: F.bodyBold, width: 50, textAlign: 'right' },
  leaderRefundYou: { color: C.primaryLight },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  tickerDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: C.success,
  },
  tickerText: { color: C.text.mut, fontFamily: F.body, fontSize: 12 },
  caveat: {
    color: C.text.mut,
    fontFamily: F.body,
    fontSize: 12,
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
  primaryBtnText: { color: C.text.hero, fontSize: 15, fontFamily: F.bodySemiBold, letterSpacing: -0.005 },
  secondaryLink: {
    color: C.text.mut,
    fontFamily: F.body,
    fontSize: 14,
    textAlign: 'center',
  },
});
