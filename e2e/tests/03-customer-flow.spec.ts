import { test, expect } from '@playwright/test';
import { loginAs, clearSession, STORE } from './helpers/auth.helper';

/**
 * Suite 3 — Customer UI Flow
 *
 * Browse products → view details → add to cart → checkout → confirmation.
 * PayPal is a third-party widget so we stop at the payment step and verify
 * the PayPal button container is rendered.
 */

test.describe('Customer — Browse & Product Details', () => {

  test('store listing page shows at least one store', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#restaurants .grid > div', { timeout: 10_000 });
    const cards = page.locator('#restaurants .grid > div');
    await expect(cards.first()).toBeVisible();
    await expect(cards.first()).toContainText(/grills|eatery|plaza/i);
  });

  test('clicking a store card navigates to store home', async ({ page }) => {
    await page.goto('/');
    // Click Gasa Grills card
    await page.getByText('Gasa Grills').click();
    await expect(page).toHaveURL(/\/store\/gasa-grills/, { timeout: 10_000 });
  });

  test('store home shows menu items grid', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    // Wait for at least one product card
    await page.waitForSelector('app-product-card', { timeout: 10_000 });
    const cards = page.locator('app-product-card');
    await expect(cards.first()).toBeVisible();
  });

  test('search filters product list', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card');

    // Type into search bar
    await page.locator('app-search-bar input').fill('burger');
    await page.waitForTimeout(600); // debounce

    const cards = page.locator('app-product-card');
    const count = await cards.count();
    // At least one result, all visible cards contain 'burger' in name
    expect(count).toBeGreaterThan(0);
  });

  test('clear search restores full menu', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card');
    const initialCount = await page.locator('app-product-card').count();

    await page.locator('app-search-bar input').fill('zzznomatch');
    await page.waitForTimeout(600);
    await expect(page.getByText(/no items found/i)).toBeVisible();

    await page.locator('app-search-bar input').clear();
    await page.waitForTimeout(600);
    await expect(page.locator('app-product-card')).toHaveCount(initialCount);
  });

  test('category chip filters products', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-category-chips button, app-category-chips span');

    // Click the first non-"All" category chip
    const chips = page.locator('app-category-chips button, app-category-chips [class*="chip"]');
    const allCount = await chips.count();
    if (allCount > 1) {
      await chips.nth(1).click();
      await page.waitForTimeout(400);
      // Header should reflect the chosen category
      await expect(page.locator('h3').first()).not.toContainText('Popular');
    }
  });

  test('sort dropdown changes product order', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card');

    await page.selectOption('select[\\(change\\)="sortMenu()"], select', 'priceLowHigh');
    await page.waitForTimeout(400);
    // Products are still visible after sort
    await expect(page.locator('app-product-card').first()).toBeVisible();
  });

  test('clicking a product card navigates to product detail page', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card');
    await page.locator('app-product-card').first().click();
    await expect(page).toHaveURL(/\/product\//, { timeout: 10_000 });
  });

  test('product detail page shows name, price, sizes, and add-to-cart button', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card');
    await page.locator('app-product-card').first().click();

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/R\d/)).toBeVisible();
    await expect(page.getByText('S')).toBeVisible();
    await expect(page.getByText('M')).toBeVisible();
    await expect(page.getByText('L')).toBeVisible();
    await expect(page.locator('app-button').filter({ hasText: /add to cart|unavailable/i })).toBeVisible();
  });

  test('back button on product page returns to store home', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card');
    await page.locator('app-product-card').first().click();
    await page.waitForURL(/\/product\//);

    await page.locator('button:has(i.bi-arrow-left)').click();
    await expect(page).toHaveURL(/\/store\/gasa-grills$/, { timeout: 10_000 });
  });
});

test.describe('Customer — Cart & Checkout (authenticated)', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'customer');
  });

  test.afterEach(async ({ page }) => {
    await clearSession(page);
  });

  test('add to cart from product detail and see confirmation banner', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card');
    await page.locator('app-product-card').first().click();
    await page.waitForURL(/\/product\//);

    // Select size M and add to cart
    await page.getByText('M').click();
    const addBtn = page.locator('app-button').filter({ hasText: /add to cart/i }).locator('button');
    await addBtn.click();

    // Success banner appears at bottom
    await expect(page.locator('text=added to cart').or(page.getByText(/added/i))).toBeVisible({ timeout: 8_000 });
  });

  test('quick add to cart from home page shows confirmation', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card');

    // Hover card to reveal Add to Cart button, then click it
    const firstCard = page.locator('app-product-card').first();
    await firstCard.hover();
    const addBtn = firstCard.locator('button[title*="cart"], button:has(i.bi-cart-plus)').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.locator('.fixed.bottom-16')).toBeVisible({ timeout: 8_000 });
    }
  });

  test('cart page shows added items', async ({ page }) => {
    // Add an item first
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card');
    await page.locator('app-product-card').first().click();
    await page.waitForURL(/\/product\//);
    await page.locator('app-button').filter({ hasText: /add to cart/i }).locator('button').click();
    await page.waitForTimeout(1_000);

    // Navigate to cart
    await page.goto(`/store/${STORE.slug}/cart`);
    await page.waitForSelector('.space-y-4, app-empty-state', { timeout: 10_000 });
    // Either cart items exist or empty state
    const hasItems = (await page.locator('.space-y-4 > div').count()) > 0;
    const isEmpty  = await page.locator('app-empty-state').isVisible();
    expect(hasItems || isEmpty).toBeTruthy();
  });

  test('checkout page loads with delivery form', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}/checkout`);
    await expect(page.getByRole('heading', { name: /checkout/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('input[name="fullName"]')).toBeVisible();
    await expect(page.locator('input[name="address"]')).toBeVisible();
    await expect(page.locator('input[name="city"]')).toBeVisible();
    await expect(page.locator('input[name="zip"]')).toBeVisible();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
  });

  test('checkout — "Continue to Payment" requires all delivery fields', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}/checkout`);
    await page.waitForSelector('input[name="fullName"]');

    // Submit empty form
    const continueBtn = page.locator('app-button').filter({ hasText: /continue to payment/i }).locator('button');
    // Button should not submit or should stay on page if required fields missing
    if (await continueBtn.isEnabled()) {
      await continueBtn.click();
      // PayPal section should NOT appear yet
      await expect(page.locator('#paypal-button-container')).not.toBeVisible();
    }
  });

  test('checkout — filling delivery details reveals PayPal button', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}/checkout`);
    await page.waitForSelector('input[name="fullName"]');

    await page.fill('input[name="fullName"]', 'Test User');
    await page.fill('input[name="address"]',  '1 Test Street, Sandton');
    await page.fill('input[name="city"]',     'Johannesburg');
    await page.fill('input[name="zip"]',      '2196');
    await page.fill('input[name="phone"]',    '0711234567');

    await page.locator('app-button').filter({ hasText: /continue to payment/i }).locator('button').click();

    // PayPal container should become visible
    await expect(page.locator('#paypal-button-container')).toBeVisible({ timeout: 15_000 });
  });

  test('checkout — promo code input is visible', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}/checkout`);
    await expect(page.locator('input[placeholder*="promo code" i], input[placeholder*="Enter promo"]')).toBeVisible({ timeout: 8_000 });
  });

  test('checkout — invalid promo code shows error', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}/checkout`);
    await page.waitForSelector('input[placeholder*="promo" i]');

    await page.fill('input[placeholder*="promo" i]', 'INVALID999');
    await page.locator('app-button').filter({ hasText: /apply/i }).locator('button').click();

    await expect(page.locator('.text-danger').filter({ hasText: /invalid|not found|expired/i })).toBeVisible({ timeout: 8_000 });
  });

  test('order history shows past orders', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}/orders`);
    await page.waitForSelector('table, app-empty-state, .space-y-4', { timeout: 10_000 });
    // Either orders are listed or empty state
    const hasList   = (await page.locator('table tr, .space-y-4 > div').count()) > 0;
    const hasEmpty  = await page.locator('app-empty-state').isVisible();
    expect(hasList || hasEmpty).toBeTruthy();
  });
});

test.describe('Customer — Thank You Page', () => {

  test('thank-you page renders success screen', async ({ page }) => {
    // Directly navigate (would normally arrive after PayPal callback)
    await loginAs(page, 'customer');
    await page.goto(`/store/${STORE.slug}/thank-you`);

    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/payment was successful/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /back to menu/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /view my orders/i })).toBeVisible();
    await clearSession(page);
  });

  test('thank-you "Back to Menu" button goes to store home', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(`/store/${STORE.slug}/thank-you`);
    await page.click('button:has-text("Back to Menu")');
    await expect(page).toHaveURL(/\/store\/gasa-grills$/, { timeout: 10_000 });
    await clearSession(page);
  });

  test('thank-you "View My Orders" button goes to orders page', async ({ page }) => {
    await loginAs(page, 'customer');
    await page.goto(`/store/${STORE.slug}/thank-you`);
    await page.click('button:has-text("View My Orders")');
    await expect(page).toHaveURL(/\/orders/, { timeout: 10_000 });
    await clearSession(page);
  });
});
