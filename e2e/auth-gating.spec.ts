import { test, expect } from '@playwright/test';

/**
 * CHARACTERISATION — auth gating + client-side validation (no accounts created).
 * FLOW-02 negative paths, FLOW-05, signup client validation, route guards.
 * Runs against the staging Firebase project via the dev server.
 */

test.describe('route guards', () => {
  test('unauthenticated /dashboard redirects to /signin', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/signin/, { timeout: 15_000 });
  });

  test('unauthenticated /settings redirects to /signin', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/signin/, { timeout: 15_000 });
  });

  test('legacy /login route serves the SignIn component', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
  });

  test('unknown route falls through to the inline catch-all redirect to /', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL(/\/$|\/welcome/);
  });
});

test.describe('WEB-03 signup client-side validation (no network submission)', () => {
  test('QUIRK: test-domain emails are blocked client-side (test.com/example.com blocklist)', async ({ page }) => {
    await page.goto('/signup');
    await page.getByPlaceholder(/name/i).first().fill('Test Driver');
    await page.locator('input[type="email"]').fill('someone@test.com');
    const pw = page.locator('input[type="password"]');
    await pw.nth(0).fill('Password123!');
    await pw.nth(1).fill('Password123!');
    await page.getByRole('button', { name: /create|sign up/i }).first().click();
    await expect(page.getByText(/valid|real|test/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/signup/); // did not advance
  });

  test('password mismatch is rejected before any network call', async ({ page }) => {
    await page.goto('/signup');
    await page.getByPlaceholder(/name/i).first().fill('Test Driver');
    await page.locator('input[type="email"]').fill('driver@driiva.co.uk');
    const pw = page.locator('input[type="password"]');
    await pw.nth(0).fill('Password123!');
    await pw.nth(1).fill('Different123!');
    await page.getByRole('button', { name: /create|sign up/i }).first().click();
    await expect(page.getByText(/match/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/signup/);
  });
});

test.describe('FLOW-02 sign-in negative path', () => {
  test('wrong credentials surface an inline error and stay on /signin', async ({ page }) => {
    await page.goto('/signin');
    await page.locator('input').first().fill('nonexistent-e2e@driiva.co.uk');
    await page.locator('input[type="password"]').fill('DefinitelyWrong123!');
    // Accessible name is "Sign in to account", not "Sign In" (visual label differs)
    await page.getByRole('button', { name: /sign in to account/i }).click();
    // Mapped Firebase error copy (invalid-credential family or throttle):
    await expect(
      page.getByText(/incorrect|invalid|no account|try again|too many/i).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/signin/);
  });
});

test.describe('FLOW-05 forgot password (anti-enumeration property)', () => {
  test('response to a nonexistent email never reveals nonexistence', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.locator('input[type="email"]').fill('nobody-e2e-characterisation@driiva.co.uk');
    await page.getByRole('button', { name: /send|reset/i }).first().click();
    // OBSERVED behaviour on staging: the code path intended to convert
    // auth/user-not-found into the generic success copy does NOT fire —
    // the SDK returns a different error code here and the page shows
    // "Failed to send reset email. Please try again." The anti-enumeration
    // PROPERTY still holds (nonexistence is never revealed), so that is
    // what we pin: either generic success or generic failure, never
    // "no account / not found".
    await expect(
      page.getByText(/check your inbox|if an account exists|failed to send reset email/i).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/no account|not found|doesn't exist/i)).toHaveCount(0);
  });
});
