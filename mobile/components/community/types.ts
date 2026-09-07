/**
 * The shapes the Community screen reads its Firestore documents into, and the
 * empty standing it starts from. Extracted verbatim from
 * mobile/app/(tabs)/community.tsx.
 */
export type Scope = 'everyone' | 'circle';

export interface Ranking {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  totalMiles: number;
  totalTrips: number;
  change: number;
}

export interface Standing {
  currentScore: number | null;
  sharePercentage: number | null;
  totalTrips: number;
  totalMiles: number;
  streakDays: number;
}

export interface PoolState {
  activeParticipants: number;
  averagePoolScore: number;
}

export const EMPTY_STANDING: Standing = {
  currentScore: null,
  sharePercentage: null,
  totalTrips: 0,
  totalMiles: 0,
  streakDays: 0,
};
