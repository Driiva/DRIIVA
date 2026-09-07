/**
 * Policy lifecycle state machine tests (M4 Task 3 + M4 review fix I4).
 *
 * Mocks ../storage at the module boundary (same pattern as
 * server/__tests__/stripe-webhook-idempotency.test.ts) with an in-memory fake
 * so the audit trail can be inspected directly - each transition must write
 * exactly one policy_audit_log row, and a rejected transition must write none.
 *
 * transitionPolicyWithAudit's fake faithfully emulates the real
 * DatabaseStorage.transitionPolicyWithAudit's db.transaction semantics
 * (server/storage.ts): the CAS status write and the audit insert are one
 * atomic unit - if the audit insert throws, the tentative status write is
 * rolled back before the error propagates, exactly as a real Postgres
 * transaction would roll back on an uncaught exception inside the callback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakePolicy {
  id: number;
  status: string;
}

interface FakeAuditRow {
  id: number;
  policyId: number;
  fromStatus: string | null;
  toStatus: string;
  causedBy: string;
}

const state = vi.hoisted(() => ({
  policies: new Map<number, FakePolicy>(),
  auditLog: [] as FakeAuditRow[],
  nextPolicyId: 1,
  nextAuditId: 1,
  // I4 test hook: when set, transitionPolicyWithAudit simulates the audit
  // insert throwing for this policy id, after the status write has already
  // been tentatively applied - proving the fake (and by extension the real
  // db.transaction it emulates) rolls the tentative status change back.
  auditShouldFailForPolicyId: null as number | null,
}));

function transitionPolicyWithAuditImpl(params: { id: number; fromStatus: string; toStatus: string; causedBy: string }) {
  const row = state.policies.get(params.id);
  if (!row || row.status !== params.fromStatus) return undefined;

  // Emulate a single db.transaction: tentatively apply the status write, then
  // attempt the audit insert within the "same transaction". If the audit
  // insert throws, roll the status write back before rethrowing - mirrors
  // DatabaseStorage.transitionPolicyWithAudit's real db.transaction (server/storage.ts):
  // both writes commit together, or neither does.
  const previousStatus = row.status;
  row.status = params.toStatus;
  try {
    if (state.auditShouldFailForPolicyId === params.id) {
      throw new Error("simulated audit insert failure");
    }
    const auditRow: FakeAuditRow = {
      id: state.nextAuditId++,
      policyId: params.id,
      fromStatus: params.fromStatus,
      toStatus: params.toStatus,
      causedBy: params.causedBy,
    };
    state.auditLog.push(auditRow);
    return { policy: row, audit: auditRow };
  } catch (err) {
    row.status = previousStatus; // rollback, mirroring a real ROLLBACK
    throw err;
  }
}

const storageMock = vi.hoisted(() => ({
  createPolicy: vi.fn(async (policy: { status?: string }) => {
    const row: FakePolicy = { id: state.nextPolicyId++, status: policy.status ?? "pending" };
    state.policies.set(row.id, row);
    return row;
  }),
  updatePolicy: vi.fn(async (id: number, updates: { status?: string }) => {
    const row = state.policies.get(id);
    if (!row) return undefined;
    if (updates.status) row.status = updates.status;
    return row;
  }),
  createPolicyAuditLog: vi.fn(async (entry: { policyId: number; fromStatus: string | null; toStatus: string; causedBy: string }) => {
    const row: FakeAuditRow = { id: state.nextAuditId++, ...entry };
    state.auditLog.push(row);
    return row;
  }),
  // I4 fix: transitionPolicy now delegates to this single atomic storage
  // call instead of two independent calls (updatePolicyIfStatus then
  // createPolicyAuditLog).
  transitionPolicyWithAudit: vi.fn(async (params: { id: number; fromStatus: string; toStatus: string; causedBy: string }) =>
    transitionPolicyWithAuditImpl(params),
  ),
}));

vi.mock("../storage", () => ({ storage: storageMock }));

import type { InsertPolicy, Policy } from "@shared/schema";
import {
  transitionPolicy,
  createPolicyWithAudit,
  InvalidPolicyTransitionError,
} from "./policyLifecycle";

/**
 * A complete policy row, so these tests hand the lifecycle a real Policy
 * rather than a partial cast at each call site. Only the fields a test cares
 * about are ever overridden; the rest are the column defaults.
 */
function policyFixture(overrides: Partial<Policy> = {}): Policy {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: 0,
    userId: 1,
    policyNumber: "POL-FIXTURE",
    status: "pending",
    coverageType: "standard",
    basePremiumCents: 0,
    currentPremiumCents: 0,
    discountPercentage: 0,
    effectiveDate: now,
    expirationDate: now,
    renewalDate: null,
    stripeSubscriptionId: null,
    billingCycle: "annual",
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

/** The insert half of the same fixture. */
function insertPolicyFixture(overrides: Partial<InsertPolicy> = {}): InsertPolicy {
  const { id: _id, ...rest } = policyFixture();
  return { ...rest, ...overrides };
}

function auditFor(policyId: number): FakeAuditRow[] {
  return state.auditLog.filter((row) => row.policyId === policyId);
}

beforeEach(() => {
  state.policies.clear();
  state.auditLog.length = 0;
  state.nextPolicyId = 1;
  state.nextAuditId = 1;
  state.auditShouldFailForPolicyId = null;
  vi.clearAllMocks();
  // Restore the real implementations after vi.clearAllMocks() clears them.
  storageMock.createPolicy.mockImplementation(async (policy: { status?: string }) => {
    const row: FakePolicy = { id: state.nextPolicyId++, status: policy.status ?? "pending" };
    state.policies.set(row.id, row);
    return row;
  });
  storageMock.updatePolicy.mockImplementation(async (id: number, updates: { status?: string }) => {
    const row = state.policies.get(id);
    if (!row) return undefined;
    if (updates.status) row.status = updates.status;
    return row;
  });
  storageMock.createPolicyAuditLog.mockImplementation(async (entry: { policyId: number; fromStatus: string | null; toStatus: string; causedBy: string }) => {
    const row: FakeAuditRow = { id: state.nextAuditId++, ...entry };
    state.auditLog.push(row);
    return row;
  });
  storageMock.transitionPolicyWithAudit.mockImplementation(async (params: { id: number; fromStatus: string; toStatus: string; causedBy: string }) =>
    transitionPolicyWithAuditImpl(params),
  );
});

describe("policyLifecycle", () => {
  it("walks the full lifecycle pending -> active -> past_due -> cancelled, one audit row per transition", async () => {
    const { policy: created } = await createPolicyWithAudit({
      policy: insertPolicyFixture({ policyNumber: "POL-1", status: "pending" }),
      causedBy: "admin:test-setup",
    });
    expect(created.status).toBe("pending");
    expect(auditFor(created.id)).toHaveLength(1);
    expect(auditFor(created.id)[0]).toMatchObject({ fromStatus: null, toStatus: "pending", causedBy: "admin:test-setup" });

    const toActive = await transitionPolicy({ policy: policyFixture(created), toStatus: "active", causedBy: "stripe:evt_1" });
    expect(toActive.policy.status).toBe("active");
    expect(auditFor(created.id)).toHaveLength(2);
    expect(auditFor(created.id)[1]).toMatchObject({ fromStatus: "pending", toStatus: "active", causedBy: "stripe:evt_1" });

    const toPastDue = await transitionPolicy({ policy: toActive.policy, toStatus: "past_due", causedBy: "stripe:evt_2" });
    expect(toPastDue.policy.status).toBe("past_due");
    expect(auditFor(created.id)).toHaveLength(3);
    expect(auditFor(created.id)[2]).toMatchObject({ fromStatus: "active", toStatus: "past_due", causedBy: "stripe:evt_2" });

    const toCancelled = await transitionPolicy({ policy: toPastDue.policy, toStatus: "cancelled", causedBy: "stripe:evt_3" });
    expect(toCancelled.policy.status).toBe("cancelled");
    expect(auditFor(created.id)).toHaveLength(4);
    expect(auditFor(created.id)[3]).toMatchObject({ fromStatus: "past_due", toStatus: "cancelled", causedBy: "stripe:evt_3" });

    // Exactly one audit row was written per transition (create + 3 transitions).
    expect(auditFor(created.id).map((r) => r.toStatus)).toEqual(["pending", "active", "past_due", "cancelled"]);
  });

  it("rejects cancelled -> active (no re-activation path) and writes no audit entry for the rejected attempt", async () => {
    const { policy: created } = await createPolicyWithAudit({
      policy: insertPolicyFixture({ policyNumber: "POL-2", status: "cancelled" }),
      causedBy: "admin:test-setup",
    });
    expect(created.status).toBe("cancelled");
    const auditCountBefore = auditFor(created.id).length;

    await expect(
      transitionPolicy({ policy: policyFixture(created), toStatus: "active", causedBy: "admin:sneaky-reactivation" })
    ).rejects.toThrow(InvalidPolicyTransitionError);

    // No new audit row for the rejected attempt.
    expect(auditFor(created.id)).toHaveLength(auditCountBefore);
    // Policy status untouched by the rejected attempt.
    expect(state.policies.get(created.id)?.status).toBe("cancelled");
    // transitionPolicyWithAudit must never have been called with the rejected
    // target status (isValidTransition rejects before the storage call).
    expect(storageMock.transitionPolicyWithAudit).not.toHaveBeenCalled();
  });

  it("rejects any cancelled -> X transition (cancelled is terminal)", async () => {
    const { policy: created } = await createPolicyWithAudit({
      policy: insertPolicyFixture({ policyNumber: "POL-3", status: "cancelled" }),
      causedBy: "admin:test-setup",
    });

    for (const target of ["pending", "past_due", "lapsed", "cancelled"] as const) {
      await expect(
        transitionPolicy({ policy: policyFixture(created), toStatus: target, causedBy: "admin:test" })
      ).rejects.toThrow(InvalidPolicyTransitionError);
    }
  });

  it("CAS guard rejects a stale-state write: two 'concurrent' transitions off the same observed fromStatus - only one wins, one audit row", async () => {
    const { policy: created } = await createPolicyWithAudit({
      policy: insertPolicyFixture({ policyNumber: "POL-4", status: "active" }),
      causedBy: "admin:test-setup",
    });
    const auditCountBefore = auditFor(created.id).length;

    // Take an immutable snapshot of the "active" row, as two handlers both
    // reading via storage.getPolicyByStripeSubscriptionId at the same moment
    // would each get their own independent copy of the row (not a shared
    // mutable reference to the in-memory fake's row).
    const staleSnapshot = { ...created };

    // Simulate two handlers that both read the policy while it was still
    // "active" (e.g. a near-simultaneous payment_failed and
    // subscription.deleted racing on the same policy) and both attempt a
    // transition off that same stale snapshot. The first write wins and moves
    // the row on; the second, still holding the original "active" snapshot,
    // must be rejected by the CAS guard rather than blindly overwriting
    // whatever the first write landed.
    const first = await transitionPolicy({ policy: policyFixture(staleSnapshot), toStatus: "past_due", causedBy: "stripe:evt_a" });
    expect(first.policy.status).toBe("past_due");

    await expect(
      transitionPolicy({ policy: policyFixture(staleSnapshot), toStatus: "cancelled", causedBy: "stripe:evt_b" })
    ).rejects.toThrow(InvalidPolicyTransitionError);

    // Only the winning transition wrote an audit row for the pair.
    expect(auditFor(created.id)).toHaveLength(auditCountBefore + 1);

    // The storage-layer CAS+audit method itself also directly rejects a stale
    // write: once the row has moved on, a repeat call with the original
    // fromStatus returns undefined (zero rows matched, real Postgres WHERE
    // clause semantics) rather than overwriting - and writes no audit row.
    const auditCountAfterFirst = auditFor(created.id).length;
    const staleWrite = await storageMock.transitionPolicyWithAudit({
      id: created.id,
      fromStatus: "active",
      toStatus: "lapsed",
      causedBy: "stripe:evt_stale",
    });
    expect(staleWrite).toBeUndefined();
    expect(auditFor(created.id)).toHaveLength(auditCountAfterFirst);
  });

  it("I4: a forced audit-insert failure rolls back the status change too (CAS write + audit insert are one atomic unit)", async () => {
    const { policy: created } = await createPolicyWithAudit({
      policy: insertPolicyFixture({ policyNumber: "POL-5", status: "active" }),
      causedBy: "admin:test-setup",
    });
    const auditCountBefore = auditFor(created.id).length;

    // Simulate the audit insert throwing after the CAS status write has
    // already been tentatively applied inside the same transaction.
    state.auditShouldFailForPolicyId = created.id;

    await expect(
      transitionPolicy({ policy: policyFixture(created), toStatus: "past_due", causedBy: "stripe:evt_audit_fail" })
    ).rejects.toThrow("simulated audit insert failure");

    // The status change must NOT have taken effect - rolled back with the
    // failed audit insert, not left half-applied.
    expect(state.policies.get(created.id)?.status).toBe("active");
    // No audit row was written for the failed attempt.
    expect(auditFor(created.id)).toHaveLength(auditCountBefore);

    // Once the fault is cleared, the exact same transition succeeds cleanly -
    // proving the rollback left the policy in a genuinely retryable state,
    // not stuck.
    state.auditShouldFailForPolicyId = null;
    const retried = await transitionPolicy({ policy: policyFixture(created), toStatus: "past_due", causedBy: "stripe:evt_retry" });
    expect(retried.policy.status).toBe("past_due");
    expect(auditFor(created.id)).toHaveLength(auditCountBefore + 1);
  });
});
