import { test, expect } from '@playwright/test';

/**
 * CHARACTERISATION — public (unauthenticated) surface.
 * WEB-01 welcome, WEB-06 demo, WEB-07/08/09 legal, WEB-24 support.
 * Quirks pinned as behaviour, incl. the privacy-vs-trust retention
 * contradiction and the dead "Chat with us" card.
 */

test.describe('WEB-01 welcome', () => {
  test('renders hero with the three CTAs and carousel', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page.getByRole('button', { name: /get started/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /test driiva/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('Get Started navigates to /signup', async ({ page }) => {
    await page.goto('/welcome');
    await page.getByRole('button', { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('Test Driiva navigates to /demo without activating demo mode', async ({ page }) => {
    await page.goto('/welcome');
    await page.getByRole('button', { name: /test driiva/i }).click();
    await expect(page).toHaveURL(/\/demo/);
    const demoFlag = await page.evaluate(() => sessionStorage.getItem('driiva-demo-mode'));
    expect(demoFlag).toBeNull();
  });
});

test.describe('WEB-07/08/09 legal pages', () => {
  test('terms renders with hardcoded effective date and refund policy prose', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByText(/effective: march 2026/i)).toBeVisible();
    await expect(page.getByText(/80%/).first()).toBeVisible();
  });

  test('QUIRK: privacy says 12-month raw telemetry retention while trust says 90 days — both pinned', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByText(/12[- ]month/i).first()).toBeVisible();
    await page.goto('/trust');
    await expect(page.getByText(/90 days/i).first()).toBeVisible();
  });

  test('trust centre renders static FCA/ICO badges (no backing status)', async ({ page }) => {
    await page.goto('/trust');
    await expect(page.getByText(/fca/i).first()).toBeVisible();
    await expect(page.getByText(/ico/i).first()).toBeVisible();
  });
});

test.describe('WEB-24 support (public by design)', () => {
  test('reachable with no session; mailto is the only working contact; chat card is dead', async ({ page }) => {
    await page.goto('/support');
    await expect(page.getByText(/get in touch/i)).toBeVisible();
    // The only real contact mechanism:
    await expect(page.locator('a[href^="mailto:info@driiva.co.uk"]')).toBeVisible();
    // QUIRK: "Chat with us" renders but is a non-interactive div (no link, no onClick)
    const chat = page.getByText(/chat with us/i).first();
    await expect(chat).toBeVisible();
    await chat.click();
    await expect(page).toHaveURL(/\/support/); // click does nothing
  });
});

test.describe('WEB-06 demo entry', () => {
  test('Enter Demo Mode sets the two sessionStorage keys and lands on the dashboard', async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('button', { name: /enter demo/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    const flags = await page.evaluate(() => ({
      mode: sessionStorage.getItem('driiva-demo-mode'),
      user: sessionStorage.getItem('driiva-demo-user'),
    }));
    expect(flags.mode).toBe('true');
    expect(JSON.parse(flags.user!).id).toBe('demo-user-1');
  });
});
