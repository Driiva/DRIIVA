import { Map, Clock, Navigation } from "lucide-react";

interface Trip {
  id: number;
  endLocation: string;
  duration: number;
  distance: string;
  score: number;
  createdAt: string;
}

interface RecentTripsProps {
  trips: Trip[];
}

export default function RecentTrips({ trips }: RecentTripsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent trips</h3>
        <button className="text-[#8B4513] text-sm font-medium haptic-button">
          View All
        </button>
      </div>

      <div className="space-y-3">
        {trips.map((trip) => (
          <div key={trip.id} className="rounded-2xl p-4" style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
          }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-[#8B4513] bg-opacity-20 rounded-xl flex items-center justify-center">
                  <Map className="w-6 h-6 text-[#8B4513]" />
                </div>
                <div>
                  <div className="font-medium text-white">
                    {trip.endLocation || 'Unknown Destination'}
                  </div>
                  <div className="text-sm text-gray-400 flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>{trip.duration} min</span>
                    <Navigation className="w-4 h-4" />
                    <span>{Number(trip.distance).toFixed(1)} miles</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${getScoreColor(trip.score)} drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]`} style={{ 
                  textShadow: '2px 2px 4px rgba(0,0,0,0.9), -1px -1px 2px rgba(0,0,0,0.7)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: '700'
                }}>
                  {trip.score}
                </div>
                <div className="text-xs text-gray-400">Score</div>
              </div>
            </div>
          </div>
        ))}
        
        {(!trips || trips.length === 0) && (
          <div className="text-center py-8">
            <Map className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No recent trips</p>
          </div>
        )}
      </div>
    </section>
  );
}
