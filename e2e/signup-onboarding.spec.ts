import { test, expect } from '@playwright/test';

/**
 * CHARACTERISATION — FLOW-01: real signup → 12-step quick-onboarding →
 * completion attempt, against the STAGING Firebase project.
 *
 * Creates one throwaway account per run (e2e-<timestamp>@driiva.co.uk).
 * Completion is now Firestore-only (M1 T2): the confirm step performs a
 * direct, owner-gated client `setDoc` of `users/{uid}.onboardingComplete`
 * (see tests/integration/identity.test.ts for the emulator-level proof of
 * that write and the gate it flips), not a PATCH to a Postgres-backed
 * endpoint; the old dead-on-arrival 401 wall from §0.4 no longer exists.
 * The walker below pins the resulting UI outcome (Celebration/dashboard),
 * not a network status code.
 */

test.describe('FLOW-01 signup → onboarding', () => {
  test('STAGING REALITY: email/password signup is impossible — provider not enabled (auth/configuration-not-found shown RAW to the user)', async ({ page }) => {
    const email = `e2e-${Date.now()}@driiva.co.uk`;
    await page.goto('/signup');
    await page.getByPlaceholder(/name/i).first().fill('E2E Characterisation');
    await page.locator('input[type="email"]').fill(email);
    const pw = page.locator('input[type="password"]');
    await pw.nth(0).fill('Characterise123!');
    await pw.nth(1).fill('Characterise123!');
    await page.getByRole('button', { name: /create|sign up/i }).first().click();
    // QUIRK: the error code is unmapped, so the raw Firebase error string leaks
    // straight into the UI. And signup cannot proceed on staging at all until
    // the Email/Password provider is enabled in the driiva-staging console.
    await expect(page.getByText(/auth\/configuration-not-found/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/\/signup/);
  });

  // UNBLOCK CONDITION: enable the Email/Password sign-in provider on the
  // driiva-staging Firebase project (console → Authentication → Sign-in
  // method), then remove this skip. Per the driiva-staging runbook this is a
  // human console action, not something this suite can flip; the STAGING
  // REALITY test above still empirically pins it as disabled today, so this
  // walker stays skipped rather than faking a pass against a signup flow it
  // cannot actually reach. Once unblocked, the walker below runs the full
  // FLOW-01 against the NEW Firestore-only completion signal (M1 T2), with
  // no PATCH involved any more.
  test.skip('signup lands on /quick-onboarding before any Firestore write confirms; onboarding walks to Confirm; completion outcome pinned', async ({ page }) => {
    test.setTimeout(180_000);
    const email = `e2e-${Date.now()}@driiva.co.uk`;

    await page.goto('/signup');
    await page.getByPlaceholder(/name/i).first().fill('E2E Characterisation');
    await page.locator('input[type="email"]').fill(email);
    const pw = page.locator('input[type="password"]');
    await pw.nth(0).fill('Characterise123!');
    await pw.nth(1).fill('Characterise123!');
    await page.getByRole('button', { name: /create|sign up/i }).first().click();

    // Signup navigates to onboarding IMMEDIATELY (fire-and-forget writes behind it)
    await expect(page).toHaveURL(/\/quick-onboarding/, { timeout: 30_000 });

    // Walk the steps. Only DataConsent (checkbox) and Confirm (checkbox) hard-gate;
    // everything else is Continue/Skip. Tick any required checkbox we meet.
    for (let step = 0; step < 14; step++) {
      // Final gate reached?
      const letsGo = page.getByRole('button', { name: /let'?s go/i });
      if (await letsGo.isVisible().catch(() => false)) {
        const confirmBox = page.locator('input[type="checkbox"]').first();
        if (await confirmBox.isVisible().catch(() => false)) {
          await confirmBox.check().catch(() => {});
        }
        await letsGo.click();
        break;
      }
      const checkbox = page.locator('input[type="checkbox"]').first();
      if (await checkbox.isVisible().catch(() => false)) {
        await checkbox.check().catch(() => {});
      }
      const nextBtn = page
        .getByRole('button', { name: /^(continue|skip|skip for now|saving\.\.\.)$/i })
        .first();
      await expect(nextBtn).toBeVisible({ timeout: 15_000 });
      await nextBtn.click();
      await page.waitForTimeout(400);
    }

    // Outcome: completion is now a direct, owner-gated Firestore write with no
    // backend row dependency (M1 T2 dropped the PATCH /api/profile/me
    // dead-on-arrival wall entirely; see the emulator-level proof in
    // tests/integration/identity.test.ts). There is no 401 branch left to
    // pin: a fresh Firebase user reaches Celebration/dashboard unconditionally.
    await page.waitForTimeout(4_000);
    const url = page.url();
    const completed = /\/dashboard/.test(url) || (await page
      .getByText(/celebrat|welcome to driiva|you're in/i)
      .first()
      .isVisible()
      .catch(() => false));

    test.info().annotations.push({
      type: 'characterisation',
      description: `onboarding completed=${completed}; url=${url}`,
    });

    expect(completed, 'onboarding did not reach Celebration/dashboard after the Firestore completion write').toBe(true);
  });
});
