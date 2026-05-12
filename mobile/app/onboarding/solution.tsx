import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

// FCA DISCLOSURE REQUIRED on financial claims before launch
const ALL_SOLUTIONS = [
  {
    pain: "Never rewarded for safe driving",
    fix: "Your trip score funds your refund. Drive well, earn back up to 15% of your premium.", // ESTIMATE — subject to actuarial review
  },
  {
    pain: "Insurer keeps your data",
    fix: "Your EcoScore and Night Owl Index are yours — visible in your dashboard, always.",
  },
  {
    pain: "Black box felt invasive",
    fix: "Phone-only telematics. No hardware. No engineer visit. Just your existing device.",
  },
  {
    pain: "System feels opaque",
    fix: "Community pool is transparent: 60–70% covers claims, 15% surplus redistributed. You can see the maths.", // VERIFY with actuary
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
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headline}>Here's how Driiva fixes exactly that.</Text>
        <Text style={styles.sub}>Matched to what you told us matters.</Text>

        <View style={styles.solutions}>
          {solutions.map((s, i) => (
            <View key={i} style={styles.solutionCard}>
              <Text style={styles.painText}>{s.pain}</Text>
              <View style={styles.arrow}>
                <Text style={styles.arrowText}>↓</Text>
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
  container: { flex: 1, backgroundColor: Colors.bg },
  progress: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  back: { marginBottom: Spacing.lg },
  backText: { color: 'rgba(255,255,255,0.4)', fontSize: 20 },
  headline: {
    color: '#fafafa', fontSize: 26, fontWeight: '600',
    letterSpacing: -0.025, lineHeight: 32, marginBottom: 8,
  },
  sub: { color: 'rgba(255,255,255,0.45)', fontSize: 15, marginBottom: 24 },
  solutions: { gap: 12 },
  solutionCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
  },
  painText: {
    color: 'rgba(255,255,255,0.4)', fontSize: 13,
    fontWeight: '500', letterSpacing: -0.005,
  },
  arrow: { marginVertical: 8 },
  arrowText: { color: Colors.primary, fontSize: 16 },
  fixText: {
    color: '#fafafa', fontSize: 15,
    lineHeight: 22, fontWeight: '400', letterSpacing: -0.005,
  },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600', letterSpacing: -0.005 },
});
