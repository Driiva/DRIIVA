import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

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
  container: { flex: 1, backgroundColor: Colors.bg },
  progress: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.lg },
  top: { marginBottom: 28 },
  eyebrow: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  headline: {
    color: '#fafafa',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.025,
    lineHeight: 34,
    marginBottom: 12,
  },
  sub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: -0.005,
  },
  previewCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.08,
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  leaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  leaderRowYou: {
    backgroundColor: 'rgba(107,95,220,0.08)',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  leaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leaderRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  leaderRank: { color: 'rgba(255,255,255,0.3)', fontSize: 12, width: 16 },
  leaderName: { color: '#fafafa', fontSize: 14, fontWeight: '500' },
  leaderNameYou: { color: Colors.primaryLight, fontWeight: '600' },
  leaderScore: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', width: 30, textAlign: 'right' },
  leaderRefund: { color: Colors.success, fontSize: 14, fontWeight: '700', width: 50, textAlign: 'right' },
  leaderRefundYou: { color: Colors.primaryLight },
  tickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  tickerDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success,
  },
  tickerText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
  caveat: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600', letterSpacing: -0.005 },
  secondaryLink: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    textAlign: 'center',
  },
});
