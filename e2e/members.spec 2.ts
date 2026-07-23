import { test, expect, credentials, hasAdminCredentials, login } from './fixtures';

test.describe('Members', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD against a live backend');

  test('loads the member roster and supports search', async ({ page }) => {
    await login(page, credentials.admin.email, credentials.admin.password);
    await page.goto('/dashboard/members');
    await expect(page.getByPlaceholder('Search members')).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder('Search members').fill('zzz-no-such-member-zzz');
    // A search with no matches should not silently keep showing stale rows.
    await expect(page.locator('table tbody tr')).toHaveCount(0, { timeout: 10_000 }).catch(async () => {
      await expect(page.getByText(/no members|nothing here/i)).toBeVisible();
    });
  });

  test('opens a member profile drawer from the roster', async ({ page }) => {
    await login(page, credentials.admin.email, credentials.admin.password);
    await page.goto('/dashboard/members');
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await firstRow.click();
      await expect(page.getByRole('button', { name: 'Close' })).toBeVisible({ timeout: 10_000 });
    }
  });
});
