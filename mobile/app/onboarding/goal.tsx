import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

const OPTIONS = [
  { icon: '£', label: 'Save money on insurance' },
  { icon: '✓', label: 'Be rewarded for driving safely' },
  { icon: '◎', label: 'Join a fairer, more transparent system' },
  { icon: '↗', label: 'Understand my own driving data' },
  { icon: '◉', label: 'Be part of a community that benefits together' },
];

export default function GoalQuestion() {
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
        <ProgressBar step={2} total={14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
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
              <Text style={styles.optionIcon}>{opt.icon}</Text>
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
  container: { flex: 1, backgroundColor: Colors.bg },
  progress: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  back: { marginBottom: Spacing.lg },
  backText: { color: 'rgba(255,255,255,0.4)', fontSize: 20 },
  headline: {
    color: '#fafafa', fontSize: 28, fontWeight: '600',
    letterSpacing: -0.025, lineHeight: 34, marginBottom: 8,
  },
  sub: { color: 'rgba(255,255,255,0.45)', fontSize: 15, marginBottom: 28, lineHeight: 22 },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(107,95,220,0.12)',
  },
  optionIcon: { color: 'rgba(255,255,255,0.4)', fontSize: 16, width: 22, textAlign: 'center' },
  optionLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 15, flex: 1, lineHeight: 22 },
  optionLabelSelected: { color: '#fafafa', fontWeight: '500' },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600', letterSpacing: -0.005 },
});
