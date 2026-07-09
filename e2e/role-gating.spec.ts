import { test, expect, credentials, hasAdminCredentials, hasSuperAdminCredentials, login } from './fixtures';

test.describe('Role gating', () => {
  test('redirects an unauthenticated visitor from /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects an unauthenticated visitor from a super-admin route to /login', async ({ page }) => {
    await page.goto('/dashboard/super');
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('an admin (non-super) account is bounced away from /dashboard/super', async ({ page }) => {
    test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD for a non-super admin account');
    await login(page, credentials.admin.email, credentials.admin.password);
    await page.goto('/dashboard/super');
    // withAuth redirects a non-matching role back to their own dashboard root.
    await page.waitForURL((url) => !url.pathname.startsWith('/dashboard/super'), { timeout: 10_000 });
    expect(page.url()).not.toContain('/dashboard/super');
  });

  test('a super-admin account can reach the super-admin console', async ({ page }) => {
    test.skip(!hasSuperAdminCredentials, 'requires E2E_SUPER_ADMIN_EMAIL/E2E_SUPER_ADMIN_PASSWORD');
    await login(page, credentials.superAdmin.email, credentials.superAdmin.password);
    await page.goto('/dashboard/super');
    await expect(page.getByText('Super Admin Command Center')).toBeVisible();
  });
});
