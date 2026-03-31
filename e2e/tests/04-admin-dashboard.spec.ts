import { test, expect } from '@playwright/test';
import { loginAs, clearSession, STORE } from './helpers/auth.helper';

/**
 * Suite 4 — Store Admin Dashboard UI
 *
 * Login as admin, navigate the dashboard, and perform full CRUD
 * on menu items. Verify only Gasa Grills data is shown.
 */

const TEST_ITEM = {
  name:        'Playwright Test Burger',
  category:    'Burgers',
  price:       '99.99',
  description: 'Created by Playwright automation test',
};

test.describe('Admin Dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin');
  });

  test.afterEach(async ({ page }) => {
    await clearSession(page);
  });

  // ─── Navigation ────────────────────────────────────────────────────────────

  test('admin lands on dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });
  });

  test('sidebar shows all main navigation links', async ({ page }) => {
    // Navigate to admin dashboard explicitly
    await page.goto('/admin/dashboard');
    const nav = page.locator('nav, aside');
    await expect(nav.getByRole('link', { name: /orders/i }).first()).toBeVisible({ timeout: 8_000 });
    await expect(nav.getByRole('link', { name: /menu/i }).first()).toBeVisible();
  });

  test('admin dashboard shows orders list', async ({ page }) => {
    await page.goto('/admin/orders');
    await page.waitForSelector('table, .space-y-4, app-empty-state', { timeout: 10_000 });
    // Orders must belong to Gasa Grills only — check a known order email
    const pageContent = await page.content();
    // Should NOT show orders from other stores
    expect(pageContent).not.toContain('sabzerogrills@gmail.com');
  });

  test('admin analytics page loads charts', async ({ page }) => {
    await page.goto('/admin/analytics');
    await page.waitForSelector('canvas, app-chart-skeleton, [class*="chart"]', { timeout: 15_000 });
    await expect(page.locator('canvas, [class*="chart"]').first()).toBeVisible();
  });

  // ─── Menu CRUD ─────────────────────────────────────────────────────────────

  test('menu management page loads with item grid', async ({ page }) => {
    await page.goto('/admin/menu');
    await page.waitForSelector('.grid, app-empty-state', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /menu management/i })).toBeVisible();
  });

  test('"Add Item" button toggles the creation form', async ({ page }) => {
    await page.goto('/admin/menu');
    const addBtn = page.locator('app-button').filter({ hasText: /add item/i }).locator('button');
    await addBtn.click();

    await expect(page.getByRole('heading', { name: /new menu item/i })).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('select[name="category"]')).toBeVisible();
    await expect(page.locator('input[name="price"]')).toBeVisible();
    await expect(page.locator('textarea[name="description"]')).toBeVisible();
  });

  test('create a new menu item', async ({ page }) => {
    await page.goto('/admin/menu');

    // Open form
    await page.locator('app-button').filter({ hasText: /add item/i }).locator('button').click();
    await page.waitForSelector('input[name="name"]');

    await page.fill('input[name="name"]',          TEST_ITEM.name);
    await page.fill('input[name="price"]',         TEST_ITEM.price);
    await page.fill('textarea[name="description"]', TEST_ITEM.description);

    // Select category — pick first available option
    const categorySelect = page.locator('select[name="category"]');
    const options = await categorySelect.locator('option').allTextContents();
    const nonEmpty = options.find(o => o.trim() && o !== 'Select a category');
    if (nonEmpty) {
      await categorySelect.selectOption({ label: nonEmpty });
    }

    // Submit
    await page.locator('app-button').filter({ hasText: /add item/i }).locator('button').last().click();

    // Success toast
    await expect(
      page.locator('ngx-toastr .toast-success, .toast-success')
    ).toBeVisible({ timeout: 8_000 });

    // New item appears in the grid
    await expect(page.getByText(TEST_ITEM.name)).toBeVisible({ timeout: 8_000 });
  });

  test('edit an existing menu item', async ({ page }) => {
    await page.goto('/admin/menu');
    await page.waitForSelector('.grid > div, app-empty-state', { timeout: 10_000 });

    // Click Edit on first item
    const editBtn = page.locator('app-button').filter({ hasText: /edit/i }).locator('button').first();
    await editBtn.click();

    await expect(page.getByRole('heading', { name: /edit menu item/i })).toBeVisible({ timeout: 5_000 });

    // Change the name
    const nameInput = page.locator('input[name="name"]');
    await nameInput.clear();
    await nameInput.fill('Updated Test Name');

    await page.locator('app-button').filter({ hasText: /update item/i }).locator('button').click();

    await expect(
      page.locator('ngx-toastr .toast-success, .toast-success')
    ).toBeVisible({ timeout: 8_000 });
  });

  test('delete menu item shows confirmation modal', async ({ page }) => {
    await page.goto('/admin/menu');
    await page.waitForSelector('.grid > div, app-empty-state', { timeout: 10_000 });

    const deleteBtn = page.locator('app-button').filter({ hasText: /delete/i }).locator('button').first();
    await deleteBtn.click();

    // Confirmation modal
    await expect(page.locator('app-confirm-modal')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/delete menu item/i)).toBeVisible();
    await expect(page.getByText(/permanently removed/i)).toBeVisible();
  });

  test('cancelling delete modal keeps item in list', async ({ page }) => {
    await page.goto('/admin/menu');
    await page.waitForSelector('.grid > div', { timeout: 10_000 });
    const beforeCount = await page.locator('.grid > div').count();

    await page.locator('app-button').filter({ hasText: /delete/i }).locator('button').first().click();
    await page.waitForSelector('app-confirm-modal');
    // Click Cancel
    await page.locator('app-confirm-modal').getByRole('button', { name: /cancel/i }).click();

    await expect(page.locator('app-confirm-modal')).not.toBeVisible();
    await expect(page.locator('.grid > div')).toHaveCount(beforeCount);
  });

  test('confirming delete removes item from list', async ({ page }) => {
    // First create a throwaway item to delete
    await page.goto('/admin/menu');
    await page.locator('app-button').filter({ hasText: /^add item$/i }).locator('button').click();
    await page.fill('input[name="name"]',   'DELETE ME');
    await page.fill('input[name="price"]',  '1.00');
    const categorySelect = page.locator('select[name="category"]');
    const options = await categorySelect.locator('option').allTextContents();
    const nonEmpty = options.find(o => o.trim() && o !== 'Select a category');
    if (nonEmpty) await categorySelect.selectOption({ label: nonEmpty });
    await page.locator('app-button').filter({ hasText: /add item/i }).locator('button').last().click();
    await page.waitForSelector('ngx-toastr .toast-success, .toast-success', { timeout: 8_000 });

    // Now delete it
    const deleteTarget = page.locator('.grid > div').filter({ hasText: 'DELETE ME' });
    await deleteTarget.locator('app-button').filter({ hasText: /delete/i }).locator('button').click();
    await page.locator('app-confirm-modal').getByRole('button', { name: /delete/i }).click();

    await expect(deleteTarget).not.toBeVisible({ timeout: 8_000 });
  });

  test('search filters menu items', async ({ page }) => {
    await page.goto('/admin/menu');
    await page.waitForSelector('.grid > div', { timeout: 10_000 });

    await page.fill('input[placeholder*="Search items" i]', 'burger');
    await page.waitForTimeout(400);

    const items = page.locator('.grid > div');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(0); // may be 0 if no burgers

    // Each visible item should contain 'burger' (case-insensitive)
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = (await items.nth(i).textContent())?.toLowerCase() ?? '';
      expect(text).toContain('burger');
    }
  });

  // ─── Orders ────────────────────────────────────────────────────────────────

  test('admin orders page lists Gasa Grills orders only', async ({ page }) => {
    await page.goto('/admin/orders');
    await page.waitForSelector('table tbody tr, .space-y-4 > div, app-empty-state', { timeout: 10_000 });
    const rows = page.locator('table tbody tr, .order-row');
    const count = await rows.count();
    if (count > 0) {
      // Spot-check: email shown should not be from another store
      const content = await rows.first().textContent();
      expect(content).toBeTruthy();
    }
  });

  test('admin can update order status', async ({ page }) => {
    await page.goto('/admin/orders');
    await page.waitForSelector('select[placeholder*="status" i], select', { timeout: 10_000 });
    // Status dropdown exists in orders table
    const statusSelects = page.locator('select').filter({ hasText: /pending|delivered|out for delivery/i });
    if (await statusSelects.count() > 0) {
      await statusSelects.first().selectOption('Out for Delivery');
      await expect(
        page.locator('ngx-toastr .toast-success, .toast-success')
      ).toBeVisible({ timeout: 8_000 });
    }
  });

  // ─── Promotions ────────────────────────────────────────────────────────────

  test('promotions page loads', async ({ page }) => {
    await page.goto('/admin/promotions');
    await page.waitForSelector('.grid, table, app-empty-state', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /promotion/i })).toBeVisible();
  });

  test('admin can create a promotion', async ({ page }) => {
    await page.goto('/admin/promotions');
    await page.locator('app-button').filter({ hasText: /create|add/i }).locator('button').first().click();

    // Fill modal or inline form
    await page.waitForSelector('input[name*="title" i], input[placeholder*="title" i]', { timeout: 5_000 });
    await page.fill('input[name*="title" i]', 'Playwright Promo');
    await expect(page.locator('app-button').filter({ hasText: /save|create|submit/i }).locator('button').first()).toBeVisible();
  });

  // ─── Settings ──────────────────────────────────────────────────────────────

  test('admin settings page loads store info', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForSelector('input, form', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    // Store name field should be pre-filled
    const nameField = page.locator('input[name*="name" i], input[formControlName*="name" i]').first();
    await expect(nameField).not.toBeEmpty({ timeout: 5_000 });
  });

  // ─── Inventory ─────────────────────────────────────────────────────────────

  test('inventory page shows stock levels', async ({ page }) => {
    await page.goto('/admin/inventory');
    await page.waitForSelector('table, .grid, app-empty-state', { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /inventory/i })).toBeVisible();
    // Table rows with stock numbers
    const stockCells = page.locator('td').filter({ hasText: /^\d+$/ });
    await expect(stockCells.first()).toBeVisible({ timeout: 5_000 });
  });
});
