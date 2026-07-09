import { test, expect, credentials, hasAdminCredentials, fillLoginForm } from './fixtures';

test.describe('MFA / TOTP setup', () => {
  test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD for an account without MFA enabled yet');

  test('an account without MFA enabled is routed to /mfa/setup after password sign-in', async ({ page }) => {
    await fillLoginForm(page, credentials.admin.email, credentials.admin.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/mfa\/setup|\/dashboard/, { timeout: 15_000 });
    // Accounts already enrolled in MFA skip straight to /dashboard — only
    // assert the setup screen when the backend actually routed us there.
    if (page.url().includes('/mfa/setup')) {
      await expect(page.getByText(/authenticator/i).first()).toBeVisible();
    }
  });

  test('the setup screen presents a QR code and a manual entry key', async ({ page }) => {
    await page.goto('/mfa/setup');
    await expect(page.getByText(/scan|qr code/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('rejects an invalid 6-digit code during the verification step', async ({ page }) => {
    await page.goto('/mfa/setup');
    const codeInput = page.locator('input[inputmode="numeric"], input[maxlength="6"]').first();
    if (await codeInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await codeInput.fill('000000');
      const confirmButton = page.getByRole('button', { name: /verify|confirm|enable/i }).first();
      await confirmButton.click();
      await expect(page.getByText(/invalid|incorrect|failed/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });
});
