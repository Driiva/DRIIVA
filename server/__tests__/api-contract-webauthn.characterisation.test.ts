/**
 * CHARACTERISATION SUITE - WebAuthn endpoints (API-06..API-10).
 *
 * Split out of api-contract.characterisation.test.ts, which had grown past the
 * 500-line ceiling. Same rig, same rules.
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

describe("WebAuthn endpoints (API-06..API-10)", () => {
  it("QUIRK: /check always 200s — internal errors collapse to hasPasskey:false", async () => {
    vi.mocked(webauthnService.hasCredentials).mockRejectedValue(new Error("db down"));
    const res = await request(app)
      .post("/api/auth/webauthn/check")
      .send({ email: "driver@driiva.co.uk" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasPasskey: false });
  });

  it("register/start requires auth (401 without token) — enrolment cannot be aimed at a victim email", async () => {
    const res = await request(app)
      .post("/api/auth/webauthn/register/start")
      .send({ email: "victim@driiva.co.uk" });
    expect(res.status).toBe(401);
  });

  it("authenticate/complete success returns user + Firebase customToken bridge (route checks result.verified, not success)", async () => {
    vi.mocked(webauthnService.verifyAuthentication).mockResolvedValue({
      verified: true,
      user: { id: 7, email: "driver@driiva.co.uk" },
      customToken: "custom-token-1",
    } as never);
    const res = await request(app)
      .post("/api/auth/webauthn/authenticate/complete")
      .send({ email: "driver@driiva.co.uk", assertion: {} });
    expect(res.status).toBe(200);
    expect(res.body.customToken).toBe("custom-token-1");
  });
});
