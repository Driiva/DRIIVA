/**
 * The three live figures shown while a trip is recording: distance, speed and
 * accepted points. Extracted verbatim from client/src/pages/trip-recording.tsx.
 */
import { MapPin, Navigation, Route } from 'lucide-react';

import { formatDistance, formatSpeed } from './formatters';
import type { TripStats } from './types';

interface LiveStatsProps {
  tripStats: TripStats;
}

export function LiveStats({ tripStats }: LiveStatsProps) {
  return (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="glass-card rounded-2xl p-4 text-center">
              <Route className="w-5 h-5 text-[#8B4513] mx-auto mb-2" />
              <div className="text-lg font-bold">{formatDistance(tripStats.distanceMeters)}</div>
              <div className="text-xs text-gray-400">Distance</div>
            </div>

            <div className="glass-card rounded-2xl p-4 text-center">
              <Navigation className="w-5 h-5 text-[#B87333] mx-auto mb-2" />
              <div className="text-lg font-bold">{formatSpeed(tripStats.avgSpeed)}</div>
              <div className="text-xs text-gray-400">Speed</div>
            </div>

            <div className="glass-card rounded-2xl p-4 text-center">
              <MapPin className="w-5 h-5 text-green-500 mx-auto mb-2" />
              <div className="text-lg font-bold">{tripStats.pointsCount}</div>
              <div className="text-xs text-gray-400">Points</div>
            </div>
          </div>
  );
}
