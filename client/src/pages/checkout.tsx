/**
 * Checkout page — Insurance premium payment via Stripe.
 *
 * Flow:
 *   1. Compute annual premium from user's onboarding profile via pricingEngine.
 *   2. Show monthly / annual billing toggle. Annual is the default (no instalment loading).
 *   3. On submit: POST /api/payments/create-subscription with annualPremiumCents + billingPeriod.
 *   4. Server creates subscription using Stripe price_data (dynamic, per-user amount).
 *   5. Confirm payment with stripe.confirmCardPayment(clientSecret).
 *   6. On a cleared card: WAIT for the insurer, then show what actually
 *      happened. A charge is not cover; see CoverOutcome.
 *
 * For demo mode: pricing engine runs on DEMO_PRICING_INPUTS; no Stripe call is made.
 * For real users: profile is read from Firestore to feed the pricing engine.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Elements } from '@stripe/react-stripe-js';
import { AlertCircle, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { stripePromise } from '@/lib/stripe';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  calculateAnnualPremium,
  calculateMonthlyPremium,
  scoreDiscountPercent,
  DEMO_PRICING_INPUTS,
  type PricingInputs,
} from '@/lib/pricingEngine';

// The billing toggle, the card form and the cover outcome live in
// client/src/components/checkout/.
import type { BillingPeriod, CoverState } from '@/components/checkout/types';
import { COVER_CONFIRMATION_TIMEOUT_MS } from '@/components/checkout/constants';
import { CoverOutcome } from '@/components/checkout/CoverOutcome';
import { PaymentForm } from '@/components/checkout/PaymentForm';

// ---------------------------------------------------------------------------
// Main checkout page
// ---------------------------------------------------------------------------

/** Read the user's profile from Firestore to feed the pricing engine. */
async function loadPricingInputs(uid: string): Promise<PricingInputs> {
  if (!isFirebaseConfigured || !db) return {};
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return {};
    const d = snap.data();
    return {
      vehicleYear: d?.vehicle?.year ?? null,
      age: d?.age ?? null,
      noClaimsYears: d?.noClaimsYears ?? null,
      postcode: d?.postcode ?? null,
      drivingScore: d?.drivingProfile?.score ?? null,
    };
  } catch {
    return {};
  }
}

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const [annualPremiumGbp, setAnnualPremiumGbp] = useState<number | null>(null);
  const [pricingInputs, setPricingInputs] = useState<PricingInputs | null>(null);
  const [quoteId, setQuoteId] = useState<string | undefined>(undefined);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [coverState, setCoverState] = useState<CoverState>({ kind: 'idle' });
  const [stripeReady, setStripeReady] = useState(false);
  // False once an authoritative Root Platform quote (with a real premiumCents)
  // has replaced the client pricingEngine estimate. Demo mode never has a
  // server quote, so it stays an estimate throughout.
  const [isEstimate, setIsEstimate] = useState(true);

  const isDemoMode = typeof window !== 'undefined' &&
    sessionStorage.getItem('driiva-demo-mode') === 'true';

  /*
   * WAVE H: a cleared card used to set `success`, which rendered "Policy
   * activated! Your Driiva insurance policy is now active."
   *
   * A cleared card is not cover. Binding happens afterwards and elsewhere: the
   * Stripe webhook writes users/{uid}/pendingPayments/{subscriptionId}, and a
   * Cloud Function calls Root. If that failed, the document was marked failed
   * and the driver was told nothing, having already read that they were
   * insured. That is the charged-but-uninsured case, and it was invisible.
   *
   * So the screen now follows the binding, not the charge. It waits, and then
   * says the true thing: confirmed, still being set up, or taken your money
   * and failed. If it cannot find out in time it says THAT, rather than
   * picking the optimistic ending.
   */
  useEffect(() => {
    if (coverState.kind !== 'awaiting') return;
    const uid = auth?.currentUser?.uid;
    if (!db || !uid) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    // If the binding has not resolved within this window, say so plainly.
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) setCoverState((s) => (s.kind === 'awaiting' ? { kind: 'unresolved' } : s));
    }, COVER_CONFIRMATION_TIMEOUT_MS);

    (async () => {
      const { collection, query, orderBy, limit, onSnapshot } = await import('firebase/firestore');
      if (cancelled) return;
      const pending = query(
        collection(db, 'users', uid, 'pendingPayments'),
        orderBy('createdAt', 'desc'),
        limit(1),
      );
      unsubscribe = onSnapshot(
        pending,
        (snap) => {
          const docSnap = snap.docs[0];
          if (!docSnap) return;
          const data = docSnap.data() as {
            status?: string;
            policyStatus?: string;
            policyId?: string;
            error?: string;
          };

          if (data.policyStatus === 'active') {
            setCoverState({ kind: 'confirmed', policyId: data.policyId ?? null });
            return;
          }
          if (data.status === 'failed' || data.policyStatus === 'none') {
            setCoverState({ kind: 'failed' });
            return;
          }
          if (data.status === 'completed') {
            // The attempt finished and the insurer has not activated the
            // policy. Finished is not the same as covered.
            setCoverState({ kind: 'notYetCovered' });
          }
        },
        () => {
          // We cannot read the outcome. That is unknown, not success.
          if (!cancelled) setCoverState({ kind: 'unresolved' });
        },
      );
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      unsubscribe?.();
    };
  }, [coverState.kind]);

  useEffect(() => {
    stripePromise.then(s => setStripeReady(s !== null));
  }, []);

  // Compute pricing: load user profile from Firestore, run pricing engine
  useEffect(() => {
    async function computePricing() {
      setQuoteLoading(true);
      setQuoteError(null);

      try {
        if (isDemoMode) {
          // Demo: use the canonical demo profile — brief artificial delay for realism
          await new Promise(r => setTimeout(r, 800));
          const inputs = DEMO_PRICING_INPUTS;
          setPricingInputs(inputs);
          setAnnualPremiumGbp(calculateAnnualPremium(inputs));
          setQuoteId('demo-quote-preview');
          return;
        }

        // Real user: read profile from Firestore, then optionally call Root for quoteId
        const firebaseUser = auth?.currentUser;
        if (!firebaseUser) throw new Error('Please sign in to continue');

        const inputs = await loadPricingInputs(firebaseUser.uid);
        setPricingInputs(inputs);
        setAnnualPremiumGbp(calculateAnnualPremium(inputs));

        // Attempt to get an authoritative quote from the Root Platform.
        // When Root responds, its premium is the source of truth and replaces the
        // client estimate above — the user must be shown and bound to the same
        // premium the policy is priced at. The client estimate is only a fallback
        // for when Root is unavailable.
        try {
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const fns = getFunctions();
          type QuoteResult = { quoteId: string; premiumCents: number; coverageType: string };
          const getInsuranceQuote = httpsCallable<{ coverageType: string }, QuoteResult>(fns, 'getInsuranceQuote');
          const result = await getInsuranceQuote({ coverageType: 'standard' });
          if (result.data?.quoteId) setQuoteId(result.data.quoteId);
          if (typeof result.data?.premiumCents === 'number' && result.data.premiumCents > 0) {
            setAnnualPremiumGbp(result.data.premiumCents / 100);
            setIsEstimate(false);
          }
        } catch {
          // Root not configured or unavailable — proceed with the client estimate
          // above; policy bind will fall back to the most recent quote for this
          // user in Firestore.
        }
      } catch (err) {
        setQuoteError(err instanceof Error && err.message ? err.message : 'Failed to load your quote. Please try again.');
      } finally {
        setQuoteLoading(false);
      }
    }
    computePricing();
  }, [isDemoMode]);

  const monthlyGbp = annualPremiumGbp != null ? calculateMonthlyPremium(annualPremiumGbp) : null;

  // Discount percentage shown in quote summary — derived from the same score
  // factor applied to the premium, so the figure shown matches what is charged.
  const rawScore = pricingInputs?.drivingScore ?? (isDemoMode ? 82 : null);
  const discountPct = scoreDiscountPercent(rawScore);

  if (coverState.kind !== 'idle') {
    return <CoverOutcome state={coverState} onDashboard={() => setLocation('/dashboard')} />;
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-sm mx-auto px-5 pt-8 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Activate your policy</h1>
            <p className="text-white/60 text-sm">Powered by Root Platform</p>
          </div>
        </div>

        {/* Loading */}
        {quoteLoading && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
            <p className="text-white/60 text-sm">Calculating your personalised quote…</p>
          </div>
        )}

        {/* Error */}
        {quoteError && !quoteLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 space-y-3"
            style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)' }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium text-sm">Quote unavailable</p>
                <p className="text-white/60 text-sm mt-1">{quoteError}</p>
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
            >
              Try again
            </button>
          </motion.div>
        )}

        {/* Stripe not configured (real mode only) */}
        {!isDemoMode && !stripeReady && !quoteLoading && !quoteError && annualPremiumGbp != null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <p className="text-white/60 text-sm text-center">
              Payments are not yet configured in this environment.
              Set <code className="text-amber-300">VITE_STRIPE_PUBLISHABLE_KEY</code> to enable checkout.
            </p>
          </motion.div>
        )}

        {/* Checkout form */}
        {annualPremiumGbp != null && (stripeReady || isDemoMode) && !quoteLoading && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
            {isDemoMode && (
              <div
                className="mb-5 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs text-amber-300"
                style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.2)' }}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Demo preview — quote is illustrative, no payment will be taken</span>
              </div>
            )}
            <Elements stripe={isDemoMode ? Promise.resolve(null) : stripePromise}>
              <PaymentForm
                annualPremiumGbp={annualPremiumGbp}
                billingPeriod={billingPeriod}
                quoteId={quoteId}
                coverageType="standard"
                drivingScore={rawScore ?? 75}
                discountPercentage={discountPct}
                expiresAt={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}
                onPaid={(mode) =>
                  setCoverState(mode === 'demo' ? { kind: 'demo' } : { kind: 'awaiting' })
                }
                isDemoMode={isDemoMode}
                onBillingPeriodChange={setBillingPeriod}
                isEstimate={isEstimate}
              />
            </Elements>
          </motion.div>
        )}
      </div>
    </div>
  );
}

