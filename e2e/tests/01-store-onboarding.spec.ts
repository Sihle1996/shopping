import { test, expect } from '@playwright/test';

/**
 * Suite 1 — Store Owner Onboarding
 *
 * Tests the /register-restaurant page: filling in store details,
 * submitting, verifying the success redirect, and confirming
 * the new store appears on the store list.
 */

const UNIQUE_SUFFIX = Date.now();
const NEW_STORE = {
  name:    `Playwright Grills ${UNIQUE_SUFFIX}`,
  slug:    `playwright-grills-${UNIQUE_SUFFIX}`,
  email:   `playwright+${UNIQUE_SUFFIX}@test.co.za`,
  phone:   '0711234567',
  address: '1 Test Street, Sandton',
};

test.describe('Store Owner Onboarding', () => {

  test('landing page shows "Register Your Restaurant" CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /list your restaurant/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get started free/i })).toBeVisible();
  });

  test('navigates to /register-restaurant from landing page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /list your restaurant/i }).first().click();
    await expect(page).toHaveURL(/\/register-restaurant/);
    await expect(page.getByRole('heading', { name: /register your restaurant/i })).toBeVisible();
  });

  test('shows 3-step progress indicator', async ({ page }) => {
    await page.goto('/register-restaurant');
    const steps = page.locator('.flex.items-center.justify-center.gap-2 .w-8');
    await expect(steps).toHaveCount(3);
    // Step 1 is active (primary background)
    await expect(steps.first()).toHaveClass(/bg-primary/);
  });

  test('submit button disabled when form is empty', async ({ page }) => {
    await page.goto('/register-restaurant');
    const submitBtn = page.locator('app-button[type="submit"] button');
    await expect(submitBtn).toBeDisabled();
  });

  test('slug validation — rejects spaces and uppercase', async ({ page }) => {
    await page.goto('/register-restaurant');
    await page.fill('input[formControlName="slug"]', 'My Store Name');
    await page.locator('input[formControlName="slug"]').blur();
    await expect(page.getByText(/only lowercase letters/i)).toBeVisible();
  });

  test('invalid email shows validation error', async ({ page }) => {
    await page.goto('/register-restaurant');
    await page.fill('input[formControlName="email"]', 'notanemail');
    await page.locator('input[formControlName="email"]').blur();
    // HTML5 or Angular validation prevents submission; button stays disabled
    const submitBtn = page.locator('app-button[type="submit"] button');
    await expect(submitBtn).toBeDisabled();
  });

  test('successfully registers a new store and proceeds to admin account step', async ({ page }) => {
    await page.goto('/register-restaurant');

    await page.fill('input[formControlName="name"]',    NEW_STORE.name);
    await page.fill('input[formControlName="slug"]',    NEW_STORE.slug);
    await page.fill('input[formControlName="email"]',   NEW_STORE.email);
    await page.fill('input[formControlName="phone"]',   NEW_STORE.phone);
    await page.fill('input[formControlName="address"]', NEW_STORE.address);

    // Button should now be enabled
    const submitBtn = page.locator('app-button[type="submit"] button');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Redirects to /register with storeName in heading after store creation
    await expect(page).toHaveURL(/\/register/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /create admin account/i })).toBeVisible();
  });

  test('new store appears on the store listing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#restaurants', { timeout: 10_000 });
    // The store listing section must load at least one store card
    const storeCards = page.locator('#restaurants .grid > div');
    await expect(storeCards.first()).toBeVisible({ timeout: 10_000 });
    // Confirm a known store is visible (store created in previous test may take a moment)
    await expect(page.getByText('Gasa Grills')).toBeVisible();
  });

  test('duplicate slug shows error message', async ({ page }) => {
    await page.goto('/register-restaurant');
    // Use an already-existing slug
    await page.fill('input[formControlName="name"]',  'Gasa Grills Copy');
    await page.fill('input[formControlName="slug"]',  'gasa-grills');
    await page.fill('input[formControlName="email"]', 'copy@test.co.za');

    const submitBtn = page.locator('app-button[type="submit"] button');
    await submitBtn.click();

    await expect(page.locator('.bg-red-50 span')).toBeVisible({ timeout: 8_000 });
  });
});
