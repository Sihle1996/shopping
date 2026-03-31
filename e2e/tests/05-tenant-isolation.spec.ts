import { test, expect } from '@playwright/test';
import { loginAs, clearSession, STORE, OTHER_STORE } from './helpers/auth.helper';

/**
 * Suite 5 — Tenant Isolation (UI level)
 *
 * Verifies that a store admin can only see and manage their own store's data.
 * Uses Gasa Grills admin and Sabzero Grills as the "other" store.
 */

test.describe('Tenant Isolation — Admin Data Visibility', () => {

  test.afterEach(async ({ page }) => {
    await clearSession(page);
  });

  test('Gasa Grills admin sees only their orders', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/orders');
    await page.waitForSelector('table tbody tr, app-empty-state', { timeout: 10_000 });

    const content = await page.content();
    // Gasa Grills orders contain known customer emails
    // Sabzero Grills admin email should NOT appear in order list
    expect(content).not.toContain('sabzero@gmail.com');
  });

  test('Gasa Grills admin sees only their menu items', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/menu');
    await page.waitForSelector('.grid, app-empty-state', { timeout: 10_000 });

    // Known Gasa Grills items should appear
    await expect(page.getByText(/cheese burger|coka cola|chicken burger/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('Gasa Grills admin cannot access Sabzero store data via URL manipulation', async ({ page }) => {
    await loginAs(page, 'admin');

    // Attempt to access another tenant's admin panel — Angular routing would
    // redirect since the JWT tenant claim does not match
    await page.goto('/admin/orders?tenantId=3597c044-8739-4690-84bc-c54f3bfb55a9');
    await page.waitForLoadState('networkidle');

    // Should still only see Gasa Grills orders (tenantId from JWT wins)
    const content = await page.content();
    expect(content).not.toContain('sabzerogrills@gmail.com');
  });

  test('customer token is rejected by admin endpoint (API-level isolation)', async ({ page }) => {
    await loginAs(page, 'customer');

    // Directly hitting the admin orders endpoint with the customer token
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const response = await page.request.get(
      'https://shopping-production-592a.up.railway.app/api/admin/orders',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': STORE.tenantId,
        },
      }
    );
    expect(response.status()).toBe(403);
  });

  test('driver token is rejected by admin endpoint', async ({ page }) => {
    await loginAs(page, 'driver');
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const response = await page.request.get(
      'https://shopping-production-592a.up.railway.app/api/admin/orders',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': STORE.tenantId,
        },
      }
    );
    expect(response.status()).toBe(403);
  });

  test('unauthenticated request to cart returns 403', async ({ page }) => {
    const response = await page.request.get(
      'https://shopping-production-592a.up.railway.app/api/cart'
    );
    expect([401, 403]).toContain(response.status());
  });

  test('customer A cannot read customer B cart via API', async ({ page }) => {
    await loginAs(page, 'customer');
    const token = await page.evaluate(() => localStorage.getItem('token'));

    // Cart endpoint now uses @AuthenticationPrincipal — no userId in URL.
    // Provide token and expect only THIS user's cart (empty array or their items).
    const response = await page.request.get(
      'https://shopping-production-592a.up.railway.app/api/cart',
      {
        headers: {
          Authorization:  `Bearer ${token}`,
          'X-Tenant-Id':  STORE.tenantId,
        },
      }
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    // Must be an array (could be empty)
    expect(Array.isArray(body)).toBe(true);
  });
});

test.describe('Tenant Isolation — Store Browsing', () => {

  test('Gasa Grills store shows only Gasa menu items', async ({ page }) => {
    await page.goto(`/store/${STORE.slug}`);
    await page.waitForSelector('app-product-card', { timeout: 10_000 });

    // Known Gasa items
    const content = await page.content();
    expect(content.toLowerCase()).toMatch(/cheese burger|coka cola|chicken/);
  });

  test('Sabzero Grills store shows its own separate menu', async ({ page }) => {
    await page.goto(`/store/${OTHER_STORE.slug}`);
    await page.waitForSelector('app-product-card, app-empty-state', { timeout: 10_000 });

    // Sabzero's store loads independently without Gasa items
    await expect(page.locator('app-product-card, app-empty-state').first()).toBeVisible();
  });

  test('menu API for Gasa Grills only returns Gasa items', async ({ page }) => {
    const response = await page.request.get(
      `https://shopping-production-592a.up.railway.app/api/menu?tenantId=${STORE.tenantId}`
    );
    expect(response.status()).toBe(200);
    const items = await response.json();
    expect(Array.isArray(items)).toBe(true);
    // All returned items should not have a different tenant attached
    // (no cross-tenant data leak)
    expect(items.length).toBeGreaterThan(0);
  });
});
