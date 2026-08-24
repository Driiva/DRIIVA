/**
 * Trips - Driiva Mobile
 *
 * Wave C (C4) replaces the hard `.limit(50)` with real cursor pagination on a
 * FlashList. The list keeps a realtime head page so a trip that finishes
 * scoring while the screen is open appears without a refresh, and appends older
 * pages behind it as the driver scrolls. Cursor logic is shared with web and
 * admin (shared/pagination.ts), including the fetch-one-extra hasMore trick.
 *
 * FlashList rather than FlatList: a driver's history grows without bound and
 * this is a fixed-row-height list, which is exactly what FlashList recycles
 * well. TradeMind's plain FlatList is not the pattern to copy here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { firestore } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { C, T, S, ROW } from '@/components/ui/theme';
import { TripCard } from '@/components/ui/TripCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { fetchTripPage, tripCursor } from '@/lib/trips';
import { tick } from '@/components/ui/motion';

const PAGE_SIZE = 25;

interface Trip {
  id: string;
  score: number;
  distanceMeters: number;
  durationSeconds: number;
  startedAt: { toDate?: () => Date } | string | null;
  routeSummary?: string;
  status: string;
}

function toTrip(id: string, data: Record<string, unknown>): Trip {
  const d = data as Partial<Trip>;
  return {
    id,
    score: typeof d.score === 'number' ? d.score : 0,
    distanceMeters: typeof d.distanceMeters === 'number' ? d.distanceMeters : 0,
    durationSeconds: typeof d.durationSeconds === 'number' ? d.durationSeconds : 0,
    startedAt: d.startedAt ?? null,
    routeSummary: d.routeSummary,
    status: typeof d.status === 'string' ? d.status : 'completed',
  };
}

function formatDate(ts: Trip['startedAt']): string {
  const date = typeof ts === 'string' ? new Date(ts) : ts?.toDate?.();
  if (!date) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Trips() {
  const { user } = useAuth();
  const router = useRouter();

  const [head, setHead] = useState<Trip[] | null>(null);
  const [older, setOlder] = useState<Trip[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pageError, setPageError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cursorRef = useRef<string | null>(null);
  // A ref, not state: a fast fling fires onEndReached again before a state
  // update lands, and the same page would be appended twice.
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = firestore()
      .collection('trips')
      .where('userId', '==', user.id)
      .where('status', '==', 'completed')
      .orderBy('startedAt', 'desc')
      .limit(PAGE_SIZE)
      .onSnapshot(
        (snapshot: { docs: { id: string; data: () => Record<string, unknown> }[] }) => {
          setHead(snapshot.docs.map((doc) => toTrip(doc.id, doc.data())));
        },
        () => setHead([]),
      );

    return unsubscribe;
  }, [user?.id]);

  const resetPages = useCallback(() => {
    cursorRef.current = null;
    inFlightRef.current = false;
    setOlder([]);
    setHasMore(true);
    setPageError(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!user?.id || inFlightRef.current || !hasMore || !head || head.length < PAGE_SIZE) return;

    const startCursor = cursorRef.current ?? tripCursor(head[head.length - 1].id);
    inFlightRef.current = true;
    setLoadingMore(true);
    setPageError(false);

    try {
      const page = await fetchTripPage(user.id, startCursor, toTrip, PAGE_SIZE);
      setOlder((prev) => [...prev, ...page.items]);
      cursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
    } catch (err) {
      console.error('[trips] page load failed', err);
      setPageError(true);
    } finally {
      inFlightRef.current = false;
      setLoadingMore(false);
    }
  }, [user?.id, hasMore, head]);

  const onRefresh = useCallback(() => {
    // The head is a live subscription, so this gesture drops the appended
    // pages rather than refetching. The haptic is the acknowledgement.
    tick('select');
    setRefreshing(true);
    resetPages();
    // The head is a live subscription and is already current; this gesture
    // drops the appended pages so the list rebuilds from the top.
    setRefreshing(false);
  }, [resetPages]);

  // A trip can appear in both the head and an appended page if a new trip lands
  // between the two reads and shifts the window. Render each id once.
  const seen = new Set<string>();
  const trips = [...(head ?? []), ...older].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  if (head === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>Your trips</Text>
        <View style={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonLoader
              key={i}
              width="100%"
              height={ROW.trip}
              borderRadius={16}
              style={{ marginBottom: S.sm }}
            />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Your trips</Text>
      <FlashList
        data={trips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <EmptyState
            icon="car-outline"
            title="No trips yet"
            subtitle="Record a drive and it appears here once it has been scored."
            action={{ label: 'Record a drive', onPress: () => router.push('/(tabs)/record') }}
          />
        }
        ListFooterComponent={
          <TripsFooter
            loadingMore={loadingMore}
            pageError={pageError}
            hasMore={hasMore}
            count={trips.length}
            onRetry={() => void loadMore()}
          />
        }
        /*
         * No entrance animation on the rows, deliberately. This list is opened
         * many times a day and recycled while it scrolls, and the frequency
         * tier where a cascade earns its place is "occasional", not "every
         * time the driver checks a trip". Press feedback is the motion this
         * screen needs; a stagger here would only make it feel slower.
         */
        renderItem={({ item }) => (
          <TripCard
            trip={{
              id: item.id,
              score: Math.round(item.score),
              distanceMeters: item.distanceMeters,
              durationSeconds: item.durationSeconds,
              routeSummary: item.routeSummary || formatDate(item.startedAt) || 'Trip',
              startedAt: formatDate(item.startedAt),
            }}
            onPress={() => router.push(`/trips/${item.id}`)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function TripsFooter({
  loadingMore,
  pageError,
  hasMore,
  count,
  onRetry,
}: {
  loadingMore: boolean;
  pageError: boolean;
  hasMore: boolean;
  count: number;
  onRetry: () => void;
}) {
  if (loadingMore) {
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  if (pageError) {
    return (
      <View style={styles.footer}>
        <Text style={styles.footerText}>Could not load older trips.</Text>
        <Text style={styles.retry} onPress={onRetry}>
          Try again
        </Text>
      </View>
    );
  }

  if (!hasMore && count > PAGE_SIZE) {
    return (
      <View style={styles.footer}>
        <Text style={styles.footerText}>That is your full trip history.</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  title: {
    ...T.h1,
    color: C.text.hero,
    paddingHorizontal: S.md,
    paddingTop: S.md,
    paddingBottom: S.sm,
  },
  list: { paddingHorizontal: S.md, paddingBottom: 100 },
  footer: { paddingVertical: S.lg, alignItems: 'center' },
  footerText: { ...T.caption, color: C.text.mut },
  retry: { ...T.label, color: C.primary, marginTop: S.sm },
});
