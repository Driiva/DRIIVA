import { db } from './db';
import { 
  users, 
  drivingProfiles, 
  trips, 
  communityPool, 
  achievements, 
  userAchievements,
  leaderboard 
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * WAVE H: this file has no callers, and that is the only reason its contents
 * never reached anybody. It creates a placeholder driver account at
 * test@driiva.co.uk with the password `driiva1`, a GBP 1,840 premium, a
 * GBP 100.80 projected refund, three drives that never happened between real
 * Manchester landmarks, two pre-awarded achievements, and rank 14 on a
 * leaderboard, alongside a community pool holding GBP 105,000 shared between
 * 1,000 participants.
 *
 * Every one of those figures is invented, and once written they are
 * indistinguishable from real rows: nothing in the schema marks a row as
 * seeded. A single `npx tsx server/seed.ts` against the wrong DATABASE_URL
 * would put a fabricated pool balance and a weak-password account into a real
 * database, and the dashboard would render both without hesitation.
 *
 * So it refuses to run unless it is told, explicitly and in the same breath,
 * that this is a development database. Seeded development data is fine. Being
 * one mistyped environment variable away from a fabricated production pool is
 * not.
 */
function assertSafeToSeed(): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const optIn = process.env.ALLOW_DB_SEED === 'true';
  const url = process.env.DATABASE_URL ?? '';

  if (nodeEnv === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production. This data is fabricated.');
  }
  if (!optIn) {
    throw new Error(
      'Refusing to seed: set ALLOW_DB_SEED=true to confirm this is a development database. ' +
        'The seed writes an invented community pool and a weak-password test account.',
    );
  }
  if (/\bprod\b|production/i.test(url)) {
    throw new Error(`Refusing to seed: DATABASE_URL looks like a production host.`);
  }
}

/**
 * Seed a DEVELOPMENT database with test data. See assertSafeToSeed above for
 * why this is gated rather than merely documented.
 */
export async function seedDatabase() {
  assertSafeToSeed();
  try {
    console.log('Seeding DEVELOPMENT database with fabricated test data...');

    // Hash password for test user
    const hashedPassword = await bcrypt.hash('driiva1', SALT_ROUNDS);

    // 1. Create test user
    console.log('Creating test user...');
    const [testUser] = await db.insert(users)
      .values({
        username: 'driiva1',
        email: 'test@driiva.co.uk',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'Driver',
        phoneNumber: '+44 7700 123456',
        premiumAmount: '1840.00'
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          email: 'test@driiva.co.uk',
          firstName: 'Test',
          lastName: 'Driver',
          phoneNumber: '+44 7700 123456',
          premiumAmount: '1840.00'
        }
      })
      .returning();

    console.log('✅ Test user created:', testUser.username);

    // 2. Create driving profile
    console.log('Creating driving profile...');
    await db.insert(drivingProfiles)
      .values({
        userId: testUser.id,
        currentScore: 72,
        hardBrakingScore: 85,
        accelerationScore: 78,
        speedAdherenceScore: 74,
        nightDrivingScore: 82,
        corneringScore: 79,
        consistencyScore: 75,
        totalTrips: 26,
        totalMiles: '1107.70',
        // Zeroed for the same reason as the pool balance: Driiva has never
        // paid a refund, so a seeded pounds-and-pence figure is the one number
        // here that could be mistaken for evidence that it has.
        projectedRefund: '0.00'
      })
      .onConflictDoUpdate({
        target: drivingProfiles.userId,
        set: {
          currentScore: 72,
          hardBrakingScore: 85,
          accelerationScore: 78,
          speedAdherenceScore: 74,
          nightDrivingScore: 82,
          corneringScore: 79,
          consistencyScore: 75,
          totalTrips: 26,
          totalMiles: '1107.70',
          projectedRefund: '0.00'
        }
      });

    console.log('✅ Driving profile created');

    // 3. Create community pool
    console.log('Creating community pool...');
    await db.insert(communityPool)
      .values({
        // Zeroed: a dev seed does not need an invented balance to be useful,
        // and if this ever lands somewhere real it should land as the truth.
        // The pool has no funding path (addPoolContribution has no callers).
        poolAmount: '0.00',
        // No pool, so no measured safety factor. 1.0 would read as perfect.
        safetyFactor: '0.00',
        participantCount: 1,
        safeDriverCount: 1
      })
      .onConflictDoNothing();

    console.log('✅ Community pool created');

    // 4. Create achievements
    console.log('Creating achievements...');
    const achievementData = [
      {
        name: 'Long Distance Driver',
        description: 'Drove over 1000 miles safely',
        icon: 'road',
        criteria: { minMiles: 1000 },
        badgeColor: 'driiva-blue'
      },
      {
        name: 'Consistent Driver',
        description: 'Maintained 70+ score for 4 weeks',
        icon: 'target',
        criteria: { minScore: 70, weeks: 4 },
        badgeColor: 'driiva-green'
      },
      {
        name: 'Safe Night Driver',
        description: 'Perfect night driving record',
        icon: 'moon',
        criteria: { nightScore: 90 },
        badgeColor: 'driiva-purple'
      },
      {
        name: 'Speed Master',
        description: 'No speed violations in 30 days',
        icon: 'gauge',
        criteria: { speedViolations: 0, days: 30 },
        badgeColor: 'driiva-orange'
      }
    ];

    for (const achievement of achievementData) {
      await db.insert(achievements)
        .values(achievement)
        .onConflictDoNothing();
    }

    console.log('✅ Achievements created');

    // 5. Award achievements to test user
    console.log('Awarding achievements...');
    const allAchievements = await db.select().from(achievements);
    
    // Award first two achievements
    for (let i = 0; i < Math.min(2, allAchievements.length); i++) {
      await db.insert(userAchievements)
        .values({
          userId: testUser.id,
          achievementId: allAchievements[i].id
        })
        .onConflictDoNothing();
    }

    console.log('✅ Achievements awarded');

    // 6. Create sample trips
    console.log('Creating sample trips...');
    const sampleTrips = [
      {
        userId: testUser.id,
        startLocation: 'Manchester City Centre',
        endLocation: 'Trafford Centre',
        startTime: new Date('2025-01-28T09:00:00Z'),
        endTime: new Date('2025-01-28T09:45:00Z'),
        distance: '12.5',
        duration: 45,
        score: 85,
        hardBrakingEvents: 1,
        harshAcceleration: 0,
        speedViolations: 0,
        nightDriving: false,
        sharpCorners: 2,
        telematicsData: { avgSpeed: 28, maxSpeed: 45 }
      },
      {
        userId: testUser.id,
        startLocation: 'Home',
        endLocation: 'Supermarket',
        startTime: new Date('2025-01-27T14:30:00Z'),
        endTime: new Date('2025-01-27T15:00:00Z'),
        distance: '8.2',
        duration: 30,
        score: 92,
        hardBrakingEvents: 0,
        harshAcceleration: 0,
        speedViolations: 0,
        nightDriving: false,
        sharpCorners: 1,
        telematicsData: { avgSpeed: 25, maxSpeed: 35 }
      },
      {
        userId: testUser.id,
        startLocation: 'Office',
        endLocation: 'Home',
        startTime: new Date('2025-01-26T18:00:00Z'),
        endTime: new Date('2025-01-26T18:35:00Z'),
        distance: '15.8',
        duration: 35,
        score: 78,
        hardBrakingEvents: 2,
        harshAcceleration: 1,
        speedViolations: 1,
        nightDriving: false,
        sharpCorners: 3,
        telematicsData: { avgSpeed: 32, maxSpeed: 55 }
      }
    ];

    for (const trip of sampleTrips) {
      await db.insert(trips)
        .values(trip)
        .onConflictDoNothing();
    }

    console.log('✅ Sample trips created');

    // 7. Create leaderboard entries
    console.log('Creating leaderboard...');
    const leaderboardData = [
      { userId: testUser.id, score: 72, rank: 14, period: 'weekly' },
      { userId: testUser.id, score: 75, rank: 12, period: 'monthly' }
    ];

    for (const entry of leaderboardData) {
      await db.insert(leaderboard)
        .values(entry)
        .onConflictDoUpdate({
          target: [leaderboard.userId, leaderboard.period],
          set: { score: entry.score, rank: entry.rank }
        });
    }

    console.log('✅ Leaderboard entries created');
    console.log('🎉 Database seeding completed successfully!');
    
    return {
      success: true,
      testUser,
      message: 'Database seeded with test data'
    };

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}