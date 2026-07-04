"use strict";
/**
 * Neon PostgreSQL client for Cloud Functions.
 * Set DATABASE_URL in Firebase config: firebase functions:config:set db.url="postgresql://..."
 * Or set DATABASE_URL in .env when running locally.
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
exports.getPgUserIdByFirebaseUid = getPgUserIdByFirebaseUid;
exports.insertUserFromFirebase = insertUserFromFirebase;
exports.insertTripSummary = insertTripSummary;
const serverless_1 = require("@neondatabase/serverless");
const ws = __importStar(require("ws"));
serverless_1.neonConfig.webSocketConstructor = ws;
let pool = null;
function getPool() {
    const url = process.env.DATABASE_URL ?? '';
    if (!url || url.startsWith('file:')) {
        throw new Error('DATABASE_URL must be a PostgreSQL connection string. Set it via Firebase Secrets (functions:secrets:set DATABASE_URL).');
    }
    if (!pool) {
        pool = new serverless_1.Pool({ connectionString: url });
    }
    return pool;
}
async function getPgUserIdByFirebaseUid(firebaseUid) {
    const p = getPool();
    const r = await p.query('SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1', [firebaseUid]);
    const row = r.rows?.[0];
    return row ? row.id : null;
}
async function insertUserFromFirebase(firebaseUid, email, displayName) {
    const p = getPool();
    // Append last 4 chars of Firebase UID to prevent username collisions between
    // users who share the same email prefix (e.g. user@gmail.com vs user@yahoo.com).
    const emailPrefix = email.includes('@') ? email.split('@')[0].toLowerCase() : email.toLowerCase();
    const username = `${emailPrefix}_${firebaseUid.slice(-4)}`;
    const r = await p.query(`INSERT INTO users (firebase_uid, email, display_name, username, onboarding_complete, created_by, updated_by)
     VALUES ($1, $2, $3, $4, false, 'firebase-auth', 'firebase-auth')
     ON CONFLICT (firebase_uid) DO UPDATE SET email = EXCLUDED.email, display_name = COALESCE(EXCLUDED.display_name, users.display_name), username = COALESCE(EXCLUDED.username, users.username), updated_at = NOW()
     RETURNING id`, [firebaseUid, email, displayName, username]);
    const rows = r.rows;
    const row = rows?.[0];
    if (!row)
        throw new Error('Insert user failed');
    const userId = row.id;
    await p.query(`INSERT INTO driving_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
    return userId;
}
async function insertTripSummary(row) {
    const p = getPool();
    await p.query(`INSERT INTO trips_summary (
      user_id, firestore_trip_id, started_at, ended_at, distance_km, duration_seconds, score,
      hard_braking_events, harsh_acceleration, speed_violations, night_driving, sharp_corners,
      start_address, end_address, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'syncTripOnComplete')
    ON CONFLICT (firestore_trip_id) DO NOTHING`, [
        row.userId,
        row.firestoreTripId,
        row.startedAt,
        row.endedAt,
        row.distanceKm,
        row.durationSeconds,
        row.score,
        row.hardBrakingEvents ?? 0,
        row.harshAcceleration ?? 0,
        row.speedViolations ?? 0,
        row.nightDriving ?? false,
        row.sharpCorners ?? 0,
        row.startAddress ?? null,
        row.endAddress ?? null,
    ]);
}
//# sourceMappingURL=neon.js.map