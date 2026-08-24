import { describe, it, expect, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

import { securityHeaders } from "../middleware/security";

/**
 * The CSP is read at request time from NODE_ENV, so each test can set it and
 * call the middleware directly rather than rebuilding the module.
 */
function cspFor(nodeEnv: string): Record<string, string> {
  process.env.NODE_ENV = nodeEnv;

  const headers: Record<string, string> = {};
  const res = {
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
  } as unknown as Response;

  let nexted = false;
  securityHeaders({} as Request, res, (() => {
    nexted = true;
  }) as NextFunction);
  expect(nexted).toBe(true);

  const policy = headers["Content-Security-Policy"];
  expect(policy).toBeTruthy();

  return Object.fromEntries(
    policy
      .split(";")
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...sources] = directive.split(/\s+/);
        return [name, sources.join(" ")];
      }),
  );
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe("securityHeaders CSP", () => {
  /*
   * The gate regression this pins down.
   *
   * `npm run gates` signs in as a seeded driver against the Auth emulator on
   * 127.0.0.1:9098 while the page is served from localhost:5202. That is
   * cross-origin, connect-src 'self' refused it, and Firebase surfaced the
   * refusal as auth/network-request-failed - which reads as a network or
   * config fault and is neither. Four authenticated routes were reported NOT
   * REACHED on every run because of this header.
   */
  it("allows the loopback emulators in development", () => {
    const connectSrc = cspFor("development")["connect-src"];

    expect(connectSrc).toContain("http://127.0.0.1:*");
    expect(connectSrc).toContain("http://localhost:*");
  });

  it("keeps the dev websocket sources for Vite HMR and Firestore", () => {
    const connectSrc = cspFor("development")["connect-src"];

    expect(connectSrc).toContain("ws:");
    expect(connectSrc).toContain("wss:");
  });

  /*
   * The whole point of gating on NODE_ENV: a shipped bundle must never be
   * allowed to talk to a loopback origin, whatever an attacker can get running
   * on the victim's own machine.
   */
  it("allows no plain-http or loopback source in production", () => {
    const connectSrc = cspFor("production")["connect-src"];

    expect(connectSrc).not.toContain("127.0.0.1");
    expect(connectSrc).not.toContain("localhost");
    expect(connectSrc).not.toContain("http://");
    expect(connectSrc).not.toContain("ws:");
  });

  it("keeps the real Firebase endpoints reachable in both modes", () => {
    for (const mode of ["development", "production"]) {
      const connectSrc = cspFor(mode)["connect-src"];

      expect(connectSrc).toContain("https://identitytoolkit.googleapis.com");
      expect(connectSrc).toContain("https://securetoken.googleapis.com");
      expect(connectSrc).toContain("https://firestore.googleapis.com");
    }
  });

  it("does not relax script-src in production", () => {
    const scriptSrc = cspFor("production")["script-src"];

    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
  });
});
