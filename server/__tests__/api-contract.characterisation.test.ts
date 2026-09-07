/**
 * CHARACTERISATION SUITE - server API contract (rebuild mission, 2026-07).
 *
 * Locks in the CURRENT behaviour of server/app.ts + the route modules under
 * server/http/, quirks included. A failure here means behaviour changed (or the
 * test is wrong) - never "found a bug". Contract source:
 * docs/rebuild/audit-api-contracts.md (API-01..API-36).
 *
 * Real: Express wiring, middleware order, zod schemas, route logic, refund
 * calculation (@driiva/scoring's calculateRefundCents - a pure function, not
 * mocked).
 * Mocked at the module boundary: Firebase Admin, Neon storage, Stripe,
 * WebAuthn service, AI providers - all in helpers/apiContractRig.ts, which the
 * payments and webauthn halves of this suite share.
 * Rate limiters are pass-through here; their 429 contract is characterised
 * separately in rate-limit.characterisation.test.ts (own module registry).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";

// The rig installs every module mock, so it must be imported before anything
// below it pulls in server/app.ts.
import { admin, asUser, NEON_USER, stripeMock, verify } from "./helpers/apiContractRig";
import { app, ready } from "../app";
import { storage } from "../storage";
import { calculateRefundCents } from "../../packages/scoring/src/refund";
import { scoreAggregation } from "../lib/scoreAggregation";
import { webauthnService } from "../webauthn";

beforeAll(async () => {
  await ready;
});

beforeEach(() => {
  vi.clearAllMocks();
  admin.mockReturnValue(null);
});

describe("API-01 health", () => {
  it("GET /api/health is public and returns ok+timestamp", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.timestamp).toBe("string");
  });
});

describe("auth gating (requireAuth / requireResourceOwner / requireAdmin)", () => {
  it("AUTH endpoint without token → 401 FIREBASE_TOKEN_REQUIRED", async () => {
    const res = await request(app).get("/api/profile/me");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("FIREBASE_TOKEN_REQUIRED");
  });

  it("AUTH endpoint with invalid token → 401", async () => {
    verify.mockResolvedValue(null);
    const res = await request(app)
      .get("/api/profile/me")
      .set("Authorization", "Bearer bad");
    expect(res.status).toBe(401);
  });

  it("OWNER endpoint with mismatched :userId → 403 RESOURCE_OWNER_REQUIRED", async () => {
    const headers = asUser();
    const res = await request(app).get("/api/dashboard/999").set(headers);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("RESOURCE_OWNER_REQUIRED");
  });

  it("ADMIN endpoint as non-admin → 403 ADMIN_REQUIRED", async () => {
    const headers = asUser();
    const res = await request(app)
      .put("/api/community-pool")
      .set(headers)
      .send({ poolAmount: "1.00" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_REQUIRED");
  });

  it("ADMIN endpoint as admin uid passes the gate (unvalidated body goes straight to storage)", async () => {
    const headers = asUser({ ...NEON_USER, firebaseUid: "admin-uid" }, "admin-uid");
    vi.mocked(storage.updateCommunityPool).mockResolvedValue({ id: 1, poolAmount: "1.00" } as never);
    const res = await request(app)
      .put("/api/community-pool")
      .set(headers)
      .send({ anyField: "accepted-without-validation" });
    expect(res.status).toBe(200);
    // QUIRK: no field allow-list — arbitrary body reaches storage.updateCommunityPool
    expect(vi.mocked(storage.updateCommunityPool).mock.calls[0][0]).toMatchObject({
      anyField: "accepted-without-validation",
    });
  });
});

describe("API-02/03 profile/me", () => {
  // DISPOSITION (M1 T3): the two prior "QUIRK: ... 401" tests below pinned
  // verifyFirebaseAuth's old wall (no Neon row → req.auth never set → 401).
  // The wall is retired: a valid token now authenticates regardless of a
  // Neon row. FIX, not drop: both are rewritten to pin the new behaviour.
  it("FIX (was QUIRK/401): valid Firebase token with NO Neon row now authenticates, GET /api/profile/me 200s via auto-provision", async () => {
    const headers = asUser(null);
    vi.mocked(storage.getOrCreateUserByFirebase).mockResolvedValue(NEON_USER as never);
    const res = await request(app).get("/api/profile/me").set(headers);
    expect(res.status).toBe(200);
    expect(storage.getOrCreateUserByFirebase).toHaveBeenCalledWith(
      "fb-uid-1",
      "driver@driiva.co.uk",
      undefined
    );
  });

  // DISPOSITION: FIX. PATCH no longer 401s for a missing Neon row; it is
  // retired outright (410) regardless of the row, so the old distinction
  // this test drew (401 for no-row vs 400/200 for a row) no longer applies.
  it("FIX (was QUIRK/401): PATCH /api/profile/me is retired, 410 regardless of Neon row, no storage write", async () => {
    const headers = asUser(null);
    const res = await request(app)
      .patch("/api/profile/me")
      .set(headers)
      .send({ onboardingComplete: true });
    expect(res.status).toBe(410);
    expect(storage.updateUser).not.toHaveBeenCalled();
  });

  // DISPOSITION: DROP. The endpoint no longer parses the request body at
  // all (onboarding-write role retired), so "rejects non-boolean" no longer
  // has anything to assert; folded into the 410-for-any-body test below.
  //
  // DISPOSITION: DROP. "persists boolean onboardingComplete via
  // storage.updateUser" pinned the write path this task removes; superseded
  // by the 410 test above and the one below.
  it("PATCH /api/profile/me stays 410 for an existing Neon user too (no legacy write path remains)", async () => {
    const headers = asUser();
    const res = await request(app)
      .patch("/api/profile/me")
      .set(headers)
      .send({ onboardingComplete: true });
    expect(res.status).toBe(410);
    expect(storage.updateUser).not.toHaveBeenCalled();
  });
});

describe("API-15 GET /api/trips/:userId", () => {
  it("QUIRK: startDate without endDate is silently ignored — falls through to the pagination path, 200", async () => {
    const headers = asUser();
    vi.mocked(storage.getUserTrips).mockResolvedValue([] as never);
    const res = await request(app)
      .get("/api/trips/7?startDate=2026-06-01T00:00:00Z")
      .set(headers);
    expect(res.status).toBe(200);
    expect(storage.getUserTrips).toHaveBeenCalled();
    expect(storage.getTripsByDateRange).not.toHaveBeenCalled();
  });

  it("unparseable dates (both present) → 400 ISO 8601 message", async () => {
    const headers = asUser();
    const res = await request(app)
      .get("/api/trips/7?startDate=abc&endDate=def")
      .set(headers);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("ISO 8601");
  });

  it("endDate <= startDate → 400", async () => {
    const headers = asUser();
    const res = await request(app)
      .get("/api/trips/7?startDate=2026-06-02T00:00:00Z&endDate=2026-06-01T00:00:00Z")
      .set(headers);
    expect(res.status).toBe(400);
  });

  it("default pagination path returns array from getUserTrips", async () => {
    const headers = asUser();
    vi.mocked(storage.getUserTrips).mockResolvedValue([{ id: 1 }] as never);
    const res = await request(app).get("/api/trips/7").set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1 }]);
  });
});

describe("API-16..19 scores", () => {
  it("weekly with no data → 404", async () => {
    const headers = asUser();
    vi.mocked(scoreAggregation.getWeeklyScore).mockResolvedValue(null as never);
    const res = await request(app).get("/api/scores/weekly/7").set(headers);
    expect(res.status).toBe(404);
  });

  it("QUIRK: timeseries accepts an invalid granularity without a 400 (unvalidated cast)", async () => {
    const headers = asUser();
    vi.mocked(scoreAggregation.getTimeSeriesData).mockResolvedValue([] as never);
    const res = await request(app)
      .get("/api/scores/timeseries/7?granularity=hourly")
      .set(headers);
    expect(res.status).toBe(200);
    expect(vi.mocked(scoreAggregation.getTimeSeriesData).mock.calls[0]).toContain("hourly");
  });
});

describe("API-13 dashboard aggregate", () => {
  it("404 when driving profile missing", async () => {
    const headers = asUser();
    vi.mocked(storage.getUser).mockResolvedValue(NEON_USER as never);
    vi.mocked(storage.getDrivingProfile).mockResolvedValue(undefined as never);
    const res = await request(app).get("/api/dashboard/7").set(headers);
    expect(res.status).toBe(404);
  });

  it("aggregates user+profile+trips+pool+achievements+leaderboard with projectedRefund", async () => {
    const headers = asUser();
    vi.mocked(storage.getUser).mockResolvedValue(NEON_USER as never);
    vi.mocked(storage.getDrivingProfile).mockResolvedValue({ currentScore: 90 } as never);
    vi.mocked(storage.getUserTrips).mockResolvedValue([] as never);
    vi.mocked(storage.getCommunityPool).mockResolvedValue({ safetyFactor: "0.80" } as never);
    vi.mocked(storage.getUserAchievements).mockResolvedValue([] as never);
    vi.mocked(storage.getLeaderboard).mockResolvedValue([] as never);
    const res = await request(app).get("/api/dashboard/7").set(headers);
    expect(res.status).toBe(200);
    // Real calculateRefundCents (unmocked): communityScore 75, premium 840.00
    // -> 84000 cents contribution and cap base, safetyFactor 0.80.
    const expectedRefund = calculateRefundCents(90, 75, 84000, 0.80, 84000);
    expect(res.body.profile).toHaveProperty("projectedRefund", expectedRefund);
    expect(res.body).toHaveProperty("communityPool");
    expect(res.body).toHaveProperty("leaderboard");
  });
});

describe("API-21/23 public reads", () => {
  it("QUIRK: GET /api/community-pool returns an empty 200 body when no pool row exists", async () => {
    vi.mocked(storage.getCommunityPool).mockResolvedValue(undefined as never);
    const res = await request(app).get("/api/community-pool");
    expect(res.status).toBe(200);
    expect(res.text).toBe("");
  });

  it("GET /api/leaderboard is public and caches for 60s (second call skips storage)", async () => {
    vi.mocked(storage.getLeaderboard).mockResolvedValue([{ userId: 7 }] as never);
    const key = `${Date.now()}`; // unique period defeats any cache from other tests
    const first = await request(app).get(`/api/leaderboard?period=${key}`);
    const second = await request(app).get(`/api/leaderboard?period=${key}`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(vi.mocked(storage.getLeaderboard)).toHaveBeenCalledTimes(1);
  });
});

describe("API-20 incidents", () => {
  it("surfaces Zod errors as 400 with errors array (contrast trips' 500 quirk)", async () => {
    const headers = asUser();
    const res = await request(app)
      .post("/api/incidents")
      .set(headers)
      .send({ description: "missing type and severity" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Validation error");
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});

describe("API-28/29 GDPR", () => {
  it("export sets a file-download Content-Disposition", async () => {
    const headers = asUser();
    vi.mocked(storage.exportUserData).mockResolvedValue({ user: NEON_USER } as never);
    const res = await request(app).get("/api/gdpr/export/7").set(headers);
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("driiva-data-7.json");
  });

  it("delete calls storage.deleteUserData for the owner only", async () => {
    const headers = asUser();
    vi.mocked(storage.deleteUserData).mockResolvedValue(undefined as never);
    const res = await request(app).delete("/api/gdpr/delete/7").set(headers);
    expect(res.status).toBe(200);
    expect(storage.deleteUserData).toHaveBeenCalledWith(7);
  });
});

describe("API-30/31 AI endpoints", () => {
  it("coach without score/scoreBreakdown → 400", async () => {
    const headers = asUser();
    const res = await request(app).post("/api/ai/coach").set(headers).send({});
    expect(res.status).toBe(400);
  });

  it("coach with no provider key configured → 503", async () => {
    const savedA = process.env.AI_COACH_API_KEY;
    const savedP = process.env.PERPLEXITY_API_KEY;
    delete process.env.AI_COACH_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    try {
      const headers = asUser();
      const res = await request(app)
        .post("/api/ai/coach")
        .set(headers)
        .send({ score: 88, scoreBreakdown: {} });
      expect(res.status).toBe(503);
    } finally {
      if (savedA !== undefined) process.env.AI_COACH_API_KEY = savedA;
      if (savedP !== undefined) process.env.PERPLEXITY_API_KEY = savedP;
    }
  });

  it("ask without prompt → 400", async () => {
    const headers = asUser();
    const res = await request(app).post("/api/ask").set(headers).send({});
    expect(res.status).toBe(400);
  });
});
