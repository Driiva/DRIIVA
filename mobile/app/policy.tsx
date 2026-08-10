/**
 * Policy - Driiva Mobile
 * Reads users/{uid}.activePolicy. Honest empty state when there is none yet
 * (pre-FCA authorisation, most users have no live policy).
 */
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { C, T, S, R } from '@/components/ui/theme';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

interface ActivePolicy {
  policyNumber?: string;
  status?: string;
  premiumCents?: number;
  coverageType?: string;
  renewalDate?: { toDate?: () => Date };
}

export default function Policy() {
  const { user } = useAuth();
  const [policy, setPolicy] = useState<ActivePolicy | null | undefined>(undefined);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.id)
      .onSnapshot((doc: { data: () => { activePolicy?: ActivePolicy } | undefined }) =>
        setPolicy(doc.data()?.activePolicy ?? null),
      );
    return unsubscribe;
  }, [user?.id]);

  const renewalLabel = policy?.renewalDate?.toDate?.()?.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const premiumLabel = typeof policy?.premiumCents === 'number'
    ? `£${(policy.premiumCents / 100).toFixed(2)}/mo`
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Policy" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {policy === undefined ? (
          <SkeletonLoader width="100%" height={160} borderRadius={R.card} />
        ) : policy ? (
          <SurfaceCard padding="lg">
            <View style={styles.iconWrap}>
              <Ionicons name="shield-checkmark-outline" size={28} color={C.primary} />
            </View>
            <Text style={styles.policyNumber}>{policy.policyNumber || 'Policy'}</Text>
            <Text style={styles.status}>{policy.status || 'unknown status'}</Text>
            <View style={styles.detailRows}>
              {premiumLabel && <DetailRow label="Premium" value={premiumLabel} />}
              {policy.coverageType && <DetailRow label="Coverage" value={policy.coverageType} />}
              {renewalLabel && <DetailRow label="Renewal" value={renewalLabel} />}
            </View>
          </SurfaceCard>
        ) : (
          <EmptyState
            icon="shield-outline"
            title="No active policy"
            subtitle="Once your Driiva policy is live, it will appear here."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: S.xxl },
  iconWrap: {
    width: 48, height: 48, borderRadius: R.card, backgroundColor: C.surface2,
    justifyContent: 'center', alignItems: 'center', marginBottom: S.md,
  },
  policyNumber: { ...T.h1, color: C.text.hero },
  status: { ...T.body, color: C.text.sec, marginTop: S.xs, textTransform: 'capitalize' },
  detailRows: { marginTop: S.lg, gap: S.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { ...T.body, color: C.text.sec },
  detailValue: { ...T.number, color: C.text.pri },
});
