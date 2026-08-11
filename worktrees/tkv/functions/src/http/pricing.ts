/**
 * PRICING & QUOTE FUNCTIONS
 * =========================
 * HTTP callable functions for Root Platform API integration.
 * 
 * Handles:
 *   - getDriverQuote: Fetches personalized insurance quote from Root Platform
 *   - Quote storage and retrieval
 *   - Fallback mock quotes when Root API is unavailable
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import {
  COLLECTION_NAMES,
  TripDocument,
  UserDocument,
  RootQuoteRequest,
  RootQuoteResponse,
  DriivaQuote,
  QuoteDocument,
  RootTelematicsData,
} from '../types';

const db = admin.firestore();

// ============================================================================
// CONFIGURATION
// ============================================================================

// Root API configuration - set via Firebase environment config
// firebase functions:config:set root.api_key="sandbox_..." root.endpoint="https://sandbox.rootplatform.com" root.product_module="camtest"
const ROOT_API_KEY = functions.config().root?.api_key || process.env.ROOT_API_KEY;
const ROOT_API_ENDPOINT = functions.config().root?.endpoint || process.env.ROOT_API_ENDPOINT || 'https://sandbox.rootplatform.com';
const ROOT_PRODUCT_MODULE = functions.config().root?.product_module || process.env.ROOT_PRODUCT_MODULE || 'camtest';

// Quote validity period (7 days)
const QUOTE_VALIDITY_DAYS = 7;

// Collection name for quotes
const QUOTES_COLLECTION = 'quotes';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get user's trips from the last N days
 */
async function getRecentTrips(userId: string, days: number): Promise<TripDocument[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

  const tripsSnapshot = await db
    .collection(COLLECTION_NAMES.TRIPS)
    .where('userId', '==', userId)
    .where('status', '==', 'completed')
    .where('startedAt', '>=', cutoffTimestamp)
    .orderBy('startedAt', 'desc')
    .limit(100) // Reasonable limit for quote calculation
    .get();

  return tripsSnapshot.docs.map(doc => doc.data() as TripDocument);
}

/**
 * Format telematics data for Root API
 */
function formatTelematicsForRoot(
  user: UserDocument,
  trips: TripDocument[]
): RootTelematicsData {
  const profile = user.drivingProfile;
  
  // Convert miles to km
  const totalDistanceKm = profile.totalMiles * 1.60934;
  
  // Calculate average speed from trips (if available)
  let avgSpeedKph = 0;
  if (trips.length > 0) {
    const totalSpeedSum = trips.reduce((sum, trip) => {
      const speedMps = trip.distanceMeters / Math.max(1, trip.durationSeconds);
      return sum + speedMps * 3.6; // Convert m/s to km/h
    }, 0);
    avgSpeedKph = totalSpeedSum / trips.length;
  }

  // Format recent trips
  const recentTrips = trips.map(trip => ({
    date: trip.startedAt.toDate().toISOString(),
    distance_km: trip.distanceMeters / 1000,
    duration_seconds: trip.durationSeconds,
    score: trip.score,
    harsh_braking_events: trip.events.hardBrakingCount || 0,
    speeding_events: Math.ceil(trip.events.speedingSeconds / 60), // Convert to events (1 per minute)
  }));

  return {
    overall_score: profile.currentScore,
    trip_count: profile.totalTrips,
    total_distance_km: Math.round(totalDistanceKm * 100) / 100,
    avg_speed_kph: Math.round(avgSpeedKph * 100) / 100,
    recent_trips: recentTrips,
  };
}

/**
 * Generate mock quote when Root API is unavailable
 * Uses telematics data to calculate a realistic quote
 */
function generateMockQuote(
  userId: string,
  user: UserDocument,
  telematicsData: RootTelematicsData
): DriivaQuote {
  const now = admin.firestore.Timestamp.now();
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + QUOTE_VALIDITY_DAYS);

  // Base premium calculation (simplified actuarial model)
  // Base: R6500/year for average driver
  const basePremiumZAR = 6500;

  // Telematics discount: up to 30% based on score
  // Score 100 = 30% discount, Score 50 = 0% discount
  const scoreDiscount = Math.max(0, ((telematicsData.overall_score - 50) / 50) * 0.30);
  
  // Trip count bonus: +2% discount for every 50 trips (max 10%)
  const tripBonus = Math.min(0.10, (telematicsData.trip_count / 50) * 0.02);
  
  // Total discount capped at 35%
  const totalDiscount = Math.min(0.35, scoreDiscount + tripBonus);
  
  const telematicsDiscountZAR = Math.round(basePremiumZAR * totalDiscount);
  const finalPremiumZAR = basePremiumZAR - telematicsDiscountZAR;
  const monthlyPremiumZAR = Math.round((finalPremiumZAR / 12) * 100) / 100;

  return {
    quoteId: `mock_${userId}_${Date.now()}`,
    userId,
    basePremium: basePremiumZAR,
    telematicsDiscount: telematicsDiscountZAR,
    finalPremium: finalPremiumZAR,
    monthlyPremium: monthlyPremiumZAR,
    currency: 'ZAR',
    validUntil: admin.firestore.Timestamp.fromDate(validUntil),
    provider: 'Root',
    isMockQuote: true,
    createdAt: now,
    sumAssured: 500000, // R500,000 standard coverage
  };
}

/**
 * Call Root Platform API to get a quote
 */
async function callRootAPI(request: RootQuoteRequest): Promise<RootQuoteResponse> {
  if (!ROOT_API_KEY) {
    throw new Error('Root API key not configured');
  }

  // Create Basic Auth header
  const authHeader = Buffer.from(`${ROOT_API_KEY}:`).toString('base64');

  const response = await fetch(`${ROOT_API_ENDPOINT}/v1/insurance/quotes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authHeader}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    functions.logger.error('Root API error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
    });
    throw new Error(`Root API returned ${response.status}: ${errorText}`);
  }

  return await response.json() as RootQuoteResponse;
}

/**
 * Transform Root API response to Driiva quote format
 */
function transformRootResponse(
  userId: string,
  rootResponse: RootQuoteResponse
): DriivaQuote {
  const now = admin.firestore.Timestamp.now();
  const createdAt = new Date(rootResponse.created_at);
  const validUntil = new Date(createdAt);
  validUntil.setDate(validUntil.getDate() + QUOTE_VALIDITY_DAYS);

  return {
    quoteId: rootResponse.quote_package_id,
    userId,
    basePremium: rootResponse.base_premium / 100, // Root uses cents
    telematicsDiscount: (rootResponse.base_premium - rootResponse.suggested_premium) / 100,
    finalPremium: rootResponse.suggested_premium / 100,
    monthlyPremium: rootResponse.monthly_premium / 100,
    currency: 'ZAR',
    validUntil: admin.firestore.Timestamp.fromDate(validUntil),
    provider: 'Root',
    isMockQuote: false,
    createdAt: now,
    rootPackageId: rootResponse.quote_package_id,
    rootPackageName: rootResponse.package_name,
    sumAssured: rootResponse.sum_assured / 100, // Root uses cents
  };
}

/**
 * Save quote to Firestore
 */
async function saveQuote(quote: DriivaQuote, additionalData?: Partial<QuoteDocument>): Promise<void> {
  const quoteDoc: QuoteDocument = {
    ...quote,
    status: 'generated',
    ...additionalData,
  };

  await db.collection(QUOTES_COLLECTION).doc(quote.quoteId).set(quoteDoc);
}

// ============================================================================
// HTTP CALLABLE FUNCTIONS
// ============================================================================

/**
 * Get a personalized driver quote from Root Platform
 * 
 * Input: { userId: string }
 * 
 * Steps:
 * 1. Validate authentication (user must be logged in)
 * 2. Read user profile from Firestore
 * 3. Read last 30 days of trips for telematics data
 * 4. Format request for Root API
 * 5. Call Root API (with fallback to mock quote)
 * 6. Transform response to Driiva format
 * 7. Store quote in Firestore
 * 8. Return quote to client
 */
export const getDriverQuote = functions.https.onCall(async (data, context) => {
  // 1. Validate authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to get a quote'
    );
  }

  const userId = data?.userId || context.auth.uid;

  // Verify user is requesting their own quote (or is admin)
  if (userId !== context.auth.uid && !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You can only request quotes for your own account'
    );
  }

  functions.logger.info('Getting driver quote', { userId });

  try {
    // 2. Read user profile from Firestore
    const userRef = db.collection(COLLECTION_NAMES.USERS).doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'User profile not found. Please complete your profile first.'
      );
    }

    const user = userDoc.data() as UserDocument;

    // Check for required demographic data
    // Note: These fields may need to be added to the user document via onboarding
    const userData = userDoc.data() as UserDocument & {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      idNumber?: string;
      vehicleMake?: string;
      vehicleModel?: string;
      vehicleYear?: number;
      vehicleRegistration?: string;
    };

    // Validate required fields for quote
    const missingFields: string[] = [];
    if (!userData.firstName && !userData.displayName) missingFields.push('firstName');
    if (!userData.lastName && !userData.displayName) missingFields.push('lastName');
    if (!userData.dateOfBirth) missingFields.push('dateOfBirth');
    if (!userData.idNumber) missingFields.push('idNumber');
    if (!userData.vehicleMake) missingFields.push('vehicleMake');
    if (!userData.vehicleModel) missingFields.push('vehicleModel');
    if (!userData.vehicleYear) missingFields.push('vehicleYear');
    if (!userData.vehicleRegistration) missingFields.push('vehicleRegistration');

    if (missingFields.length > 0) {
      functions.logger.warn('Missing required fields for quote', { userId, missingFields });
      // For now, continue with mock quote - in production, you might want to require these
    }

    // 3. Read last 30 days of trips
    const trips = await getRecentTrips(userId, 30);
    functions.logger.info(`Retrieved ${trips.length} trips for quote calculation`, { userId });

    // 4. Format telematics data
    const telematicsData = formatTelematicsForRoot(user, trips);

    // 5. Try to call Root API, fallback to mock if unavailable
    let quote: DriivaQuote;
    let requestPayload: Record<string, unknown> | undefined;
    let responsePayload: Record<string, unknown> | undefined;
    let errorMessage: string | undefined;

    // Parse name from displayName if individual fields not available
    const nameParts = (userData.displayName || 'Driver User').split(' ');
    const firstName = userData.firstName || nameParts[0] || 'Driver';
    const lastName = userData.lastName || nameParts.slice(1).join(' ') || 'User';

    if (ROOT_API_KEY && missingFields.length === 0) {
      // Build Root API request
      const rootRequest: RootQuoteRequest = {
        type: 'root_insurance_za.car.comprehensive',
        policyholder: {
          id: userId,
          first_name: firstName,
          last_name: lastName,
          email: user.email,
          date_of_birth: userData.dateOfBirth || '1990-01-01', // Fallback
          id_number: userData.idNumber || '0000000000000', // Fallback (13 digits for SA ID)
        },
        vehicle: {
          make: userData.vehicleMake || 'Unknown',
          model: userData.vehicleModel || 'Unknown',
          year: userData.vehicleYear || 2020,
          registration: userData.vehicleRegistration || 'UNKNOWN',
        },
        telematics: telematicsData,
        billing_amount: {
          currency: 'ZAR',
          amount: 0, // Root calculates this
        },
      };

      // Store sanitized request (remove sensitive data for logging)
      requestPayload = {
        ...rootRequest,
        policyholder: {
          ...rootRequest.policyholder,
          id_number: '***REDACTED***',
        },
      };

      try {
        functions.logger.info('Calling Root API', { userId, endpoint: ROOT_API_ENDPOINT });
        const rootResponse = await callRootAPI(rootRequest);
        
        quote = transformRootResponse(userId, rootResponse);
        responsePayload = rootResponse as unknown as Record<string, unknown>;
        
        functions.logger.info('Root API quote received', {
          userId,
          quoteId: quote.quoteId,
          basePremium: quote.basePremium,
          finalPremium: quote.finalPremium,
        });

      } catch (rootError) {
        // Root API failed, fall back to mock quote
        functions.logger.warn('Root API unavailable, generating mock quote', {
          userId,
          error: rootError instanceof Error ? rootError.message : 'Unknown error',
        });

        errorMessage = rootError instanceof Error ? rootError.message : 'Root API unavailable';
        quote = generateMockQuote(userId, user, telematicsData);
      }
    } else {
      // No API key or missing required fields, generate mock quote
      functions.logger.info('Generating mock quote (no API key or missing fields)', {
        userId,
        hasApiKey: !!ROOT_API_KEY,
        missingFields,
      });

      if (!ROOT_API_KEY) {
        errorMessage = 'Root API key not configured';
      } else {
        errorMessage = `Missing required fields: ${missingFields.join(', ')}`;
      }

      quote = generateMockQuote(userId, user, telematicsData);
    }

    // 7. Store quote in Firestore
    await saveQuote(quote, {
      requestPayload,
      responsePayload,
      errorMessage,
      status: quote.isMockQuote ? 'generated' : 'generated',
    });

    functions.logger.info('Quote saved to Firestore', {
      userId,
      quoteId: quote.quoteId,
      isMockQuote: quote.isMockQuote,
    });

    // 8. Return quote to client
    return {
      success: true,
      quote: {
        quoteId: quote.quoteId,
        basePremium: quote.basePremium,
        telematicsDiscount: quote.telematicsDiscount,
        finalPremium: quote.finalPremium,
        monthlyPremium: quote.monthlyPremium,
        currency: quote.currency,
        validUntil: quote.validUntil.toDate().toISOString(),
        provider: quote.provider,
        isMockQuote: quote.isMockQuote,
        sumAssured: quote.sumAssured,
      },
      telematicsSnapshot: {
        overallScore: telematicsData.overall_score,
        tripCount: telematicsData.trip_count,
        totalDistanceKm: telematicsData.total_distance_km,
        recentTripsCount: telematicsData.recent_trips.length,
      },
    };

  } catch (error) {
    functions.logger.error('Quote generation failed', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Failed to generate quote'
    );
  }
});

/**
 * Get user's existing quotes
 */
export const getUserQuotes = functions.https.onCall(async (data, context) => {
  // Validate authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to view quotes'
    );
  }

  const userId = context.auth.uid;
  const limitCount = data?.limit || 10;

  try {
    const quotesSnapshot = await db
      .collection(QUOTES_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limitCount)
      .get();

    const quotes = quotesSnapshot.docs.map(doc => {
      const quoteData = doc.data() as QuoteDocument;
      return {
        quoteId: quoteData.quoteId,
        basePremium: quoteData.basePremium,
        telematicsDiscount: quoteData.telematicsDiscount,
        finalPremium: quoteData.finalPremium,
        monthlyPremium: quoteData.monthlyPremium,
        currency: quoteData.currency,
        validUntil: quoteData.validUntil.toDate().toISOString(),
        provider: quoteData.provider,
        isMockQuote: quoteData.isMockQuote,
        status: quoteData.status,
        createdAt: quoteData.createdAt.toDate().toISOString(),
      };
    });

    return {
      success: true,
      quotes,
      count: quotes.length,
    };

  } catch (error) {
    functions.logger.error('Failed to retrieve quotes', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new functions.https.HttpsError(
      'internal',
      'Failed to retrieve quotes'
    );
  }
});
