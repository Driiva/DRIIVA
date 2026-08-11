/**
 * ROOT PLATFORM PRICING INTEGRATION
 * ==================================
 * HTTP callable function to get insurance quotes from Root Platform API.
 * 
 * The Root Platform provides telematics-based insurance pricing.
 * This function:
 *   1. Validates user authentication
 *   2. Gathers user profile and telematics data
 *   3. Calls Root Platform API with formatted request
 *   4. Transforms response to Driiva format
 *   5. Stores quote in Firestore
 * 
 * Environment Configuration (via Firebase Functions Config):
 *   firebase functions:config:set root.api_key="sandbox_..." root.api_endpoint="https://sandbox.rootplatform.com" root.product_module="camtest"
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import {
  COLLECTION_NAMES,
  UserDocument,
  TripDocument,
  QuoteDocument,
  RootQuoteRequest,
  RootQuoteResponse,
  TelematicsQuoteData,
  DriverQuote,
  Timestamp,
} from '../types';

const db = admin.firestore();

// ============================================================================
// CONFIGURATION
// ============================================================================

// Root Platform API configuration
// Set via: firebase functions:config:set root.api_key="..." root.api_endpoint="..." root.product_module="..."
const getRootConfig = () => ({
  apiKey: functions.config().root?.api_key || process.env.ROOT_API_KEY,
  apiEndpoint: functions.config().root?.api_endpoint || process.env.ROOT_API_ENDPOINT || 'https://sandbox.rootplatform.com',
  productModule: functions.config().root?.product_module || process.env.ROOT_PRODUCT_MODULE || 'camtest',
});

// Quote validity period (7 days)
const QUOTE_VALIDITY_DAYS = 7;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert meters to kilometers with 2 decimal precision
 */
function metersToKm(meters: number): number {
  return Math.round((meters / 1000) * 100) / 100;
}

/**
 * Convert miles to kilometers
 */
function milesToKm(miles: number): number {
  return Math.round(miles * 1.60934 * 100) / 100;
}

/**
 * Convert m/s to km/h
 */
function mpsToKph(mps: number): number {
  return Math.round(mps * 3.6 * 100) / 100;
}

/**
 * Get ISO date string from Firestore Timestamp
 */
function timestampToIso(ts: Timestamp): string {
  return ts.toDate().toISOString();
}

/**
 * Add days to a date and return ISO string
 */
function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString();
}

/**
 * Generate a unique quote ID
 */
function generateQuoteId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `quote_${timestamp}_${random}`;
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetch user document from Firestore
 */
async function fetchUserDocument(userId: string): Promise<UserDocument | null> {
  const userRef = db.collection(COLLECTION_NAMES.USERS).doc(userId);
  const snapshot = await userRef.get();
  
  if (!snapshot.exists) {
    return null;
  }
  
  return snapshot.data() as UserDocument;
}

/**
 * Fetch trips from last 30 days for telematics data
 */
async function fetchRecentTrips(userId: string, days: number = 30): Promise<TripDocument[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);
  
  const tripsSnapshot = await db
    .collection(COLLECTION_NAMES.TRIPS)
    .where('userId', '==', userId)
    .where('status', '==', 'completed')
    .where('startedAt', '>=', cutoffTimestamp)
    .orderBy('startedAt', 'desc')
    .limit(100) // Cap at 100 trips
    .get();
  
  return tripsSnapshot.docs.map(doc => doc.data() as TripDocument);
}

/**
 * Build telematics data from user profile and trips
 */
function buildTelematicsData(
  user: UserDocument,
  trips: TripDocument[]
): TelematicsQuoteData {
  const profile = user.drivingProfile;
  
  // Calculate average speed from recent trips
  let totalSpeed = 0;
  let speedCount = 0;
  
  const recentTrips = trips.map(trip => {
    // Calculate average speed for this trip
    const avgSpeedMps = trip.durationSeconds > 0 
      ? trip.distanceMeters / trip.durationSeconds 
      : 0;
    totalSpeed += avgSpeedMps;
    speedCount++;
    
    return {
      date: timestampToIso(trip.startedAt),
      distanceKm: metersToKm(trip.distanceMeters),
      durationSeconds: trip.durationSeconds,
      score: trip.score,
      harshBrakingEvents: trip.events.hardBrakingCount || 0,
      speedingEvents: Math.ceil(trip.events.speedingSeconds / 60) || 0, // Convert seconds to event count
    };
  });
  
  const avgSpeedKph = speedCount > 0 ? mpsToKph(totalSpeed / speedCount) : 0;
  
  return {
    overallScore: profile.currentScore,
    tripCount: profile.totalTrips,
    totalDistanceKm: milesToKm(profile.totalMiles / 100), // totalMiles stored as miles * 100
    avgSpeedKph,
    recentTrips,
  };
}

// ============================================================================
// ROOT PLATFORM API
// ============================================================================

/**
 * Call Root Platform API to get insurance quote
 */
async function callRootApi(
  request: RootQuoteRequest
): Promise<RootQuoteResponse | null> {
  const config = getRootConfig();
  
  if (!config.apiKey) {
    functions.logger.warn('Root API key not configured, falling back to mock quote');
    return null;
  }
  
  const url = `${config.apiEndpoint}/v1/insurance/quotes`;
  
  // Root uses Basic auth with API key as username, empty password
  const authString = Buffer.from(`${config.apiKey}:`).toString('base64');
  
  try {
    functions.logger.info('Calling Root Platform API', {
      url,
      productModule: config.productModule,
      userId: request.policyholder.id,
    });
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      functions.logger.error('Root API error', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return null;
    }
    
    const data = await response.json() as RootQuoteResponse;
    
    functions.logger.info('Root API response received', {
      quotePackageId: data.quote_package_id,
      basePremium: data.base_premium,
      suggestedPremium: data.suggested_premium,
    });
    
    return data;
    
  } catch (error) {
    functions.logger.error('Root API call failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Generate a mock quote when Root API is unavailable
 * Uses telematics data to calculate a realistic mock premium
 */
function generateMockQuote(
  userId: string,
  telematicsData: TelematicsQuoteData
): RootQuoteResponse {
  const score = telematicsData.overallScore;
  const tripCount = telematicsData.tripCount;
  
  // Base premium calculation (simplified for mock)
  // Higher score = lower premium
  const baseAnnualPremiumCents = 780000; // R7,800 base annual
  
  // Telematics discount based on score (0-30%)
  const discountRate = Math.min(0.30, (score / 100) * 0.35);
  const telematicsDiscountCents = Math.round(baseAnnualPremiumCents * discountRate);
  
  // Additional discount for trip count (engagement bonus)
  const engagementDiscount = Math.min(0.05, (tripCount / 100) * 0.05);
  const engagementDiscountCents = Math.round(baseAnnualPremiumCents * engagementDiscount);
  
  const suggestedPremiumCents = baseAnnualPremiumCents - telematicsDiscountCents - engagementDiscountCents;
  const monthlyPremiumCents = Math.round(suggestedPremiumCents / 12);
  
  return {
    quote_package_id: `mock_${generateQuoteId()}`,
    package_name: 'Driiva Comprehensive (Mock)',
    sum_assured: 50000000, // R500,000
    base_premium: baseAnnualPremiumCents,
    monthly_premium: monthlyPremiumCents,
    suggested_premium: suggestedPremiumCents,
    created_at: new Date().toISOString(),
    module: {
      type: 'mock',
    },
  };
}

// ============================================================================
// QUOTE TRANSFORMATION & STORAGE
// ============================================================================

/**
 * Transform Root API response to Driiva quote format
 */
function transformRootResponse(
  rootResponse: RootQuoteResponse,
  telematicsData: TelematicsQuoteData,
  isMock: boolean
): DriverQuote {
  const quoteId = rootResponse.quote_package_id;
  
  // Root uses cents, convert to ZAR
  const basePremium = rootResponse.base_premium / 100;
  const suggestedPremium = rootResponse.suggested_premium / 100;
  const telematicsDiscount = basePremium - suggestedPremium;
  const monthlyPremium = rootResponse.monthly_premium / 100;
  
  // Quote valid for 7 days
  const createdAt = new Date(rootResponse.created_at);
  const validUntil = addDays(createdAt, QUOTE_VALIDITY_DAYS);
  
  return {
    quoteId,
    basePremium,
    telematicsDiscount,
    finalPremium: suggestedPremium,
    monthlyPremium,
    currency: 'ZAR',
    validUntil,
    provider: 'Root',
    isMock,
    driverScore: telematicsData.overallScore,
    tripCount: telematicsData.tripCount,
    totalDistanceKm: telematicsData.totalDistanceKm,
  };
}

/**
 * Store quote in Firestore
 */
async function storeQuote(
  quoteId: string,
  userId: string,
  quote: DriverQuote,
  telematicsData: TelematicsQuoteData,
  rootResponse: RootQuoteResponse | null,
  isMock: boolean
): Promise<void> {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const validUntilDate = new Date(quote.validUntil);
  
  const quoteDoc: Omit<QuoteDocument, 'createdAt' | 'updatedAt' | 'validUntil'> & {
    createdAt: FirebaseFirestore.FieldValue;
    updatedAt: FirebaseFirestore.FieldValue;
    validUntil: admin.firestore.Timestamp;
  } = {
    quoteId,
    userId,
    rootQuotePackageId: rootResponse?.quote_package_id || null,
    basePremiumCents: Math.round(quote.basePremium * 100),
    telematicsDiscountCents: Math.round(quote.telematicsDiscount * 100),
    finalPremiumCents: Math.round(quote.finalPremium * 100),
    monthlyPremiumCents: Math.round(quote.monthlyPremium * 100),
    currency: quote.currency,
    status: 'issued',
    validUntil: admin.firestore.Timestamp.fromDate(validUntilDate),
    telematicsSnapshot: telematicsData,
    driverScoreAtQuote: telematicsData.overallScore,
    provider: quote.provider,
    isMock,
    rootResponse: isMock ? null : rootResponse,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };
  
  await db.collection(COLLECTION_NAMES.QUOTES).doc(quoteId).set(quoteDoc);
  
  functions.logger.info('Quote stored in Firestore', {
    quoteId,
    userId,
    isMock,
    finalPremiumCents: quoteDoc.finalPremiumCents,
  });
}

// ============================================================================
// HTTP CALLABLE FUNCTION
// ============================================================================

/**
 * Get driver insurance quote
 * 
 * Callable function that:
 * 1. Validates authentication
 * 2. Reads user profile and driving data
 * 3. Calls Root Platform API (or generates mock)
 * 4. Returns transformed quote
 * 
 * @param data - { userId?: string } - Optional userId for admin override
 * @returns DriverQuote
 */
export const getDriverQuote = functions.https.onCall(async (data, context) => {
  // -------------------------------------------------------------------------
  // 1. Validate authentication
  // -------------------------------------------------------------------------
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to get a quote');
  }
  
  // Use context.auth.uid unless admin override provided
  const requestedUserId = data?.userId as string | undefined;
  const isAdmin = context.auth.token.admin === true;
  
  // Only admins can request quotes for other users
  if (requestedUserId && requestedUserId !== context.auth.uid && !isAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'Cannot request quote for another user');
  }
  
  const userId = requestedUserId || context.auth.uid;
  
  functions.logger.info('getDriverQuote called', {
    requestedBy: context.auth.uid,
    targetUser: userId,
    isAdmin,
  });
  
  try {
    // -----------------------------------------------------------------------
    // 2. Fetch user profile
    // -----------------------------------------------------------------------
    const user = await fetchUserDocument(userId);
    
    if (!user) {
      throw new functions.https.HttpsError('not-found', 'User profile not found');
    }
    
    // Check for minimum data requirements
    if (user.drivingProfile.totalTrips < 1) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'At least 1 completed trip is required to get a quote'
      );
    }
    
    // -----------------------------------------------------------------------
    // 3. Fetch recent trips for telematics data
    // -----------------------------------------------------------------------
    const recentTrips = await fetchRecentTrips(userId, 30);
    
    functions.logger.info('Fetched driving data', {
      userId,
      totalTrips: user.drivingProfile.totalTrips,
      recentTripsCount: recentTrips.length,
      currentScore: user.drivingProfile.currentScore,
    });
    
    // -----------------------------------------------------------------------
    // 4. Build telematics data for API
    // -----------------------------------------------------------------------
    const telematicsData = buildTelematicsData(user, recentTrips);
    
    // -----------------------------------------------------------------------
    // 5. Build Root API request
    // -----------------------------------------------------------------------
    const config = getRootConfig();
    
    const rootRequest: RootQuoteRequest = {
      type: `root_insurance_za.${config.productModule}.comprehensive`,
      policyholder: {
        id: userId,
        first_name: user.displayName?.split(' ')[0] || 'Driver',
        last_name: user.displayName?.split(' ').slice(1).join(' ') || 'User',
        email: user.email,
        // Note: These fields would come from extended profile in production
        date_of_birth: '1990-01-01', // Placeholder - should come from user profile
        id_number: '0000000000000', // Placeholder - should come from user profile
      },
      vehicle: {
        // Placeholder - should come from user's policy or profile
        make: 'Unknown',
        model: 'Unknown',
        year: 2020,
        registration: 'UNKNOWN',
      },
      telematics: {
        overall_score: telematicsData.overallScore,
        trip_count: telematicsData.tripCount,
        total_distance_km: telematicsData.totalDistanceKm,
        avg_speed_kph: telematicsData.avgSpeedKph,
        recent_trips: telematicsData.recentTrips.map(trip => ({
          date: trip.date,
          distance_km: trip.distanceKm,
          duration_seconds: trip.durationSeconds,
          score: trip.score,
          harsh_braking_events: trip.harshBrakingEvents,
          speeding_events: trip.speedingEvents,
        })),
      },
      billing_amount: {
        currency: 'ZAR',
        amount: 0, // Root calculates this
      },
    };
    
    // -----------------------------------------------------------------------
    // 6. Call Root API (with mock fallback)
    // -----------------------------------------------------------------------
    let rootResponse = await callRootApi(rootRequest);
    let isMock = false;
    
    if (!rootResponse) {
      // Root API unavailable - generate mock quote
      functions.logger.warn('Using mock quote - Root API unavailable or not configured');
      rootResponse = generateMockQuote(userId, telematicsData);
      isMock = true;
    }
    
    // -----------------------------------------------------------------------
    // 7. Transform response to Driiva format
    // -----------------------------------------------------------------------
    const quote = transformRootResponse(rootResponse, telematicsData, isMock);
    
    // -----------------------------------------------------------------------
    // 8. Store quote in Firestore
    // -----------------------------------------------------------------------
    await storeQuote(
      quote.quoteId,
      userId,
      quote,
      telematicsData,
      isMock ? null : rootResponse,
      isMock
    );
    
    // -----------------------------------------------------------------------
    // 9. Return quote to client
    // -----------------------------------------------------------------------
    functions.logger.info('Quote generated successfully', {
      quoteId: quote.quoteId,
      userId,
      isMock,
      basePremium: quote.basePremium,
      telematicsDiscount: quote.telematicsDiscount,
      finalPremium: quote.finalPremium,
    });
    
    return quote;
    
  } catch (error) {
    functions.logger.error('Error generating quote', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
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

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

/**
 * Get quote by ID (admin function)
 */
export const getQuoteById = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  const quoteId = data?.quoteId as string;
  if (!quoteId) {
    throw new functions.https.HttpsError('invalid-argument', 'quoteId is required');
  }
  
  const quoteRef = db.collection(COLLECTION_NAMES.QUOTES).doc(quoteId);
  const quoteDoc = await quoteRef.get();
  
  if (!quoteDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Quote not found');
  }
  
  const quote = quoteDoc.data() as QuoteDocument;
  
  // Only allow access to own quotes (or admin)
  if (quote.userId !== context.auth.uid && !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized to view this quote');
  }
  
  return quote;
});

/**
 * List user's quotes
 */
export const listUserQuotes = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }
  
  const requestedUserId = data?.userId as string | undefined;
  const userId = requestedUserId || context.auth.uid;
  
  // Only allow access to own quotes (or admin)
  if (userId !== context.auth.uid && !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized to view quotes for this user');
  }
  
  const limit = Math.min(data?.limit || 10, 50);
  
  const quotesSnapshot = await db
    .collection(COLLECTION_NAMES.QUOTES)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return quotesSnapshot.docs.map(doc => doc.data());
});
