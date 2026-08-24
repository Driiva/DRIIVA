import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { C, F, S, R, RGB, alpha, FS, LH, TR, T } from '@/components/ui/theme';
import { refundEstimateRange, DEMO_REFUND_DISCLOSURE } from '@/hooks/useTripSeed';
import { formatPoundsWhole } from '@/lib/money';
import { joinWaitlist, WaitlistError } from '@/lib/waitlist';

// FCA DISCLOSURE REQUIRED - all financial figures are illustrative before product launch
// TODO: Root Platform API integration - Sprint 5
export default function Quote() {
  const router = useRouter();
  const { user, markOnboardingComplete } = useAuth();
  const { state } = useOnboarding();
  const [waitlistEmail, setWaitlistEmail] = useState(user?.email ?? '');
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);

  // One range calculation, shared with viral-moment.tsx, delegating to the
  // real projectedRefundCents. The hand-rolled `refund * 0.8` and `* 1.2` that
  // used to live here widened a figure already scaled to the 15% ceiling, so
  // the top of the displayed range sat ABOVE the cap. A cap applied before the
  // spread is not a cap.
  const { min: minRefund, max: maxRefund } = refundEstimateRange(state.seedScore);

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
          <ScoreRing score={state.seedScore} size={120} label="Your score" animated={false} />
          <View style={styles.refundEstimate}>
            <Text style={styles.refundLabel}>Drive like today, earn back</Text>
            <Text style={styles.refundRange}>
              {formatPoundsWhole(minRefund * 100)} to {formatPoundsWhole(maxRefund * 100)} this year
            </Text>
            <Text style={styles.refundBasis}>{DEMO_REFUND_DISCLOSURE}</Text>
          </View>
        </View>

        {/* TODO: Root Platform API - Sprint 5 */}
        <View style={styles.quoteStub}>
          <Text style={styles.quoteStubEyebrow}>Quote</Text>
          <Text style={styles.quoteStubTitle}>Launching soon.</Text>
          <Text style={styles.quoteStubSub}>
            Driiva Ltd is not authorised by the FCA and our insurance product is pending FCA
            authorisation. Join the waitlist and you will be first to get a live quote.
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
            Driiva is operated by Driiva Ltd, which is not authorised by the FCA. Our insurance product is pending FCA authorisation.
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
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: 120 },
  headline: {
    ...T.h0,
    color: C.text.hero, marginBottom: 24,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: C.surface1,
    borderRadius: R.sheet,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    marginBottom: 16,
  },
  refundEstimate: { flex: 1 },
  refundBasis: { ...T.caption, color: C.text.mut, marginTop: S.sm },
  refundLabel: { color: C.text.sec, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm, marginBottom: 6 },
  refundRange: { ...T.stat, color: C.success },
  quoteStub: {
    backgroundColor: alpha(RGB.primary, 0.08),
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: alpha(RGB.primary, 0.2),
    padding: 20,
    marginBottom: 16,
  },
  quoteStubEyebrow: {
    ...T.eyebrow,
    color: C.primaryLight, marginBottom: 6,
  },
  quoteStubTitle: { color: C.text.hero, fontSize: FS.xl, fontFamily: F.bodySemiBold, lineHeight: LH.xl, letterSpacing: TR.xl, marginBottom: 8 },
  quoteStubSub: { color: C.text.sec, fontFamily: F.body, fontSize: FS.md, lineHeight: LH.md, letterSpacing: TR.md },
  waitlistCard: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    marginBottom: 16,
  },
  waitlistTitle: { color: C.text.hero, fontSize: FS.base, fontFamily: F.bodySemiBold, lineHeight: LH.base, letterSpacing: TR.base, marginBottom: 4 },
  waitlistSub: { color: C.text.mut, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm, marginBottom: 16 },
  emailInput: {
    backgroundColor: C.surface2,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: F.body,
    fontSize: FS.md,
    lineHeight: LH.md,
    letterSpacing: TR.md,
    color: C.text.hero,
    marginBottom: 12,
  },
  waitlistBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 13, alignItems: 'center',
  },
  waitlistBtnDisabled: { opacity: 0.5 },
  waitlistBtnText: { color: C.text.hero, fontSize: FS.md, fontFamily: F.bodySemiBold, lineHeight: LH.md, letterSpacing: TR.md },
  joinedBadge: {
    backgroundColor: alpha(RGB.success, 0.12),
    borderRadius: R.card,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: alpha(RGB.success, 0.25),
  },
  joinedText: { color: C.success, fontSize: FS.md, fontFamily: F.bodySemiBold, lineHeight: LH.md, letterSpacing: TR.md },
  waitlistErrorText: {
    color: C.error, fontFamily: F.body, fontSize: FS.sm,
    marginTop: 10, lineHeight: LH.sm, letterSpacing: TR.sm,
  },
  disclaimer: { padding: 2 },
  disclaimerText: { color: C.text.mut, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: S.lg, gap: 12,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: C.text.hero, fontSize: FS.md, fontFamily: F.bodySemiBold, lineHeight: LH.md, letterSpacing: TR.md },
  skipText: { color: C.text.mut, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm, textAlign: 'center' },
});
