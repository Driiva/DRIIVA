import { useEffect } from 'react';
/**
 * Onboarding step 4 - why Driiva works this way.
 *
 * Wave 0 (0a): this screen was entirely invented. Three testimonials from
 * named people who do not exist (Meera 24, Jordan 27, Marcus 31) with quoted
 * praise and driver scores, a hardcoded waitlist-count headline carrying the
 * same invented figure that turned up in four other places, an invented
 * average-refund stat and an invented average-score stat. None of it came from
 * data. Presented in an FCA-sensitive insurance funnel, invented reviews and
 * invented performance figures are not placeholder copy.
 *
 * The figures themselves are deliberately not repeated here. This file is
 * linted, and an allowlist entry naming the exact literal would suppress the
 * same literal if it ever came back as rendered copy in this file, which for
 * that particular number is not a hypothetical.
 *
 * The route is kept so the 14-step flow and its ProgressBar are unchanged.
 * It now explains the model rather than fake-crowding it. Real reviews and a
 * real waitlist count can return here once either exists.
 */
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ONBOARDING_TOTAL, stepNumber } from '@/lib/onboardingFlow';
import { track } from '@/lib/analytics';
import { C, F, S, R, FS, LH, TR, T } from '@/components/ui/theme';

const PRINCIPLES = [
  {
    title: 'Your score sets your price.',
    body: 'Not your postcode, not your age bracket. We measure how you actually drive and the number moves with you.',
  },
  {
    title: 'The pool is shared, not kept.',
    body: 'Contributions sit in a community pool. What is not paid out in claims comes back to safe drivers rather than becoming margin.',
  },
  {
    title: 'No interest, no speculation.',
    body: 'The pool is structured as a Shariah-compliant mutual benefit model.',
  },
];

export default function SocialProof() {
  useEffect(() => {
    track('onboarding_step_viewed', { step: stepNumber('social-proof'), name: 'social-proof' });
  }, []);

  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={stepNumber('social-proof')} total={ONBOARDING_TOTAL} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={C.text.mut} />
        </TouchableOpacity>

        <Text style={styles.headline}>Insurance that pays attention.</Text>
        <Text style={styles.sub}>Three things that make Driiva different.</Text>

        <View style={styles.list}>
          {PRINCIPLES.map((principle) => (
            <View key={principle.title} style={styles.card}>
              <Text style={styles.cardTitle}>{principle.title}</Text>
              <Text style={styles.cardBody}>{principle.body}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.disclaimer}>
          Driiva is operated by Driiva Ltd, which is working towards the FCA regulatory
          sandbox. We are not authorised and not operating under an MGA.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/tinder')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: { flex: 1, paddingTop: S.md, paddingHorizontal: S.lg },
  back: { marginBottom: S.lg },
  headline: {
    ...T.h0,
    color: C.text.hero, marginBottom: 8,
  },
  sub: { color: C.text.sec, fontFamily: F.body, fontSize: FS.md, lineHeight: LH.md, letterSpacing: TR.md, marginBottom: 24 },

  list: { gap: 12 },
  card: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
  },
  cardTitle: { color: C.text.hero, fontSize: FS.md, fontFamily: F.bodySemiBold, lineHeight: LH.md, letterSpacing: TR.md, marginBottom: 6 },
  cardBody: { color: C.text.sec, fontFamily: F.body, fontSize: FS.md, lineHeight: LH.md, letterSpacing: TR.md },

  disclaimer: {
    color: C.text.mut, fontFamily: F.body, fontSize: FS.sm,
    lineHeight: LH.sm, letterSpacing: TR.sm, marginTop: S.lg,
  },

  footer: { paddingHorizontal: S.lg, paddingBottom: S.lg },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: C.text.hero, fontSize: FS.md, fontFamily: F.bodySemiBold, lineHeight: LH.md, letterSpacing: TR.md },
});
