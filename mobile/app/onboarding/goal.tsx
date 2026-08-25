import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { ONBOARDING_TOTAL, stepNumber } from '@/lib/onboardingFlow';
import { track } from '@/lib/analytics';
import { C, F, S, R, RGB, alpha, FS, T, LH, TR } from '@/components/ui/theme';

const OPTIONS = [
  { icon: 'cash-outline', label: 'Save money on insurance' },
  { icon: 'checkmark-circle-outline', label: 'Be rewarded for driving safely' },
  { icon: 'locate-outline', label: 'Join a fairer, more transparent system' },
  { icon: 'stats-chart-outline', label: 'Understand my own driving data' },
  { icon: 'people-outline', label: 'Be part of a community that benefits together' },
];

export default function GoalQuestion() {
  useEffect(() => {
    track('onboarding_step_viewed', { step: stepNumber('goal'), name: 'goal' });
  }, []);

  const router = useRouter();
  const { setGoal } = useOnboarding();
  const [selected, setSelected] = useState<number | null>(null);

  const handleContinue = () => {
    if (selected === null) return;
    setGoal(OPTIONS[selected].label);
    router.push('/onboarding/pain-points');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={stepNumber('goal')} total={ONBOARDING_TOTAL} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={C.text.mut} />
        </TouchableOpacity>
        <Text style={styles.headline}>What matters most to you?</Text>
        <Text style={styles.sub}>Choose the one that resonates most.</Text>

        <View style={styles.options}>
          {OPTIONS.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.option, selected === i && styles.optionSelected]}
              onPress={() => setSelected(i)}
              activeOpacity={0.7}
            >
              <Ionicons name={opt.icon as never} size={20} color={C.primary} style={styles.optionIcon} />
              <Text style={[styles.optionLabel, selected === i && styles.optionLabelSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.primaryBtn, selected === null && styles.primaryBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={0.8}
          disabled={selected === null}
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
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.lg },
  back: { marginBottom: S.lg },
  headline: {
    ...T.h0,
    color: C.text.hero, marginBottom: 8,
  },
  sub: { color: C.text.sec, fontFamily: F.body, fontSize: FS.md, marginBottom: 28, lineHeight: LH.md, letterSpacing: TR.md },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  optionSelected: {
    borderColor: C.primary,
    backgroundColor: alpha(RGB.primary, 0.12),
  },
  optionIcon: { width: 22, textAlign: 'center' },
  optionLabel: { color: C.text.pri, fontFamily: F.body, fontSize: FS.md, flex: 1, lineHeight: LH.md, letterSpacing: TR.md },
  optionLabelSelected: { color: C.text.hero, fontFamily: F.bodySemiBold },
  footer: { paddingHorizontal: S.lg, paddingBottom: S.lg },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: C.text.hero, fontSize: FS.md, fontFamily: F.bodySemiBold, lineHeight: LH.md, letterSpacing: TR.md },
});
