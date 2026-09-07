/**
 * The driving-events panel shown mid-trip. Extracted verbatim from
 * client/src/pages/trip-recording.tsx.
 */
import { Zap } from 'lucide-react';
import type { TripEvents } from '@/lib/tripService';

interface DrivingEventsProps {
  tripEvents: TripEvents;
}

export function DrivingEvents({ tripEvents }: DrivingEventsProps) {
  return (
          <div className="glass-card rounded-2xl p-4 mb-6">
            <h3 className="font-semibold mb-3 flex items-center">
              <Zap className="w-4 h-4 mr-2 text-yellow-500" />
              Driving Events
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {tripEvents.speedingSeconds > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Speeding</span>
                  <span>{tripEvents.speedingSeconds}s</span>
                </div>
              )}
              {tripEvents.hardBrakingCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Hard Braking</span>
                  <span>{tripEvents.hardBrakingCount}</span>
                </div>
              )}
            </div>
          </div>
  );
}
