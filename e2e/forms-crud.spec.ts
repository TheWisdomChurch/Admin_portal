import { test, expect, credentials, hasAdminCredentials, login } from './fixtures';

test.describe('Forms CRUD', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD against a live backend');

  const formTitle = `E2E Test Form ${Date.now()}`;
  const formSlug = `e2e-test-form-${Date.now()}`;

  test('creates a form, finds it in the manager, then deletes it', async ({ page }) => {
    await login(page, credentials.admin.email, credentials.admin.password);

    // Create.
    await page.goto('/dashboard/forms/new');
    await page.getByLabel('Title *').fill(formTitle);
    await page.getByLabel('Form Link Name *').fill(formSlug);
    await page.getByRole('button', { name: 'Create & Publish' }).click();
    await page.waitForURL(/\/dashboard\/forms(?!\/new)/, { timeout: 15_000 });

    // Find.
    await page.goto('/dashboard/forms');
    await page.getByPlaceholder('Search forms, fields, status...').fill(formTitle);
    await expect(page.getByText(formTitle)).toBeVisible({ timeout: 10_000 });

    // Delete (cleanup — keeps the suite idempotent across reruns).
    const row = page.getByText(formTitle).locator('..');
    const deleteButton = row.getByRole('button', { name: /delete/i }).first();
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();
      const confirmButton = page.getByRole('button', { name: /confirm|yes, delete/i }).first();
      if (await confirmButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await confirmButton.click();
      }
      await expect(page.getByText(formTitle)).not.toBeVisible({ timeout: 10_000 });
    }
  });
});
