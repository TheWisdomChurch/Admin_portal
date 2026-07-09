import { test, expect, credentials, hasAdminCredentials, login } from './fixtures';

test.describe('Event CRUD', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD against a live backend');

  const eventTitle = `E2E Test Event ${Date.now()}`;

  test('creates, finds, and deletes an event', async ({ page }) => {
    await login(page, credentials.admin.email, credentials.admin.password);
    await page.goto('/dashboard/event');

    // Create.
    await page.getByRole('button', { name: 'Create event' }).click();
    await page.getByLabel('Title').fill(eventTitle);
    await page.getByLabel('Short description').fill('Created by the events e2e spec.');
    await page.getByLabel('Location').fill('E2E Test Hall');
    await page.getByRole('button', { name: 'Save event' }).click();
    await expect(page.getByText('Save event')).not.toBeVisible({ timeout: 15_000 });

    // Find.
    await page.getByPlaceholder('Search title, location, category...').fill(eventTitle);
    await expect(page.getByText(eventTitle)).toBeVisible({ timeout: 10_000 });

    // Delete (cleanup — keeps the suite idempotent across reruns).
    await page.getByText(eventTitle).click();
    const deleteButton = page.getByRole('button', { name: /delete/i }).first();
    if (await deleteButton.isVisible().catch(() => false)) {
      await deleteButton.click();
      const confirmButton = page.getByRole('button', { name: /confirm|yes, delete/i }).first();
      if (await confirmButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await confirmButton.click();
      }
      await expect(page.getByText(eventTitle)).not.toBeVisible({ timeout: 10_000 });
    }
  });
});
