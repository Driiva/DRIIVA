/**
 * ACHIEVEMENTS ENGINE
 * ===================
 * Checks and unlocks achievements based on driving profile and trip data.
 * Called after each trip completion in a non-blocking fire-and-forget manner.
 */
import { DrivingProfileData, TripDocument } from '../types';
export interface AchievementDefinition {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'safety' | 'community' | 'refund' | 'milestone';
    maxProgress: number | null;
    check: (profile: DrivingProfileData, trip: TripDocument) => boolean;
}
export declare const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[];
/**
 * Check and unlock eligible achievements for a user after a trip.
 * Returns an array of achievement IDs that were newly unlocked.
 */
export declare function checkAndUnlockAchievements(userId: string, profile: DrivingProfileData, trip: TripDocument, tripId: string): Promise<string[]>;
//# sourceMappingURL=achievements.d.ts.map