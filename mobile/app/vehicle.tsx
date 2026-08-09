/**
 * Vehicle - Driiva Mobile
 * Reads users/{uid}.vehicle (make/model/year/colour). Honest empty state
 * when nothing has been captured at onboarding yet.
 */
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { C, T, S, R } from '@/components/ui/theme';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';

interface VehicleInfo {
  make?: string;
  model?: string;
  year?: number;
  color?: string | null;
}

export default function Vehicle() {
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<VehicleInfo | null | undefined>(undefined);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.id)
      .onSnapshot((doc: { data: () => { vehicle?: VehicleInfo } | undefined }) =>
        setVehicle(doc.data()?.vehicle ?? null),
      );
    return unsubscribe;
  }, [user?.id]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Vehicle" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {vehicle === undefined ? (
          <SkeletonLoader width="100%" height={140} borderRadius={R.card} />
        ) : vehicle ? (
          <GlassCard padding="lg">
            <View style={styles.iconWrap}>
              <Ionicons name="car-sport-outline" size={28} color={C.primary} />
            </View>
            <Text style={styles.model}>
              {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'}
            </Text>
            {vehicle.color && <Text style={styles.detail}>{vehicle.color}</Text>}
          </GlassCard>
        ) : (
          <EmptyState
            icon="car-outline"
            title="No vehicle on file"
            subtitle="Vehicle details are captured during onboarding. Contact support if yours is missing."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: S.xxl },
  iconWrap: {
    width: 48, height: 48, borderRadius: R.card, backgroundColor: C.surface2,
    justifyContent: 'center', alignItems: 'center', marginBottom: S.md,
  },
  model: { ...T.h1, color: C.text.hero },
  detail: { ...T.body, color: C.text.sec, marginTop: S.xs },
});
