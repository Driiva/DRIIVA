/**
 * Checkout's own shapes: the billing period the toggle drives, and the cover
 * outcome the end of the flow reports. Extracted verbatim from
 * client/src/pages/checkout.tsx.
 */
export type BillingPeriod = 'annual' | 'monthly';

export type CoverState =
  | { kind: 'idle' }
  /** Card cleared. The insurer has not answered yet. */
  | { kind: 'awaiting' }
  | { kind: 'confirmed'; policyId: string | null }
  /** The binding attempt finished and the insurer has not activated cover. */
  | { kind: 'notYetCovered' }
  /** Money taken, no cover. */
  | { kind: 'failed' }
  /** We could not find out in time. Unknown, stated as unknown. */
  | { kind: 'unresolved' }
  /** Demo mode: nothing was charged and nothing was bound. */
  | { kind: 'demo' };
