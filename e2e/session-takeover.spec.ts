import { test, expect, credentials, hasAdminCredentials, login } from './fixtures';

/**
 * Covers the cross-tab session model in src/providers/AuthProviders.tsx —
 * the genuinely sophisticated part of this app's session handling, and the
 * piece most likely to silently break during unrelated refactors. Two tabs
 * of the *same* browser context (so they share localStorage, like real
 * browser tabs) simulate a user logging in again elsewhere.
 */
test.describe('Cross-tab session takeover', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD against a live backend');

  test('logging in on a second tab signs the first tab out', async ({ page, context }) => {
    await login(page, credentials.admin.email, credentials.admin.password);
    await expect(page).toHaveURL(/\/dashboard/);

    const secondTab = await context.newPage();
    await login(secondTab, credentials.admin.email, credentials.admin.password);
    await expect(secondTab).toHaveURL(/\/dashboard/);

    // The first tab should detect the takeover via the `storage` event and
    // force a local sign-out, redirecting to /login with the reason code.
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain('reason=');

    await secondTab.close();
  });
});
