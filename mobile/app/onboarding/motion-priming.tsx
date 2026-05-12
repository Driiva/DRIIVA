import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

const BULLETS = [
  'Powers your Stop-Go Classifier score.',
  'Contributes to your EcoScore.',
  'Zero battery impact beyond normal usage.',
];

export default function MotionPriming() {
  const router = useRouter();
  const { setPermission } = useOnboarding();
  const { requestMotion } = usePermissions();
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const granted = await requestMotion();
      setPermission('motion', granted);
      if (!granted) {
        Alert.alert(
          'Motion not enabled',
          "You can enable it in Settings > Privacy > Motion & Fitness. Some score metrics may be limited.",
        );
      }
    } finally {
      setLoading(false);
      router.push('/onboarding/processing');
    }
  };

  const handleSkip = () => {
    setPermission('motion', false);
    router.push('/onboarding/processing');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={9} total={14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Text style={styles.icon}>↻</Text>
        </View>

        <Text style={styles.headline}>Motion sensors score your smoothness — no extra effort.</Text>
        <Text style={styles.sub}>
          Acceleration, braking, cornering — your phone's already tracking this. Driiva just makes it useful.
        </Text>

        <View style={styles.bullets}>
          {BULLETS.map((b, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>✓</Text>
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.primaryBtnLoading]}
          onPress={handleEnable}
          activeOpacity={0.8}
          disabled={loading}
        >
          <Text style={styles.primaryBtnText}>
            {loading ? 'Requesting…' : 'Enable motion'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>I'll do this later</Text>
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
  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: 'rgba(107,95,220,0.12)',
    borderWidth: 1, borderColor: 'rgba(107,95,220,0.25)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  icon: { fontSize: 28, color: Colors.primaryLight },
  headline: {
    color: '#fafafa', fontSize: 26, fontWeight: '600',
    letterSpacing: -0.025, lineHeight: 32, marginBottom: 12,
  },
  sub: { color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 23, marginBottom: 28 },
  bullets: { gap: 14, marginBottom: 24 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bulletDot: { color: Colors.success, fontSize: 14, fontWeight: '700', marginTop: 1 },
  bulletText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, flex: 1, lineHeight: 22 },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: 12 },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnLoading: { opacity: 0.6 },
  primaryBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600', letterSpacing: -0.005 },
  skipText: { color: 'rgba(255,255,255,0.35)', fontSize: 14, textAlign: 'center' },
});
