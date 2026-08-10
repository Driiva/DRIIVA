/**
 * TRIPS PAGE
 * ==========
 * Shows user's trip history with pull-to-refresh, swipeable cards, and shimmer loading.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { PageWrapper } from '../components/PageWrapper';
import { BottomNav } from '../components/BottomNav';
import { Map, Car, AlertCircle, Play, Navigation, RefreshCw, ChevronLeft } from "lucide-react";
import { useAuth } from '../contexts/AuthContext';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { COLLECTION_NAMES } from '../../../shared/firestore-types';
import type { TripDocument } from '../../../shared/firestore-types';
import { SwipeTripCard } from '@/components/SwipeTripCard';
import { TripCardShimmer } from '@/components/Shimmer';
import { PullToRefreshIndicator } from '@/components/PullToRefresh';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useHaptics } from '@/hooks/useHaptics';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { container, item } from '@/lib/animations';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCursorPagination } from '@/hooks/useCursorPagination';
import { encodeCursor } from '../../../shared/pagination';

/** Rows per page. The realtime head fetches this many; older pages match it. */
const TRIPS_PAGE_SIZE = 25;

// ============================================================================
// DEMO DATA
// ============================================================================

interface DemoTrip {
  tripId: string;
  from: string;
  to: string;
  score: number;
  distance: number;
  date: string;
  durationMinutes: number;
  hardBrakingCount: number;
  hardAccelerationCount: number;
  speedingSeconds: number;
}

const DEMO_TRIPS: DemoTrip[] = [
  {
    tripId: 'demo-trip-1',
    from: 'Home',
    to: 'Office',
    score: 92,
    distance: 12.3,
    date: 'Mon, 10 Feb',
    durationMinutes: 25,
    hardBrakingCount: 1,
    hardAccelerationCount: 0,
    speedingSeconds: 0,
  },
  {
    tripId: 'demo-trip-2',
    from: 'Office',
    to: 'Grocery Store',
    score: 88,
    distance: 5.7,
    date: 'Mon, 10 Feb',
    durationMinutes: 14,
    hardBrakingCount: 2,
    hardAccelerationCount: 1,
    speedingSeconds: 5,
  },
  {
    tripId: 'demo-trip-3',
    from: 'Grocery Store',
    to: 'Home',
    score: 95,
    distance: 6.1,
    date: 'Sun, 9 Feb',
    durationMinutes: 16,
    hardBrakingCount: 0,
    hardAccelerationCount: 0,
    speedingSeconds: 0,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function locationLabel(loc: TripDocument['startLocation']): string {
  if (loc.placeType && loc.placeType !== 'other') {
    return loc.placeType.charAt(0).toUpperCase() + loc.placeType.slice(1);
  }
  if (loc.address) {
    const first = loc.address.split(',')[0].trim();
    return first.length > 20 ? first.slice(0, 17) + '...' : first;
  }
  return 'Unknown';
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function Trips() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const haptics = useHaptics();

  const isDemoMode = typeof window !== 'undefined' && sessionStorage.getItem('driiva-demo-mode') === 'true';

  // Realtime trip history. Includes in-flight trips (recording/processing) so
  // a trip that is still being recorded or scored is visible in the list, and
  // a trip completing while this page is open updates live via onSnapshot
  // (no manual refresh). Ordered by startedAt because recording trips have no
  // endedAt yet. The status `in` filter is served by the existing composite
  // index (userId, status, startedAt); a status-less query would need a new
  // index that is not deployed.
  // Ordering and filters only. The realtime head applies its own limit; the
  // pagination hook applies pageSize + 1 per older page from the same base.
  const baseTripsQuery = useMemo(() => {
    if (isDemoMode || !user?.id || !isFirebaseConfigured || !db) return null;
    return query(
      collection(db, COLLECTION_NAMES.TRIPS),
      where('userId', '==', user.id),
      where('status', 'in', ['recording', 'processing', 'completed']),
      orderBy('startedAt', 'desc'),
    );
  }, [isDemoMode, user?.id]);

  const tripsQuery = useMemo(
    () => (baseTripsQuery ? query(baseTripsQuery, limit(TRIPS_PAGE_SIZE)) : null),
    [baseTripsQuery],
  );

  const { data: tripsData, loading, error: queryError, refresh } = useFirestoreQuery<TripDocument[]>(
    tripsQuery,
    { transform: (snapshot) => snapshot.docs.map(d => d.data() as TripDocument) },
  );
  const headTrips = useMemo(() => tripsData ?? [], [tripsData]);

  const transformTrip = useCallback(
    (snapshot: QueryDocumentSnapshot<DocumentData>) => snapshot.data() as TripDocument,
    [],
  );
  const {
    items: olderTrips,
    loadingMore,
    hasMore,
    error: paginationError,
    loadMore,
    reset: resetPagination,
  } = useCursorPagination<TripDocument>(baseTripsQuery, transformTrip, TRIPS_PAGE_SIZE);

  // Older pages are keyed off the head, so a change of user or filter must drop
  // them rather than leave one driver's history stitched below another's.
  useEffect(() => {
    resetPagination();
  }, [baseTripsQuery, resetPagination]);

  // A trip can appear in both the head and an older page if a new trip lands
  // between the two reads and shifts the window. Render by id, once.
  const trips = useMemo(() => {
    const seen = new Set<string>();
    return [...headTrips, ...olderTrips].filter((t) => {
      if (seen.has(t.tripId)) return false;
      seen.add(t.tripId);
      return true;
    });
  }, [headTrips, olderTrips]);

  // Continue after the last trip currently rendered.
  const headCursor = useMemo(() => {
    const last = headTrips[headTrips.length - 1];
    return last ? encodeCursor(`${COLLECTION_NAMES.TRIPS}/${last.tripId}`) : null;
  }, [headTrips]);

  // Infinite scroll: load the next page when the sentinel below the list comes
  // into view. Only armed once the head page is full, because a short head page
  // is already the whole history.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const canPaginate = headTrips.length >= TRIPS_PAGE_SIZE && hasMore && !paginationError;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !canPaginate || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore(headCursor);
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canPaginate, headCursor, loadMore]);

  const error = queryError ? 'Failed to load trips. Please try again.' : null;

  // Pull-to-refresh (realtime already keeps the list current; this stays for
  // the familiar gesture and to force a re-subscribe on demand).
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      resetPagination();
      refresh();
      await new Promise(r => setTimeout(r, 400));
    },
    disabled: isDemoMode,
  });

  const hasRealTrips = !isDemoMode && trips.length > 0;
  const hasDemoTrips = isDemoMode && DEMO_TRIPS.length > 0;
  const isEmpty = !loading && !error && !hasRealTrips && !hasDemoTrips;

  // Stats reflect completed trips only - in-flight trips have no final
  // distance or score to total up.
  const completedTrips = trips.filter(t => t.status === 'completed');
  const totalTrips = isDemoMode ? DEMO_TRIPS.length : completedTrips.length;
  const totalMiles = isDemoMode
    ? DEMO_TRIPS.reduce((sum, t) => sum + t.distance, 0)
    : completedTrips.reduce((sum, t) => sum + ((t.distanceMeters ?? 0) / 1609.34), 0);

  return (
    <PageWrapper>
      <div className="pb-24 text-white" {...pullToRefresh.handlers}>
        {/* Pull-to-refresh indicator */}
        <PullToRefreshIndicator
          pullDistance={pullToRefresh.pullDistance}
          progress={pullToRefresh.progress}
          refreshing={pullToRefresh.refreshing}
        />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-start justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { haptics.light(); setLocation('/dashboard'); }}
              aria-label="Back"
              className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </motion.button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-700/30 border border-white/10 flex items-center justify-center overflow-hidden">
                <img src="/logo.png" alt="Driiva" className="w-full h-full object-cover" />
              </div>
              <div style={{ marginTop: '2px' }}>
                <h1 className="text-xl font-bold text-white">Driiva</h1>
                <p className="text-sm text-white/60">Your trip history</p>
                {isDemoMode && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                    Demo Mode
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <h2 className="text-2xl font-bold text-white mb-2">Recent Trips</h2>

        {!loading && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-sm text-white/60">
              {totalTrips} trip{totalTrips !== 1 ? 's' : ''}
              {totalMiles > 0 && (
                <> · <AnimatedNumber value={totalMiles} decimals={1} className="text-white/60" suffix="mi total" /></>
              )}
            </p>
          </motion.div>
        )}

        {/* Shimmer loading skeleton */}
        {loading && (
          <div className="space-y-3">
            <TripCardShimmer />
            <TripCardShimmer />
            <TripCardShimmer />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="dashboard-glass-card p-6 text-center"
          >
            <AlertCircle className="w-10 h-10 text-red-400/60 mx-auto mb-3" />
            <p className="text-red-300 text-sm mb-4">{error}</p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { haptics.light(); refresh(); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white/70 text-sm hover:bg-white/15 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </motion.button>
          </motion.div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <EmptyState
            icon={<Car size={24} strokeWidth={2} />}
            heading="No trips yet"
            subtext="Your driving history and scores appear here once your first trip has been recorded and scored."
            action={
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { haptics.medium(); setLocation('/trip-recording'); }}
                className="inline-flex items-center gap-2 px-5 py-3 text-[14px] font-medium"
                style={{
                  borderRadius: 'var(--radius-button)',
                  background: 'var(--app-primary)',
                  color: 'var(--app-text-hero)',
                }}
              >
                <Play className="w-4 h-4" />
                Record your first trip
              </motion.button>
            }
          />
        )}

        {/* Demo trips list - using SwipeTripCard */}
        {isDemoMode && !loading && !error && (
          <motion.div
            className="space-y-3"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {DEMO_TRIPS.map((trip, index) => (
              <SwipeTripCard
                key={trip.tripId}
                tripId={trip.tripId}
                from={trip.from}
                to={trip.to}
                score={trip.score}
                distance={`${trip.distance} mi`}
                date={trip.date}
                duration={`${trip.durationMinutes} min`}
                events={{
                  braking: trip.hardBrakingCount,
                  acceleration: trip.hardAccelerationCount,
                  speeding: `${trip.speedingSeconds}s`,
                }}
                onTap={() => {}}
                index={index}
              />
            ))}
          </motion.div>
        )}

        {/* Real Firestore trips - using SwipeTripCard */}
        {hasRealTrips && !loading && !error && (
          <motion.div
            className="space-y-3"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {trips.map((trip, index) => {
              const isCompleted = trip.status === 'completed';
              const distanceMiles = ((trip.distanceMeters ?? 0) / 1609.34).toFixed(1);
              const durationMinutes = Math.round((trip.durationSeconds ?? 0) / 60);
              const startLabel = locationLabel(trip.startLocation);
              // Recording trips have no endLocation yet - fall back to start.
              const endLabel = trip.endLocation ? locationLabel(trip.endLocation) : startLabel;
              const tripDate = trip.startedAt?.toDate?.() ?? new Date();

              return (
                <SwipeTripCard
                  key={trip.tripId}
                  tripId={trip.tripId}
                  from={startLabel}
                  to={endLabel}
                  score={isCompleted ? Math.round(trip.score) : 0}
                  distance={`${distanceMiles} mi`}
                  date={tripDate.toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  duration={`${durationMinutes} min`}
                  events={{
                    braking: trip.events?.hardBrakingCount ?? 0,
                    acceleration: trip.events?.hardAccelerationCount ?? 0,
                    speeding: `${trip.events?.speedingSeconds ?? 0}s`,
                  }}
                  status={isCompleted ? 'completed' : (trip.status === 'recording' ? 'recording' : 'processing')}
                  flagged={trip.status === 'processing' && trip.anomalies?.flaggedForReview === true}
                  onTap={() => setLocation(`/trips/${trip.tripId}`)}
                  index={index}
                />
              );
            })}
          </motion.div>
        )}

        {/* Infinite scroll sentinel and its states. Rendered below the list so
            the observer only fires once the reader has reached the bottom. */}
        {hasRealTrips && !loading && !error && (
          <div className="mt-4" data-testid="trips-pagination">
            <div ref={sentinelRef} aria-hidden="true" />

            {loadingMore && (
              <div className="space-y-3" data-testid="trips-loading-more">
                <TripCardShimmer />
              </div>
            )}

            {paginationError && !loadingMore && (
              <div className="text-center py-4">
                <p className="text-sm text-white/60 mb-3">Could not load older trips.</p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { haptics.light(); void loadMore(headCursor); }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-[13px] text-white/70"
                  style={{
                    borderRadius: 'var(--radius-button)',
                    background: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Try again
                </motion.button>
              </div>
            )}

            {!hasMore && trips.length > TRIPS_PAGE_SIZE && (
              <p className="text-center text-[13px] text-white/55 py-4">
                That is your full trip history.
              </p>
            )}
          </div>
        )}

        {/* Start Trip Button */}
        {!loading && !error && !isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-6"
          >
            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              onClick={() => { haptics.medium(); setLocation('/trip-recording'); }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-300 font-semibold hover:from-emerald-500/30 hover:to-teal-500/30 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start New Trip
              <Navigation className="w-4 h-4" />
            </motion.button>
          </motion.div>
        )}
      </div>

      <BottomNav />
    </PageWrapper>
  );
}
