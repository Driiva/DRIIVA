import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { C, F, S, R, FS, LH, TR } from '@/components/ui/theme';

// FCA DISCLOSURE REQUIRED on financial claims before launch
const ALL_SOLUTIONS = [
  {
    pain: "Never rewarded for safe driving",
    fix: "Your trip score funds your refund. Drive well, earn back up to 15% of your premium.", // ESTIMATE - subject to actuarial review
  },
  {
    pain: "Insurer keeps your data",
    fix: "Your EcoScore and Night Owl Index are yours, visible in your dashboard, always.",
  },
  {
    pain: "Black box felt invasive",
    fix: "Phone-only telematics. No hardware. No engineer visit. Just your existing device.",
  },
  {
    pain: "System feels opaque",
    fix: "Community pool is transparent: 60 to 70% covers claims, 15% surplus redistributed. You can see the maths.", // VERIFY with actuary
  },
];

export default function PersonalisedSolution() {
  const router = useRouter();
  const { state } = useOnboarding();

  const solutions = state.painPoints.length > 0
    ? ALL_SOLUTIONS.filter((_, i) => i < 3)
    : ALL_SOLUTIONS;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={6} total={14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={C.text.mut} />
        </TouchableOpacity>
        <Text style={styles.headline}>Here's how Driiva fixes exactly that.</Text>
        <Text style={styles.sub}>Matched to what you told us matters.</Text>

        <View style={styles.solutions}>
          {solutions.map((s, i) => (
            <View key={i} style={styles.solutionCard}>
              <Text style={styles.painText}>{s.pain}</Text>
              <View style={styles.arrow}>
                <Ionicons name="arrow-down" size={16} color={C.primary} />
              </View>
              <Text style={styles.fixText}>{s.fix}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/comparison')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>See the full picture</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.lg },
  back: { marginBottom: S.lg },
  headline: {
    color: C.text.hero, fontSize: FS.xxl, fontFamily: F.bodySemiBold,
    letterSpacing: TR.xxl, lineHeight: LH.xxl, marginBottom: 8,
  },
  sub: { color: C.text.sec, fontFamily: F.body, fontSize: FS.md, marginBottom: 24 },
  solutions: { gap: 12 },
  solutionCard: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
  },
  painText: {
    color: C.text.mut, fontSize: FS.sm,
    fontFamily: F.bodySemiBold, letterSpacing: -0.005,
  },
  arrow: { marginVertical: 8 },
  fixText: {
    color: C.text.hero, fontSize: FS.md,
    lineHeight: 22, fontFamily: F.body, letterSpacing: -0.005,
  },
  footer: { paddingHorizontal: S.lg, paddingBottom: S.lg },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: C.text.hero, fontSize: FS.md, fontFamily: F.bodySemiBold, letterSpacing: -0.005 },
});
