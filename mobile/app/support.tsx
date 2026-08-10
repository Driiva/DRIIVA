/**
 * Support - Driiva Mobile
 * Ported from client/src/pages/support.tsx, trimmed for mobile.
 */
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, T, S, R } from '@/components/ui/theme';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

const SUPPORT_OPTIONS = [
  {
    icon: 'chatbubble-ellipses-outline' as const,
    title: 'Chat with us',
    description: 'Coming soon.',
    color: C.success,
    action: null,
  },
  {
    icon: 'mail-outline' as const,
    title: 'Email us',
    description: "Got a question? We'll respond as soon as possible.",
    color: C.warning,
    action: () => Linking.openURL('mailto:info@driiva.co.uk?subject=Say%20Hi'),
  },
];

const FAQ_ITEMS = [
  {
    id: 'score',
    question: 'How is my driving score calculated?',
    answer: 'Your score is based on speed discipline, smooth braking, smooth acceleration, gentle cornering, and phone-free driving.',
  },
  {
    id: 'refund',
    question: 'When will I receive my refund?',
    answer: 'We aim to pay eligible Driiva members at or just before policy renewal.',
  },
  {
    id: 'improve',
    question: 'Can I improve my driving score?',
    answer: "Yes. You get clear feedback on how your driving affects your score, so you know what to work on.",
  },
];

export default function Support() {
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Support" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Get in touch</Text>
        {SUPPORT_OPTIONS.map((option) => (
          <SurfaceCard
            key={option.title}
            padding="md"
            style={{ marginBottom: S.sm }}
            onPress={option.action ?? undefined}
          >
            <View style={styles.optionRow}>
              <View style={[styles.optionIcon, { backgroundColor: `${option.color}20` }]}>
                <Ionicons name={option.icon} size={20} color={option.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDesc}>{option.description}</Text>
              </View>
            </View>
          </SurfaceCard>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: S.lg }]}>Frequently asked questions</Text>
        {FAQ_ITEMS.map((item) => {
          const isOpen = openFaq === item.id;
          return (
            <SurfaceCard key={item.id} padding="none" style={{ marginBottom: S.sm }}>
              <TouchableOpacity
                style={styles.faqHeader}
                onPress={() => setOpenFaq(isOpen ? null : item.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={C.text.sec}
                />
              </TouchableOpacity>
              {isOpen && (
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              )}
            </SurfaceCard>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: S.xxl },
  sectionTitle: { ...T.label, color: C.text.sec, marginBottom: S.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  optionIcon: { width: 40, height: 40, borderRadius: R.card, justifyContent: 'center', alignItems: 'center' },
  optionTitle: { ...T.h2, color: C.text.pri },
  optionDesc: { ...T.caption, color: C.text.sec, marginTop: 2 },
  faqHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: S.md, gap: S.sm,
  },
  faqQuestion: { ...T.body, color: C.text.pri, flex: 1 },
  faqAnswer: { ...T.caption, color: C.text.sec, paddingHorizontal: S.md, paddingBottom: S.md },
});
