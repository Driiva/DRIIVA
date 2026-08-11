import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboarding, DrivingFrequency, DrivingTime, DrivingRoutes } from '@/contexts/OnboardingContext';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { C, F, S, R, RGB, alpha, FS, LH, TR } from '@/components/ui/theme';
import { seedScore as calcSeed } from '@/hooks/useTripSeed';

const STEPS = [
  {
    question: 'How often do you drive?',
    options: ['Daily', 'A few times a week', 'Weekends only', 'Occasionally'] as DrivingFrequency[],
    field: 'frequency' as const,
  },
  {
    question: 'What time do you mostly drive?',
    options: ['Morning commute', 'Daytime', 'Evening', 'Mixed'] as DrivingTime[],
    field: 'time' as const,
  },
  {
    question: "What best describes your routes?",
    options: ['City centre', 'Suburban', 'Rural', 'Mix'] as DrivingRoutes[],
    field: 'routes' as const,
  },
];

export default function Preferences() {
  const router = useRouter();
  const { setDrivingProfile, setSeedScore, state } = useOnboarding();
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const current = STEPS[step];

  const handleSelect = (option: string) => {
    const updated = { ...selections, [current.field]: option };
    setSelections(updated);

    if (step < STEPS.length - 1) {
      setTimeout(() => setStep(s => s + 1), 180);
    } else {
      const profile = {
        frequency: (updated.frequency ?? 'Daily') as DrivingFrequency,
        time: (updated.time ?? 'Mixed') as DrivingTime,
        routes: (updated.routes ?? 'Mix') as DrivingRoutes,
      };
      setDrivingProfile(profile);
      setSeedScore(calcSeed(profile));
      router.push('/onboarding/location-priming');
    }
  };

  const overallStep = 8;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={overallStep} total={14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={step > 0 ? () => setStep(s => s - 1) : () => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={C.text.mut} />
        </TouchableOpacity>

        <View style={styles.stepIndicator}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.stepDot, i <= step && styles.stepDotActive]} />
          ))}
        </View>

        <Text style={styles.headline}>{current.question}</Text>

        <View style={styles.options}>
          {current.options.map((opt, i) => {
            const isSelected = selections[current.field] === opt;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => handleSelect(opt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opt}</Text>
                {isSelected && <Ionicons name="checkmark" size={14} color={C.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.lg },
  back: { marginBottom: S.lg },
  stepIndicator: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  stepDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.surface2,
  },
  stepDotActive: { backgroundColor: C.primary },
  headline: {
    color: C.text.hero, fontSize: FS.xxl, fontFamily: F.bodySemiBold,
    letterSpacing: TR.xxl, lineHeight: LH.xxl, marginBottom: 28,
  },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  optionText: { color: C.text.pri, fontFamily: F.body, fontSize: FS.md },
  optionTextSelected: { color: C.text.hero, fontFamily: F.bodySemiBold },
});
