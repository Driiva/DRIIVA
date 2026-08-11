/**
 * Neon PostgreSQL client for Cloud Functions.
 * Set DATABASE_URL in Firebase config: firebase functions:config:set db.url="postgresql://..."
 * Or set DATABASE_URL in .env when running locally.
 */

import * as functions from 'firebase-functions';
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as ws from 'ws';

neonConfig.webSocketConstructor = ws;

let pool: Pool | null = null;

function getPool(): Pool {
  const fromEnv = typeof process.env.DATABASE_URL === 'string' ? process.env.DATABASE_URL : '';
  const fromConfig = (functions.config().db as { url?: string } | undefined)?.url ?? '';
  const url = fromEnv || fromConfig;
  if (!url || url.startsWith('file:')) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL. Set via firebase functions:config:set db.url="postgresql://..." or .env');
  }
  if (!pool) {
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

export async function getPgUserIdByFirebaseUid(firebaseUid: string): Promise<number | null> {
  const p = getPool();
  const r = await p.query('SELECT id FROM users WHERE firebase_uid = $1 LIMIT 1', [firebaseUid]);
  const row = (r as { rows: { id: number }[] }).rows?.[0];
  return row ? row.id : null;
}

export async function insertUserFromFirebase(firebaseUid: string, email: string, displayName: string | null): Promise<number> {
  const p = getPool();
  const username = email.includes('@') ? email.split('@')[0].toLowerCase() : email.toLowerCase();
  const r = await p.query(
    `INSERT INTO users (firebase_uid, email, display_name, username, onboarding_complete, created_by, updated_by)
     VALUES ($1, $2, $3, $4, false, 'firebase-auth', 'firebase-auth')
     ON CONFLICT (firebase_uid) DO UPDATE SET email = EXCLUDED.email, display_name = COALESCE(EXCLUDED.display_name, users.display_name), username = COALESCE(EXCLUDED.username, users.username), updated_at = NOW()
     RETURNING id`,
    [firebaseUid, email, displayName, username]
  );
  const rows = (r as { rows: { id: number }[] }).rows;
  const row = rows?.[0];
  if (!row) throw new Error('Insert user failed');
  const userId = row.id;
  await p.query(
    `INSERT INTO driving_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  return userId;
}

export async function insertTripSummary(row: {
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
}): Promise<void> {
  const p = getPool();
  await p.query(
    `INSERT INTO trips_summary (
      user_id, firestore_trip_id, started_at, ended_at, distance_km, duration_seconds, score,
      hard_braking_events, harsh_acceleration, speed_violations, night_driving, sharp_corners,
      start_address, end_address, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'syncTripOnComplete')
    ON CONFLICT (firestore_trip_id) DO NOTHING`,
    [
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
    ]
  );
}
