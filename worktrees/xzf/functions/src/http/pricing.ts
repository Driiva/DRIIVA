/**
 * PRICING HTTP FUNCTIONS
 * ======================
 * Cloud Functions for Root Platform integration and quote generation.
 * 
 * Environment Variables (set via Firebase secrets):
 *   - ROOT_API_KEY: Root Platform API key (sandbox or production)
 *   - ROOT_API_ENDPOINT: Root Platform API endpoint
 *   - ROOT_PRODUCT_MODULE: Product module code (e.g., 'camtest')
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  COLLECTION_NAMES,
  UserDocument,
  TripDocument,
  QuoteDocument,
  RootQuoteRequest,
  RootQuoteResponse,
  RootTripSummary,
  DrivaQuote,
  ExtendedUserProfile,
  QuoteVehicleInfo,
  Timestamp,
} from '../types';

const db = admin.firestore();
const logger = functions.logger;

// ============================================================================
// CONFIGURATION
// ============================================================================

interface RootConfig {
  apiKey: string;
  endpoint: string;
  productModule: string;
}

/**
 * Get Root API configuration from environment
 * Uses Firebase Functions config/secrets
 */
function getRootConfig(): RootConfig {
  const apiKey = process.env.ROOT_API_KEY || functions.config().root?.api_key;
  const endpoint = process.env.ROOT_API_ENDPOINT || 
    functions.config().root?.endpoint || 
    'https://sandbox.rootplatform.com';
  const productModule = process.env.ROOT_PRODUCT_MODULE || 
    functions.config().root?.product_module || 
    'camtest';

  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Root API key not configured. Set ROOT_API_KEY environment variable.'
    );
  }

  return { apiKey, endpoint, productModule };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get trips from the last N days for a user
 */
async function getRecentTrips(
  userId: string, 
  days: number
): Promise<TripDocument[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

  const tripsSnapshot = await db
    .collection(COLLECTION_NAMES.TRIPS)
    .where('userId', '==', userId)
    .where('status', '==', 'completed')
    .where('startedAt', '>=', cutoffTimestamp)
    .orderBy('startedAt', 'desc')
    .limit(100) // Reasonable limit
    .get();

  return tripsSnapshot.docs.map(doc => doc.data() as TripDocument);
}

/**
 * Convert trips to Root API format
 */
function formatTripsForRoot(trips: TripDocument[]): RootTripSummary[] {
  return trips.map(trip => ({
    date: trip.startedAt.toDate().toISOString(),
    distance_km: trip.distanceMeters / 1000,
    duration_seconds: trip.durationSeconds,
    score: trip.score,
    harsh_braking_events: trip.events.hardBrakingCount,
    speeding_events: Math.floor(trip.events.speedingSeconds / 60), // Convert seconds to event count
  }));
}

/**
 * Calculate average speed from trips
 */
function calculateAverageSpeed(trips: TripDocument[]): number {
  if (trips.length === 0) return 0;
  
  const totalDistance = trips.reduce((sum, t) => sum + t.distanceMeters, 0);
  const totalDuration = trips.reduce((sum, t) => sum + t.durationSeconds, 0);
  
  if (totalDuration === 0) return 0;
  
  // meters/second to km/h
  return (totalDistance / totalDuration) * 3.6;
}

/**
 * Generate mock quote when Root API is unavailable
 * Uses a deterministic formula based on telematics data
 */
function generateMockQuote(
  userId: string,
  overallScore: number,
  tripCount: number,
  totalDistanceKm: number
): DrivaQuote {
  // Base premium calculation (mock - for demo purposes)
  // Real pricing would come from Root API
  const basePremiumCents = 650000; // R6,500 base
  
  // Telematics discount: up to 15% based on score
  const scoreDiscount = Math.min(0.15, (overallScore / 100) * 0.15);
  
  // Experience discount: up to 5% based on trip count
  const experienceDiscount = Math.min(0.05, (tripCount / 100) * 0.05);
  
  // Total discount
  const totalDiscount = scoreDiscount + experienceDiscount;
  const discountCents = Math.floor(basePremiumCents * totalDiscount);
  const finalPremiumCents = basePremiumCents - discountCents;
  const monthlyPremiumCents = Math.floor(finalPremiumCents / 12);

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 7);

  return {
    quoteId: `mock_${userId}_${Date.now()}`,
    basePremiumZAR: basePremiumCents / 100,
    telematicsDiscountZAR: discountCents / 100,
    finalPremiumZAR: finalPremiumCents / 100,
    monthlyPremiumZAR: monthlyPremiumCents / 100,
    currency: 'ZAR',
    validUntil,
    provider: 'Root',
    isMockQuote: true,
  };
}

/**
 * Call Root Platform API to get quote
 */
async function callRootAPI(
  config: RootConfig,
  request: RootQuoteRequest
): Promise<RootQuoteResponse> {
  const url = `${config.endpoint}/v1/insurance/quotes`;
  
  // Root uses Basic auth with API key
  const authHeader = `Basic ${Buffer.from(`${config.apiKey}:`).toString('base64')}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('Root API error', { 
      status: response.status, 
      body: errorBody,
      url,
    });
    throw new Error(`Root API returned ${response.status}: ${errorBody}`);
  }

  return response.json();
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

interface GetQuoteInput {
  userId: string;
  // Optional extended profile (if not in Firestore)
  profile?: ExtendedUserProfile;
  vehicle?: QuoteVehicleInfo;
}

/**
 * Validate South African ID number (basic validation)
 * Full validation would check checksum
 */
function validateSAIdNumber(idNumber: string): boolean {
  return /^\d{13}$/.test(idNumber);
}

/**
 * Validate vehicle year
 */
function validateVehicleYear(year: number): boolean {
  const currentYear = new Date().getFullYear();
  return year >= 1900 && year <= currentYear + 1;
}

// ============================================================================
// MAIN CLOUD FUNCTION
// ============================================================================

/**
 * Get driver quote from Root Platform
 * 
 * Input: { userId: string, profile?: ExtendedUserProfile, vehicle?: QuoteVehicleInfo }
 * 
 * Process:
 * 1. Validate authentication
 * 2. Read user profile from Firestore
 * 3. Read last 30 days of trips
 * 4. Format and send request to Root API
 * 5. Transform and store quote
 * 6. Return quote to client
 */
export const getDriverQuote = functions
  .runWith({
    secrets: ['ROOT_API_KEY'],
    timeoutSeconds: 30,
    memory: '256MB',
  })
  .https.onCall(async (data: GetQuoteInput, context): Promise<DrivaQuote> => {
    const startTime = Date.now();
    
    // -------------------------------------------------------------------------
    // Step 1: Validate Authentication
    // -------------------------------------------------------------------------
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to get a quote'
      );
    }

    const userId = data.userId || context.auth.uid;
    
    // Ensure user can only get quotes for themselves
    if (userId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Cannot request quotes for other users'
      );
    }

    logger.info('Getting driver quote', { userId });

    try {
      // -----------------------------------------------------------------------
      // Step 2: Read User Profile
      // -----------------------------------------------------------------------
      const userDoc = await db
        .collection(COLLECTION_NAMES.USERS)
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'User profile not found. Complete onboarding first.'
        );
      }

      const user = userDoc.data() as UserDocument;

      // -----------------------------------------------------------------------
      // Step 3: Read Driver Stats & Recent Trips
      // -----------------------------------------------------------------------
      const recentTrips = await getRecentTrips(userId, 30);
      
      const drivingProfile = user.drivingProfile;
      const overallScore = drivingProfile.currentScore;
      const tripCount = drivingProfile.totalTrips;
      const totalDistanceKm = drivingProfile.totalMiles * 1.60934; // Miles to KM
      const avgSpeedKph = calculateAverageSpeed(recentTrips);

      // Minimum data requirements
      if (tripCount < 1) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'At least 1 completed trip is required to generate a quote'
        );
      }

      // -----------------------------------------------------------------------
      // Step 4: Validate Extended Profile & Vehicle
      // -----------------------------------------------------------------------
      const profile = data.profile;
      const vehicle = data.vehicle;

      // For sandbox testing, allow mock data if profile not provided
      const useMockData = !profile || !vehicle;
      
      if (!useMockData) {
        // Validate SA ID number
        if (!profile.idNumber || !validateSAIdNumber(profile.idNumber)) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Valid 13-digit South African ID number is required'
          );
        }

        // Validate date of birth
        if (!profile.dateOfBirth || isNaN(Date.parse(profile.dateOfBirth))) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Valid date of birth in ISO 8601 format is required'
          );
        }

        // Validate vehicle year
        if (!vehicle.year || !validateVehicleYear(vehicle.year)) {
          throw new functions.https.HttpsError(
            'invalid-argument',
            'Valid vehicle year is required'
          );
        }
      }

      // -----------------------------------------------------------------------
      // Step 5: Call Root API or Generate Mock Quote
      // -----------------------------------------------------------------------
      let quote: DrivaQuote;
      let rootResponse: RootQuoteResponse | null = null;

      if (useMockData) {
        // Generate mock quote for sandbox/demo
        logger.info('Generating mock quote (missing profile/vehicle data)', { userId });
        quote = generateMockQuote(userId, overallScore, tripCount, totalDistanceKm);
      } else {
        try {
          const config = getRootConfig();
          
          // Format request for Root API
          const rootRequest: RootQuoteRequest = {
            type: 'root_insurance_za.car.comprehensive',
            policyholder: {
              id: userId,
              first_name: profile.firstName,
              last_name: profile.lastName,
              email: user.email,
              date_of_birth: profile.dateOfBirth,
              id_number: profile.idNumber,
            },
            vehicle: {
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
              registration: vehicle.registration,
            },
            telematics: {
              overall_score: overallScore,
              trip_count: tripCount,
              total_distance_km: totalDistanceKm,
              avg_speed_kph: avgSpeedKph,
              recent_trips: formatTripsForRoot(recentTrips),
            },
            billing_amount: {
              currency: 'ZAR',
              amount: 0, // Root calculates this
            },
          };

          logger.info('Calling Root API', { 
            userId, 
            tripCount: recentTrips.length,
            overallScore,
          });

          rootResponse = await callRootAPI(config, rootRequest);

          // Transform Root response to our format
          const validUntil = new Date(rootResponse.created_at);
          validUntil.setDate(validUntil.getDate() + 7);

          quote = {
            quoteId: rootResponse.quote_package_id,
            basePremiumZAR: rootResponse.base_premium / 100,
            telematicsDiscountZAR: (rootResponse.base_premium - rootResponse.suggested_premium) / 100,
            finalPremiumZAR: rootResponse.suggested_premium / 100,
            monthlyPremiumZAR: rootResponse.monthly_premium / 100,
            currency: 'ZAR',
            validUntil,
            provider: 'Root',
            isMockQuote: false,
          };
        } catch (apiError) {
          // Fallback to mock quote if Root API fails
          logger.warn('Root API failed, using mock quote', { 
            userId, 
            error: apiError instanceof Error ? apiError.message : 'Unknown error',
          });
          quote = generateMockQuote(userId, overallScore, tripCount, totalDistanceKm);
        }
      }

      // -----------------------------------------------------------------------
      // Step 6: Store Quote in Firestore
      // -----------------------------------------------------------------------
      const now = admin.firestore.Timestamp.now();
      const validUntilTimestamp = admin.firestore.Timestamp.fromDate(quote.validUntil);

      const quoteDoc: QuoteDocument = {
        quoteId: quote.quoteId,
        userId,
        
        rootQuotePackageId: rootResponse?.quote_package_id || null,
        rootPackageName: rootResponse?.package_name || null,
        
        basePremiumCents: Math.round(quote.basePremiumZAR * 100),
        telematicsDiscountCents: Math.round(quote.telematicsDiscountZAR * 100),
        finalPremiumCents: Math.round(quote.finalPremiumZAR * 100),
        monthlyPremiumCents: Math.round(quote.monthlyPremiumZAR * 100),
        sumAssuredCents: rootResponse?.sum_assured ? rootResponse.sum_assured * 100 : 50000000, // Default R500k
        currency: 'ZAR',
        
        telematicsSnapshot: {
          overallScore,
          tripCount,
          totalDistanceKm,
          avgSpeedKph,
        },
        
        vehicle: vehicle || {
          make: 'Unknown',
          model: 'Unknown',
          year: new Date().getFullYear(),
          registration: 'UNKNOWN',
        },
        
        status: 'active',
        isMockQuote: quote.isMockQuote,
        
        createdAt: now,
        validUntil: validUntilTimestamp,
        convertedAt: null,
        
        createdBy: userId,
        updatedBy: userId,
        updatedAt: now,
      };

      await db
        .collection(COLLECTION_NAMES.QUOTES)
        .doc(quote.quoteId)
        .set(quoteDoc);

      logger.info('Quote generated and stored', {
        userId,
        quoteId: quote.quoteId,
        isMockQuote: quote.isMockQuote,
        finalPremiumZAR: quote.finalPremiumZAR,
        durationMs: Date.now() - startTime,
      });

      // -----------------------------------------------------------------------
      // Step 7: Return Quote to Client
      // -----------------------------------------------------------------------
      return quote;

    } catch (error) {
      // Re-throw HttpsError as-is
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Log and wrap unexpected errors
      logger.error('Unexpected error generating quote', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new functions.https.HttpsError(
        'internal',
        'Failed to generate quote. Please try again later.'
      );
    }
  });

/**
 * Get user's quote history
 */
export const getQuoteHistory = functions.https.onCall(
  async (data: { limit?: number }, context): Promise<QuoteDocument[]> => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const userId = context.auth.uid;
    const limit = Math.min(data.limit || 10, 50);

    const quotesSnapshot = await db
      .collection(COLLECTION_NAMES.QUOTES)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return quotesSnapshot.docs.map(doc => doc.data() as QuoteDocument);
  }
);

/**
 * Expire old quotes (scheduled function)
 * Run daily to mark expired quotes
 */
export const expireOldQuotes = functions.pubsub
  .schedule('0 2 * * *') // 2 AM daily
  .timeZone('Africa/Johannesburg')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    
    const expiredQuotes = await db
      .collection(COLLECTION_NAMES.QUOTES)
      .where('status', '==', 'active')
      .where('validUntil', '<', now)
      .get();

    const batch = db.batch();
    let count = 0;

    for (const doc of expiredQuotes.docs) {
      batch.update(doc.ref, {
        status: 'expired',
        updatedAt: now,
        updatedBy: 'system',
      });
      count++;
    }

    if (count > 0) {
      await batch.commit();
      logger.info('Expired old quotes', { count });
    }

    return null;
  });
