# Characterisation audit — Third-party integration edges (EDGE-01..EDGE-16) + MANUAL-VERIFY list

> Rebuild mission, 2026-07-02. Read-only. No .env files opened (only .env.example grepped for names).

### EDGE-01 — Stripe
Client: `client/src/lib/stripe.ts:9-15` loadStripe(VITE_STRIPE_PUBLISHABLE_KEY), null if missing. `checkout.tsx` Elements/CardElement/confirmCardPayment (196-207); demo mode bypasses Stripe entirely (1.8s fake delay, 154-161).
Server: `server/lib/stripe.ts:17-25` lazy singleton, throws if STRIPE_SECRET_KEY unset (→503). `allowedStripePriceIds()` env-only allow-list (routes.ts:63-74). create-subscription (898-997): cents range [10000,500000]; inline price_data when STRIPE_PRODUCT_ID set (7% monthly markup); deterministic idempotency keys. create-checkout (1003-1045): allow-listed priceId or 400. billing-portal (1050-1075). Webhook (1097-1206): constructEvent sig check; **process-before-ACK** (thrown error → 5xx → Stripe redelivers). Handlers: payment_succeeded REAL (writes pendingPayment); payment_failed / subscription.deleted / checkout.session.completed = logging-only stubs with TODOs; default silently ignored. webhookLimiter 10/min.
**Quirk (preserve as behaviour): `handleStripePaymentSucceeded` (routes.ts:1247-1288) catches its own errors without rethrowing — despite process-before-ACK, Stripe still gets 200 if the pendingPayment write fails.** (Pinned in api-contract.characterisation.test.ts.)
Stripe→Root glue: `functions/src/triggers/payments.ts:51-160` Firestore onCreate on pendingPayments; calls acceptInsuranceQuoteInternal; FCM push; **no retry primitive** (Firestore triggers don't redeliver) — failure marks doc 'failed', Sentry only.
Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_MONTHLY_PRICE_ID, STRIPE_PRODUCT_ID, STRIPE_ALLOWED_PRICE_IDS, VITE_STRIPE_PUBLISHABLE_KEY (only the first two in .env.example, commented). API version pinned '2025-01-27.acacia'.
Verdict: AUTOMATABLE (mock stripe client; real signed payload w/ test secret for constructEvent; demo checkout E2E-able). MANUAL-VERIFY: real card decline/3DS; dashboard subscription lifecycle.

### EDGE-02 — Root Platform insurance
`functions/src/http/insurance.ts`: getRootConfig fails fast if ROOT_API_KEY/ROOT_PRODUCT_MODULE_KEY missing (:39-64); rootApiFetch Basic auth (:76-104). getInsuranceQuote (229-307): requires ≥1 completed trip; stores quotes/{id} with premiumCents = suggested_premium **as-is, no currency handling**. acceptInsuranceQuote (315-435): ensurePolicyholder caches rootPolicyholderId; writes policies with currentPremiumCents unconverted + **hardcoded coverageDetails** (382-388). `insuranceInternal.ts:49-132` = hand-duplicated accept logic for the Stripe-trigger path ("avoid cross-function HTTP call") — fixes don't propagate; its policy write **omits coverageDetails** (different doc shape per bind path).
**Currency unresolved on main**: insurance.ts:19 says Root sandbox uses ZAR cents; checkout.tsx:428 divides by 100 into GBP; routes.ts:946 hardcodes currency 'gbp'; zero conversion code repo-wide.
Root webhook (routes.ts:1212-1239): HMAC only if ROOT_WEBHOOK_SECRET set (unset ⇒ any unsigned payload accepted); ACKs 200 BEFORE parsing; console.log only — stub.
`scripts/test-root-api.ts` = manual smoke script, the only Root credential check that exists.
Env: ROOT_API_KEY, ROOT_API_URL, ROOT_ENVIRONMENT, ROOT_PRODUCT_MODULE_KEY, ROOT_WEBHOOK_SECRET (last one undocumented).
Verdict: AUTOMATABLE via fetch mocking; webhook HMAC unit-testable. MANUAL-VERIFY: real sandbox call to resolve currency; real webhook payload shape; product-module key validity.

### EDGE-03 — Damoov telematics
`functions/src/lib/damoov.ts`: user API + datahub API; getCredentials throws if DAMOOV_INSTANCE_ID/KEY missing. createDamoovUser (62-108) called from onUserCreate — never throws, null on failure (signup never blocked). fetchDamoovTrips/DailyStats swallow-and-return-empty. syncDamoovTrips cron 00:30 Europe/London, maxInstances 10, 540s, 512MB; 7-day rolling window per user with damoovDeviceToken; docs keyed `damoov_{Id}` (dedup).
**Mobile gap confirmed**: zero Damoov SDK usage in mobile/; record.tsx TODOs at :22,:26; record button = local state + 3s setTimeout + haptic, no network/GPS/Firestore. On-screen copy "Damoov auto-detects your trips" describes unimplemented behaviour. Ingestion depends wholly on the daily batch pull of trips recorded by Damoov's own SDK — which this app never wires in.
Env: DAMOOV_INSTANCE_ID/KEY (absent from .env.example).
Verdict: AUTOMATABLE (vi.mock('node-fetch') precedent exists in tests). MANUAL-VERIFY: real creds/response shape. Mobile SDK gap = MISSING_STEP to build, not testable behaviour.

### EDGE-04 — Anthropic trip analysis (`functions/src/ai/tripAnalysis.ts`)
**Hardcoded retired model `claude-sonnet-4-20250514` at tripAnalysis.ts:56** (echoed into persisted fields + cost tracking) AND independently at `server/routes.ts:776` (/api/ai/coach anthropic branch, raw fetch) — fix must hit both. FEATURE_AI_INSIGHTS env (default 'true') gates server-side analysis (trips.ts:113-116,138); VITE_FEATURE_AI_INSIGHTS only gates client display. Cost: max_tokens 1500; $3/$15 per-M hardcoded for estimates to aiUsageTracking; **no budget cap or breaker**. Retries 3× exp backoff, auth/non-JSON not retried; total failure → null, non-blocking. Idempotency: skips if insight doc <1hr old.
Verdict: AUTOMATABLE (existing test mocks @anthropic-ai/sdk — and its fixture hardcodes the same retired model, so tests keep passing after prod breaks). MANUAL-VERIFY: model ID resolves against live API — mocks structurally cannot catch retirement.

### EDGE-05 — /api/ai/coach + /api/ask (Perplexity/Anthropic)
coach (720-834): requireAuth + coachLimiter 5/min/user; provider AI_COACH_PROVIDER (default perplexity); key AI_COACH_API_KEY ?? PERPLEXITY_API_KEY → 503 if neither; perplexity sonar-pro temp 0.3; response shape {headline,tips[],encouragement} checked; any error → generic 500. Client widget: local rules-table insight always; LLM only on expand (staleTime 30min); "AI Driiva is taking a break" + Retry on error. Header comment says /api/ai/driiva, actual /api/ai/coach (drift). ask (840-880): requireAuth, arbitrary prompt → sonar-pro, no key guard, no shape validation; **zero client callers — orphan route**.
CSP whitelists api.anthropic.com + api.stripe.com in connect-src but NOT perplexity/rootplatform (fine while server-proxied).
Env: AI_COACH_PROVIDER, AI_COACH_API_KEY, PERPLEXITY_API_KEY (none in .env.example).
Verdict: AUTOMATABLE via fetch mock. MANUAL-VERIFY: sonar-pro still valid; whether /api/ask is intentionally exposed.

### EDGE-06 — Open-Meteo weather
`functions/src/utils/weather.ts:55-106`: archive API, no key, 3s AbortController, WMO map (unknown → 'cloudy'), null on ANY failure. Fully AUTOMATABLE.

### EDGE-07 — Resend (marketing waitlist; app out of rebuild scope, data flow in scope)
`apps/marketing/api/lib/waitlist-core.ts`: real send only if RESEND_API_KEY (else console.info mock); confirmation email fire-and-forget; Firestore dedup degrades to in-memory Set if FIREBASE_SERVICE_ACCOUNT_JSON/PROJECT_ID absent (positions/dupes don't survive cold starts); BASE_COUNT default 117 added to displayed count.
Verdict: AUTOMATABLE (injectable clients by design). MANUAL-VERIFY: real deliverability/rendering.

### EDGE-08 — FCM push
Client `usePushNotifications.ts`: SW registration, config postMessage, permission, getToken(VAPID), addFcmToken, onMessage — every failure swallowed to console.warn. Server `utils/notifications.ts:21-47` sendEachForMulticast; per-token failures logged, **stale tokens never pruned**. Also inlined in payments.ts:124-144.
Verdict: AUTOMATABLE via mocks. MANUAL-VERIFY: real on-device delivery.

### EDGE-09 — Firebase Analytics
Initialised iff VITE_FIREBASE_MEASUREMENT_ID; **zero logEvent() call sites** — auto-collected only. Nothing to characterise; MANUAL-VERIFY console usage.

### EDGE-10 — Vercel Analytics
injectVercelAnalytics() in main.tsx; no track() calls. MANUAL-VERIFY dashboard only.

### EDGE-11 — Sentry
Client: no-op unless VITE_SENTRY_DSN; 10%/100% traces; replay 1%/100%-on-error prod; scrubs token/apiKey breadcrumb params. Functions: no-op unless SENTRY_DSN_FUNCTIONS; wrapFunction/wrapTrigger across ~20 files, flush(2000) before rethrow; **redacts only sk-ant-* and sandbox_* patterns — Stripe sk_live/sk_test, Damoov, Resend re_* have no rule**. Admin monitoring "Coming soon" — nothing reads back from Sentry.
Verdict: init branching AUTOMATABLE; capture correctness MANUAL-VERIFY.

### EDGE-12 — Firebase Performance
getPerformance gated on VITE_FIREBASE_MEASUREMENT_ID (reuses the Analytics ID as its own flag); withTrace falls back to plain exec. AUTOMATABLE; console bucketing MANUAL-VERIFY.

### EDGE-13 — Upstash/Redis rate limiting
`distributedRateLimit.ts`: UpstashRestStore only if both env vars; else InMemoryStore with prod warning ("NOT distributed"). Store is a **hand-rolled REST client** (INCR+PEXPIRE+PTTL via fetch), not @upstash/* packages (header comment describes them as future swap-in — reconfirms the phantom-dep false positive). **Fails open** on store errors (191-196). Backs authLimiter/webhookLimiter/coachLimiter.
Env: UPSTASH_REDIS_REST_URL/TOKEN (absent from .env.example).
Verdict: fully AUTOMATABLE incl. fail-open path. MANUAL-VERIFY: real Upstash round-trip only.

### EDGE-14 — Map tiles
Both LeafletMap.tsx:225 and TripRouteMap.tsx:90 use **CartoCDN dark basemap** (`{s}.basemaps.cartocdn.com/dark_all/...`), not tile.openstreetmap.org — vendor is Carto (OSM-derived). No key. MANUAL-VERIFY: tiles render, no 402/429.

### EDGE-15 — Google Sign-In
Live: signin.tsx:218 signInWithPopup(googleProvider) (firebase.ts:179). Dead parallel implementation in FirebaseSignIn.tsx:72-106 (imported nowhere). /api/auth/firebase = pure verification, creates nothing. Mobile: zero Google sign-in code.
Verdict: OAuth popup MANUAL-VERIFY; token-verification leg automatable.

### EDGE-16 — Python Stop-Go-Classifier
`functions/src/http/classifier.ts`: POST {CLASSIFIER_URL}/classify_trip, no auth header. **CLASSIFIER_URL set nowhere in the repo** — every call short-circuits to {success:false} without a network call; caller swallows. classifyCompletedTrip auto-path needs ≥23 points; never throws. No test file.
Verdict: AUTOMATABLE via fetch mock. MANUAL-VERIFY: whether the sibling Python function is deployed/reachable anywhere.

### Cross-cutting
- **.env.example materially incomplete**: DAMOOV_*, RESEND_*, UPSTASH_*, PERPLEXITY_API_KEY, AI_COACH_*, FEATURE_AI_INSIGHTS, CLASSIFIER_URL, WAITLIST_*, FIREBASE_SERVICE_ACCOUNT_JSON, STRIPE_MONTHLY_PRICE_ID/PRODUCT_ID/ALLOWED_PRICE_IDS, ROOT_WEBHOOK_SECRET, VITE_STRIPE_PUBLISHABLE_KEY all read in code but absent from the template.
- **GDPR deletion is Firestore/Auth-only**: `functions/src/http/gdpr.ts` never calls Stripe (customer), Root (policyholder), or Damoov (user/device) — a "deleted" user's records persist on all three third parties.
- Sentry secret redaction partial (Anthropic + Root prefixes only).

## MANUAL-VERIFY LIST (feeds the coverage report)
1. Stripe: real card decline / 3-D Secure UI (test-mode cards, browser).
2. Stripe: dashboard subscription lifecycle vs Firestore state after payment_failed/subscription.deleted (stubs today).
3. Root: one real sandbox POST /quotes with valid key → resolve ZAR-cents vs GBP-pence definitively.
4. Root: capture a real webhook payload (field names are guessed today).
5. Root: confirm ROOT_PRODUCT_MODULE_KEY maps to a live product module.
6. Damoov: confirm real creds + /Scores/trips response shape.
7. Damoov mobile: cannot be verified — must be BUILT (no code path exists).
8. Anthropic: confirm claude-sonnet-4-20250514 resolves (both hardcode sites) — mocked tests cannot catch retirement.
9. Perplexity: confirm sonar-pro still valid.
10. Confirm whether POST /api/ask is intentionally exposed (no callers).
11. FCM: real on-device push delivery.
12. Firebase Analytics: is auto-collected data used at all?
13. Vercel Analytics: page-views landing.
14. Sentry: trigger a real error in a deployed env, confirm capture (client + functions DSNs).
15. Firebase Performance: traces bucketed correctly.
16. Leaflet/Carto: dark basemap renders, no free-tier rate-limits.
17. Google Sign-In: real signInWithPopup consent flow end-to-end.
18. Classifier: is the Python function deployed/reachable at any CLASSIFIER_URL?
19. Scope decision (Jamal/legal): should GDPR deleteUserAccount propagate to Stripe/Root/Damoov? (Currently does not.)
20. (From audit-auth) `firebase firestore:rules get` — diff deployed rules vs the merge-conflicted repo file.
21. (From audit-functions) Confirm whether Cloud Functions are deployed to the production Firebase project at all.
