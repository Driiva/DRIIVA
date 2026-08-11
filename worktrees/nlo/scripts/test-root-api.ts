/**
 * Test if Root Platform API returns a quote.
 *
 * Run from repo root with Root credentials in .env or functions/.env:
 *   npx tsx scripts/test-root-api.ts
 *
 * Required env vars:
 *   ROOT_API_KEY   - Sandbox key from https://app.rootplatform.com/
 *   ROOT_API_URL   - e.g. https://sandbox.rootplatform.com/v1 or
 *                    https://sandbox.uk.rootplatform.com/v1 (UK)
 *
 * If 200 + real quote data = integrated ✅
 * If 401/404/500 = not connected ❌
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load root .env and functions/.env (Root vars may be in either)
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), 'functions/.env') });

const ROOT_API_KEY = process.env.ROOT_API_KEY;
const ROOT_API_URL =
  process.env.ROOT_API_URL || 'https://sandbox.rootplatform.com/v1/insurance';

async function testRootQuote(): Promise<void> {
  if (!ROOT_API_KEY || ROOT_API_KEY === 'sandbox_...') {
    console.error('❌ ROOT_API_KEY not set or still placeholder.');
    console.error('   Set ROOT_API_KEY in .env or functions/.env');
    console.error('   Get a sandbox key at: https://app.rootplatform.com/');
    process.exit(1);
  }

  // Root uses Basic auth: API key as username, empty password (same as insurance.ts)
  const auth = Buffer.from(`${ROOT_API_KEY}:`).toString('base64');
  const baseUrl = ROOT_API_URL.replace(/\/$/, '');
  const path = baseUrl.endsWith('/insurance') ? '/quotes' : '/insurance/quotes';
  const url = `${baseUrl}${path}`;

  const body = {
    type: process.env.ROOT_PRODUCT_MODULE_KEY || 'camtest',
    module: {
      type: 'driiva_telematics',
      coverage_type: 'standard',
      driving_score: 85,
      total_trips: 10,
      total_miles: 500,
      discount_factor: 21,
    },
  };

  console.log('Testing Root Platform API...');
  console.log(`  URL: ${url}`);
  console.log(`  Auth: Basic ***`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Response may not be JSON on error
  }

  console.log(`  Status: ${res.status}`);

  if (res.ok) {
    const data = json as { quote_package_id?: string; suggested_premium?: number };
    if (data?.quote_package_id && typeof data.suggested_premium === 'number') {
      console.log('✅ Root API integrated');
      console.log(`   quote_package_id: ${data.quote_package_id}`);
      console.log(`   suggested_premium: ${data.suggested_premium} cents`);
    } else {
      console.log('⚠️ 200 OK but unexpected response shape:');
      console.log(JSON.stringify(json, null, 2));
    }
  } else {
    console.log('❌ Root API not connected');
    if (res.status === 401) {
      console.log('   Invalid or missing API key');
    } else if (res.status === 404) {
      console.log('   Endpoint or product module not found');
    } else if (res.status >= 500) {
      console.log('   Root server error');
    }
    if (text) {
      console.log('   Response:', text.slice(0, 300));
    }
  }
}

testRootQuote().catch((err) => {
  console.error('❌ Request failed:', (err as Error).message);
  process.exit(1);
});
