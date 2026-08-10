/**
 * Checkout page — Insurance premium payment via Stripe.
 *
 * Flow:
 *   1. Compute annual premium from user's onboarding profile via pricingEngine.
 *   2. Show monthly / annual billing toggle. Annual is the default (no instalment loading).
 *   3. On submit: POST /api/payments/create-subscription with annualPremiumCents + billingPeriod.
 *   4. Server creates subscription using Stripe price_data (dynamic, per-user amount).
 *   5. Confirm payment with stripe.confirmCardPayment(clientSecret).
 *   6. On success: show confirmation screen.
 *
 * For demo mode: pricing engine runs on DEMO_PRICING_INPUTS; no Stripe call is made.
 * For real users: profile is read from Firestore to feed the pricing engine.
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  ArrowLeft,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  CreditCard,
  Car,
  Sparkles,
} from 'lucide-react';
import { stripePromise } from '@/lib/stripe';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
  calculateAnnualPremium,
  calculateMonthlyPremium,
  formatGbp,
  scoreDiscountPercent,
  DEMO_PRICING_INPUTS,
  type PricingInputs,
} from '@/lib/pricingEngine';

// ---------------------------------------------------------------------------
// Billing period toggle
// ---------------------------------------------------------------------------

type BillingPeriod = 'annual' | 'monthly';

function BillingToggle({
  period,
  onChange,
  annualGbp,
  monthlyGbp,
}: {
  period: BillingPeriod;
  onChange: (p: BillingPeriod) => void;
  annualGbp: number;
  monthlyGbp: number;
}) {
  const annualVsMonthly = Math.round((1 - annualGbp / (monthlyGbp * 12)) * 100);

  return (
    <div className="space-y-3 mb-6">
      <div
        className="flex rounded-2xl p-1 gap-1"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
        role="group"
        aria-label="Billing period"
      >
        {(['annual', 'monthly'] as BillingPeriod[]).map((p) => {
          const isActive = period === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className="flex-1 relative flex flex-col items-center py-3 rounded-xl transition-all duration-200 text-sm"
              style={{
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
              }}
            >
              {p === 'annual' && annualVsMonthly > 0 && (
                <span
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-300"
                  style={{ background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.35)' }}
                >
                  Save {annualVsMonthly}%
                </span>
              )}
              <span className={`font-semibold ${isActive ? 'text-white' : 'text-white/50'}`}>
                {p === 'annual' ? `${formatGbp(annualGbp)}/yr` : `${formatGbp(monthlyGbp, true)}/mo`}
              </span>
              <span className={`text-xs mt-0.5 ${isActive ? 'text-white/60' : 'text-white/30'}`}>
                {p === 'annual' ? 'Pay annually' : 'Pay monthly'}
              </span>
            </button>
          );
        })}
      </div>
      {period === 'monthly' && (
        <p className="text-center text-white/40 text-xs">
          Monthly instalments include a 7% handling charge vs. annual.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner payment form (rendered inside Stripe <Elements>)
// ---------------------------------------------------------------------------

interface PaymentFormProps {
  annualPremiumGbp: number;
  billingPeriod: BillingPeriod;
  quoteId?: string;
  coverageType: string;
  drivingScore: number;
  discountPercentage: number;
  expiresAt: string;
  onSuccess: () => void;
  isDemoMode: boolean;
  onBillingPeriodChange: (p: BillingPeriod) => void;
}

function PaymentForm({
  annualPremiumGbp,
  billingPeriod,
  quoteId,
  coverageType,
  drivingScore,
  discountPercentage,
  expiresAt,
  onSuccess,
  isDemoMode,
  onBillingPeriodChange,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const monthlyGbp = calculateMonthlyPremium(annualPremiumGbp);
  const displayGbp = billingPeriod === 'annual' ? annualPremiumGbp : monthlyGbp;
  const displayAmount = billingPeriod === 'annual'
    ? formatGbp(annualPremiumGbp)
    : formatGbp(monthlyGbp, true);
  const displayPeriod = billingPeriod === 'annual' ? '/year' : '/month';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Demo mode: simulate a successful payment
    if (isDemoMode) {
      setIsProcessing(true);
      await new Promise(r => setTimeout(r, 1800));
      setIsProcessing(false);
      onSuccess();
      return;
    }

    if (!stripe || !elements || !cardComplete) return;

    setIsProcessing(true);
    setCardError(null);

    try {
      const firebaseUser = auth?.currentUser;
      if (!firebaseUser) throw new Error('Please sign in to continue');
      const idToken = await firebaseUser.getIdToken();

      // Pass annualPremiumCents and billingPeriod — server uses price_data (no fixed Price ID)
      const annualPremiumCents = Math.round(annualPremiumGbp * 100);
      const res = await fetch('/api/payments/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ quoteId, annualPremiumCents, billingPeriod }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create subscription');
      }

      const { clientSecret } = await res.json();

      if (!clientSecret) {
        onSuccess();
        return;
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (error) {
        setCardError(error.message || 'Payment failed');
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        onSuccess();
      }
    } catch (err: any) {
      setCardError(err.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        color: '#fff',
        fontFamily: 'var(--font-body)',
        fontSize: '16px',
        '::placeholder': { color: 'rgba(255,255,255,0.4)' },
        backgroundColor: 'transparent',
      },
      invalid: { color: '#f87171' },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Billing period toggle */}
      <BillingToggle
        period={billingPeriod}
        onChange={onBillingPeriodChange}
        annualGbp={annualPremiumGbp}
        monthlyGbp={monthlyGbp}
      />

      {/* Quote summary card */}
      <div
        className="rounded-2xl p-5 space-y-3"
        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/70 text-sm">
            <Car className="w-4 h-4" />
            <span>{coverageType.charAt(0).toUpperCase() + coverageType.slice(1)} Cover</span>
          </div>
          {discountPercentage > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
              <Shield className="w-3.5 h-3.5" />
              <span>Score {drivingScore} → {discountPercentage}% off</span>
            </div>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div>
            <motion.span
              key={`${billingPeriod}-amount`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold text-white"
            >
              {displayAmount}
            </motion.span>
            <span className="text-white/50 text-sm ml-1.5">{displayPeriod}</span>
          </div>
          {billingPeriod === 'annual' && (
            <span className="text-xs text-white/40">
              equiv. {formatGbp(annualPremiumGbp / 12, true)}/mo
            </span>
          )}
        </div>
        <p className="text-white/40 text-xs">
          Quote expires {new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Card input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/70">Card details</label>
        {isDemoMode ? (
          <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,193,7,0.35)' }}
          >
            <CreditCard className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-amber-300 text-sm">Demo mode — no real card needed</span>
          </div>
        ) : (
          <div
            className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <CardElement
              options={cardElementOptions}
              onChange={(e) => {
                setCardComplete(e.complete);
                setCardError(e.error?.message || null);
              }}
            />
          </div>
        )}
        {cardError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-red-400 text-sm"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{cardError}</span>
          </motion.div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isProcessing || (!isDemoMode && (!stripe || !cardComplete))}
        className="w-full py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: isProcessing || (!isDemoMode && !cardComplete)
            ? 'rgba(255,255,255,0.1)'
            : 'linear-gradient(135deg, #059669, #0d9488)',
        }}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Processing…</span>
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            <span>Pay {displayAmount} now</span>
          </>
        )}
      </button>

      <p className="text-center text-white/30 text-xs">
        Secured by Stripe · Cancel anytime · First refund eligibility begins next scoring period after payment.
      </p>
    </form>
  );
}

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
  const [success, setSuccess] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);

  const isDemoMode = typeof window !== 'undefined' &&
    sessionStorage.getItem('driiva-demo-mode') === 'true';

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
          }
        } catch {
          // Root not configured or unavailable — proceed with the client estimate
          // above; policy bind will fall back to the most recent quote for this
          // user in Firestore.
        }
      } catch (err: any) {
        setQuoteError(err.message || 'Failed to load your quote. Please try again.');
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
            className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto"
          >
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">Policy activated!</h1>
          <p className="text-white/60 max-w-xs mx-auto">
            Your Driiva insurance policy is now active. Keep driving safely to earn refunds.
          </p>
          <button
            onClick={() => setLocation('/dashboard')}
            className="mt-4 px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-colors"
          >
            Go to dashboard
          </button>
        </motion.div>
      </div>
    );
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
            <p className="text-white/50 text-sm">Powered by Root Platform</p>
          </div>
        </div>

        {/* Loading */}
        {quoteLoading && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
            <p className="text-white/50 text-sm">Calculating your personalised quote…</p>
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
                onSuccess={() => setSuccess(true)}
                isDemoMode={isDemoMode}
                onBillingPeriodChange={setBillingPeriod}
              />
            </Elements>
          </motion.div>
        )}
      </div>
    </div>
  );
}
