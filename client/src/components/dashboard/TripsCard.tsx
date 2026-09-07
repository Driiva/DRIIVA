/**
 * Your trips card: the recent-trip list, the total-miles row and the start
 * button. Extracted verbatim from client/src/pages/dashboard.tsx.
 */
import { motion } from 'framer-motion';
import { Car, Navigation, Play } from 'lucide-react';
import { item } from '@/lib/animations';

interface DashboardTrip {
  id: number | string;
  from: string;
  to: string;
  score: number;
  distance: number;
  date: string;
}

interface TripsCardProps {
  trips: DashboardTrip[];
  totalMiles: number;
  haptics: { medium: () => void };
  setLocation: (path: string) => void;
}

export function TripsCard({ trips, totalMiles, haptics, setLocation }: TripsCardProps) {
  return (
        <motion.div variants={item} className="instrument-card mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Your trips</h2>
            <Car className="w-5 h-5 text-white/60" />
          </div>
          {trips.length > 0 ? (
            <div className="space-y-3">
              {trips.map((trip) => (
                <motion.div
                  key={trip.id}
                  whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="bg-white/5 rounded-xl p-3 border border-white/10 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{trip.from} → {trip.to}</span>
                    <span className={`text-sm font-bold tabular ${trip.score >= 80 ? 'text-emerald-400' : trip.score >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {trip.score}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span className="tabular">{trip.distance} mi</span>
                    <span>{trip.date}</span>
                  </div>
                </motion.div>
              ))}
              <div className="pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Total Miles</span>
                  <span className="text-white font-semibold tabular">{totalMiles.toLocaleString()} mi</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                <Car className="w-8 h-8 text-white/60" />
              </div>
              <p className="text-white/60 text-sm">Start driving to see your first trip!</p>
              <p className="text-white/60 text-xs mt-1">Your journey data will appear here</p>
            </div>
          )}
          
          {/* Start Trip Button */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={() => { haptics.medium(); setLocation('/trip-recording'); }}
            className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-300 font-semibold hover:from-emerald-500/30 hover:to-teal-500/30 transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Start New Trip
            <Navigation className="w-4 h-4" />
          </motion.button>
        </motion.div>
  );
}
