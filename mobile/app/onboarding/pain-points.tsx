import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { C, F, S, R, RGB, alpha } from '@/components/ui/theme';

const OPTIONS = [
  "I've never claimed but my premium keeps rising",
  'My insurer uses my data but never shares it with me',
  'I had to install a black box, and it felt invasive',
  'I drive carefully but get the same rate as everyone else',
  'The whole system feels opaque and unfair',
  "I don't know where my money actually goes",
];

export default function PainPoints() {
  const router = useRouter();
  const { setPainPoints } = useOnboarding();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    const next = new Set(selected);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelected(next);
  };

  const handleContinue = () => {
    setPainPoints(Array.from(selected).map(i => OPTIONS[i]));
    router.push('/onboarding/social-proof');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={3} total={14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={C.text.mut} />
        </TouchableOpacity>
        <Text style={styles.headline}>What frustrates you most about car insurance?</Text>
        <Text style={styles.sub}>Select all that apply.</Text>

        <View style={styles.options}>
          {OPTIONS.map((opt, i) => {
            const isSelected = selected.has(i);
            return (
              <TouchableOpacity
                key={i}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggle(i)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={12} color={C.text.hero} />}
                </View>
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue} activeOpacity={0.8}>
          <Text style={styles.primaryBtnText}>
            {selected.size === 0 ? 'Skip' : `Continue (${selected.size} selected)`}
          </Text>
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
    color: C.text.hero, fontSize: 26, fontFamily: F.bodySemiBold,
    letterSpacing: -0.025, lineHeight: 32, marginBottom: 8,
  },
  sub: { color: C.text.sec, fontFamily: F.body, fontSize: 15, marginBottom: 24 },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  optionSelected: {
    borderColor: C.primary,
    backgroundColor: alpha(RGB.primary, 0.1),
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: C.borderActive,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: C.primary, borderColor: C.primary,
  },
  optionLabel: { color: C.text.pri, fontFamily: F.body, fontSize: 14, flex: 1, lineHeight: 20 },
  optionLabelSelected: { color: C.text.hero },
  footer: { paddingHorizontal: S.lg, paddingBottom: S.lg },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: C.text.hero, fontSize: 15, fontFamily: F.bodySemiBold, letterSpacing: -0.005 },
});
