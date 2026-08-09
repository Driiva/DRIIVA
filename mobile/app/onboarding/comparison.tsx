import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

const ROWS = [
  { label: 'Premium surplus', old: 'Kept by insurer', driiva: 'Redistributed to community' },
  { label: 'Your data', old: 'Their asset', driiva: 'Your dashboard' },
  { label: 'Hardware required', old: 'Black box install', driiva: 'Phone only' },
  { label: 'Safe driving reward', old: 'None', driiva: 'Up to 15% back' }, // ESTIMATE — subject to actuarial review
];

export default function Comparison() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.progress}>
        <ProgressBar step={7} total={14} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headline}>The old way vs the Driiva way.</Text>
        <Text style={styles.sub}>Same car. Very different deal.</Text>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <View style={styles.labelCol} />
            <View style={styles.col}>
              <Text style={styles.headerOld}>Traditional</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.headerDriiva}>Driiva</Text>
            </View>
          </View>
          {ROWS.map((row, i) => (
            <View key={i} style={[styles.row, i % 2 === 0 && styles.rowAlt]}>
              <View style={styles.labelCol}>
                <Text style={styles.rowLabel}>{row.label}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.oldText}>{row.old}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.driText}>{row.driiva}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.callout}>
          <Text style={styles.calloutText}>
            Our insurance product is pending FCA authorisation. Driiva is Shariah-compliant
            and your community pool operates under a mutual benefit model, not a
            traditional insurance profit structure.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/preferences')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>Tell us about your driving</Text>
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
  table: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowAlt: { backgroundColor: 'rgba(255,255,255,0.02)' },
  labelCol: { flex: 1.2 },
  col: { flex: 1 },
  rowLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 12, lineHeight: 18 },
  headerOld: { color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600', letterSpacing: 0.04 },
  headerDriiva: { color: Colors.primaryLight, fontSize: 11, fontWeight: '600', letterSpacing: 0.04 },
  oldText: { color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 18 },
  driText: { color: '#fafafa', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  callout: {
    backgroundColor: 'rgba(107,95,220,0.08)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(107,95,220,0.2)',
    padding: 16,
  },
  calloutText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 20 },
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: '#fafafa', fontSize: 15, fontWeight: '600', letterSpacing: -0.005 },
});
