import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Map, Clock, Navigation, Trophy, Calendar } from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';

interface Trip {
  id: number;
  startLocation: string;
  endLocation: string;
  startTime: string;
  endTime: string;
  distance: string;
  duration: number;
  score: number;
  hardBrakingEvents: number;
  harshAcceleration: number;
  speedViolations: number;
}

interface TripTimelineProps {
  trips: Trip[];
}

const TripTimeline: React.FC<TripTimelineProps> = ({ trips }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [activeDate, setActiveDate] = useState<string>('');
  const [visibleDates, setVisibleDates] = useState<Set<string>>(new Set());

  // Group trips by date
  const groupedTrips = trips.reduce((acc, trip) => {
    const date = format(parseISO(trip.startTime), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(trip);
    return acc;
  }, {} as Record<string, Trip[]>);

  const sortedDates = Object.keys(groupedTrips).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  const formatDateHeader = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#10B981]';
    if (score >= 60) return 'text-[#F59E0B]';
    return 'text-[#EF4444]';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-[#10B981] bg-opacity-20';
    if (score >= 80) return 'bg-[#F59E0B] bg-opacity-20';
    return 'bg-[#EF4444] bg-opacity-20';
  };

  // Intersection Observer for date highlighting
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const newVisibleDates = new Set<string>();
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const date = entry.target.getAttribute('data-date');
            if (date) {
              newVisibleDates.add(date);
            }
          }
        });
        setVisibleDates(newVisibleDates);
        
        if (newVisibleDates.size > 0) {
          const latestDate = Array.from(newVisibleDates).sort((a, b) => 
            new Date(b).getTime() - new Date(a).getTime()
          )[0];
          setActiveDate(latestDate);
        }
      },
      {
        root: timelineRef.current,
        rootMargin: '-50px 0px -50px 0px',
        threshold: 0.3,
      }
    );

    const dateHeaders = timelineRef.current?.querySelectorAll('[data-date]');
    dateHeaders?.forEach((header) => observer.observe(header));

    return () => observer.disconnect();
  }, [trips]);

  const scrollToDate = (dateStr: string) => {
    const element = timelineRef.current?.querySelector(`[data-date="${dateStr}"]`);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }
  };

  return (
    <div className="relative">
      {/* Date Navigation */}
      <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {sortedDates.map((date) => (
          <button
            key={date}
            onClick={() => scrollToDate(date)}
            className={`
              flex items-center space-x-2 px-4 py-2 rounded-xl whitespace-nowrap
              transition-all duration-300 ease-out relative z-20
              ${activeDate === date 
                ? 'glass-morphism border-[#06B6D4] text-white' 
                : 'bg-gray-800 bg-opacity-60 text-gray-300 hover:text-white hover:bg-opacity-80'
              }
            `}
          >
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">
              {formatDateHeader(date)}
            </span>
            <Badge variant="outline" className="ml-1 text-xs">
              {groupedTrips[date].length}
            </Badge>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div 
        ref={timelineRef}
        className="relative max-h-[70vh] overflow-y-auto scrollbar-hide scroll-smooth"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-px opacity-60" style={{ background: 'linear-gradient(to bottom, var(--app-primary), transparent)' }} />
          
          {sortedDates.map((date, dateIndex) => (
            <div key={date} className="relative">
              {/* Date Header */}
              <div 
                data-date={date}
                className={`
                  sticky top-0 z-30 mb-4 transition-all duration-500
                  ${visibleDates.has(date) ? 'opacity-100 transform translate-y-0' : 'opacity-60 transform translate-y-2'}
                `}
              >
                <div className="flex items-center space-x-4">
                  <div className={`
                    w-6 h-6 rounded-full border-2 flex items-center justify-center relative z-10
                    ${activeDate === date 
                      ? 'bg-[#06B6D4] border-[#06B6D4] shadow-lg shadow-[#06B6D4]/30' 
                      : 'bg-gray-700 border-gray-600'
                    }
                    transition-all duration-300
                  `}>
                    <div className={`w-2 h-2 rounded-full ${
                      activeDate === date ? 'bg-white' : 'bg-gray-400'
                    }`} />
                  </div>
                  <div className="glass-morphism px-4 py-2 rounded-xl border-gray-600">
                    <h3 className="text-lg font-semibold text-white">
                      {formatDateHeader(date)}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {groupedTrips[date].length} trip{groupedTrips[date].length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trips for this date */}
              <div className="ml-16 space-y-4 pb-8">
                {groupedTrips[date].map((trip, tripIndex) => (
                  <Card 
                    key={trip.id} 
                    className={`
                      glass-morphism border-gray-700 relative z-20
                      transform transition-all duration-500 ease-out
                      hover:scale-[1.02] hover:border-[#06B6D4]/50
                      animate-in fade-in slide-in-from-left-4
                    `}
                    style={{
                      animationDelay: `${tripIndex * 100}ms`,
                      animationDuration: '600ms',
                      animationFillMode: 'both'
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`
                            w-12 h-12 rounded-xl flex items-center justify-center
                            ${getScoreBgColor(trip.score)}
                          `}>
                            <Map className={`w-6 h-6 ${getScoreColor(trip.score)}`} />
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {trip.startLocation} → {trip.endLocation}
                            </div>
                            <div className="text-sm text-gray-400 flex items-center space-x-2">
                              <Clock className="w-4 h-4" />
                              <span>{format(parseISO(trip.startTime), 'h:mm a')}</span>
                              <span>•</span>
                              <span>{trip.duration} min</span>
                              <Navigation className="w-4 h-4 ml-2" />
                              <span>{Number(trip.distance || 0).toFixed(1)} miles</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-1">
                            <Trophy className={`w-4 h-4 ${getScoreColor(trip.score)}`} />
                            <span className={`text-lg font-bold ${getScoreColor(trip.score)}`}>
                              {trip.score || 0}
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">Score</div>
                        </div>
                      </div>
                      
                      {/* Trip events */}
                      {(trip.hardBrakingEvents > 0 || trip.harshAcceleration > 0 || trip.speedViolations > 0) && (
                        <div className="mt-3 pt-3 border-t border-gray-600">
                          <div className="flex items-center space-x-4 text-xs">
                            {trip.hardBrakingEvents > 0 && (
                              <Badge variant="outline" className="text-[#EF4444] border-[#EF4444]">
                                {trip.hardBrakingEvents} hard braking
                              </Badge>
                            )}
                            {trip.harshAcceleration > 0 && (
                              <Badge variant="outline" className="text-[#F59E0B] border-[#F59E0B]">
                                {trip.harshAcceleration} harsh acceleration
                              </Badge>
                            )}
                            {trip.speedViolations > 0 && (
                              <Badge variant="outline" className="text-[#EF4444] border-[#EF4444]">
                                {trip.speedViolations} speed violations
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TripTimeline;