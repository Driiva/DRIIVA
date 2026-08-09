/**
 * Onboarding step 4 - why Driiva works this way.
 *
 * Wave 0 (0a): this screen was entirely invented. Three testimonials from
 * named people who do not exist (Meera 24, Jordan 27, Marcus 31) with quoted
 * praise and driver scores, a "117 drivers already on the waitlist" headline,
 * a "£162 avg refund est." stat and a "4.9 avg score" stat. None of it came
 * from data. Presented in an FCA-sensitive insurance funnel, invented reviews
 * and invented performance figures are not placeholder copy.
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
import { C, F, S, R } from '@/components/ui/theme';

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
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={4} total={14} />
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
          Driiva is operated by Driiva Ltd. Our insurance product is pending FCA
          authorisation.
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
    color: C.text.hero, fontSize: 26, fontFamily: F.bodySemiBold,
    letterSpacing: -0.025, lineHeight: 32, marginBottom: 8,
  },
  sub: { color: C.text.sec, fontFamily: F.body, fontSize: 15, marginBottom: 24 },

  list: { gap: 12 },
  card: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
  },
  cardTitle: { color: C.text.hero, fontSize: 15, fontFamily: F.bodySemiBold, marginBottom: 6 },
  cardBody: { color: C.text.sec, fontFamily: F.body, fontSize: 14, lineHeight: 21 },

  disclaimer: {
    color: C.text.mut, fontFamily: F.body, fontSize: 12,
    lineHeight: 18, marginTop: S.lg,
  },

  footer: { paddingHorizontal: S.lg, paddingBottom: S.lg },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: C.text.hero, fontSize: 15, fontFamily: F.bodySemiBold, letterSpacing: -0.005 },
});
