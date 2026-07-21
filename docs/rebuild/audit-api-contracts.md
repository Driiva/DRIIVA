# Characterisation audit — Server API contracts (API-01..API-36)

> Rebuild mission, 2026-07-02. Produced by read-only audit subagent. Current code = behavioural spec; quirks documented as behaviour, not bugs.

## Entrypoints

Three files touch "the server," but only one path is live in each environment:

- **`server/app.ts`** (`/Users/joa/Documents/Driiva/server/app.ts`) — the single source of truth for the Express app (middleware chain + `registerRoutes`). Exports `app` and `ready` (a promise that resolves once routes are registered and the error handler is attached).
- **`server/index.ts`** (`server/index.ts:1-36`) — self-host/local-dev entry only. Imports `app`/`ready` from `app.ts`, adds Vite dev middleware or static serving, and calls `server.listen(PORT)`. Used by `npm run dev` and `npm start` (`dist/index.js`, esbuild-bundled from `server/index.ts` per `package.json`'s `build` script). **Does not run on Vercel.**
- **`api/index.ts`** (`api/index.ts:1-43`) — the actual Vercel serverless entrypoint. Dynamically imports `api/_server.js`, which `vercel.json`'s `buildCommand` produces by esbuild-bundling `server/app.ts` (not `server/index.ts`) directly. Awaits `mod.ready` then delegates `(req,res)` to the Express app as a raw handler.
- **QUIRK**: `package.json`'s `build` script (`esbuild server/index.ts ... --outdir=dist`) and `vercel.json`'s `buildCommand` (`esbuild server/app.ts ... --outfile=api/_server.js`) bundle two different entry files. This is intentional per the comment in `server/index.ts:1-15` (self-host needs Vite/static serving, Vercel doesn't) but means `npm run build` output (`dist/index.js`) is never what ships to production.
- `vercel.json` rewrites: `/api/(.*)` → `/api/index`, everything else → `/index.html` (SPA fallback). `functions.api/index.ts.maxDuration = 30`.
- **Dead code**: `api/main.py` (30KB FastAPI app, "Driiva Refund Calculator API" with a mock XGBoost risk service) plus `api/requirements.txt` and `api/__init__.py` sit in the same folder as the real `api/index.ts` but are **not referenced anywhere** in `vercel.json` or `package.json`. Not part of the production contract — a completely separate, unwired Python service.

### Middleware chain, in order (`server/app.ts`)

1. `app.set('trust proxy', 1)` — trusts exactly one proxy hop (Vercel/Cloudflare); required for `req.ip` to resolve to the real client IP (rate-limit keys depend on this).
2. `securityHeaders` (`server/middleware/security.ts:65-91`) — sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `X-XSS-Protection`, HSTS, `Referrer-Policy`, `Permissions-Policy`, and a hand-built CSP string (looser in dev: allows `unsafe-inline`/`unsafe-eval`/`ws:`/`wss:`).
3. Inline CORS middleware (`app.ts:22-36`) — origin allow-list from `CORS_ORIGINS` env (comma-separated; defaults to localhost ports 5173/3000/3001/3002 on both `localhost` and `127.0.0.1`). Reflects the origin only if it's in the set; short-circuits `OPTIONS` with `204`.
4. `app.use('/api/', apiLimiter)` — global 100 req/min/IP limiter applied to everything under `/api/`.
5. `express.raw({type:'application/json'})` mounted on `/api/webhooks/stripe` and `/api/webhooks/root` **before** the JSON body parser, so those two paths get an untouched `Buffer` body for signature verification.
6. `express.json({limit:'5mb'})` on `/api/trips` specifically (batched GPS payloads), then `express.json({limit:'1mb'})` globally, then `express.urlencoded({extended:false, limit:'1mb'})` globally.
7. Inline `sanitizeInput` gate (`app.ts:52-59`) — skips `/api/webhooks/stripe` and `/api/webhooks/root` (raw Buffer body, must stay byte-intact for HMAC/Stripe signature checks), otherwise calls `sanitizeInput` (`security.ts:94-119`) which trims and strips `<`/`>` from every string in `req.query` and recursively in `req.body`. Runs **after** body parsers (June fix).
8. Request logging middleware (`app.ts:61-89`) — wraps `res.json` to capture the response body, logs `METHOD path status in Nms :: <json>` truncated to 80 chars, only for paths starting with `/api`.
9. `registerRoutes(app)` runs, then `app.use(errorHandler)` is attached only after routes resolve (`app.ts:91-93`) — the generic 500 handler (`security.ts:122-135`) hides `err.message` unless `NODE_ENV==='development'`.

Inside `registerRoutes` (`server/routes.ts:76-78`): `app.use(verifyFirebaseAuth)` runs **before every route below**, including public ones. It's non-blocking (never sends a response) — it just best-effort populates `req.auth` if a valid `Authorization: Bearer` header maps to a Firebase user with a matching Neon `users` row. `requireAuth` is what actually gates access later.

## Full endpoint contract (`server/routes.ts`, 1288 lines — every `app.*` call; no other route files exist)

Auth legend: **PUB** = no auth check (may still populate `req.auth` from `verifyFirebaseAuth` but doesn't require it) · **AUTH** = `requireAuth` (401 `FIREBASE_TOKEN_REQUIRED` if missing) · **OWNER** = `requireAuth` + `requireResourceOwner("userId")` (403 `RESOURCE_OWNER_REQUIRED` if path `:userId` ≠ `req.auth.userId`) · **ADMIN** = `requireAuth` + `requireAdmin` (403 `ADMIN_REQUIRED` unless Firebase uid ∈ `ADMIN_FIREBASE_UIDS` env, comma-separated).

**API-01** `GET /api/health` — PUB. No params. → `200 {status:"ok", timestamp}`. No side effects. (`routes.ts:85-87`)

**API-02** `GET /api/profile/me` — AUTH. Identity from `req.auth.uid/email` only. Looks up `storage.getUserByFirebaseUid`; if missing but email present, auto-creates via `getOrCreateUserByFirebase` (which also creates a `drivingProfiles` row, upsert-safe via `onConflictDoUpdate`). → `200 {id, firebaseUid, email, name, onboardingComplete}` or `404` if no email to bootstrap with. `500` generic on throw. (`routes.ts:92-115`)

**API-03** `PATCH /api/profile/me` — AUTH. Body: `{onboardingComplete: boolean}` (manual check, not zod) → `400` if not boolean. `404` if user row doesn't exist yet. Writes via `storage.updateUser`. → `200 {id, email, name, onboardingComplete}`. (`routes.ts:117-142`)

**API-04** `GET /api/auth/check` — AUTH. → `200 {authenticated:true, user:null, firebaseUid}` if Firebase token valid but no Neon row, else `200 {authenticated:true, user:<row minus password>}`. `500 {authenticated:false}` on error. (`routes.ts:145-158`)

**API-05** `POST /api/auth/firebase` — PUB, `authLimiter` (10/min/IP). Body `{token}` (manual check). Verifies via `verifyFirebaseToken` (imports `./lib/firebase-admin` dynamically inline). → `200 {authenticated:true, user:{uid,email}}` / `400` no token / `401` invalid. **Note: this endpoint does NOT create or look up a Neon user row** — it only confirms the Firebase token is valid. No side effects. (`routes.ts:162-178`)

**API-06** `POST /api/auth/webauthn/check` — PUB, `authLimiter`. Body `{email}`. → `200 {hasPasskey: boolean}`; catches all errors internally and always returns `200 {hasPasskey:false}` on failure (never propagates a 500). (`routes.ts:185-197`)

**API-07** `POST /api/auth/webauthn/register/start` — AUTH, `authLimiter`. Email comes from `req.auth.email` (verified token), never the body — prevents account-takeover by enrolling a passkey against a victim's email (June fix). → registration options JSON or `400`. (`routes.ts:203-214`)

**API-08** `POST /api/auth/webauthn/register/complete` — AUTH, `authLimiter`. Body `{credential}`. → `200 {success:true}` / `400` (missing email/credential, or `result.error`) / `500`. Side effect: inserts into `webauthn_credentials`. (`routes.ts:216-233`)

**API-09** `POST /api/auth/webauthn/authenticate/start` — PUB, `authLimiter`. Body `{email}`. Throws (→ `400`) if user has zero active credentials. (`routes.ts:235-245`)

**API-10** `POST /api/auth/webauthn/authenticate/complete` — PUB, `authLimiter`. Body `{email, assertion}`. On success returns `{success:true, user, customToken}` — `customToken` is a Firebase custom token minted via Admin SDK so the client can bridge into a real Firebase session (`webauthn.ts:268-283`); `customToken` is `null` if Admin SDK isn't initialised (only warns, doesn't fail the request). `401` on verification failure. (`routes.ts:248-262`)

**API-11** `GET /api/auth/webauthn/credentials/me` — AUTH. → `200 {credentials:[{id, deviceType, deviceName, createdAt, lastUsed}]}`, `404` if user has no email. (`routes.ts:265-283`)

**API-12** `DELETE /api/auth/webauthn/credentials/:credentialId` — AUTH. Soft-delete (`isActive:false`) scoped to `req.auth.uid`. → `200 {success:true}` / `404` if not found/already removed. (`routes.ts:286-299`)

**API-13** `GET /api/dashboard/:userId` — OWNER. Aggregates: `getUser`, `getDrivingProfile`, `getUserTrips(userId,5)`, `getCommunityPool()`, `getUserAchievements`, and leaderboard via the **60s in-memory TTL cache** (`leaderboardCache` Map, key `weekly:10`, module-level). `404` if user or profile missing. Computes `projectedRefund` via `telematicsProcessor.calculateRefund(profile.currentScore||0, poolSafetyFactor||0.80, user.premiumAmount)`. → `200 {user, profile:{...profile, projectedRefund}, recentTrips, communityPool, achievements, leaderboard}`. (`routes.ts:303-342`)

**API-14** `POST /api/trips` — AUTH + `tripDataLimiter` (30/5min/IP). **The most complex handler.** `userId` forced from `req.auth.userId` (body's userId, if any, is overwritten — `routes.ts:348`). Body validated by `insertTripSchema` (drizzle-zod) via `.parse()` — throws `ZodError` on failure but the catch-all returns a generic `500 {message:"Error processing trip"}`, **swallowing the Zod validation detail**. Telematics payload is `req.body.telematicsData || req.body`. Pulls last-24h trips via `getTripsByDateRange` for duplicate detection, runs `telematicsProcessor.processTrip(...)` (worker-thread-backed with main-thread fallback), and:
  - if `metrics.anomalies.isDuplicate` → **`409`** `{message:"Duplicate trip rejected", anomalies}`, no write at all.
  - else requires `process.env.ENCRYPTION_KEY` to be set → `500 {message:"Server configuration error"}` if missing (no insecure fallback).
  - computes new profile aggregates in JS (running average of `currentScore`, increments hard-braking/accel/speed/night/cornering counters, `totalMiles += distanceKm*0.621371`).
  - persists trip + profile + leaderboard row **atomically** via `storage.recordTripAtomic` (single Postgres transaction); `telematicsData` column is AES-256-GCM encrypted (`crypto.encrypt`) with `ENCRYPTION_KEY` before storage.
  - impossible-speed/GPS-jump anomalies are **not** rejected — kept and soft-penalised in `metrics.score` only.
  - busts `leaderboardCache` only if a profile existed.
  → `200 {trip, metrics:{...metrics, distance_km, avg_speed, harsh_braking_count}, anomalies}`. All errors fall through to a single generic `500 {message:"Error processing trip"}`. (`routes.ts:345-469`)

**API-15** `GET /api/trips/:userId` — OWNER. Query: `limit` (default 20), `offset` (default 0), optional `startDate`+`endDate` (both required together, ISO 8601; `400` if unparseable or `endDate<=startDate`) which switches to `getTripsByDateRange` instead of paginated `getUserTrips`. → `200 Trip[]`. (`routes.ts:472-497`)

**API-16** `GET /api/scores/weekly/:userId` — OWNER. Query `weekStart?`. `404` if `scoreAggregation.getWeeklyScore` returns falsy (no trips that week). (`routes.ts:500-515`)

**API-17** `GET /api/scores/monthly/:userId` — OWNER. Same shape, `monthStart?`. (`routes.ts:518-533`)

**API-18** `GET /api/scores/timeseries/:userId` — OWNER. Query `startDate?` (default now-30d), `endDate?` (default now), `granularity?` ('daily'|'weekly'|'monthly', default daily) — **no validation that `granularity` is actually one of those three values**, just cast with `as`. → `200` array, never 404s. (`routes.ts:536-548`)

**API-19** `GET /api/scores/trend/:userId` — OWNER. Query `period?` ('weekly'|'monthly', default weekly), same no-validation cast pattern. (`routes.ts:551-561`)

**API-20** `POST /api/incidents` — AUTH. Body merged with `userId: req.auth!.userId`, `reportedAt: new Date()` server-side and `timestamp: body.timestamp || new Date().toISOString()`. Validated via `insertIncidentSchema` (hand-written zod: requires `userId:number`, `incidentType:string`, `description:string`, `location?`, `severity: enum(minor|moderate|major|critical)`, `status` default `"pending"`). **This DOES surface Zod errors**: `400 {message:"Validation error", errors: error.errors}` on `ZodError`, else generic `500`. → `200 <incident row>`. (`routes.ts:564-587`)

**API-21** `GET /api/community-pool` — PUB. → `200 <pool row or undefined>` (returns `undefined`→serialises to no body via `res.json(undefined)` if no pool row exists — not explicitly 404'd). (`routes.ts:590-597`)

**API-22** `PUT /api/community-pool` — ADMIN + `poolModificationLimiter` (10/15min/IP — **not** per-admin-user). Body passed through to `storage.updateCommunityPool` with **zero field validation/allow-list** — any JSON object is spread into the singleton pool row's `.set()` (throws if no existing row: "seed it first"). → `200 <updated pool>`. (`routes.ts:600-608`)

**API-23** `GET /api/leaderboard` — PUB. Query `period?` (default 'weekly'), `limit?` (default 50). 60s in-memory cache keyed `${period}:${limit}`. (`routes.ts:611-628`)

**API-24** `GET /api/achievements` — PUB. All active achievements, no pagination. (`routes.ts:631-638`)

**API-25** `GET /api/achievements/:userId` — OWNER. (`routes.ts:641-649`)

**API-26** `POST /api/simulate-refund` — AUTH (not resource-scoped). Body `{personalScore, poolSafetyFactor, premiumAmount}` — **zero validation**, passed raw into `telematicsProcessor.calculateRefund`. → `200 {refund}`. (`routes.ts:652-660`)

**API-27** `GET /api/insights/:userId` — OWNER. `404` if no driving profile. Reads up to 20 trips + `getCommunityPool(1)` (hardcoded pool id `1`, unlike the rest of the app which uses `getCommunityPool()` — **inconsistent pool lookup**, silently returns `undefined` safetyFactor → falls back to `75` if pool id 1 doesn't exist). Calls `aiInsightsEngine.generateInsights` — pure local computation, no external API call. (`routes.ts:663-687`)

**API-28** `GET /api/gdpr/export/:userId` — OWNER. Sets `Content-Disposition: attachment; filename=driiva-data-{userId}.json`. Body = `storage.exportUserData` (user + profile + up to 1000 trips + achievements + incidents + `exportedAt`). (`routes.ts:690-701`)

**API-29** `DELETE /api/gdpr/delete/:userId` — OWNER + `gdprDeleteLimiter` (3/hour/IP — per-IP not per-user). `storage.deleteUserData` does **6 sequential (non-transactional) deletes** in FK-safe order: `userAchievements → incidents → leaderboard → trips → drivingProfiles → users`. **Not atomic** — a crash mid-sequence leaves a partially-deleted account. (`routes.ts:704-712`, `storage.ts:393-400`)

**API-30** `POST /api/ai/coach` — AUTH + `coachLimiter` (5/min, keyed by `req.auth.uid`). Body: `score, scoreBreakdown, events, distanceMeters, durationSeconds, context, averageScore, totalTrips` — only `score`/`scoreBreakdown` presence-checked (`400` if missing), rest interpolated raw into a prompt string. Provider selected by `AI_COACH_PROVIDER` env ('anthropic' | default 'perplexity'), key from `AI_COACH_API_KEY` or fallback `PERPLEXITY_API_KEY` → `503` if neither set. **Anthropic branch hardcodes `model: "claude-sonnet-4-20250514"`** (`routes.ts:776`) — a retired model id; if it 404s, generic `500 {message:"AI Coach error"}`. Both providers require the response to parse as JSON matching `{headline, tips:[], encouragement}` (manual shape check) or it throws "Invalid response shape". No persistence — purely proxied. (`routes.ts:720-834`)

**API-31** `POST /api/ask` — AUTH. Body `{prompt}` (`400` if missing/falsy). Hardcoded to Perplexity `sonar-pro`, `PERPLEXITY_API_KEY` only (no missing-key guard — unset key fires fetch with `Authorization: Bearer undefined`, upstream 401 wrapped into generic `500 {message:"AI backend error"}`). Returns `{answer, citations}`. No persistence. (`routes.ts:840-880`)

**API-32** `POST /api/payments/create-subscription` — AUTH. Looks up Neon user via `req.auth.uid`, `404` if missing. Upserts Stripe customer (idempotency key `driiva-customer-create-{uid}-{date}`) and persists `stripeCustomerId` back via `storage.updateStripeCustomerId`. Body: `quoteId?`, `billingPeriod` ('monthly'|'annual', anything else coerced to 'monthly'), `annualPremiumCents?` (validated range 10000–500000 if present, `400` otherwise), `priceId?` (legacy fallback path). If `annualPremiumCents` + `STRIPE_PRODUCT_ID` both present, builds an **inline `price_data`** subscription item (monthly = `annualPremiumCents/12*1.07`, a hardcoded 7% monthly markup, rounded). Else falls back to `priceId` — **server-side allow-listed** via `allowedStripePriceIds()` (env `STRIPE_MONTHLY_PRICE_ID` + `STRIPE_ALLOWED_PRICE_IDS`, `400 "Invalid priceId"` otherwise). Creates the subscription with `payment_behavior:'default_incomplete'`, idempotency key `driiva-subscription-{period}-{cents|'fixed'}-{quoteId|'none'}-{uid}-{date}`. → `200 {subscriptionId, clientSecret, status}`. `503` if `STRIPE_SECRET_KEY` unset (message-substring check). (`routes.ts:898-997`)

**API-33** `POST /api/payments/create-checkout` — AUTH. Body `{priceId, successUrl?, cancelUrl?}` — `priceId` required and must be in `allowedStripePriceIds()` (`400` otherwise). Upserts Stripe customer (no idempotency key on this create call, unlike API-32). Creates a one-time Checkout Session (`mode:'payment'`), success/cancel URLs default to `{origin}/dashboard?checkout=success` / `{origin}/checkout?checkout=cancelled` where origin = request `Origin` header → `WEBAUTHN_ORIGIN` env → `http://localhost:5000`. → `200 {url, sessionId}`. (`routes.ts:1003-1047`)

**API-34** `GET /api/payments/billing-portal` — AUTH. `404` if user has no `stripeCustomerId`. Creates a Stripe Billing Portal session, `return_url: {origin}/settings`. → `200 {url}`. (`routes.ts:1052-1075`)

## Webhooks

**API-35** `POST /api/webhooks/stripe` — `webhookLimiter` only (10/min/IP), **no `requireAuth`** — auth is the Stripe signature itself. Raw `Buffer` body. Verifies via `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)` → `400` on bad signature. Then **processes synchronously before ACKing** (June fix; a thrown error anywhere in the switch returns `500` so Stripe redelivers). Event handling:
  - `invoice.payment_succeeded` → **real handler**: retrieves the Stripe subscription to read `metadata.quoteId`, then `handleStripePaymentSucceeded` (`routes.ts:1247-1288`) looks up the Neon user by `stripeCustomerId`, and if found + has `firebaseUid` + Firebase Admin is initialised, writes a Firestore doc at `users/{firebaseUid}/pendingPayments/{subscriptionId}` with `{stripeSubscriptionId, stripeCustomerId, status:'pending', createdAt: serverTimestamp(), quoteId?}`. Silently no-ops (just warns) if user not found or Admin SDK uninitialised — **does not throw**, so Stripe still gets a 200 even though the pendingPayment write was skipped.
  - `invoice.payment_failed` → **console.warn stub only** (`// TODO: persist past_due + notify the customer`).
  - `customer.subscription.deleted` → **console.warn stub only** (`// TODO: cancel the bound policy via Root/Firestore`).
  - `checkout.session.completed` → **console.log stub only** (`// TODO: fulfil add-on purchases once defined`).
  - any other event type → silently ignored.
  → `200 {received:true}` once the switch completes without throwing.

**API-36** `POST /api/webhooks/root` — `webhookLimiter` only, no `requireAuth`. Raw Buffer body. If `ROOT_WEBHOOK_SECRET` env is set: requires `x-root-signature` header (`400` if missing), verifies via `timingSafeEqual` of HMAC-SHA256(body) — **if the env var is unset, signature verification is skipped entirely**. **Acknowledges immediately** (`res.json({received:true})`) **before** parsing/processing the body — opposite pattern from the Stripe handler. Then fire-and-forget: parses JSON, extracts `event_type||type` and `policy_id||data.policy_id`, and just `console.log`s them. **No actual handling exists.**

## Health / unauthenticated surface

Only `GET /api/health` (API-01), and the public-tier routes marked **PUB** (API-05, 06, 09, 10, 21, 23, 24, plus both webhooks API-35/36 which substitute signature verification for Firebase auth). `verifyFirebaseAuth` runs globally but never blocks.

## QUIRKS

- **In-memory leaderboard cache is per-instance, not distributed** (`routes.ts:35-53`) — on Vercel serverless each cold container gets its own cache; "60s TTL" is really "60s per warm container".
- **Rate limiting silently degrades in production without Upstash env vars** (`distributedRateLimit.ts:121-137`) — falls back to `InMemoryStore` with a warning; on serverless every limiter is effectively per-container.
- **Rate limiter fails open on store errors** (`distributedRateLimit.ts:190-196`) — Redis errors are caught, logged, request allowed through.
- **`/api/trips` (API-14) swallows Zod validation errors into a generic 500**, unlike `/api/incidents` (API-20) which surfaces `error.errors` as 400.
- **`/api/scores/timeseries` and `/api/scores/trend`** cast query enums with `as` instead of validating — invalid values pass through silently.
- **`/api/insights/:userId` hardcodes `getCommunityPool(1)`** — if pool row id ≠ 1, silently falls back to flat 75 safety factor.
- **`deleteUserData` (GDPR delete, API-29) is not transactional** — 6 sequential deletes, no `db.transaction()`.
- **`GET /api/community-pool` (API-21) can return a bare empty response** if no pool row exists — no explicit 404.
- **`PUT /api/community-pool` (API-22, admin) has no body validation or field allow-list.**
- **AI Coach (API-30) hardcodes retired `model: "claude-sonnet-4-20250514"`** (`routes.ts:776`) — same pattern caused a 16-day silent outage in StrydeOutreach.
- **`POST /api/ask` (API-31) has no `PERPLEXITY_API_KEY` presence check** (contrast API-30's 503).
- **Stripe webhook: 3 of 4 event types are stub/log-only** — all still return `200 {received:true}`; no dead-letter.
- **Root webhook has zero real handling** and ACKs before parsing; signature verification is opt-in via env presence (unset ⇒ none, silently).
- **`api/main.py`** — an entire unwired FastAPI "Refund Calculator" with a mock XGBoost risk scorer lives in `api/`; not part of any request path.
- **`Promise<any>` / loosely-typed boundaries**: `storage.exportUserData` returns `Promise<any>` (`storage.ts:83`); `error: any` in every catch block codebase-wide.
- **`telematicsProcessor` is worker-thread-backed with a silent main-thread fallback** (`server/lib/telematics.ts:649-734`) — if `new Worker(...)` throws, processing transparently falls back to synchronous main-thread execution; 30s internal timeout redrains pending requests to main thread. POST /api/trips behaviour/latency silently differs across environments — characterise both paths.
- **Existing `server/__tests__/api.test.ts` does NOT test the real routes.ts contract at all** — its own header says "Assumed route structure based on project architecture"; it tests a fictional route shape (`GET /api/trips` with no `:userId`, `GET /api/policy`, `GET /api/pool` — none exist) against hand-rolled mocks. **Zero characterisation coverage of the actual API; do not trust as spec.** By contrast, `server/__tests__/auth-middleware.test.ts` tests the real `server/middleware/auth.ts` functions and can be trusted/extended.

## Appendix: full contract table

| ID | Method + Path | Auth | Request | Response (success / errors) | Side effects | Characterization test approach |
|---|---|---|---|---|---|---|
| API-01 | GET /api/health | PUB | — | 200 `{status,timestamp}` | none | vitest+supertest, no mocks needed |
| API-02 | GET /api/profile/me | AUTH | token only | 200 profile / 404 / 500 | may INSERT users+driving_profiles (auto-provision) | supertest + mock firebase-admin verifyIdToken + Neon (or test DB) |
| API-03 | PATCH /api/profile/me | AUTH | body `{onboardingComplete:boolean}` | 200 / 400 / 404 / 500 | UPDATE users | supertest + mocked auth + test DB |
| API-04 | GET /api/auth/check | AUTH | token only | 200 (2 shapes) / 500 | none | supertest + mocked auth |
| API-05 | POST /api/auth/firebase | PUB, authLimiter | body `{token}` | 200/400/401 | none | supertest + mock verifyFirebaseToken |
| API-06 | POST /api/auth/webauthn/check | PUB, authLimiter | body `{email}` | 200 always (even on internal error) | none | supertest + mock webauthnService |
| API-07 | POST /api/auth/webauthn/register/start | AUTH, authLimiter | token only | 200 opts / 400 | writes webauthn_challenges | supertest + mocked auth + test DB |
| API-08 | POST /api/auth/webauthn/register/complete | AUTH, authLimiter | body `{credential}` | 200/400/500 | INSERT webauthn_credentials | supertest, mock @simplewebauthn/server verify |
| API-09 | POST /api/auth/webauthn/authenticate/start | PUB, authLimiter | body `{email}` | 200/400 (throws if 0 creds) | writes webauthn_challenges | supertest + test DB |
| API-10 | POST /api/auth/webauthn/authenticate/complete | PUB, authLimiter | body `{email,assertion}` | 200 w/ customToken / 401 | UPDATE credentials counter; mints Firebase custom token | supertest + mock verify + mock createCustomToken |
| API-11 | GET /api/auth/webauthn/credentials/me | AUTH | token only | 200 list / 404 / 500 | none | supertest + mocked auth |
| API-12 | DELETE /api/auth/webauthn/credentials/:id | AUTH | path param | 200/404/500 | soft-delete UPDATE | supertest + test DB |
| API-13 | GET /api/dashboard/:userId | OWNER | path param | 200 aggregate / 404 / 500 | reads leaderboardCache (stateful) | supertest + test DB; must reset module-level cache between tests |
| API-14 | POST /api/trips | AUTH, tripDataLimiter | body = trip+telematics (zod insertTripSchema) | 200/409 dup/500 config/500 (Zod swallowed) | tx: INSERT trips, UPDATE driving_profiles, UPSERT leaderboard; requires ENCRYPTION_KEY | supertest + test DB + ENCRYPTION_KEY; test worker-thread AND forced-fallback path |
| API-15 | GET /api/trips/:userId | OWNER | query limit/offset or startDate/endDate | 200 array / 400 bad dates / 500 | none | supertest + test DB |
| API-16 | GET /api/scores/weekly/:userId | OWNER | query weekStart? | 200/404/500 | none | supertest + test DB w/ seeded trips |
| API-17 | GET /api/scores/monthly/:userId | OWNER | query monthStart? | 200/404/500 | none | same |
| API-18 | GET /api/scores/timeseries/:userId | OWNER | query startDate/endDate/granularity (unvalidated) | 200 always/500 | none | same, incl. invalid granularity case |
| API-19 | GET /api/scores/trend/:userId | OWNER | query period (unvalidated) | 200/500 | none | same |
| API-20 | POST /api/incidents | AUTH | body (zod insertIncidentSchema) | 200/400 zod errors/500 | INSERT incidents | supertest + test DB |
| API-21 | GET /api/community-pool | PUB | — | 200 (may be empty)/500 | none | supertest, seed/unseed pool row |
| API-22 | PUT /api/community-pool | ADMIN, poolModificationLimiter | body (unvalidated) | 200/throws if unseeded/500 | UPDATE community_pool | supertest + ADMIN_FIREBASE_UIDS env + test DB |
| API-23 | GET /api/leaderboard | PUB | query period/limit | 200 (cached 60s)/500 | reads cache | supertest; reset cache module between tests |
| API-24 | GET /api/achievements | PUB | — | 200/500 | none | supertest + test DB |
| API-25 | GET /api/achievements/:userId | OWNER | path param | 200/500 | none | supertest + test DB |
| API-26 | POST /api/simulate-refund | AUTH | body (unvalidated numbers) | 200/500 | none | supertest; also unit-test calculateRefund directly |
| API-27 | GET /api/insights/:userId | OWNER | path param | 200/404/500 | none (reads pool id=1 hardcoded) | supertest + test DB; test pool-id-1-missing case |
| API-28 | GET /api/gdpr/export/:userId | OWNER | path param | 200 file download/500 | none (read-only) | supertest, check Content-Disposition header |
| API-29 | DELETE /api/gdpr/delete/:userId | OWNER, gdprDeleteLimiter | path param | 200/500 | 6 sequential non-transactional DELETEs | supertest + test DB; test partial-failure mid-sequence |
| API-30 | POST /api/ai/coach | AUTH, coachLimiter | body (score/scoreBreakdown required) | 200/400/503 no key/500 | none, external AI call | supertest + mock global fetch (both provider branches) |
| API-31 | POST /api/ask | AUTH | body `{prompt}` | 200/400/500 | none, calls Perplexity | supertest + mock fetch |
| API-32 | POST /api/payments/create-subscription | AUTH | body (quoteId?/billingPeriod/annualPremiumCents?/priceId?) | 200/400/404/503/500 | Stripe customer+subscription create; UPDATE users.stripeCustomerId | supertest + mock Stripe SDK |
| API-33 | POST /api/payments/create-checkout | AUTH | body `{priceId,successUrl?,cancelUrl?}` | 200/400/404/503/500 | Stripe customer+checkout session create | supertest + mock Stripe SDK |
| API-34 | GET /api/payments/billing-portal | AUTH | token only | 200/404/503/500 | Stripe billing portal session create | supertest + mock Stripe SDK |
| API-35 | POST /api/webhooks/stripe | webhookLimiter (sig-verified) | raw Buffer + stripe-signature | 200/400 bad sig/500 (Stripe retries) | Firestore write for payment_succeeded only; log-only for other 3 | supertest w/ raw body + constructed Stripe signature; mock firebase-admin.firestore() |
| API-36 | POST /api/webhooks/root | webhookLimiter (optional HMAC) | raw Buffer + x-root-signature (if secret set) | 200 always after sig check/400 | none (log only) | supertest w/ raw body + HMAC; test secret-set AND secret-unset paths |
