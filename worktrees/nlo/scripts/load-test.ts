/**
 * Load / integrity test: simulate many users hitting the API.
 * Usage: Start the app (npm run dev), then in another terminal:
 *   npx tsx scripts/load-test.ts
 *   BASE_URL=http://localhost:3001 USERS=1000 CONCURRENCY=50 npx tsx scripts/load-test.ts
 *
 * Measures: success rate, response times, errors. Uses public endpoints (no auth).
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const TOTAL_USERS = parseInt(process.env.USERS || "1000", 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "50", 10);

const PUBLIC_ENDPOINTS = [
  { method: "GET", path: "/api/community-pool" },
  { method: "GET", path: "/api/leaderboard" },
  { method: "GET", path: "/api/achievements" },
  { method: "GET", path: "/" },
];

interface Result {
  ok: boolean;
  status: number;
  durationMs: number;
  endpoint: string;
  error?: string;
}

async function fetchOne(
  endpoint: string,
  method: string
): Promise<Result> {
  const url = `${BASE_URL}${endpoint}`;
  const start = Date.now();
  try {
    const res = await fetch(url, { method });
    const durationMs = Date.now() - start;
    return {
      ok: res.ok,
      status: res.status,
      durationMs,
      endpoint: `${method} ${endpoint}`,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      ok: false,
      status: 0,
      durationMs,
      endpoint: `${method} ${endpoint}`,
      error: (err as Error).message,
    };
  }
}

function runBatch(promises: Promise<Result>[]): Promise<Result[]> {
  return Promise.all(promises);
}

async function main() {
  console.log("Load test: simulate", TOTAL_USERS, "users");
  console.log("Base URL:", BASE_URL);
  console.log("Concurrency:", CONCURRENCY);
  console.log("Endpoints:", PUBLIC_ENDPOINTS.map((e) => e.path).join(", "));
  console.log("");

  const allResults: Result[] = [];
  const totalRequests = TOTAL_USERS * PUBLIC_ENDPOINTS.length;
  let done = 0;

  for (let i = 0; i < TOTAL_USERS; i += CONCURRENCY) {
    const batchSize = Math.min(CONCURRENCY, TOTAL_USERS - i);
    const batch: Promise<Result>[] = [];
    for (let j = 0; j < batchSize; j++) {
      for (const { method, path } of PUBLIC_ENDPOINTS) {
        batch.push(fetchOne(path, method));
      }
    }
    const results = await runBatch(batch);
    allResults.push(...results);
    done += batch.length;
    process.stdout.write(`\r  ${done} / ${totalRequests} requests`);
  }
  console.log("\n");

  const success = allResults.filter((r) => r.ok).length;
  const failed = allResults.filter((r) => !r.ok);
  const statusCounts: Record<number, number> = {};
  const durations = allResults.map((r) => r.durationMs).filter((d) => d > 0);
  allResults.forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  const avgMs =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
  const sorted = [...durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;

  console.log("--- Results ---");
  console.log("Total requests:", allResults.length);
  console.log("Success (2xx):", success);
  console.log("Failed:", failed.length);
  console.log("Success rate:", ((100 * success) / allResults.length).toFixed(2) + "%");
  console.log("");
  console.log("Status codes:", JSON.stringify(statusCounts, null, 0));
  console.log("");
  console.log("Response time (ms): avg", avgMs.toFixed(0), "| p50", p50, "| p95", p95, "| p99", p99);
  if (failed.length > 0) {
    console.log("");
    console.log("Sample errors:");
    failed.slice(0, 5).forEach((r) => {
      console.log(" ", r.endpoint, r.status, r.error || "");
    });
  }
  console.log("");
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
