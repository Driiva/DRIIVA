import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

// PLACEHOLDER — replace with real reviews post-launch
const TESTIMONIALS = [
  {
    name: 'Meera, 24',
    tag: 'Safe driver, overpaying',
    quote: 'First time insurance has ever felt like it\'s on my side.',
    score: 91,
  },
  {
    name: 'Jordan, 27',
    tag: 'Ethical consumer',
    quote: 'The community pool idea is genius. Finally aligns incentives.',
    score: 88,
  },
  {
    name: 'Marcus, 31',
    tag: 'Data-first driver',
    quote: 'I can see my EcoScore. My insurer never showed me anything.',
    score: 94,
  },
];

export default function SocialProof() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={4} total={14} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headline}>117 drivers already on the waitlist.</Text>
        <Text style={styles.sub}>Here's what brought them in.</Text>

        <FlatList
          data={TESTIMONIALS}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={width - Spacing.lg * 2}
          decelerationRate="fast"
          contentContainerStyle={{ gap: 12 }}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (width - Spacing.lg * 2));
            setActiveIndex(idx);
          }}
          renderItem={({ item }) => (
            <View style={[styles.card, { width: width - Spacing.lg * 2 }]}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardTag}>{item.tag}</Text>
                </View>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreValue}>{item.score}</Text>
                </View>
              </View>
              <Text style={styles.cardQuote}>"{item.quote}"</Text>
            </View>
          )}
          style={styles.flatList}
        />

        <View style={styles.dots}>
          {TESTIMONIALS.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>117</Text>
            <Text style={styles.statLabel}>Waitlist</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>£162</Text>
            <Text style={styles.statLabel}>Avg refund est.</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>4.9</Text>
            <Text style={styles.statLabel}>Avg score</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/tinder')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>That's interesting — continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  progress: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  content: { flex: 1, paddingTop: Spacing.md },
  back: { marginBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  backText: { color: 'rgba(255,255,255,0.4)', fontSize: 20 },
  headline: {
    color: '#fafafa', fontSize: 26, fontWeight: '600',
    letterSpacing: -0.025, lineHeight: 32, marginBottom: 8,
    paddingHorizontal: Spacing.lg,
  },
  sub: {
    color: 'rgba(255,255,255,0.45)', fontSize: 15,
    marginBottom: 24, paddingHorizontal: Spacing.lg,
  },
  flatList: { paddingLeft: Spacing.lg },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 22,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  cardName: { color: '#fafafa', fontSize: 15, fontWeight: '600' },
  cardTag: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 },
  scoreBadge: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: Colors.success,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  scoreValue: { color: Colors.success, fontSize: 15, fontWeight: '700' },
  cardQuote: { color: 'rgba(255,255,255,0.7)', fontSize: 15, lineHeight: 23, fontStyle: 'italic' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  dotActive: { backgroundColor: Colors.primary, width: 18 },
  statRow: {
    flexDirection: 'row',
    marginTop: 20,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fafafa', fontSize: 22, fontWeight: '700', letterSpacing: -0.03 },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600', letterSpacing: -0.005 },
});
