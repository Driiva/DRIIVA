import { defineConfig, devices } from '@playwright/test';

/**
 * Characterisation E2E harness (rebuild mission, 2026-07).
 * Runs the real dev server against the staging Firebase project (.env.staging).
 * These tests lock in CURRENT behaviour — quirks included. A failing test here
 * means the test is wrong or behaviour changed, never "found a bug".
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // The webServer is a DEV server (tsx + Vite middleware): first navigation to
  // each route triggers an on-demand transform that can take >10s cold. Keep
  // worker count low and timeouts generous or parallel cold-compiles time out.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4310',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'PORT=4310 npm run dev:staging',
    url: 'http://localhost:4310/api/health',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
