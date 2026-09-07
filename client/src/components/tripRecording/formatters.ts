/**
 * Display formatting for the live trip readout: clock, distance and speed.
 * Extracted verbatim from client/src/pages/trip-recording.tsx.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return miles < 0.1 ? `${Math.round(meters)} m` : `${miles.toFixed(2)} mi`;
}

export function formatSpeed(metersPerSecond: number | null): string {
  if (metersPerSecond === null || metersPerSecond <= 0) return '0 mph';
  const mph = metersPerSecond * 2.237;
  return `${Math.round(mph)} mph`;
}

