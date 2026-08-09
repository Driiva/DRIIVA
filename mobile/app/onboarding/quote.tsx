import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ScoreRing } from '@/components/onboarding/ScoreRing';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { refundEstimate } from '@/hooks/useTripSeed';
import { joinWaitlist, WaitlistError } from '@/lib/waitlist';

// FCA DISCLOSURE REQUIRED - all financial figures are illustrative before product launch
// TODO: Root Platform API integration — Sprint 5
export default function Quote() {
  const router = useRouter();
  const { user, markOnboardingComplete } = useAuth();
  const { state } = useOnboarding();
  const [waitlistEmail, setWaitlistEmail] = useState(user?.email ?? '');
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  const refund = refundEstimate(state.seedScore); // ESTIMATE — subject to actuarial review
  const minRefund = Math.round(refund * 0.8);
  const maxRefund = Math.round(refund * 1.2);

  const handleGetQuote = async () => {
    // TODO: Root Platform API - Sprint 5. Launch quote journey here.
    // Wave 0 (0d): this used to promise an email to people whose address was
    // never captured. It now points at the waitlist, which does store one.
    Alert.alert(
      'Quotes are not live yet',
      'Join the waitlist above with your email and we will contact you when quotes open.',
      [{ text: 'Got it' }]
    );
  };

  const handleJoinWaitlist = async () => {
    if (!waitlistEmail.trim() || loading) return;
    setLoading(true);
    setWaitlistError(null);
    try {
      // Wave 0 (0d): the confirmation below renders only after this resolves.
      // Any failure surfaces as an error, never as a tick.
      await joinWaitlist(waitlistEmail);
      setJoined(true);
    } catch (err) {
      const message = err instanceof WaitlistError
        ? err.message
        : 'We could not save your place. Try again.';
      setWaitlistError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    await markOnboardingComplete();
    router.replace('/(tabs)/dashboard');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={14} total={14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.headline}>Your policy. Your community. Your refund.</Text>

        <View style={styles.scoreCard}>
          <ScoreRing score={state.seedScore} size={120} label="Your score" animate={false} />
          <View style={styles.refundEstimate}>
            <Text style={styles.refundLabel}>Drive like today — earn back</Text>
            {/* ESTIMATE — subject to actuarial review */}
            <Text style={styles.refundRange}>£{minRefund}–£{maxRefund} this year</Text>
          </View>
        </View>

        {/* TODO: Root Platform API — Sprint 5 */}
        <View style={styles.quoteStub}>
          <Text style={styles.quoteStubEyebrow}>Quote</Text>
          <Text style={styles.quoteStubTitle}>Launching soon.</Text>
          <Text style={styles.quoteStubSub}>
            Our insurance product is pending FCA authorisation. Join the waitlist
            and you'll be first to get a live quote.
          </Text>
        </View>

        <View style={styles.waitlistCard}>
          <Text style={styles.waitlistTitle}>Join the waitlist</Text>
          {/*
            Wave 0 (0a): "117 drivers ahead of you" was a string literal shown
            to every user forever, next to a join button that stored nothing.
            No queue position is claimed until there is a real one to read.
          */}
          <Text style={styles.waitlistSub}>
            We'll email you when quotes open in your area.
          </Text>
          <TextInput
            style={styles.emailInput}
            value={waitlistEmail}
            onChangeText={setWaitlistEmail}
            placeholder="Your email"
            placeholderTextColor="rgba(255,255,255,0.25)"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!joined}
          />
          {joined ? (
            <View style={styles.joinedBadge}>
              <Text style={styles.joinedText}>You're on the list</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.waitlistBtn, loading && styles.waitlistBtnDisabled]}
                onPress={handleJoinWaitlist}
                activeOpacity={0.8}
                disabled={loading}
              >
                <Text style={styles.waitlistBtnText}>
                  {loading ? 'Saving' : 'Join waitlist'}
                </Text>
              </TouchableOpacity>
              {waitlistError !== null && (
                <Text style={styles.waitlistErrorText}>{waitlistError}</Text>
              )}
            </>
          )}
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            {/* FCA DISCLOSURE REQUIRED */}
            Driiva is operated by Driiva Ltd. Our insurance product is pending FCA authorisation.
            Refund estimates are illustrative and do not constitute a binding offer. Terms apply.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleGetQuote} activeOpacity={0.8}>
          <Text style={styles.primaryBtnText}>Get notified when quotes go live</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleComplete}>
          <Text style={styles.skipText}>Go to my dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  progress: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 120 },
  headline: {
    color: '#fafafa', fontSize: 26, fontWeight: '600',
    letterSpacing: -0.025, lineHeight: 32, marginBottom: 24,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    marginBottom: 16,
  },
  refundEstimate: { flex: 1 },
  refundLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 6 },
  refundRange: { color: Colors.success, fontSize: 22, fontWeight: '700', letterSpacing: -0.02 },
  quoteStub: {
    backgroundColor: 'rgba(107,95,220,0.08)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(107,95,220,0.2)',
    padding: 20,
    marginBottom: 16,
  },
  quoteStubEyebrow: {
    color: Colors.primaryLight, fontSize: 10, fontWeight: '600',
    letterSpacing: 0.1, textTransform: 'uppercase', marginBottom: 6,
  },
  quoteStubTitle: { color: '#fafafa', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  quoteStubSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 20 },
  waitlistCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
    marginBottom: 16,
  },
  waitlistTitle: { color: '#fafafa', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  waitlistSub: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 16 },
  emailInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#fafafa',
    marginBottom: 12,
  },
  waitlistBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 13, alignItems: 'center',
  },
  waitlistBtnDisabled: { opacity: 0.5 },
  waitlistBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600' },
  joinedBadge: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
  },
  joinedText: { color: Colors.success, fontSize: 15, fontWeight: '600' },
  waitlistErrorText: {
    color: Colors.error, fontSize: 13,
    marginTop: 10, lineHeight: 18,
  },
  disclaimer: { padding: 2 },
  disclaimerText: { color: 'rgba(255,255,255,0.2)', fontSize: 12, lineHeight: 18 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.lg, gap: 12,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600', letterSpacing: -0.005 },
  skipText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, textAlign: 'center' },
});
