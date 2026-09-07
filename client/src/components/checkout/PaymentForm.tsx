/**
 * The card form rendered inside Stripe's <Elements>, and the cover-confirmation
 * wait that follows it. Extracted verbatim from client/src/pages/checkout.tsx.
 */
import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import { AlertCircle, Car, CreditCard, Loader2, Shield } from 'lucide-react';

import { auth } from '@/lib/firebase';
import { calculateMonthlyPremium, formatGbp } from '@/lib/pricingEngine';
import type { BillingPeriod, CoverState } from './types';
import { BillingToggle } from './BillingToggle';
import { CoverOutcome } from './CoverOutcome';

interface PaymentFormProps {
  annualPremiumGbp: number;
  billingPeriod: BillingPeriod;
  quoteId?: string;
  coverageType: string;
  drivingScore: number;
  discountPercentage: number;
  expiresAt: string;
  /** Demo runs bind nothing; a real charge starts the wait for the insurer. */
  onPaid: (mode: 'demo' | 'charged') => void;
  isDemoMode: boolean;
  onBillingPeriodChange: (p: BillingPeriod) => void;
  /** True when annualPremiumGbp came from the client pricingEngine estimate
   *  rather than an authoritative Root Platform quote - the server still
   *  binds and charges the real price at create-subscription, but the UI
   *  must not present an unconfirmed client-side figure as final. */
  isEstimate: boolean;
}

export function PaymentForm({
  annualPremiumGbp,
  billingPeriod,
  quoteId,
  coverageType,
  drivingScore,
  discountPercentage,
  expiresAt,
  onPaid,
  isDemoMode,
  onBillingPeriodChange,
  isEstimate,
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

    // Demo mode: nothing is charged and nothing is bound, so say that.
    if (isDemoMode) {
      setIsProcessing(true);
      await new Promise(r => setTimeout(r, 1800));
      setIsProcessing(false);
      onPaid('demo');
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
        // Nothing to confirm on the card. The subscription still has to bind a
        // policy, so this waits on the insurer like every other paid path.
        onPaid('charged');
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
        // The CARD succeeded. Cover has not been established yet.
        onPaid('charged');
      }
    } catch (err) {
      setCardError(err instanceof Error && err.message ? err.message : 'Payment failed. Please try again.');
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
            <span className="text-white/60 text-sm ml-1.5">{displayPeriod}</span>
          </div>
          {billingPeriod === 'annual' && (
            <span className="text-xs text-white/60">
              equiv. {formatGbp(annualPremiumGbp / 12, true)}/mo
            </span>
          )}
        </div>
        {isEstimate && (
          <p className="text-amber-400/80 text-xs">
            Estimated premium - confirmed at payment.
          </p>
        )}
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

      <p className="text-center text-white/55 text-xs">
        Secured by Stripe · Cancel anytime · First refund eligibility begins next scoring period after payment.
      </p>
    </form>
  );
}
