/**
 * CHARACTERISATION SUITE — rate limiter contract (rebuild mission, 2026-07).
 *
 * Separate file from api-contract.characterisation.test.ts on purpose: that
 * file neuters the limiters; this one keeps them REAL (in-memory store — no
 * Upstash env in tests, which is itself the documented fallback behaviour)
 * and pins the 429 contract of authLimiter (10/min/IP) on a public endpoint.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getUserByFirebaseUid: vi.fn(),
    getOrCreateUserByFirebase: vi.fn(),
    getCommunityPool: vi.fn(),
    getLeaderboard: vi.fn(),
    getAchievements: vi.fn(),
    getUserByStripeCustomerId: vi.fn(),
    updateStripeCustomerId: vi.fn(),
  },
}));
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(async () => null),
  getFirebaseAdmin: vi.fn(() => null),
}));
vi.mock("../lib/aiInsights", () => ({
  aiInsightsEngine: { generateInsights: vi.fn() },
}));
vi.mock("../lib/scoreAggregation", () => ({
  scoreAggregation: {
    getWeeklyScore: vi.fn(),
    getMonthlyScore: vi.fn(),
    getTimeSeriesData: vi.fn(),
    getScoreTrend: vi.fn(),
  },
}));
vi.mock("../webauthn", () => ({
  webauthnService: {
    hasCredentials: vi.fn(async () => false),
    generateRegistrationOptions: vi.fn(),
    verifyRegistration: vi.fn(),
    generateAuthenticationOptions: vi.fn(),
    verifyAuthentication: vi.fn(),
    getUserCredentials: vi.fn(),
    deleteCredential: vi.fn(),
  },
}));
vi.mock("../lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent: vi.fn() } }),
  getStripeWebhookSecret: () => "whsec_test",
  stripeIdempotencyKey: (...parts: unknown[]) => parts.join("-"),
}));
vi.mock("../lib/crypto", () => ({ crypto: { encrypt: vi.fn() } }));

import { app, ready } from "../app";

beforeAll(async () => {
  await ready;
});

describe("authLimiter (10/min/IP) on POST /api/auth/firebase", () => {
  it("first 10 requests pass the limiter (reach the handler's 400), 11th is 429", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await request(app).post("/api/auth/firebase").send({});
      statuses.push(res.status);
    }
    // Handler returns 400 (no token) — proves the limiter passed the request through.
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(400));
    expect(statuses[10]).toBe(429);
  });
});
