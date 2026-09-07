/**
 * Route inventory pin.
 *
 * `registerRoutes` is the only place the Express API is assembled, and it was
 * a 1,500-line file before being split into `server/routes/*` by domain. A
 * move of that size can silently drop a route, drop an auth middleware from a
 * route, or register the same path twice, and the characterisation suite only
 * notices for the paths it happens to exercise.
 *
 * So this test records every registration `registerRoutes` makes against a
 * fake app and pins the full set: method, path and how many handlers sit on
 * it. The handler count is the part that matters for security - a route that
 * goes from three handlers to two has usually lost `requireAuth` or
 * `requireResourceOwner`.
 *
 * Order across distinct paths is not pinned (Express only cares about order
 * when paths overlap, and none of these do), with one exception: the Firebase
 * token verifier must be the first thing registered, or a route could run
 * before `req.auth` exists.
 */
import { describe, it, expect, vi } from "vitest";
import type { Express } from "express";

// Module-boundary stubs so importing the route modules has no side effects
// (storage, webauthn and scoreAggregation each open the Neon client on import).
vi.mock("../storage", () => ({ storage: {} }));
vi.mock("../webauthn", () => ({ webauthnService: {} }));
vi.mock("../lib/scoreAggregation", () => ({ scoreAggregation: {} }));
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  getFirebaseAdmin: vi.fn(() => null),
}));

import { registerRoutes } from "../routes";

/** `METHOD /path [handlerCount]` for every route, plus `USE` lines for app.use. */
const EXPECTED_ROUTES = [
  "GET /api/health [1]",

  "GET /api/profile/me [2]",
  "PATCH /api/profile/me [2]",
  "GET /api/auth/check [2]",
  "POST /api/auth/firebase [2]",
  "POST /api/auth/webauthn/check [2]",
  "POST /api/auth/webauthn/register/start [3]",
  "POST /api/auth/webauthn/register/complete [3]",
  "POST /api/auth/webauthn/authenticate/start [2]",
  "POST /api/auth/webauthn/authenticate/complete [2]",
  "GET /api/auth/webauthn/credentials/me [2]",
  "DELETE /api/auth/webauthn/credentials/:credentialId [2]",

  "GET /api/dashboard/:userId [3]",
  "GET /api/trips/:userId [3]",
  "GET /api/scores/weekly/:userId [3]",
  "GET /api/scores/monthly/:userId [3]",
  "GET /api/scores/timeseries/:userId [3]",
  "GET /api/scores/trend/:userId [3]",
  "POST /api/incidents [2]",
  "GET /api/insights/:userId [3]",

  "GET /api/community-pool [1]",
  "PUT /api/community-pool [4]",
  "GET /api/leaderboard [1]",
  "GET /api/achievements [1]",
  "GET /api/achievements/:userId [3]",
  "POST /api/simulate-refund [2]",

  "GET /api/gdpr/export/:userId [3]",
  "DELETE /api/gdpr/delete/:userId [4]",

  "POST /api/ai/coach [3]",
  "POST /api/ask [2]",

  "POST /api/payments/create-subscription [2]",
  "POST /api/payments/create-checkout [2]",
  "GET /api/payments/billing-portal [2]",

  "POST /api/webhooks/stripe [2]",
  "POST /api/webhooks/root [2]",
];

async function recordRegistrations(): Promise<string[]> {
  const entries: string[] = [];
  const record = (method: string) => (path: string, ...handlers: unknown[]) => {
    entries.push(`${method} ${path} [${handlers.length}]`);
  };
  const fakeApp = {
    use: (...args: unknown[]) => {
      const mount = typeof args[0] === "string" ? args[0] : "*";
      const handlers = args.filter((a) => typeof a === "function");
      entries.push(`USE ${mount} [${handlers.length}]`);
    },
    get: record("GET"),
    post: record("POST"),
    put: record("PUT"),
    patch: record("PATCH"),
    delete: record("DELETE"),
  } as unknown as Express;

  await registerRoutes(fakeApp);
  return entries;
}

describe("API route inventory", () => {
  it("registers the Firebase token verifier before any route", async () => {
    const entries = await recordRegistrations();
    expect(entries[0]).toBe("USE * [1]");
    expect(entries.filter((e) => e.startsWith("USE "))).toEqual(["USE * [1]"]);
  });

  it("registers exactly the pinned routes with the pinned handler counts", async () => {
    const entries = await recordRegistrations();
    const routes = entries.filter((e) => !e.startsWith("USE "));
    expect([...routes].sort()).toEqual([...EXPECTED_ROUTES].sort());
  });

  it("registers no path more than once", async () => {
    const entries = await recordRegistrations();
    const keys = entries
      .filter((e) => !e.startsWith("USE "))
      .map((e) => e.replace(/ \[\d+\]$/, ""));
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(duplicates).toEqual([]);
  });
});
