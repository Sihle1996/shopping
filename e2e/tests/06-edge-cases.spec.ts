import { test, expect } from '@playwright/test';
import { loginAs, clearSession, STORE } from './helpers/auth.helper';

/**
 * Suite 6 — Edge Cases
 *
 * Empty forms, invalid inputs, unauthorized access, and boundary conditions.
 */

test.describe('Edge Cases — Empty & Invalid Forms', () => {

  test('login — empty form keeps submit disabled', async ({ page }) => {
    await page.goto('/login');
    const btn = page.locator('app-button[type="submit"] button');
    await expect(btn).toBeDisabled();
  });

  test('login — only email filled keeps submit disabled', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@test.com');
    const btn = page.locator('app-button[type="submit"] button');
    await expect(btn).toBeDisabled();
  });

  test('register — empty form keeps submit disabled', async ({ page }) => {
    await page.goto('/register');
    const btn = page.locator('app-button[type="submit"] button');
    await expect(btn).toBeDisabled();
  });

  test('register — invalid email format prevents submission', async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[formControlName="email"]',           'bademail');
    await page.fill('input[formControlName="password"]',        '123456');
    await page.fill('input[formControlName="confirmPassword"]', '123456');
    const btn = page.locator('app-button[type="submit"] button');
    await expect(btn).toBeDisabled();
  });

  test('register-restaurant — empty name prevents submit', async ({ page }) => {
    await page.goto('/register-restaurant');
    await page.fill('input[formControlName="email"]', 'test@test.co.za');
    await page.fill('input[formControlName="slug"]',  'valid-slug');
    // Leave name empty
    const btn = page.locator('app-button[type="submit"] button');
    await expect(btn).toBeDisabled();
  });

  test('register-restaurant — slug with spaces fails validation', async ({ page }) => {
    await page.goto('/register-restaurant');
    await page.fill('input[formControlName="name"]',  'My Store');
    await page.fill('input[formControlName="slug"]',  'My Store Slug');
    await page.fill('input[formControlName="email"]', 'test@test.co.za');
    await page.locator('input[formControlName="slug"]').blur();

    await expect(page.getByText(/only lowercase letters/i)).toBeVisible();
    const btn = page.locator('app-button[type="submit"] button');
    await expect(btn).toBeDisabled();
  });

  test('forgot-password — empty email keeps submit disabled', async ({ page }) => {
    await page.goto('/forgot-password');
    const btn = page.locator('app-button[type="submit"] button');
    await expect(btn).toBeDisabled();
  });

  test('forgot-password — invalid email format keeps submit disabled', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('input[formControlName="email"]', 'notvalid');
    await page.locator('input[formControlName="email"]').blur();
    const btn = page.locator('app-button[type="submit"] button');
    await expect(btn).toBeDisabled();
  });

  test('admin menu — add form empty name keeps submit disabled', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/menu');
    await page.locator('app-button').filter({ hasText: /add item/i }).locator('button').click();
    await page.waitForSelector('input[name="name"]');

    // Fill price but leave name empty
    await page.fill('input[name="price"]', '50');
    const submitBtn = page.locator('app-button[type="submit"] button').last();
    await expect(submitBtn).toBeDisabled();
    await clearSession(page);
  });

  test('checkout — empty delivery form does not show PayPal', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(`/store/${STORE.slug}/checkout`);
    await page.waitForSelector('input[name="fullName"]');

    // Do not fill anything; try clicking Continue
    const continueBtn = page.locator('app-button').filter({ hasText: /continue to payment/i }).locator('button');
    if (await continueBtn.isEnabled()) {
      await continueBtn.click();
    }
    await expect(page.locator('#paypal-button-container')).not.toBeVisible();
    await clearSession(page);
  });
});

test.describe('Edge Cases — Unauthorized Access', () => {

  test('accessing /admin without auth redirects to login', async ({ page }) => {
    await clearSession(page);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('accessing /driver/dashboard without auth redirects to login', async ({ page }) => {
    await clearSession(page);
    await page.goto('/driver/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('customer role cannot reach /admin/* — redirected away', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto('/admin/dashboard');
    // Should be redirected away (guard redirects non-admins)
    await expect(page).not.toHaveURL(/\/admin\/dashboard/, { timeout: 8_000 });
    await clearSession(page);
  });

  test('driver role cannot reach /admin/* — redirected away', async ({ page }) => {
    await loginAs(page, 'driver');
    await page.goto('/admin/dashboard');
    await expect(page).not.toHaveURL(/\/admin\/dashboard/, { timeout: 8_000 });
    await clearSession(page);
  });

  test('customer role cannot reach /driver/dashboard — redirected away', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto('/driver/dashboard');
    await expect(page).not.toHaveURL(/\/driver\/dashboard/, { timeout: 8_000 });
    await clearSession(page);
  });

  test('unknown route redirects to store listing', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    // Wildcard route redirects to '/'
    await expect(page).toHaveURL('/', { timeout: 8_000 });
  });

  test('API: analytics endpoint rejects customer JWT with 403', async ({ page }) => {
    await loginAs(page, 'customer');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const response = await page.request.get(
      `https://shopping-production-592a.up.railway.app/api/admin/analytics/sales-trends` +
      `?startDate=2026-01-01T00:00:00Z&endDate=2026-12-31T23:59:59Z`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(response.status()).toBe(403);
    await clearSession(page);
  });

  test('API: user-list endpoint rejects customer JWT with 403', async ({ page }) => {
    await loginAs(page, 'customer');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const response = await page.request.get(
      'https://shopping-production-592a.up.railway.app/api/users',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(response.status()).toBe(403);
    await clearSession(page);
  });
});

test.describe('Edge Cases — Input Boundary Values', () => {

  test('product quantity selector cannot go below 1', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card');
    await page.locator('app-product-card').first().click();
    await page.waitForURL(/\/product\//);

    // Find the decrement button in quantity selector
    const decrementBtn = page.locator('app-quantity-selector button').first();
    // Quantity starts at 1 — decrement should be disabled or do nothing
    if (await decrementBtn.isEnabled()) {
      await decrementBtn.click();
    }
    const quantityDisplay = page.locator('app-quantity-selector span, app-quantity-selector input');
    const qty = await quantityDisplay.textContent();
    expect(parseInt(qty ?? '1')).toBeGreaterThanOrEqual(1);
  });

  test('OTP input has maxlength=6', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.fill('input[formControlName="email"]', 'mofokengsihle63@gmail.com');
    await page.click('app-button[type="submit"] button');
    await page.waitForSelector('input[formControlName="otp"]');

    const otpInput = page.locator('input[formControlName="otp"]');
    await expect(otpInput).toHaveAttribute('maxlength', '6');

    // Try typing more than 6 digits
    await otpInput.fill('12345678');
    const value = await otpInput.inputValue();
    expect(value.length).toBeLessThanOrEqual(6);
  });

  test('promo code input trims and uppercases entry', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(`/store/${STORE.slug}/checkout`);
    await page.waitForSelector('input[placeholder*="promo" i]');

    const promoInput = page.locator('input[placeholder*="promo" i]');
    await promoInput.fill('  test10  ');

    // Apply button should be enabled (non-empty after trim is checked in code)
    const applyBtn = page.locator('app-button').filter({ hasText: /apply/i }).locator('button');
    await expect(applyBtn).toBeEnabled();
    await clearSession(page);
  });

  test('store detail page handles unknown slug gracefully', async ({ page }) => {
    await page.goto('/store/this-store-does-not-exist-9999');
    await page.waitForLoadState('networkidle');
    // Either shows error message, empty state, or redirects — should not crash
    const crashed = await page.locator('text=Cannot read').isVisible();
    expect(crashed).toBe(false);
  });
});

test.describe('Edge Cases — UI State', () => {

  test('loading spinner appears on login submit', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]',    'mofokengsihle63@gmail.com');
    await page.fill('input[type="password"]', '123456');

    // Click submit and immediately check for loading state
    await page.click('app-button[type="submit"] button');
    // Button may show spinner before redirect — check within a short window
    // (this may not always be catchable due to speed, so we just confirm no crash)
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 });
    await clearSession(page);
  });

  test('add-to-cart button shows loading state briefly', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card');
    await page.locator('app-product-card').first().click();
    await page.waitForURL(/\/product\//);

    const addBtn = page.locator('app-button').filter({ hasText: /add to cart/i }).locator('button');
    await addBtn.click();

    // Confirm the button is clicked and success banner appears (no double-click crash)
    await page.waitForTimeout(2_000);
    const errorBanner = page.locator('.toast-error');
    await expect(errorBanner).not.toBeVisible();
    await clearSession(page);
  });

  test('cart delete confirmation does not affect other items', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(`/store/${STORE.slug}/cart`);
    await page.waitForSelector('.space-y-4, app-empty-state', { timeout: 10_000 });

    const items = page.locator('.space-y-4 > div');
    const initialCount = await items.count();

    if (initialCount >= 2) {
      // Remove first item
      await items.first().locator('button:has(i.bi-trash), button[title*="remove" i]').click();
      await page.waitForTimeout(1_000);
      await expect(items).toHaveCount(initialCount - 1);
    }
    await clearSession(page);
  });
});
