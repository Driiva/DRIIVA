/**
 * Trust Centre - Driiva Mobile
 * Ported from client/src/pages/trust.tsx, trimmed for mobile.
 */
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, T, S, R, F } from '@/components/ui/theme';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

const DATA_COLLECTED = [
  { item: 'GPS location', detail: 'During active trips only, never in the background' },
  { item: 'Accelerometer & gyroscope', detail: 'To detect braking, acceleration, and cornering' },
  { item: 'Speed & heading', detail: 'For safety scoring and route context' },
  { item: 'Trip metadata', detail: 'Start/end time, duration, distance' },
];

const RIGHTS = [
  { title: 'Right of access', body: 'Request a full copy of your personal data at any time. Provided in a machine-readable format within 30 days.' },
  { title: 'Right to erasure', body: 'Delete your account and all associated data, subject only to legal retention requirements.' },
  { title: 'Right to data portability', body: 'Your export includes all trip data, scores, and profile information in a structured, machine-readable format.' },
  { title: 'Right to object', body: "Object to processing based on legitimate interests. We'll stop processing unless we have compelling grounds that override your rights." },
];

export default function Trust() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Trust centre" subtitle="How Driiva protects you and your data" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SurfaceCard padding="lg" style={{ marginBottom: S.md }}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed-outline" size={24} color={C.primary} />
          </View>
          <Text style={styles.cardTitle}>Data & privacy shield</Text>
          <Text style={styles.cardSubtitle}>What we collect, why, and for how long</Text>
          <View style={{ marginTop: S.md, gap: S.sm }}>
            {DATA_COLLECTED.map((d) => (
              <View key={d.item} style={styles.dataRow}>
                <View style={styles.dot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dataItem}>{d.item}</Text>
                  <Text style={styles.dataDetail}>{d.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </SurfaceCard>

        <SurfaceCard padding="lg" style={{ marginBottom: S.md }}>
          <Text style={styles.cardTitle}>Your rights</Text>
          <Text style={styles.cardSubtitle}>Under UK GDPR, you have full control over your data</Text>
          <View style={{ marginTop: S.md, gap: S.md }}>
            {RIGHTS.map((right) => (
              <View key={right.title}>
                <Text style={styles.rightTitle}>{right.title}</Text>
                <Text style={styles.rightBody}>{right.body}</Text>
              </View>
            ))}
          </View>
          <Text
            style={[styles.rightBody, { marginTop: S.md, textDecorationLine: 'underline' }]}
            onPress={() => Linking.openURL('mailto:info@driiva.co.uk')}
          >
            To exercise any right, email info@driiva.co.uk
          </Text>
        </SurfaceCard>

        <SurfaceCard padding="lg" style={{ marginBottom: S.md }}>
          <Text style={styles.cardTitle}>Who underwrites your policy</Text>
          <Text style={styles.rightBody}>
            Driiva is a technology and distribution platform. Insurance policies are
            underwritten by our capacity partner and are subject to their terms and
            conditions. Driiva is not the insurer.
          </Text>
        </SurfaceCard>

        <SurfaceCard padding="lg">
          <Text style={styles.disclaimer}>
            Financial promotion disclaimer: refund amounts shown anywhere in the
            Driiva app are illustrative projections based on driving score
            performance. Actual refunds depend on community pool performance,
            claims experience, and underwriting criteria. Past performance is not a
            guarantee of future refunds. Driiva Ltd is pending FCA authorisation.
          </Text>
        </SurfaceCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: S.xxl },
  iconWrap: {
    width: 48, height: 48, borderRadius: R.card, backgroundColor: C.surface2,
    justifyContent: 'center', alignItems: 'center', marginBottom: S.sm,
  },
  cardTitle: { ...T.h2, color: C.text.hero },
  cardSubtitle: { ...T.caption, color: C.text.sec, marginTop: 2 },
  dataRow: { flexDirection: 'row', gap: S.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary, marginTop: 6 },
  dataItem: { ...T.body, color: C.text.pri },
  dataDetail: { ...T.caption, color: C.text.sec },
  rightTitle: { ...T.body, fontFamily: F.bodySemiBold, color: C.text.pri },
  rightBody: { ...T.caption, color: C.text.sec, marginTop: 2 },
  disclaimer: { ...T.caption, color: C.text.mut },
});
