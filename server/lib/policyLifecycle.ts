/**
 * Policy lifecycle state machine + audit trail (M4 Task 3).
 *
 * Replaces the direct `policies.status = 'cancelled'` stopgap write that Task 2
 * left in the `customer.subscription.deleted` webhook handler (server/routes.ts),
 * and the client-only `checkout.tsx:204` flag flip on payment success. Every
 * write to `policies.status` from now on should go through `transitionPolicy`
 * (existing policy) or `createPolicyWithAudit` (brand new policy), so the state
 * machine is the single place that knows which transitions are legal and every
 * transition leaves exactly one row in `policy_audit_log`.
 *
 * Design notes:
 *  - `transitionPolicy` takes the already-loaded `Policy` row rather than an id,
 *    so callers that already fetched the policy (the webhook handlers do, via
 *    `storage.getPolicyByStripeSubscriptionId`) don't pay for a second read, and
 *    the "from" state used for the transition check is exactly the state the
 *    caller observed - no race between a caller's read and this module's own.
 *  - `causedBy` is a free-text provenance string, e.g. `stripe:evt_123` for a
 *    webhook-driven transition or `admin:<uid>` for a manual admin action. It is
 *    required on every call so the audit trail is never anonymous.
 */
import { storage } from "../storage";
import type { InsertPolicy, Policy } from "@shared/schema";

export const POLICY_STATUSES = [
  "pending",
  "active",
  "past_due",
  "cancelled",
  "lapsed",
] as const;

export type PolicyStatus = (typeof POLICY_STATUSES)[number];

/**
 * Explicit transition table: which states a policy may move to next.
 * `cancelled` is terminal - it has no outgoing transitions at all, so
 * cancelled -> active (or cancelled -> anything) is always rejected. This is
 * deliberate: there is no re-activation path for a cancelled policy in this
 * system: a driver who wants cover again buys a new policy.
 */
export const POLICY_TRANSITIONS: Readonly<Record<PolicyStatus, readonly PolicyStatus[]>> = {
  pending: ["active", "cancelled", "lapsed"],
  active: ["past_due", "cancelled", "lapsed"],
  past_due: ["active", "cancelled", "lapsed"],
  lapsed: ["active", "cancelled"],
  cancelled: [],
};

export function isValidTransition(from: PolicyStatus, to: PolicyStatus): boolean {
  return (POLICY_TRANSITIONS[from] ?? []).includes(to);
}

export class InvalidPolicyTransitionError extends Error {
  constructor(public readonly from: PolicyStatus, public readonly to: PolicyStatus) {
    super(`Invalid policy transition: ${from} -> ${to}`);
    this.name = "InvalidPolicyTransitionError";
  }
}

export interface LifecycleResult {
  policy: Policy;
  audit: Awaited<ReturnType<typeof storage.createPolicyAuditLog>>;
}

/**
 * Move an existing policy to a new state. Rejects (throws
 * InvalidPolicyTransitionError) if `policy.status -> toStatus` isn't in
 * POLICY_TRANSITIONS - callers must not fall back to writing the status
 * directly on rejection. Writes exactly one policy_audit_log row per
 * successful call.
 */
export async function transitionPolicy(params: {
  policy: Policy;
  toStatus: PolicyStatus;
  causedBy: string;
}): Promise<LifecycleResult> {
  const fromStatus = params.policy.status as PolicyStatus;
  if (!isValidTransition(fromStatus, params.toStatus)) {
    throw new InvalidPolicyTransitionError(fromStatus, params.toStatus);
  }

  const updated = await storage.updatePolicy(params.policy.id, { status: params.toStatus });
  if (!updated) {
    throw new Error(`Policy ${params.policy.id} disappeared during transition to ${params.toStatus}`);
  }

  const audit = await storage.createPolicyAuditLog({
    policyId: params.policy.id,
    fromStatus,
    toStatus: params.toStatus,
    causedBy: params.causedBy,
  });

  return { policy: updated, audit };
}

/**
 * Create a brand new policy in the given initial state (defaults to
 * "pending"). Not a "transition" in the POLICY_TRANSITIONS sense - there is no
 * prior state - but it writes exactly one audit row with `fromStatus: null` so
 * the audit trail's first entry always shows how a policy came into being.
 */
export async function createPolicyWithAudit(params: {
  policy: InsertPolicy;
  causedBy: string;
}): Promise<LifecycleResult> {
  const initialStatus = (params.policy.status as PolicyStatus | undefined) ?? "pending";
  const policy = await storage.createPolicy({ ...params.policy, status: initialStatus });

  const audit = await storage.createPolicyAuditLog({
    policyId: policy.id,
    fromStatus: null,
    toStatus: initialStatus,
    causedBy: params.causedBy,
  });

  return { policy, audit };
}
