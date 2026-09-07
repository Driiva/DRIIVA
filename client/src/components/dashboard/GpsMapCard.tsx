/**
 * Collapsible live-location card. The Leaflet bundle stays lazy and is only
 * mounted once the card is expanded. Extracted verbatim from
 * client/src/pages/dashboard.tsx.
 */
import { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import MapLoader from '@/components/MapLoader';
import { item } from '@/lib/animations';

const LeafletMap = lazy(() => import('@/components/LeafletMap'));

interface GpsMapCardProps {
  mapExpanded: boolean;
  setMapExpanded: (updater: (prev: boolean) => boolean) => void;
  lastTripRoutePoints: Array<{ lat: number; lng: number }>;
}

export function GpsMapCard({ mapExpanded, setMapExpanded, lastTripRoutePoints }: GpsMapCardProps) {
  return (
        <motion.div variants={item} className="instrument-card mb-4">
          <button
            onClick={() => setMapExpanded((prev) => !prev)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Live location</h2>
            </div>
            {mapExpanded ? (
              <ChevronUp className="w-5 h-5 text-white/60" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/60" />
            )}
          </button>
          <AnimatePresence initial={false}>
            {mapExpanded && (
              <motion.div
                key="map-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="pt-4">
                  <Suspense fallback={<MapLoader />}>
                    <LeafletMap
                      className="border border-white/10"
                      routePoints={lastTripRoutePoints.length >= 2 ? lastTripRoutePoints : undefined}
                    />
                  </Suspense>
                  <p className="text-white/60 text-xs mt-3 text-center">
                    {lastTripRoutePoints.length >= 2
                      ? 'Toggle between your live location and last trip route'
                      : 'Showing your current location'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
  );
}
