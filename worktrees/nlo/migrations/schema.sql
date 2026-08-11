-- =============================================================================
-- Driiva Production Schema (Neon PostgreSQL)
-- =============================================================================
-- Run this against your Neon instance after creating the database.
-- Usage: psql "$DATABASE_URL" -f migrations/schema.sql
-- Or in Neon SQL Editor: paste and run each section.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- USERS (Firebase Auth + legacy username/password)
-- Single source of truth for profiles; onboarding_complete lives here.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  firebase_uid TEXT UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  username TEXT UNIQUE,
  password TEXT,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  date_of_birth TIMESTAMP WITH TIME ZONE,
  license_number TEXT,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  premium_amount DECIMAL(10, 2) DEFAULT 500.00,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS users_firebase_uid_idx ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- -----------------------------------------------------------------------------
-- TRIPS_SUMMARY (synced from Firestore on trip completion)
-- Real-time trip data stays in Firestore; summaries here for API/analytics.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trips_summary (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  firestore_trip_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
  distance_km DECIMAL(10, 2) NOT NULL,
  duration_seconds INTEGER NOT NULL,
  score INTEGER NOT NULL,
  hard_braking_events INTEGER DEFAULT 0,
  harsh_acceleration INTEGER DEFAULT 0,
  speed_violations INTEGER DEFAULT 0,
  night_driving BOOLEAN DEFAULT false,
  sharp_corners INTEGER DEFAULT 0,
  start_address TEXT,
  end_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS trips_summary_user_id_idx ON trips_summary(user_id);
CREATE INDEX IF NOT EXISTS trips_summary_started_at_idx ON trips_summary(started_at);
CREATE INDEX IF NOT EXISTS trips_summary_firestore_trip_id_idx ON trips_summary(firestore_trip_id);

-- -----------------------------------------------------------------------------
-- POLICIES (structured policy data for API; optional sync from Firestore)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS policies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  coverage_type TEXT NOT NULL DEFAULT 'standard',
  base_premium_cents INTEGER NOT NULL DEFAULT 0,
  current_premium_cents INTEGER NOT NULL DEFAULT 0,
  discount_percentage INTEGER DEFAULT 0,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE NOT NULL,
  renewal_date TIMESTAMP WITH TIME ZONE,
  stripe_subscription_id TEXT,
  billing_cycle TEXT DEFAULT 'annual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS policies_user_id_idx ON policies(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS policies_policy_number_idx ON policies(policy_number);

-- -----------------------------------------------------------------------------
-- COMMUNITY_POOL (pool ledger; single row or time-series by period)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_pool (
  id SERIAL PRIMARY KEY,
  pool_amount DECIMAL(15, 2) NOT NULL,
  safety_factor DECIMAL(5, 2) DEFAULT 0.80,
  participant_count INTEGER DEFAULT 0,
  safe_driver_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Optional: driving_profiles, trips (legacy), leaderboard, etc.
-- Uncomment if you use them; Drizzle schema may already define them.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS driving_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  current_score INTEGER DEFAULT 0,
  hard_braking_score INTEGER DEFAULT 0,
  acceleration_score INTEGER DEFAULT 0,
  speed_adherence_score INTEGER DEFAULT 0,
  night_driving_score INTEGER DEFAULT 0,
  cornering_score INTEGER DEFAULT 0,
  consistency_score INTEGER DEFAULT 0,
  total_trips INTEGER DEFAULT 0,
  total_miles DECIMAL(10, 2) DEFAULT 0.00,
  projected_refund DECIMAL(10, 2) DEFAULT 0.00,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_location TEXT,
  end_location TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  distance DECIMAL(10, 2) NOT NULL,
  duration INTEGER NOT NULL,
  score INTEGER NOT NULL,
  hard_braking_events INTEGER DEFAULT 0,
  harsh_acceleration INTEGER DEFAULT 0,
  speed_violations INTEGER DEFAULT 0,
  night_driving BOOLEAN DEFAULT false,
  sharp_corners INTEGER DEFAULT 0,
  telematics_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trips_user_id_idx ON trips(user_id);
CREATE INDEX IF NOT EXISTS trips_start_time_idx ON trips(start_time);

CREATE TABLE IF NOT EXISTS leaderboard (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  period TEXT DEFAULT 'weekly',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, period)
);

CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  criteria JSONB NOT NULL,
  badge_color TEXT DEFAULT 'driiva-blue',
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  incident_type TEXT NOT NULL,
  description TEXT,
  location TEXT,
  severity TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'reported',
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  device_type TEXT,
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE
);
