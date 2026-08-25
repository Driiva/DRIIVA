/**
 * Internal Root Platform policy binding - shared between the callable function
 * and the Stripe payment trigger.
 *
 * Extracted here to avoid duplicating Root API logic across modules.
 */
import { PolicyStatus } from '../types';
/**
 * Root's policy status, mapped onto ours. Only Root saying "active" makes a
 * policy active here.
 *
 * This used to be the literal `status: 'active'`, written regardless of what
 * Root reported, so a policy Root was still holding in a pending state was
 * recorded, rendered and pushed to the driver's phone as live cover. Anything
 * we do not recognise is 'pending', because an unrecognised status is a status
 * we have not verified, and the rule is that we never assert a state we have
 * not verified.
 */
export declare function mapRootPolicyStatus(rootStatus: string | undefined | null): PolicyStatus;
export interface BindResult {
    policyId: string;
    /** Null when the insurer did not give us one. Never invented. */
    policyNumber: string | null;
    /** What the INSURER says the policy is, not what we would like it to be. */
    status: PolicyStatus;
}
export declare function acceptInsuranceQuoteInternal(userId: string, quoteId: string, stripeSubscriptionId?: string): Promise<BindResult>;
//# sourceMappingURL=insuranceInternal.d.ts.map