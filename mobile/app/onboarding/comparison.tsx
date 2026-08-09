import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { C, F, S, R, RGB, alpha } from '@/components/ui/theme';

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
  container: { flex: 1, backgroundColor: C.bg },
  progress: { paddingHorizontal: S.lg, paddingTop: S.sm },
  content: { paddingHorizontal: S.lg, paddingTop: S.md, paddingBottom: S.lg },
  back: { marginBottom: S.lg },
  backText: { color: C.text.mut, fontFamily: F.body, fontSize: 20 },
  headline: {
    color: C.text.hero, fontSize: 26, fontFamily: F.bodySemiBold,
    letterSpacing: -0.025, lineHeight: 32, marginBottom: 8,
  },
  sub: { color: C.text.sec, fontFamily: F.body, fontSize: 15, marginBottom: 24 },
  table: {
    backgroundColor: C.surface1,
    borderRadius: R.sheet,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowAlt: { backgroundColor: C.surface1 },
  labelCol: { flex: 1.2 },
  col: { flex: 1 },
  rowLabel: { color: C.text.sec, fontFamily: F.body, fontSize: 12, lineHeight: 18 },
  headerOld: { color: C.text.mut, fontSize: 11, fontFamily: F.bodySemiBold, letterSpacing: 0.04 },
  headerDriiva: { color: C.primaryLight, fontSize: 11, fontFamily: F.bodySemiBold, letterSpacing: 0.04 },
  oldText: { color: C.text.sec, fontFamily: F.body, fontSize: 13, lineHeight: 18 },
  driText: { color: C.text.hero, fontSize: 13, fontFamily: F.bodySemiBold, lineHeight: 18 },
  callout: {
    backgroundColor: alpha(RGB.primary, 0.08),
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: alpha(RGB.primary, 0.2),
    padding: 16,
  },
  calloutText: { color: C.text.sec, fontFamily: F.body, fontSize: 13, lineHeight: 20 },
  footer: { paddingHorizontal: S.lg, paddingBottom: S.lg },
  primaryBtn: {
    backgroundColor: C.primary, borderRadius: R.card,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: C.text.hero, fontSize: 15, fontFamily: F.bodySemiBold, letterSpacing: -0.005 },
});
