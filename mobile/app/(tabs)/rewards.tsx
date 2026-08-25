/**
 * Earned - Driiva Mobile
 *
 * Reached from the Community tab and from an achievement_unlocked push
 * notification. It is no longer a tab of its own: collecting badges is not one
 * of the five things a driver does, and recognition belongs beside the
 * standing it is recognition of. The ROUTE stays registered (href: null in
 * app/(tabs)/_layout.tsx) so the notification still lands somewhere.
 *
 * Two things live here and they are deliberately not mixed up.
 *
 * RECOGNITION BADGES are real: the trip-completion trigger unlocks them
 * server-side against the driver's actual profile, and this screen reads those
 * unlocks. They carry no cash value and no partner brand.
 *
 * PARTNER REWARDS are not live. Wave 0 deleted a hardcoded timeline naming
 * five third-party vouchers with no partnership and no redemption path behind
 * any of them. Naming a brand and a cash value the product cannot honour is a
 * promise, not a placeholder, so that section stays a statement of where the
 * programme actually is until a reward can be handed over.
 */
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { C, T, S, R, RGB, alpha } from '@/components/ui/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { buildAchievementViews, type AchievementView } from '@driiva/contracts';

/** Lucide names in the shared catalogue, drawn as Ionicons here. Never emoji. */
const ICONS: Record<string, string> = {
  Car: 'car-sport-outline',
  Shield: 'shield-checkmark-outline',
  Target: 'locate-outline',
  Star: 'star-outline',
  Route: 'map-outline',
  Flame: 'flame-outline',
  Moon: 'moon-outline',
  Award: 'ribbon-outline',
};

interface Profile {
  totalTrips: number;
  totalMiles: number;
  streakDays: number;
  currentScore: number;
}

const EMPTY_PROFILE: Profile = { totalTrips: 0, totalMiles: 0, streakDays: 0, currentScore: 0 };

function Badge({ view }: { view: AchievementView }) {
  const icon = ICONS[view.icon] ?? 'ribbon-outline';
  const showBar = !view.unlocked && view.maxProgress !== null && view.progress !== null;
  const pct = showBar ? Math.round((view.progress! / view.maxProgress!) * 100) : 0;

  return (
    <View style={[styles.badge, view.unlocked && styles.badgeUnlocked]}>
      <View style={[styles.badgeIcon, view.unlocked && styles.badgeIconUnlocked]}>
        <Ionicons
          name={(view.unlocked ? icon : 'lock-closed-outline') as never}
          size={20}
          color={view.unlocked ? C.primary : C.text.mut}
        />
      </View>

      <View style={styles.badgeBody}>
        <Text style={[styles.badgeName, !view.unlocked && styles.badgeNameLocked]}>
          {view.name}
        </Text>
        <Text style={styles.badgeDesc}>{view.description}</Text>

        {showBar && (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {view.progress} of {view.maxProgress}
            </Text>
          </View>
        )}

        {view.unlocked && view.unlockedAt && (
          <Text style={styles.unlockedAt}>
            Unlocked {view.unlockedAt.toLocaleDateString('en-GB')}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function Rewards() {
  const { user } = useAuth();
  const [views, setViews] = useState<AchievementView[]>([]);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.id)
      .onSnapshot((snap: { data: () => Record<string, never> | undefined }) => {
        const dp = (snap.data()?.drivingProfile ?? {}) as Partial<Profile>;
        setProfile({
          totalTrips: dp.totalTrips ?? 0,
          totalMiles: dp.totalMiles ?? 0,
          streakDays: dp.streakDays ?? 0,
          currentScore: dp.currentScore ?? 0,
        });
      });
    return unsubscribe;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setViews(buildAchievementViews([], EMPTY_PROFILE));
      return;
    }
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.id)
      .collection('achievements')
      .onSnapshot(
        (snap: { docs: Array<{ id: string; data: () => { unlockedAt?: { toDate?: () => Date } } }> }) => {
          const unlocked = snap.docs.map((d) => ({
            achievementId: d.id,
            unlockedAt: d.data().unlockedAt?.toDate?.() ?? null,
          }));
          setViews(buildAchievementViews(unlocked, profile));
        },
        () => setViews(buildAchievementViews([], profile)),
      );
    return unsubscribe;
  }, [user?.id, profile]);

  const unlockedCount = views.filter((v) => v.unlocked).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Earned"
        subtitle="Recognition for how you drive. No cash value, no partner brand."
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 800);
            }}
            tintColor={C.primary}
          />
        }
      >
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recognition</Text>
          <Text style={styles.sectionCount}>
            {unlockedCount} of {views.length}
          </Text>
        </View>

        <View style={styles.list}>
          {views.map((view) => (
            <Badge key={view.id} view={view} />
          ))}
        </View>

        <View style={styles.card}>
          <Ionicons name="gift-outline" size={28} color={C.primaryLight} />
          <Text style={styles.cardTitle}>Reward partners are not live yet.</Text>
          <Text style={styles.cardBody}>
            We are not going to list rewards we cannot hand over. When partner
            rewards are signed and redeemable, they will appear here and you
            will be told what unlocks them.
          </Text>
          <Text style={styles.cardBody}>
            The badges above are recognition, not vouchers. They carry no cash
            value.
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          Driiva is operated by Driiva Ltd, which is working towards the FCA regulatory
          sandbox. We are not authorised and not operating under an MGA. Nothing on this
          screen is a binding offer.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: S.xxl },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: S.sm,
  },
  sectionTitle: { ...T.label, color: C.text.sec },
  sectionCount: { ...T.number, color: C.text.sec },

  list: { gap: S.sm, marginBottom: S.lg },

  badge: {
    flexDirection: 'row',
    gap: S.sm,
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.md,
    opacity: 0.72,
  },
  badgeUnlocked: { opacity: 1, borderColor: alpha(RGB.primary, 0.3) },

  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: R.badge,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconUnlocked: { backgroundColor: alpha(RGB.primary, 0.16) },

  badgeBody: { flex: 1, minWidth: 0 },
  badgeName: { ...T.h2, color: C.text.pri },
  badgeNameLocked: { color: C.text.sec },
  badgeDesc: { ...T.caption, color: C.text.sec, marginTop: 2 },

  progressWrap: { marginTop: S.sm },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: C.surface3,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: C.primary },
  progressText: { ...T.caption, color: C.text.mut, marginTop: 4 },

  unlockedAt: { ...T.caption, color: C.text.mut, marginTop: 4 },

  card: {
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.md,
    gap: S.sm,
    marginBottom: S.lg,
  },
  cardTitle: { ...T.h2, color: C.text.pri },
  cardBody: { ...T.body, color: C.text.sec },

  disclaimer: { ...T.caption, color: C.text.mut },
});
