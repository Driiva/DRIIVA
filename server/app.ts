import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { securityHeaders, sanitizeInput, errorHandler, apiLimiter } from "./middleware/security";
import { log } from "./logger";

const app = express();

// Behind Vercel/Cloudflare there is exactly one proxy hop in front of us, so
// trust the first X-Forwarded-For entry. Without this req.ip resolves to the
// proxy address and every client collapses into a single rate-limit bucket.
app.set('trust proxy', 1);

app.use(securityHeaders);

const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:5173,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const CORS_ORIGIN_SET = new Set(CORS_ORIGINS);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGIN_SET.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use('/api/', apiLimiter);
// Stripe webhook requires raw body for signature verification - must come before express.json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use('/api/webhooks/root', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Input sanitisation must run AFTER the body parsers so req.body is populated —
// running it before leaves body sanitisation dead and only the query string is
// cleaned. The raw webhook paths are skipped because their body is a Buffer
// kept byte-intact for Stripe/Root signature verification.
const RAW_BODY_PATHS = ['/api/webhooks/stripe', '/api/webhooks/root'];
app.use((req, res, next) => {
  if (RAW_BODY_PATHS.some((p) => req.path.startsWith(p))) {
    next();
    return;
  }
  sanitizeInput(req, res, next);
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  // Only ever stringified for the log line, so `unknown` is the honest type:
  // nothing here reads a field off it.
  let capturedJsonResponse: unknown = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export const ready = registerRoutes(app).then(() => {
  app.use(errorHandler);
});

export { app };
