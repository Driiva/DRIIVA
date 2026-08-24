/**
 * YOU - Driiva Mobile
 *
 * The account screen. It used to be a static list of eight identical menu
 * rows: no name beyond the Auth display name, no score, no vehicle, no policy,
 * no indication of whether any of those existed. Every row looked the same
 * whether the thing behind it was set up or empty, so the only way to find out
 * was to tap all eight.
 *
 * Every row that has a state now shows it. "Not on file" and "No active
 * policy" are answers; a row that looks identical either way is not. The
 * figures are read from users/{uid} and nothing on this screen is computed
 * client-side except the formatting.
 *
 * WHY THE RISK TIER IS NOT HERE
 * drivingProfile.riskTier is a real field and it says 'low', 'medium' or
 * 'high'. It is an underwriting classification, written for pricing, and
 * printing it back at a driver as a label about themselves is a rating this
 * product is not authorised to give. The score is the number they earned and
 * it is the number they see.
 */
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { firestore } from '@/lib/firebase';
import { formatPounds } from '@/lib/money';
import { useAuth } from '@/contexts/AuthContext';
import { C, T, S, R, scoreColor } from '@/components/ui/theme';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { Enter, PressableCard, tick } from '@/components/ui/motion';

interface VehicleInfo {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
}

interface Account {
  displayName: string | null;
  score: number | null;
  totalTrips: number;
  totalMiles: number;
  memberSince: Date | null;
  vehicle: VehicleInfo | null;
  premiumCents: number | null;
}

const EMPTY: Account = {
  displayName: null,
  score: null,
  totalTrips: 0,
  totalMiles: 0,
  memberSince: null,
  vehicle: null,
  premiumCents: null,
};

function vehicleLabel(vehicle: VehicleInfo | null): string {
  if (!vehicle) return 'Not on file';
  const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Not on file';
}

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [account, setAccount] = useState<Account>(EMPTY);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.id)
      .onSnapshot(
        (snap: { data: () => Record<string, unknown> | undefined }) => {
          const data = snap.data();
          if (!data) return;
          const profile = (data.drivingProfile ?? {}) as {
            currentScore?: number;
            totalTrips?: number;
            totalMiles?: number;
          };
          const policy = (data.activePolicy ?? null) as { premiumCents?: number } | null;
          const created = data.createdAt as { toDate?: () => Date } | undefined;

          setAccount({
            displayName: (data.displayName as string | null) ?? null,
            // Null, not zero. A driver with no scored trip has no score.
            score: typeof profile.currentScore === 'number' ? profile.currentScore : null,
            totalTrips: profile.totalTrips ?? 0,
            totalMiles: profile.totalMiles ?? 0,
            memberSince: created?.toDate ? created.toDate() : null,
            vehicle: (data.vehicle as VehicleInfo | null) ?? null,
            premiumCents: typeof policy?.premiumCents === 'number' ? policy.premiumCents : null,
          });
        },
        () => setAccount(EMPTY),
      );
    return unsubscribe;
  }, [user?.id]);

  const handleLogout = () => {
    tick('select');
    Alert.alert('Sign out', 'You will need your email and password to get back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  const name = account.displayName || user?.name || 'Driver';
  const initial = name[0]?.toUpperCase() ?? 'D';
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Enter index={0} count={5}>
          <SurfaceCard padding="lg" style={styles.card}>
            <View style={styles.identity}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={styles.identityBody}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {user?.email && (
                  <Text style={styles.email} numberOfLines={1}>
                    {user.email}
                  </Text>
                )}
              </View>
              <View style={styles.scoreChip}>
                {account.score != null ? (
                  <>
                    <Text style={[styles.scoreValue, { color: scoreColor(account.score) }]}>
                      {Math.round(account.score)}
                    </Text>
                    <Text style={styles.scoreCaption}>score</Text>
                  </>
                ) : (
                  <Text style={styles.scorePending}>Not scored</Text>
                )}
              </View>
            </View>

            <View style={styles.figures}>
              <Figure value={String(account.totalTrips)} label="trips" />
              <Figure value={String(Math.round(account.totalMiles))} label="miles" />
              <Figure
                value={
                  account.memberSince
                    ? account.memberSince.toLocaleDateString('en-GB', {
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Not known'
                }
                label="member since"
              />
            </View>
          </SurfaceCard>
        </Enter>

        <Enter index={1} count={5}>
          <SurfaceCard padding="md" style={styles.card}>
            <MenuItem
              icon="car-outline"
              label="Vehicle"
              value={vehicleLabel(account.vehicle)}
              onPress={() => router.push('/vehicle')}
            />
            <MenuItem
              icon="shield-checkmark-outline"
              label="Policy"
              value={
                account.premiumCents != null
                  ? `${formatPounds(account.premiumCents)} a month`
                  : 'None active'
              }
              onPress={() => router.push('/policy')}
            />
            <MenuItem
              icon="settings-outline"
              label="Settings"
              onPress={() => router.push('/settings')}
            />
            <MenuItem
              icon="help-circle-outline"
              label="Support"
              onPress={() => router.push('/support')}
              last
            />
          </SurfaceCard>
        </Enter>

        <Enter index={2} count={5}>
          <SurfaceCard padding="md" style={styles.card}>
            <MenuItem
              icon="people-outline"
              label="Your circle"
              onPress={() => router.push('/(tabs)/community')}
            />
            <MenuItem
              icon="ribbon-outline"
              label="Earned"
              onPress={() => router.push('/(tabs)/rewards')}
            />
            <MenuItem
              icon="podium-outline"
              label="Full board"
              onPress={() => router.push('/leaderboard')}
              last
            />
          </SurfaceCard>
        </Enter>

        <Enter index={3} count={5}>
          <SurfaceCard padding="md" style={styles.card}>
            <MenuItem
              icon="document-text-outline"
              label="Privacy"
              onPress={() => router.push('/privacy')}
            />
            <MenuItem
              icon="document-outline"
              label="Terms"
              onPress={() => router.push('/terms')}
            />
            <MenuItem
              icon="shield-outline"
              label="Trust centre"
              onPress={() => router.push('/trust')}
              last
            />
          </SurfaceCard>
        </Enter>

        <Enter index={4} count={5}>
          <View>
            <PressableCard
              onPress={handleLogout}
              haptic="none"
              style={styles.signOut}
              accessibilityLabel="Sign out"
            >
              <Ionicons name="log-out-outline" size={18} color={C.error} />
              <Text style={styles.signOutText}>Sign out</Text>
            </PressableCard>

            <Text style={styles.version}>Driiva {version}</Text>
            <Text style={styles.legal}>
              Driiva Ltd. Our insurance product is pending FCA authorisation.
            </Text>
          </View>
        </Enter>
      </ScrollView>
    </SafeAreaView>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  value,
  onPress,
  last = false,
}: {
  icon: string;
  label: string;
  /** The state behind the row. Omit for a row that has none. */
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <PressableCard
      onPress={onPress}
      haptic="select"
      style={[styles.menuItem, last && styles.menuItemLast]}
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <Ionicons name={icon as never} size={18} color={C.text.sec} />
      <Text style={styles.menuLabel}>{label}</Text>
      {value !== undefined && (
        <Text style={styles.menuValue} numberOfLines={1}>
          {value}
        </Text>
      )}
      <Ionicons name="chevron-forward" size={16} color={C.text.mut} />
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: S.md, paddingTop: S.md, paddingBottom: 100 },

  card: { marginBottom: S.md },

  identity: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { ...T.stat, color: C.text.hero },
  identityBody: { flex: 1, minWidth: 0 },
  name: { ...T.h1, color: C.text.hero },
  email: { ...T.caption, color: C.text.sec, marginTop: 2 },

  scoreChip: { alignItems: 'flex-end' },
  scoreValue: { ...T.statLg },
  scoreCaption: { ...T.eyebrow, color: C.text.mut, marginTop: -2 },
  scorePending: { ...T.label, color: C.text.mut },

  figures: {
    flexDirection: 'row',
    gap: S.md,
    marginTop: S.lg,
    paddingTop: S.md,
    borderTopWidth: 1,
    borderTopColor: C.hairline,
  },
  figure: { flex: 1, minWidth: 0 },
  figureValue: { ...T.number, color: C.text.pri },
  figureLabel: { ...T.caption, color: C.text.sec, marginTop: 2 },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: C.hairline,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuLabel: { ...T.bodySm, color: C.text.pri, flex: 1, minWidth: 0 },
  menuValue: { ...T.caption, color: C.text.mut, maxWidth: '46%' },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.sm,
    height: 52,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface1,
  },
  signOutText: { ...T.label, color: C.error },

  version: { ...T.caption, color: C.text.mut, textAlign: 'center', marginTop: S.md },
  legal: { ...T.caption, color: C.text.mut, textAlign: 'center', marginTop: S.xs },
});
