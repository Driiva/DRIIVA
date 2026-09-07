// Core user types
export interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  premiumAmount: string;
  phoneNumber?: string;
}

// Dashboard specific types
export interface MetricUser extends User {
  currentScore?: number;
  projectedRefund?: number;
}

export interface CommunityPoolData {
  poolAmount: number;
  safetyFactor: number;
  participantCount: number;
  safeDriverCount: number;
  averageScore: number;
}

export interface DrivingProfile {
  id: number;
  userId: number;
  currentScore: number;
  lifetimeScore?: number;
  totalTrips: number;
  totalMiles: number;
  hardBrakingScore: number;
  accelerationScore: number;
  speedAdherenceScore: number;
  nightDrivingScore: number;
  corneringScore: number;
  consistencyScore: number;
  projectedRefund: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Achievement {
  id: number;
  name: string;
  description: string;
  iconUrl: string;
  unlockedAt: string;
}

export interface LeaderboardEntry {
  id: number;
  userId: number;
  rank: number;
  score: number;
  weeklyScore: number;
  username?: string;
  weeklyChange?: number;
  changeType?: 'up' | 'down' | 'same';
}

// Auth types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error?: Error;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: {
    code: number;
    message: string;
    timestamp: string;
  };
}

// Trip types
export interface Trip {
  id: string;
  userId: number;
  startLocation: string;
  endLocation: string;
  startTime: Date;
  endTime: Date;
  distance: number;
  duration: number;
  score: number;
  hardBrakingEvents: number;
  harshAcceleration: number;
  speedViolations: number;
  nightDriving: boolean;
  sharpCorners: number;
  /**
   * The raw sensor payload as the provider sent it. Left unstructured because
   * it is stored and forwarded, never read field by field here; `unknown`
   * rather than `any` so anything that does read it has to narrow first.
   */
  telematicsData?: unknown;
  createdAt: Date;
}