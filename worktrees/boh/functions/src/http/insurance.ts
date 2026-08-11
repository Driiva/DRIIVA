/**
 * ROOT PLATFORM INSURANCE INTEGRATION
 * ====================================
 * Cloud Functions for interacting with the Root Platform insurance API.
 *
 * Root Platform (rootplatform.com) provides programmable insurance
 * infrastructure. This module handles:
 *   1. Generating insurance quotes based on driving scores
 *   2. Accepting quotes to create policies
 *   3. Retrieving policy details from Root
 *
 * Environment variables (set via Firebase secrets):
 *   ROOT_API_KEY        – Root Platform API key
 *   ROOT_API_URL        – Base URL (sandbox: https://sandbox.rootplatform.com/v1)
 *   ROOT_ENVIRONMENT    – "sandbox" | "production"
 *
 * All monetary values use integer cents (ZAR cents on Root sandbox).
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { COLLECTION_NAMES, UserDocument, PolicyDocument, CoverageType } from '../types';

// ============================================================================
// CONFIG
// ============================================================================

interface RootConfig {
  apiKey: string;
  apiUrl: string;
  environment: 'sandbox' | 'production';
  productModuleKey: string;
}

function getRootConfig(): RootConfig {
  const apiKey = process.env.ROOT_API_KEY;
  const apiUrl = process.env.ROOT_API_URL || 'https://api.rootplatform.com/v1/insurance';
  const environment = (process.env.ROOT_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
  const productModuleKey = process.env.ROOT_PRODUCT_MODULE_KEY || 'camtest';

  if (!apiKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Root Platform API key is not configured. Set ROOT_API_KEY in functions environment.'
    );
  }

  return { apiKey, apiUrl, environment, productModuleKey };
}

// ============================================================================
// ROOT API HELPER
// ============================================================================

interface RootApiOptions {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: Record<string, unknown>;
}

async function rootApiFetch<T>(options: RootApiOptions): Promise<T> {
  const config = getRootConfig();
  const url = `${config.apiUrl}${options.path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${Buffer.from(`${config.apiKey}:`).toString('base64')}`,
  };

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    functions.logger.error(`[Root API] ${options.method} ${options.path} failed`, {
      status: response.status,
      body: errorBody,
    });
    throw new functions.https.HttpsError(
      'internal',
      `Root Platform API error (${response.status}): ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// ROOT API TYPES
// ============================================================================

/** Root Platform quote request payload */
interface RootQuoteRequest {
  type: string;
  policyholder_id?: string;
  module: Record<string, unknown>;
}

/** Root Platform quote response */
interface RootQuoteResponse {
  quote_package_id: string;
  created_at: string;
  module: {
    type: string;
    [key: string]: unknown;
  };
  suggested_premium: number; // cents
  billing_amount: number;   // cents
  expiry_date: string;
}

/** Root Platform application/policy response */
interface RootApplicationResponse {
  application_id: string;
  policy_id: string | null;
  status: string;
  created_at: string;
  monthly_premium: number;
  policy_number: string | null;
}

/** Root Platform policy response */
interface RootPolicyResponse {
  policy_id: string;
  policy_number: string;
  status: string;
  created_at: string;
  monthly_premium: number;
  sum_assured: number;
  start_date: string;
  end_date: string;
  module: Record<string, unknown>;
}

// ============================================================================
// COVERAGE TYPE MAPPING
// ============================================================================

/** Map Driiva coverage type to Root module type */
function mapCoverageToRootModule(
  coverageType: CoverageType,
  drivingScore: number,
  totalTrips: number,
  totalMiles: number,
): Record<string, unknown> {
  return {
    type: 'driiva_telematics',
    coverage_type: coverageType,
    driving_score: Math.round(drivingScore),
    total_trips: totalTrips,
    total_miles: Math.round(totalMiles * 100) / 100,
    // Root uses the score to calculate premium discount
    discount_factor: Math.max(0, Math.min(30, (drivingScore - 50) * 0.6)),
  };
}

// ============================================================================
// CALLABLE FUNCTIONS
// ============================================================================

const db = admin.firestore();

/**
 * Generate an insurance quote based on the user's driving score.
 *
 * Input: { coverageType: 'basic' | 'standard' | 'premium' }
 * Output: { quoteId, premiumCents, billingAmountCents, expiresAt, coverageType }
 */
export const getInsuranceQuote = functions.https.onCall(async (data, context) => {
  // Auth check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const userId = context.auth.uid;
  const coverageType: CoverageType = data.coverageType || 'standard';

  if (!['basic', 'standard', 'premium'].includes(coverageType)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid coverage type');
  }

  // Fetch user profile for driving score
  const userDoc = await db.collection(COLLECTION_NAMES.USERS).doc(userId).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found');
  }

  const user = userDoc.data() as UserDocument;
  const profile = user.drivingProfile;

  if (profile.totalTrips < 1) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'At least 1 completed trip is required to generate a quote'
    );
  }

  functions.logger.info(`[Insurance] Generating quote for user ${userId}`, {
    coverageType,
    drivingScore: profile.currentScore,
    totalTrips: profile.totalTrips,
  });

  // Build Root quote request
  const config = getRootConfig();
  const quoteRequest: RootQuoteRequest = {
    type: config.productModuleKey,
    module: mapCoverageToRootModule(
      coverageType,
      profile.currentScore,
      profile.totalTrips,
      profile.totalMiles,
    ),
  };

  const rootQuote = await rootApiFetch<RootQuoteResponse>({
    method: 'POST',
    path: '/quotes',
    body: quoteRequest as unknown as Record<string, unknown>,
  });

  functions.logger.info(`[Insurance] Quote generated`, {
    quoteId: rootQuote.quote_package_id,
    premiumCents: rootQuote.suggested_premium,
  });

  return {
    quoteId: rootQuote.quote_package_id,
    premiumCents: rootQuote.suggested_premium,
    billingAmountCents: rootQuote.billing_amount,
    expiresAt: rootQuote.expiry_date,
    coverageType,
    drivingScore: Math.round(profile.currentScore),
    discountPercentage: Math.round(
      Math.max(0, Math.min(30, (profile.currentScore - 50) * 0.6))
    ),
  };
});

/**
 * Accept a quote and bind a policy via Root Platform.
 *
 * Input: { quoteId: string }
 * Output: { policyId, policyNumber, status, monthlyPremiumCents }
 */
export const acceptInsuranceQuote = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const userId = context.auth.uid;
  const quoteId: string | undefined = data.quoteId;

  if (!quoteId || typeof quoteId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'quoteId is required');
  }

  functions.logger.info(`[Insurance] User ${userId} accepting quote ${quoteId}`);

  // Create application (policy binding) on Root
  const application = await rootApiFetch<RootApplicationResponse>({
    method: 'POST',
    path: '/applications',
    body: {
      quote_package_id: quoteId,
      policyholder_id: userId,
    },
  });

  if (!application.policy_id) {
    throw new functions.https.HttpsError(
      'internal',
      `Root did not return a policy_id. Application status: ${application.status}`
    );
  }

  // Fetch the full policy from Root
  const rootPolicy = await rootApiFetch<RootPolicyResponse>({
    method: 'GET',
    path: `/policies/${application.policy_id}`,
  });

  // Store policy in Firestore
  const policyData: Omit<PolicyDocument, 'createdAt' | 'updatedAt'> & {
    createdAt: admin.firestore.FieldValue;
    updatedAt: admin.firestore.FieldValue;
    rootPolicyId: string;
    rootApplicationId: string;
  } = {
    policyId: rootPolicy.policy_id,
    userId,
    policyNumber: rootPolicy.policy_number || `DRV-${Date.now()}`,
    status: 'active',
    coverageType: 'standard', // from quote
    coverageDetails: {
      liabilityLimitCents: 10_000_000, // $100,000 default
      collisionDeductibleCents: 50_000, // $500 default
      comprehensiveDeductibleCents: 25_000, // $250 default
      includesRoadside: false,
      includesRental: false,
    },
    basePremiumCents: rootPolicy.monthly_premium,
    currentPremiumCents: rootPolicy.monthly_premium,
    discountPercentage: 0,
    effectiveDate: admin.firestore.Timestamp.fromDate(new Date(rootPolicy.start_date)),
    expirationDate: admin.firestore.Timestamp.fromDate(new Date(rootPolicy.end_date)),
    renewalDate: null,
    vehicle: null,
    billingCycle: 'monthly',
    stripeSubscriptionId: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: userId,
    updatedBy: 'cloud-function',
    // Root-specific fields
    rootPolicyId: rootPolicy.policy_id,
    rootApplicationId: application.application_id,
  };

  await db.collection(COLLECTION_NAMES.POLICIES).doc(rootPolicy.policy_id).set(policyData);

  functions.logger.info(`[Insurance] Policy created`, {
    policyId: rootPolicy.policy_id,
    policyNumber: rootPolicy.policy_number,
    userId,
  });

  return {
    policyId: rootPolicy.policy_id,
    policyNumber: rootPolicy.policy_number,
    status: 'active',
    monthlyPremiumCents: rootPolicy.monthly_premium,
    startDate: rootPolicy.start_date,
    endDate: rootPolicy.end_date,
  };
});

/**
 * Fetch the user's current policy status from Root Platform.
 *
 * Input: { policyId: string }
 * Output: Root policy details synced with local Firestore
 */
export const syncInsurancePolicy = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }

  const userId = context.auth.uid;
  const policyId: string | undefined = data.policyId;

  if (!policyId || typeof policyId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'policyId is required');
  }

  // Verify ownership
  const localPolicy = await db.collection(COLLECTION_NAMES.POLICIES).doc(policyId).get();
  if (!localPolicy.exists) {
    throw new functions.https.HttpsError('not-found', 'Policy not found');
  }
  const policyData = localPolicy.data() as PolicyDocument;
  if (policyData.userId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Not your policy');
  }

  // Fetch latest from Root
  const rootPolicy = await rootApiFetch<RootPolicyResponse>({
    method: 'GET',
    path: `/policies/${policyId}`,
  });

  // Sync status
  const rootStatus = rootPolicy.status === 'active' ? 'active'
    : rootPolicy.status === 'cancelled' ? 'cancelled'
    : rootPolicy.status === 'expired' ? 'expired'
    : 'pending';

  await db.collection(COLLECTION_NAMES.POLICIES).doc(policyId).update({
    status: rootStatus,
    currentPremiumCents: rootPolicy.monthly_premium,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'cloud-function',
  });

  functions.logger.info(`[Insurance] Policy ${policyId} synced`, { status: rootStatus });

  return {
    policyId: rootPolicy.policy_id,
    policyNumber: rootPolicy.policy_number,
    status: rootStatus,
    monthlyPremiumCents: rootPolicy.monthly_premium,
    startDate: rootPolicy.start_date,
    endDate: rootPolicy.end_date,
  };
});
