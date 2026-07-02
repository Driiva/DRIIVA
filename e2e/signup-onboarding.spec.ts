import { test, expect } from '@playwright/test';

/**
 * CHARACTERISATION — FLOW-01: real signup → 12-step quick-onboarding →
 * completion attempt, against the STAGING Firebase project.
 *
 * Creates one throwaway account per run (e2e-<timestamp>@driiva.co.uk).
 * This flow also empirically probes the §0.4 dead-on-arrival finding:
 * onboarding completion is gated on PATCH /api/profile/me, which 401s for
 * any Firebase user with no Neon row (verifyFirebaseAuth drops them), unless
 * the syncUserOnSignup Auth trigger is deployed on staging and has created
 * the row. Whatever happens is pinned via the observable outcome AND the
 * captured PATCH status code.
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
  // driiva-staging Firebase project (console → Authentication → Sign-in method),
  // then remove this skip. The walker below then pins the full FLOW-01 including
  // the §0.4 dead-on-arrival probe (does completion PATCH 200 or 401?).
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

    // Track the completion PATCH — the load-bearing call of the whole flow.
    let patchStatus: number | null = null;
    page.on('response', (res) => {
      if (res.url().includes('/api/profile/me') && res.request().method() === 'PATCH') {
        patchStatus = res.status();
      }
    });

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

    // Outcome: either Celebration/dashboard (PATCH 200 — Neon row existed, i.e.
    // syncUserOnSignup IS live on staging) or stuck on Confirm (PATCH 401 —
    // the dead-on-arrival wall, with the failure toast invisible because the
    // Toaster is never mounted). Pin whichever staging exhibits, and record it.
    await page.waitForTimeout(4_000);
    const url = page.url();
    const completed = /\/dashboard/.test(url) || (await page
      .getByText(/celebrat|welcome to driiva|you're in/i)
      .first()
      .isVisible()
      .catch(() => false));

    // Attach the empirical result to the report either way:
    test.info().annotations.push({
      type: 'characterisation',
      description: `completion PATCH /api/profile/me status=${patchStatus}; completed=${completed}; url=${url}`,
    });

    // The PATCH must have fired — completion is gated on it (June fix 9acbb60).
    expect(patchStatus, 'completion PATCH never fired — step walker did not reach Confirm').not.toBeNull();

    if (patchStatus === 200) {
      expect(completed).toBe(true);
    } else {
      // Dead-on-arrival wall confirmed end-to-end: fresh Firebase user, no Neon
      // row, PATCH 401, user cannot complete onboarding; failure feedback is
      // silently dropped (dead Toaster).
      expect(patchStatus).toBe(401);
      expect(completed).toBe(false);
    }
  });
});
