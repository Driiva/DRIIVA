/**
 * Policy lifecycle state machine tests (M4 Task 3).
 *
 * Mocks ../storage at the module boundary (same pattern as
 * server/__tests__/stripe-webhook-idempotency.test.ts) with an in-memory fake
 * so the audit trail can be inspected directly - each transition must write
 * exactly one policy_audit_log row, and a rejected transition must write none.
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
}));

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
  // CAS write matching the real DatabaseStorage.updatePolicyIfStatus contract:
  // only applies `updates` (and returns the row) if the in-memory row's status
  // still equals `fromStatus`; returns undefined on a stale-status mismatch
  // (zero rows would match the real `WHERE id = ? AND status = ?`).
  updatePolicyIfStatus: vi.fn(async (id: number, fromStatus: string, updates: { status?: string }) => {
    const row = state.policies.get(id);
    if (!row) return undefined;
    if (row.status !== fromStatus) return undefined;
    if (updates.status) row.status = updates.status;
    return row;
  }),
  createPolicyAuditLog: vi.fn(async (entry: { policyId: number; fromStatus: string | null; toStatus: string; causedBy: string }) => {
    const row: FakeAuditRow = { id: state.nextAuditId++, ...entry };
    state.auditLog.push(row);
    return row;
  }),
}));

vi.mock("../storage", () => ({ storage: storageMock }));

import {
  transitionPolicy,
  createPolicyWithAudit,
  InvalidPolicyTransitionError,
} from "./policyLifecycle";

function auditFor(policyId: number): FakeAuditRow[] {
  return state.auditLog.filter((row) => row.policyId === policyId);
}

beforeEach(() => {
  state.policies.clear();
  state.auditLog.length = 0;
  state.nextPolicyId = 1;
  state.nextAuditId = 1;
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
  storageMock.updatePolicyIfStatus.mockImplementation(async (id: number, fromStatus: string, updates: { status?: string }) => {
    const row = state.policies.get(id);
    if (!row) return undefined;
    if (row.status !== fromStatus) return undefined;
    if (updates.status) row.status = updates.status;
    return row;
  });
  storageMock.createPolicyAuditLog.mockImplementation(async (entry: { policyId: number; fromStatus: string | null; toStatus: string; causedBy: string }) => {
    const row: FakeAuditRow = { id: state.nextAuditId++, ...entry };
    state.auditLog.push(row);
    return row;
  });
});

describe("policyLifecycle", () => {
  it("walks the full lifecycle pending -> active -> past_due -> cancelled, one audit row per transition", async () => {
    const { policy: created } = await createPolicyWithAudit({
      policy: { userId: 1, policyNumber: "POL-1", status: "pending" } as any,
      causedBy: "admin:test-setup",
    });
    expect(created.status).toBe("pending");
    expect(auditFor(created.id)).toHaveLength(1);
    expect(auditFor(created.id)[0]).toMatchObject({ fromStatus: null, toStatus: "pending", causedBy: "admin:test-setup" });

    const toActive = await transitionPolicy({ policy: created as any, toStatus: "active", causedBy: "stripe:evt_1" });
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
      policy: { userId: 1, policyNumber: "POL-2", status: "cancelled" } as any,
      causedBy: "admin:test-setup",
    });
    expect(created.status).toBe("cancelled");
    const auditCountBefore = auditFor(created.id).length;

    await expect(
      transitionPolicy({ policy: created as any, toStatus: "active", causedBy: "admin:sneaky-reactivation" })
    ).rejects.toThrow(InvalidPolicyTransitionError);

    // No new audit row for the rejected attempt.
    expect(auditFor(created.id)).toHaveLength(auditCountBefore);
    // Policy status untouched by the rejected attempt.
    expect(state.policies.get(created.id)?.status).toBe("cancelled");
    // updatePolicy must never have been called with the rejected target status.
    expect(storageMock.updatePolicy).not.toHaveBeenCalledWith(created.id, { status: "active" });
  });

  it("rejects any cancelled -> X transition (cancelled is terminal)", async () => {
    const { policy: created } = await createPolicyWithAudit({
      policy: { userId: 1, policyNumber: "POL-3", status: "cancelled" } as any,
      causedBy: "admin:test-setup",
    });

    for (const target of ["pending", "past_due", "lapsed", "cancelled"] as const) {
      await expect(
        transitionPolicy({ policy: created as any, toStatus: target, causedBy: "admin:test" })
      ).rejects.toThrow(InvalidPolicyTransitionError);
    }
  });

  it("CAS guard rejects a stale-state write: two 'concurrent' transitions off the same observed fromStatus - only one wins, one audit row", async () => {
    const { policy: created } = await createPolicyWithAudit({
      policy: { userId: 1, policyNumber: "POL-4", status: "active" } as any,
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
    const first = await transitionPolicy({ policy: staleSnapshot as any, toStatus: "past_due", causedBy: "stripe:evt_a" });
    expect(first.policy.status).toBe("past_due");

    await expect(
      transitionPolicy({ policy: staleSnapshot as any, toStatus: "cancelled", causedBy: "stripe:evt_b" })
    ).rejects.toThrow(InvalidPolicyTransitionError);

    // Only the winning transition wrote an audit row for the pair.
    expect(auditFor(created.id)).toHaveLength(auditCountBefore + 1);

    // The storage-layer CAS method itself also directly rejects a stale write:
    // once the row has moved on, a repeat call with the original fromStatus
    // returns undefined (zero rows matched) rather than overwriting.
    const staleWrite = await storageMock.updatePolicyIfStatus(created.id, "active", { status: "lapsed" });
    expect(staleWrite).toBeUndefined();
  });
});
