/**
 * Notifications - Driiva Mobile
 *
 * Reads users/{uid}/notifications, which Cloud Functions write whenever
 * something actually happens: a trip is scored, an achievement unlocks, the
 * weekly summary goes out. Before Wave D these were push-only, so a
 * notification existed as a banner and nothing else.
 *
 * The client cannot create these; the rules deny it. That is deliberate: a
 * fabricated "your refund has landed" would be indistinguishable from a real
 * one to the person reading it.
 */
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { C, T, S, R, RGB, alpha } from '@/components/ui/theme';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';

interface NotificationRecord {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: Date | null;
}

const TYPE_ICON: Record<string, string> = {
  trip_complete: 'speedometer-outline',
  achievement_unlocked: 'ribbon-outline',
  weekly_summary: 'calendar-outline',
  general: 'notifications-outline',
};

/** Short, honest relative time. No "just now" for something an hour old. */
function when(date: Date | null): string {
  if (!date) return '';
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-GB');
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.id)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(
        (snap: {
          docs: Array<{
            id: string;
            data: () => {
              title?: string;
              body?: string;
              type?: string;
              read?: boolean;
              createdAt?: { toDate?: () => Date };
            };
          }>;
        }) => {
          setItems(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                title: data.title ?? '',
                body: data.body ?? '',
                type: data.type ?? 'general',
                read: data.read ?? false,
                createdAt: data.createdAt?.toDate?.() ?? null,
              };
            }),
          );
          setLoading(false);
        },
        () => setLoading(false),
      );
    return unsubscribe;
  }, [user?.id]);

  const markRead = (id: string, alreadyRead: boolean) => {
    if (alreadyRead || !user?.id) return;
    firestore()
      .collection('users')
      .doc(user.id)
      .collection('notifications')
      .doc(id)
      .update({ read: true })
      .catch(() => {
        // Read state is a convenience. Failing to persist it must not throw an
        // error dialogue over a list the user is only reading.
      });
  };

  const unread = items.filter((i) => !i.read).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Notifications" />
      <ScrollView
        contentContainerStyle={styles.scroll}
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
        {unread > 0 && (
          <Text style={styles.unread}>
            {unread} unread
          </Text>
        )}

        {loading ? null : items.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="Nothing yet"
            subtitle="Trip scores, achievements and your weekly summary appear here once they happen. Nothing is hidden in the meantime."
          />
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => markRead(item.id, item.read)}
                style={[styles.row, !item.read && styles.rowUnread]}
              >
                <View style={styles.icon}>
                  <Ionicons
                    name={(TYPE_ICON[item.type] ?? TYPE_ICON.general) as never}
                    size={18}
                    color={item.read ? C.text.sec : C.primary}
                  />
                </View>
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.when}>{when(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.text}>{item.body}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: S.md, paddingBottom: S.xxl, flexGrow: 1 },

  unread: { ...T.label, color: C.text.sec, marginBottom: S.sm },

  list: { gap: S.sm },
  row: {
    flexDirection: 'row',
    gap: S.sm,
    backgroundColor: C.surface1,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.md,
  },
  rowUnread: { borderColor: alpha(RGB.primary, 0.3), backgroundColor: C.surface2 },

  icon: {
    width: 36,
    height: 36,
    borderRadius: R.badge,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: S.sm },
  title: { ...T.h2, color: C.text.sec, flex: 1 },
  titleUnread: { color: C.text.hero },
  when: { ...T.caption, color: C.text.mut },
  text: { ...T.body, color: C.text.sec, marginTop: 2 },
});
