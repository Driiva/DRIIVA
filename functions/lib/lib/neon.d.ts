/**
 * Neon PostgreSQL client for Cloud Functions.
 * Set DATABASE_URL in Firebase config: firebase functions:config:set db.url="postgresql://..."
 * Or set DATABASE_URL in .env when running locally.
 */
export declare function getPgUserIdByFirebaseUid(firebaseUid: string): Promise<number | null>;
export declare function insertUserFromFirebase(firebaseUid: string, email: string, displayName: string | null): Promise<number>;
export declare function insertTripSummary(row: {
    userId: number;
    firestoreTripId: string;
    startedAt: Date;
    endedAt: Date;
    distanceKm: number;
    durationSeconds: number;
    score: number;
    hardBrakingEvents?: number;
    harshAcceleration?: number;
    speedViolations?: number;
    nightDriving?: boolean;
    sharpCorners?: number;
    startAddress?: string | null;
    endAddress?: string | null;
}): Promise<void>;
//# sourceMappingURL=neon.d.ts.map