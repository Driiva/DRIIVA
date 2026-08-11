# Load / integrity test (1000 users)

Simulates many users hitting the API to check **uptime, faults, and stability** (no crashes under load).

## Run it

1. **Start the app** in one terminal:
   ```bash
   npm run verify:db   # optional: confirm DB is up
   npm run dev
   ```
2. In **another terminal**:
   ```bash
   npm run load-test
   ```
   Or with options:
   ```bash
   USERS=1000 CONCURRENCY=50 BASE_URL=http://localhost:3001 npx tsx scripts/load-test.ts
   ```

## What it does

- **USERS** (default 1000): number of simulated users.
- Each user hits 4 **public** endpoints (no auth): `GET /`, `GET /api/community-pool`, `GET /api/leaderboard`, `GET /api/achievements`.
- **CONCURRENCY** (default 50): how many users’ requests run in parallel.
- Total requests = `USERS × 4`. It reports success rate, status codes, and response times (avg, p50, p95, p99).

## How to read results

- **No crashes** = server stayed up; good for integrity.
- **429 (Too many requests)** = the API rate limiter (100 requests per 15 min per IP in dev) is doing its job. For a single-machine load test, all requests come from one IP, so after ~100 requests you’ll see 429. That’s expected and not a bug.
- **Success rate** = fraction of requests that got 2xx. Under the default rate limit you’ll see a lot of 429s; that’s normal for this test.
- **Response times** = if p95/p99 are very high or timeouts appear, you may have a performance or DB issue.

## Running a “full” 1000-user run without 429s

To stress-test without hitting the default limit:

- **Option A:** Temporarily raise the limit in `server/middleware/security.ts` (e.g. `apiLimiter` `max` to 5000) for the test run only, then revert.
- **Option B:** Spread load over time, e.g. lower concurrency and add a small delay between batches so you stay under 100 req/15min (not ideal for a quick stress test).
- **Option C:** Run from multiple IPs (e.g. several machines or a cloud load tester); each IP gets its own 100 req/15min.

For **beta/staging**, you can set a higher rate limit in that environment so load tests and real users don’t hit 429 too quickly.
