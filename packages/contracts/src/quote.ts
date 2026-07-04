import { z } from 'zod';

import { FirestoreTimestampSchema } from './timestamp';
import { CoverageTypeSchema } from './policy';

/**
 * QUOTE DOCUMENT
 * ==============
 * Collection: `quotes/{quoteId}`. Root insurer quote handoff, written by
 * `getInsuranceQuote` (functions/src/http/insurance.ts:282-289) and read back
 * by `acceptInsuranceQuote` and the `onPendingPaymentWrite` trigger's
 * most-recent-open-quote fallback. Zero mention in firestore.rules (safe via
 * catch-all deny; all access is Admin SDK) - audit quirk 6.9.
 */
export const QuoteDocumentSchema = z.object({
  quoteId: z.string(),
  userId: z.string(),
  coverageType: CoverageTypeSchema,
  premiumCents: z.number().int(),
  /**
   * Written as `rootQuote.expiry_date`, a raw ISO date STRING returned by the
   * Root insurance API (functions/src/http/insurance.ts:122,287) - unlike
   * every other `*At` field in this contract package, this is NOT a
   * Firestore Timestamp. Pinned as a string deliberately; do not silently
   * "fix" it to a Timestamp shape without changing the writer first.
   */
  expiresAt: z.string(),
  createdAt: FirestoreTimestampSchema,
});
export type QuoteDocument = z.infer<typeof QuoteDocumentSchema>;
