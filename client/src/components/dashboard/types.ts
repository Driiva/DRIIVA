/**
 * The shape demo mode stores in sessionStorage. Extracted from
 * client/src/pages/dashboard.tsx.
 */
export interface DemoUser {
  id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  premium_amount?: number;
  premiumAmount?: number;
  personal_score?: number;
  community_score?: number;
  overall_score?: number;
  drivingScore?: number;
  totalMiles?: number;
  projectedRefund?: number;
  trips?: Array<{
    id: number;
    from: string;
    to: string;
    score: number;
    distance: number;
    date: string;
  }>;
  poolTotal?: number;
  poolShare?: number;
  safetyFactor?: number;
}
