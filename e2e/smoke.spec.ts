import { test, expect } from '@playwright/test';

/**
 * Harness smoke: proves the E2E rig drives the real app before the
 * flow-map suites land. Characterisation only — asserts what IS.
 */

test('server health endpoint responds ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('ok');
});

test('SPA boots and renders without console errors on /', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});
