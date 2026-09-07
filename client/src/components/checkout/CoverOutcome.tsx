/**
 * The end of checkout, told truthfully. Extracted verbatim from
 * client/src/pages/checkout.tsx.
 */
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Loader2, Shield, Sparkles } from 'lucide-react';

import type { CoverState } from './types';

/**
 * The end of checkout, told truthfully.
 *
 * Every branch here except `confirmed` exists because the previous version of
 * this screen had only one ending and used it for all of them.
 */
export function CoverOutcome({
  state,
  onDashboard,
}: {
  state: Exclude<CoverState, { kind: 'idle' }>;
  onDashboard: () => void;
}) {
  const content: Record<
    Exclude<CoverState['kind'], 'idle'>,
    { icon: JSX.Element; title: string; body: string; tone: string }
  > = {
    awaiting: {
      icon: <Loader2 className="w-10 h-10 text-white/70 animate-spin" />,
      tone: 'bg-white/10 border-white/20',
      title: 'Payment received',
      body: 'We are setting up your policy with the insurer. This usually takes a few seconds. You are not covered until it is confirmed.',
    },
    confirmed: {
      icon: <CheckCircle className="w-10 h-10 text-emerald-400" />,
      tone: 'bg-emerald-500/20 border-emerald-500/40',
      title: 'Your cover is confirmed',
      body: 'The insurer has your policy in place. Keep driving safely to build your score.',
    },
    notYetCovered: {
      icon: <AlertCircle className="w-10 h-10 text-amber-400" />,
      tone: 'bg-amber-500/20 border-amber-500/40',
      title: 'Your policy is still being set up',
      body: 'We have your payment and the insurer has not confirmed cover yet. You are not insured with Driiva until they do. We will tell you as soon as that changes.',
    },
    failed: {
      icon: <AlertCircle className="w-10 h-10 text-red-400" />,
      tone: 'bg-red-500/20 border-red-500/40',
      title: 'We could not set up your policy',
      body: 'Your payment went through and your cover did not. You are not insured with Driiva. Do not rely on this cover. Contact us at hello@driiva.co.uk with the time of this payment and we will sort it out, including a refund if we cannot put cover in place.',
    },
    unresolved: {
      icon: <AlertCircle className="w-10 h-10 text-amber-400" />,
      tone: 'bg-amber-500/20 border-amber-500/40',
      title: 'We cannot confirm your cover yet',
      body: 'Your payment went through. We have not had an answer from the insurer, so we cannot tell you whether you are covered. Do not assume you are. Check the app shortly, or contact hello@driiva.co.uk.',
    },
    demo: {
      icon: <Sparkles className="w-10 h-10 text-white/70" />,
      tone: 'bg-white/10 border-white/20',
      title: 'Demo complete',
      body: 'This is a demo. No payment was taken and no policy exists.',
    },
  };

  const view = content[state.kind];

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-4"
        role="status"
        aria-live="polite"
      >
        <div
          className={`w-20 h-20 rounded-full border flex items-center justify-center mx-auto ${view.tone}`}
        >
          {view.icon}
        </div>
        <h1 className="text-2xl font-bold text-white">{view.title}</h1>
        <p className="text-white/60 max-w-xs mx-auto">{view.body}</p>
        {state.kind !== 'awaiting' && (
          <button
            onClick={onDashboard}
            className="mt-4 px-8 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold transition-colors"
          >
            Go to dashboard
          </button>
        )}
      </motion.div>
    </div>
  );
}
