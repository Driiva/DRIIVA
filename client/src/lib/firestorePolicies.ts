/**
 * Policies collection and the Root Platform insurance callables.
 * Extracted verbatim from client/src/lib/firestore.ts.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  COLLECTION_NAMES,
  PolicyDocument,
} from '../../../shared/firestore-types';
import { assertFirestore } from './firestoreClient';

// ============================================================================
// POLICIES COLLECTION
// ============================================================================

/**
 * Get user's active policy
 */
export async function getUserPolicy(userId: string): Promise<PolicyDocument | null> {
  assertFirestore();
  
  const policiesRef = collection(db!, COLLECTION_NAMES.POLICIES);
  const q = query(
    policiesRef,
    where('userId', '==', userId),
    where('status', '==', 'active'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].data() as PolicyDocument;
}

/**
 * Get policy by ID
 */
export async function getPolicy(policyId: string): Promise<PolicyDocument | null> {
  assertFirestore();
  
  const policyRef = doc(db!, COLLECTION_NAMES.POLICIES, policyId);
  const snapshot = await getDoc(policyRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return snapshot.data() as PolicyDocument;
}

/**
 * Create a new policy
 */
export async function createPolicy(
  policyData: Omit<PolicyDocument, 'policyId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  assertFirestore();
  
  const policiesRef = collection(db!, COLLECTION_NAMES.POLICIES);
  const policyRef = doc(policiesRef);
  const policyId = policyRef.id;
  
  const now = Timestamp.now();
  
  await setDoc(policyRef, {
    ...policyData,
    policyId,
    createdAt: now,
    updatedAt: now,
  });
  
  return policyId;
}


// ============================================================================
// INSURANCE (Root Platform)
// ============================================================================

/** Response from getInsuranceQuote Cloud Function */
export interface InsuranceQuoteResponse {
  quoteId: string;
  premiumCents: number;
  billingAmountCents: number;
  expiresAt: string;
  coverageType: string;
  drivingScore: number;
  discountPercentage: number;
}

/** Response from acceptInsuranceQuote Cloud Function */
export interface InsurancePolicyResponse {
  policyId: string;
  policyNumber: string;
  status: string;
  monthlyPremiumCents: number;
  startDate: string;
  endDate: string;
}

/**
 * Request an insurance quote from Root Platform via Cloud Function.
 */
export async function getInsuranceQuote(
  coverageType: 'basic' | 'standard' | 'premium' = 'standard'
): Promise<InsuranceQuoteResponse> {
  assertFirestore();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const fn = httpsCallable<
    { coverageType: string },
    InsuranceQuoteResponse
  >(functions, 'getInsuranceQuote');
  const result = await fn({ coverageType });
  return result.data;
}

/**
 * Accept a quote and bind a policy via Root Platform.
 */
export async function acceptInsuranceQuote(
  quoteId: string
): Promise<InsurancePolicyResponse> {
  assertFirestore();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const fn = httpsCallable<
    { quoteId: string },
    InsurancePolicyResponse
  >(functions, 'acceptInsuranceQuote');
  const result = await fn({ quoteId });
  return result.data;
}

/**
 * Sync a policy's status with Root Platform.
 */
export async function syncInsurancePolicy(
  policyId: string
): Promise<InsurancePolicyResponse> {
  assertFirestore();
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions();
  const fn = httpsCallable<
    { policyId: string },
    InsurancePolicyResponse
  >(functions, 'syncInsurancePolicy');
  const result = await fn({ policyId });
  return result.data;
}
