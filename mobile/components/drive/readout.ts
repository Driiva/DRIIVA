/**
 * The Drive screen's own shapes, unit constants and readout formatting.
 * Extracted verbatim from mobile/app/(tabs)/record.tsx.
 */
export interface LandedTrip {
  tripScore: number;
  previousOverallScore: number | null;
  newOverallScore: number | null;
  previousProjectedPence: number | null;
  newProjectedPence: number | null;
}

export interface LastDrive {
  miles: number;
  score: number;
  endedAt: Date;
}

export const METRES_PER_SECOND_TO_MPH = 2.23694;
export const METRES_PER_MILE = 1609.34;
/** How long "End drive" must be held. Long enough that a pocket cannot do it. */
export const HOLD_TO_END_MS = 600;

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDay(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export type FixQuality = 'good' | 'fair' | 'poor' | 'unknown';

export function fixQuality(accuracyMeters: number | null): FixQuality {
  if (accuracyMeters === null || !Number.isFinite(accuracyMeters) || accuracyMeters < 0) {
    return 'unknown';
  }
  if (accuracyMeters <= 10) return 'good';
  if (accuracyMeters <= 30) return 'fair';
  return 'poor';
}

export const QUALITY_LABEL: Record<FixQuality, string> = {
  good: 'strong',
  fair: 'fair',
  poor: 'weak',
  unknown: 'waiting',
};
