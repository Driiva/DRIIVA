"use strict";
/**
 * ACHIEVEMENTS ENGINE
 * ===================
 * Checks and unlocks achievements based on driving profile and trip data.
 * Called after each trip completion in a non-blocking fire-and-forget manner.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACHIEVEMENT_DEFINITIONS = void 0;
exports.checkAndUnlockAchievements = checkAndUnlockAchievements;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const types_1 = require("../types");
const db = admin.firestore();
exports.ACHIEVEMENT_DEFINITIONS = [
    {
        id: 'first-trip',
        name: 'First Journey',
        description: 'Complete your first tracked trip',
        icon: 'Car',
        category: 'milestone',
        maxProgress: null,
        check: (profile) => profile.totalTrips >= 1,
    },
    {
        id: 'smooth-operator',
        name: 'Smooth Operator',
        description: '10 trips without hard braking',
        icon: 'Shield',
        category: 'safety',
        maxProgress: 10,
        check: (profile) => profile.totalTrips >= 10,
    },
    {
        id: 'century-club',
        name: 'Century Club',
        description: 'Complete 100 safe trips',
        icon: 'Target',
        category: 'milestone',
        maxProgress: 100,
        check: (profile) => profile.totalTrips >= 100,
    },
    {
        id: 'high-scorer',
        name: 'High Scorer',
        description: 'Achieve a driving score of 90+',
        icon: 'Star',
        category: 'safety',
        maxProgress: null,
        check: (profile) => profile.currentScore >= 90,
    },
    {
        id: 'road-warrior',
        name: 'Road Warrior',
        description: 'Drive 500+ miles safely',
        icon: 'Route',
        category: 'milestone',
        maxProgress: 500,
        check: (profile) => profile.totalMiles >= 500,
    },
    {
        id: 'streak-master',
        name: 'Streak Master',
        description: 'Maintain a 7-day driving streak',
        icon: 'Flame',
        category: 'safety',
        maxProgress: 7,
        check: (profile) => profile.streakDays >= 7,
    },
    {
        id: 'night-owl',
        name: 'Night Owl',
        description: 'Complete a safe night trip (after 9pm)',
        icon: 'Moon',
        category: 'safety',
        maxProgress: null,
        check: (_profile, trip) => {
            const startHour = trip.startedAt?.toDate?.()?.getHours?.() ?? 12;
            return startHour >= 21 && trip.score >= 70;
        },
    },
    {
        id: 'perfect-score',
        name: 'Perfect Score',
        description: 'Score 100 on a single trip',
        icon: 'Award',
        category: 'safety',
        maxProgress: null,
        check: (_profile, trip) => trip.score >= 100,
    },
];
/**
 * Check and unlock eligible achievements for a user after a trip.
 * Returns an array of achievement IDs that were newly unlocked.
 */
async function checkAndUnlockAchievements(userId, profile, trip, tripId) {
    const userAchRef = db.collection(types_1.COLLECTION_NAMES.USERS).doc(userId).collection('achievements');
    const existingSnap = await userAchRef.get();
    const alreadyUnlocked = new Set(existingSnap.docs.map(d => d.id));
    const newlyUnlocked = [];
    for (const def of exports.ACHIEVEMENT_DEFINITIONS) {
        if (alreadyUnlocked.has(def.id))
            continue;
        try {
            if (def.check(profile, trip)) {
                await userAchRef.doc(def.id).set({
                    achievementId: def.id,
                    unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
                    tripId,
                });
                newlyUnlocked.push(def.id);
            }
        }
        catch (err) {
            functions.logger.warn(`[Achievements] Error checking ${def.id}:`, err);
        }
    }
    return newlyUnlocked;
}
//# sourceMappingURL=achievements.js.map