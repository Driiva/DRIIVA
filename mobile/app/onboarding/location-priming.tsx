import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { C, F, S, R, RGB, alpha } from '@/components/ui/theme';

const BULLETS = [
  'Trip detection starts and stops automatically.',
  'Your route data stays private — it is yours.',
  'No GPS logging when you are not driving.',
];

export default function LocationPriming() {
  const router = useRouter();
  const { setPermission } = useOnboarding();
  const { requestLocation } = usePermissions();
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const granted = await requestLocation();
      setPermission('location', granted);
      if (!granted) {
        Alert.alert(
          'Location not enabled',
          "You can enable it later in Settings. We'll remind you before your first trip.",
        );
      }
    } finally {
      setLoading(false);
      router.push('/onboarding/motion-priming');
    }
  };

  const handleSkip = () => {
    setPermission('location', false);
    router.push('/onboarding/motion-priming');
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
          <Text style={styles.icon}>◎</Text>
        </View>

        <Text style={styles.headline}>Your phone detects every trip — hands-free, always.</Text>
        <Text style={styles.sub}>
          Driiva uses your location silently in the background. You never have to open the app while driving.
        </Text>

        <View style={styles.bullets}>
          {BULLETS.map((b, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>✓</Text>
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
        </View>

        <View style={styles.trustBadge}>
          <Text style={styles.trustText}>
            Location data is processed on-device and never sold to third parties.
          </Text>
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
            {loading ? 'Requesting…' : 'Enable location'}
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
  backText: { color: C.text.mut, fontFamily: F.body, fontSize: 20 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: alpha(RGB.primary, 0.12),
    borderWidth: 1, borderColor: alpha(RGB.primary, 0.25),
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  icon: { fontFamily: F.body, fontSize: 28, color: C.primaryLight },
  headline: {
    color: C.text.hero, fontSize: 26, fontFamily: F.bodySemiBold,
    letterSpacing: -0.025, lineHeight: 32, marginBottom: 12,
  },
  sub: { color: C.text.sec, fontFamily: F.body, fontSize: 15, lineHeight: 23, marginBottom: 28 },
  bullets: { gap: 14, marginBottom: 24 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  bulletDot: { color: C.success, fontSize: 14, fontFamily: F.bodyBold, marginTop: 1 },
  bulletText: { color: C.text.pri, fontFamily: F.body, fontSize: 15, flex: 1, lineHeight: 22 },
  trustBadge: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  trustText: { color: C.text.mut, fontFamily: F.body, fontSize: 13, lineHeight: 19 },
  footer: { paddingHorizontal: S.lg, paddingBottom: S.lg, gap: 12 },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnLoading: { opacity: 0.6 },
  primaryBtnText: { color: C.text.hero, fontSize: 15, fontFamily: F.bodySemiBold, letterSpacing: -0.005 },
  skipText: { color: C.text.mut, fontFamily: F.body, fontSize: 14, textAlign: 'center' },
});
