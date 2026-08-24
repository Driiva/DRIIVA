import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ONBOARDING_TOTAL, stepNumber } from '@/lib/onboardingFlow';
import { track } from '@/lib/analytics';
import { C, F, S, R, RGB, alpha, FS, LH, TR, T } from '@/components/ui/theme';

const BULLETS = [
  'Powers your Stop-Go Classifier score.',
  'Contributes to your EcoScore.',
  'Zero battery impact beyond normal usage.',
];

export default function MotionPriming() {
  useEffect(() => {
    track('onboarding_step_viewed', { step: stepNumber('motion-priming'), name: 'motion-priming' });
  }, []);

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
        <ProgressBar step={stepNumber('motion-priming')} total={ONBOARDING_TOTAL} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={C.text.mut} />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <Ionicons name="sync-outline" size={28} color={C.primaryLight} />
        </View>

        <Text style={styles.headline}>Motion sensors score your smoothness, with no extra effort.</Text>
        <Text style={styles.sub}>
          Acceleration, braking, cornering: your phone is already tracking this. Driiva just makes it useful.
        </Text>

        <View style={styles.bullets}>
          {BULLETS.map((b, i) => (
            <View key={i} style={styles.bullet}>
              <Ionicons name="checkmark" size={14} color={C.success} />
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
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.lg },
  back: { marginBottom: S.lg },
  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: alpha(RGB.primary, 0.12),
    borderWidth: 1, borderColor: alpha(RGB.primary, 0.25),
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  headline: {
    ...T.h0,
    color: C.text.hero, marginBottom: 12,
  },
  sub: { color: C.text.sec, fontFamily: F.body, fontSize: FS.md, lineHeight: LH.md, letterSpacing: TR.md, marginBottom: 28 },
  bullets: { gap: 14, marginBottom: 24 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bulletText: { color: C.text.pri, fontFamily: F.body, fontSize: FS.md, flex: 1, lineHeight: LH.md, letterSpacing: TR.md },
  footer: { paddingHorizontal: S.lg, paddingBottom: S.lg, gap: 12 },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnLoading: { opacity: 0.6 },
  primaryBtnText: { color: C.text.hero, fontSize: FS.md, fontFamily: F.bodySemiBold, lineHeight: LH.md, letterSpacing: TR.md },
  skipText: { color: C.text.mut, fontFamily: F.body, fontSize: FS.sm, lineHeight: LH.sm, letterSpacing: TR.sm, textAlign: 'center' },
});
