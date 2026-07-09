import { test as base, type Page } from '@playwright/test';

/**
 * This repo has no mock backend by design (see README's "Testing" section) —
 * e2e flows that require a real session (login, MFA, CRUD, role-gating)
 * need live credentials against a real `wisdom_api` instance. Locally/in CI
 * without those env vars set, such tests skip instead of failing, so the
 * suite stays green on a plain checkout while still running for real
 * whenever E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD (and the super-admin
 * equivalents) are configured against a staging environment.
 */
export const credentials = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || '',
    password: process.env.E2E_ADMIN_PASSWORD || '',
  },
  superAdmin: {
    email: process.env.E2E_SUPER_ADMIN_EMAIL || '',
    password: process.env.E2E_SUPER_ADMIN_PASSWORD || '',
  },
};

export const hasAdminCredentials = Boolean(credentials.admin.email && credentials.admin.password);
export const hasSuperAdminCredentials = Boolean(credentials.superAdmin.email && credentials.superAdmin.password);

export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
}

/**
 * Logs in via the real UI (not an API shortcut) so the OTP/TOTP challenge
 * step is exercised the same way a user hits it. Assumes email-OTP is the
 * account's MFA method and that E2E_LOGIN_OTP_CODE is retrievable (e.g. a
 * fixed test-only code configured on the staging backend) when MFA is on.
 */
export async function login(page: Page, email: string, password: string) {
  await fillLoginForm(page, email, password);
  await page.getByRole('button', { name: /sign in/i }).click();

  const otpCode = process.env.E2E_LOGIN_OTP_CODE;
  const otpInput = page.getByPlaceholder('••••••');
  if (otpCode && (await otpInput.isVisible().catch(() => false))) {
    await otpInput.fill(otpCode);
    await page.getByRole('button', { name: /verify/i }).click();
  }

  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

export const test = base;
export { expect } from '@playwright/test';
