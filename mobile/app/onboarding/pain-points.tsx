import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

const OPTIONS = [
  "I've never claimed but my premium keeps rising",
  'My insurer uses my data but never shares it with me',
  'I had to install a black box — it felt invasive',
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
          <Text style={styles.backText}>←</Text>
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
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
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
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(107,95,220,0.10)',
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  optionLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 14, flex: 1, lineHeight: 20 },
  optionLabelSelected: { color: '#fafafa' },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600', letterSpacing: -0.005 },
});
