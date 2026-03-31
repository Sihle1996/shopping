import { test, expect } from '@playwright/test';
import { TEST_ACCOUNTS, STORE, clearSession } from './helpers/auth.helper';

/**
 * Suite 2 — Authentication UI
 */

/** Navigate to a page and wait for Angular to finish bootstrapping */
async function gotoApp(page: any, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test.describe('Authentication — Login', () => {

  test.beforeEach(async ({ page }) => {
    await clearSession(page);
  });

  test('login page renders correctly', async ({ page }) => {
    await gotoApp(page, '/login');
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot password/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /create one/i })).toBeVisible();
  });

  test('submit button is disabled when form is empty', async ({ page }) => {
    await gotoApp(page, '/login');
    await page.waitForSelector('app-button[type="submit"] button', { timeout: 15_000 });
    const btn = page.locator('app-button[type="submit"] button');
    await expect(btn).toBeDisabled();
  });

  test('invalid email format shows validation error', async ({ page }) => {
    await gotoApp(page, '/login');
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
    await page.fill('input[type="email"]', 'notanemail');
    await page.locator('input[type="email"]').blur();
    await expect(page.getByText(/please enter a valid email/i)).toBeVisible({ timeout: 5_000 });
  });

  test('wrong credentials show error message', async ({ page }) => {
    await gotoApp(page, '/login');
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
    await page.fill('input[type="email"]',    TEST_ACCOUNTS.customer.email);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('app-button[type="submit"] button');

    await expect(page.locator('.bg-red-50 span').first()).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('password toggle shows/hides password text', async ({ page }) => {
    await gotoApp(page, '/login');
    await page.waitForSelector('input[formControlName="password"]', { timeout: 15_000 });
    const passwordInput = page.locator('input[formControlName="password"]');
    // Use a stable container-relative selector — the icon class changes on toggle
    const toggleBtn = page.locator('div:has(> input[formControlName="password"]) button[type="button"]').first();

    await expect(passwordInput).toHaveAttribute('type', 'password');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('successful customer login redirects away from /login', async ({ page }) => {
    await gotoApp(page, '/login');
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
    await page.fill('input[type="email"]',    TEST_ACCOUNTS.customer.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.customer.password);
    await page.click('app-button[type="submit"] button');

    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20_000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  test('successful admin login redirects to admin dashboard', async ({ page }) => {
    // Requires a publicly accessible environment with seeded admin account.
    // Skipped when BASE_URL is not set (Vercel preview requires auth)
    // or when pointing at localhost (no admin account in local DB).
    const baseUrl = process.env['BASE_URL'] ?? '';
    test.skip(
      !baseUrl || baseUrl.includes('localhost') || baseUrl.includes('vercel.app'),
      'Needs public staging URL with admin account'
    );

    await gotoApp(page, '/login');
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
    await page.fill('input[type="email"]',    TEST_ACCOUNTS.admin.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.admin.password);
    await page.click('app-button[type="submit"] button');

    // Admin redirects to /admin/* — lazy-loaded module can take extra time
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 40_000 });
    await expect(page).toHaveURL(/\/admin/);
  });

  test('successful driver login redirects to driver dashboard', async ({ page }) => {
    // Same restriction as admin test above.
    const baseUrl = process.env['BASE_URL'] ?? '';
    test.skip(
      !baseUrl || baseUrl.includes('localhost') || baseUrl.includes('vercel.app'),
      'Needs public staging URL with driver account'
    );

    await gotoApp(page, '/login');
    await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
    await page.fill('input[type="email"]',    TEST_ACCOUNTS.driver.email);
    await page.fill('input[type="password"]', TEST_ACCOUNTS.driver.password);
    await page.click('app-button[type="submit"] button');

    // Driver module is lazy-loaded — allow extra time
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 40_000 });
    await expect(page).toHaveURL(/\/driver\/dashboard/);
  });
});

test.describe('Authentication — Register', () => {

  test('register page renders correctly', async ({ page }) => {
    await gotoApp(page, '/register');
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[formControlName="email"]')).toBeVisible();
    await expect(page.locator('input[formControlName="password"]')).toBeVisible();
    await expect(page.locator('input[formControlName="confirmPassword"]')).toBeVisible();
  });

  test('mismatched passwords show error', async ({ page }) => {
    await gotoApp(page, '/register');
    await page.waitForSelector('input[formControlName="email"]', { timeout: 15_000 });
    await page.fill('input[formControlName="email"]',           'newuser@test.co.za');
    await page.fill('input[formControlName="password"]',        'password1');
    await page.fill('input[formControlName="confirmPassword"]', 'password2');
    await page.locator('input[formControlName="confirmPassword"]').blur();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('app-button[type="submit"] button')).toBeDisabled();
  });

  test('password too short shows minlength error', async ({ page }) => {
    await gotoApp(page, '/register');
    await page.waitForSelector('input[formControlName="password"]', { timeout: 15_000 });
    await page.fill('input[formControlName="password"]', '123');
    await page.locator('input[formControlName="password"]').blur();
    await expect(page.getByText(/at least 6 characters/i)).toBeVisible({ timeout: 5_000 });
  });

  test('duplicate email shows conflict error', async ({ page }) => {
    await gotoApp(page, `/register?tenantId=${STORE.tenantId}`);
    await page.waitForSelector('input[formControlName="email"]', { timeout: 15_000 });
    await page.fill('input[formControlName="email"]',           TEST_ACCOUNTS.customer.email);
    await page.fill('input[formControlName="password"]',        '123456');
    await page.fill('input[formControlName="confirmPassword"]', '123456');
    await page.click('app-button[type="submit"] button');

    await expect(page.locator('.bg-red-50 span')).toBeVisible({ timeout: 10_000 });
  });

  test('sign in link navigates to /login', async ({ page }) => {
    await gotoApp(page, '/register');
    await page.waitForSelector('a[href*="login"]', { timeout: 15_000 });
    // Use the footer sign-in link (not navbar), which has exact text "Sign in"
    await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Authentication — Forgot Password', () => {

  test('forgot password page renders two-step form', async ({ page }) => {
    await gotoApp(page, '/forgot-password');
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[formControlName="email"]')).toBeVisible();
    await expect(page.getByText(/we'll send a code/i)).toBeVisible();
  });

  test('unknown email shows error', async ({ page }) => {
    await gotoApp(page, '/forgot-password');
    await page.waitForSelector('input[formControlName="email"]', { timeout: 15_000 });
    await page.fill('input[formControlName="email"]', 'nobody@nowhere.co.za');
    await page.click('app-button[type="submit"] button');

    await expect(page.getByRole('alert', { name: /no account found/i })).toBeVisible({ timeout: 10_000 });
  });

  test('valid email advances to OTP step', async ({ page }) => {
    await gotoApp(page, '/forgot-password');
    await page.waitForSelector('input[formControlName="email"]', { timeout: 15_000 });
    await page.fill('input[formControlName="email"]', TEST_ACCOUNTS.customer.email);
    await page.click('app-button[type="submit"] button');

    await expect(page.getByRole('heading', { name: /enter reset code/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[formControlName="otp"]')).toBeVisible();
    await expect(page.locator('input[formControlName="newPassword"]')).toBeVisible();
    await expect(page.locator('input[formControlName="confirmPassword"]')).toBeVisible();
  });

  test('OTP step — back button returns to email step', async ({ page }) => {
    await gotoApp(page, '/forgot-password');
    await page.waitForSelector('input[formControlName="email"]', { timeout: 15_000 });
    await page.fill('input[formControlName="email"]', TEST_ACCOUNTS.customer.email);
    await page.click('app-button[type="submit"] button');
    await page.waitForSelector('input[formControlName="otp"]', { timeout: 15_000 });

    await page.getByRole('button', { name: /back/i }).click();
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
  });

  test('OTP step — password mismatch shows error', async ({ page }) => {
    await gotoApp(page, '/forgot-password');
    await page.waitForSelector('input[formControlName="email"]', { timeout: 15_000 });
    await page.fill('input[formControlName="email"]', TEST_ACCOUNTS.customer.email);
    await page.click('app-button[type="submit"] button');
    await page.waitForSelector('input[formControlName="otp"]', { timeout: 15_000 });

    await page.fill('input[formControlName="otp"]',             '123456');
    await page.fill('input[formControlName="newPassword"]',     'newpass1');
    await page.fill('input[formControlName="confirmPassword"]', 'newpass2');
    await page.locator('input[formControlName="confirmPassword"]').blur();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('app-button[type="submit"] button')).toBeDisabled();
  });

  test('sign in link is visible on forgot-password page', async ({ page }) => {
    await gotoApp(page, '/forgot-password');
    // Match the page-level "Sign in" link (exact case, not navbar)
    await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Authentication — Protected Routes', () => {

  test('unauthenticated user is redirected away from /store/:slug/cart', async ({ page }) => {
    await clearSession(page);
    await page.goto(`/store/${STORE.slug}/cart`);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('unauthenticated user is redirected away from /store/:slug/checkout', async ({ page }) => {
    await clearSession(page);
    await page.goto(`/store/${STORE.slug}/checkout`);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('unauthenticated user is redirected away from /store/:slug/orders', async ({ page }) => {
    await clearSession(page);
    await page.goto(`/store/${STORE.slug}/orders`);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
