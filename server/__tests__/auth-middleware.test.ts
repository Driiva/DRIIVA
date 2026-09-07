import { describe, it, expect, vi, beforeEach } from "vitest";

// Set ADMIN env before the auth module loads (it reads env at import time).
vi.hoisted(() => {
  process.env.ADMIN_FIREBASE_UIDS = "admin-uid-1,admin-uid-2";
});

import type { Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import {
  verifyFirebaseAuth,
  requireAuth,
  requireResourceOwner,
  requireAdmin,
  AuthRequest,
} from "../middleware/auth";

vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: { getUserByFirebaseUid: vi.fn() },
}));

import { verifyFirebaseToken } from "../lib/firebase-admin";
import { storage } from "../storage";

const mockedVerify = vi.mocked(verifyFirebaseToken);
const mockedGetUser = vi.mocked(storage.getUserByFirebaseUid);

function mockReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    headers: {},
    params: {},
    ...overrides,
  } as AuthRequest;
}

/**
 * A Neon user row with only the fields this middleware reads populated. Typed
 * as the real row so a shape change here fails the test rather than sliding
 * past a cast.
 */
function userRow(id: number): User {
  return { id } as User;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe("verifyFirebaseAuth", () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  it("calls next without setting req.auth when no auth header", async () => {
    const req = mockReq();
    await verifyFirebaseAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.auth).toBeUndefined();
  });

  it("calls next without setting req.auth for invalid token", async () => {
    mockedVerify.mockResolvedValue(null);
    const req = mockReq({ headers: { authorization: "Bearer bad-token" } });
    await verifyFirebaseAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.auth).toBeUndefined();
  });

  it("sets req.auth when token is valid and user exists in DB", async () => {
    mockedVerify.mockResolvedValue({ uid: "fb-123", email: "test@driiva.com" });
    mockedGetUser.mockResolvedValue(userRow(42));
    const req = mockReq({ headers: { authorization: "Bearer valid-token" } });
    await verifyFirebaseAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.auth).toEqual({ uid: "fb-123", email: "test@driiva.com", userId: 42 });
  });

  // DISPOSITION (M1 T3, FIX): this pinned the retired 401 wall (no DB user,
  // req.auth left unset). A valid token now authenticates regardless; the
  // Neon row only enriches userId, it is no longer a gate.
  it("sets req.auth with userId=undefined when token is valid but no DB user", async () => {
    mockedVerify.mockResolvedValue({ uid: "fb-999", email: "ghost@driiva.com" });
    mockedGetUser.mockResolvedValue(undefined);
    const req = mockReq({ headers: { authorization: "Bearer valid-token" } });
    await verifyFirebaseAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.auth).toEqual({ uid: "fb-999", email: "ghost@driiva.com", userId: undefined });
  });
});

describe("requireAuth", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it("calls next when req.auth.uid is present", () => {
    const req = mockReq({ auth: { uid: "fb-123", email: "a@b.com", userId: 1 } });
    const res = mockRes();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 when req.auth is missing", () => {
    const req = mockReq();
    const res = mockRes();
    requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "FIREBASE_TOKEN_REQUIRED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireResourceOwner", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it("calls next when userId param matches req.auth.userId", () => {
    const req = mockReq({
      auth: { uid: "fb-1", userId: 7 },
      params: { userId: "7" },
    });
    const res = mockRes();
    requireResourceOwner()(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 403 when userId param does not match", () => {
    const req = mockReq({
      auth: { uid: "fb-1", userId: 7 },
      params: { userId: "99" },
    });
    const res = mockRes();
    requireResourceOwner()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "RESOURCE_OWNER_REQUIRED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  // REGRESSION (M1 T7 add-on): the newly-reachable state T3 created -
  // req.auth set with userId: undefined (valid token, no Neon row yet, see
  // verifyFirebaseAuth above). A route param present but no DB row must
  // still 403, not incorrectly authorize because both sides are "falsy".
  it("returns 403 when req.auth.userId is undefined (valid token, no DB row yet)", () => {
    const req = mockReq({
      auth: { uid: "fb-1", userId: undefined },
      params: { userId: "7" },
    });
    const res = mockRes();
    requireResourceOwner()(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "RESOURCE_OWNER_REQUIRED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it("calls next when uid is in ADMIN_UIDS", () => {
    const req = mockReq({ auth: { uid: "admin-uid-1", userId: 1 } });
    const res = mockRes();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 when uid is not in ADMIN_UIDS", () => {
    const req = mockReq({ auth: { uid: "not-an-admin", userId: 1 } });
    const res = mockRes();
    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ADMIN_REQUIRED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
