import { test, expect, credentials, hasAdminCredentials, login } from './fixtures';

test.describe('Login', () => {
  test('renders the sign-in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows client-side validation errors on an empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('rejects an invalid email format before any network call', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill('not-an-email');
    await page.getByPlaceholder('••••••••').fill('somepassword123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText('Enter a valid email')).toBeVisible();
  });

  test('toggles the remember-me checkbox', async ({ page }) => {
    await page.goto('/login');
    const rememberMe = page.getByLabel('Remember me');
    await expect(rememberMe).not.toBeChecked();
    await rememberMe.check();
    await expect(rememberMe).toBeChecked();
  });

  test('shows an error dialog for incorrect credentials against the real backend', async ({ page }) => {
    test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD against a live backend');
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(credentials.admin.email);
    await page.getByPlaceholder('••••••••').fill('definitely-the-wrong-password-123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByRole('heading', { name: 'Incorrect password' })).toBeVisible({ timeout: 10_000 });
  });

  test('signs in successfully and reaches the dashboard', async ({ page }) => {
    test.skip(!hasAdminCredentials, 'requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD against a live backend');
    await login(page, credentials.admin.email, credentials.admin.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
