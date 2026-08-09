/**
 * Rewards - Driiva Mobile
 *
 * Wave 0 (0a/0c): the hardcoded REWARDS timeline was deleted. It named five
 * third-party vouchers (Tesco, RAC, Halfords, Nectar, Amazon) as if they were
 * unlockable, with no partnership and no redemption path behind any of them.
 * Naming a brand and a cash value the product cannot honour is a promise, not
 * a placeholder. Wave D wires this screen to the real reward definitions in
 * Firestore; until then it states where the programme actually is.
 */
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

export default function Rewards() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Rewards</Text>
        <Text style={styles.subtitle}>
          Your safety score is what earns you money back.
        </Text>

        <View style={styles.card}>
          <Ionicons name="gift-outline" size={28} color={Colors.primaryLight} />
          <Text style={styles.cardTitle}>Reward partners are not live yet.</Text>
          <Text style={styles.cardBody}>
            We are not going to list rewards we cannot hand over. When partner
            rewards are signed and redeemable, they will appear here and you
            will be told what unlocks them.
          </Text>
          <Text style={styles.cardBody}>
            In the meantime your driving still counts. Every trip you record
            feeds your safety score, and your score sets your share of the
            community pool.
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          Driiva is operated by Driiva Ltd. Our insurance product is pending FCA
          authorisation. Nothing on this screen is a binding offer.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.md },
  subtitle: {
    fontSize: FontSize.md, color: Colors.textSecondary,
    marginTop: Spacing.xs, marginBottom: Spacing.lg,
  },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.bgCardBorder,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardTitle: {
    fontSize: FontSize.lg, fontWeight: '700',
    color: Colors.textPrimary, marginTop: Spacing.xs,
  },
  cardBody: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 21 },

  disclaimer: {
    fontSize: FontSize.xs, color: Colors.textMuted,
    lineHeight: 17, marginTop: Spacing.lg,
  },
});
