import { Page } from '@playwright/test';

export const TEST_ACCOUNTS = {
  customer: { email: 'mofokengsihle63@gmail.com', password: '123456' },
  admin:    { email: 'gasa@gmail.com',             password: '123456' },
  driver:   { email: 'messi@gmail.com',            password: '123456' },
};

export const STORE = {
  slug:     'gasa-grills',
  name:     'Gasa Grills',
  tenantId: 'cf0e7da3-e835-4333-ac44-e5575d39c25a',
};

export const OTHER_STORE = {
  slug: 'sabzero-grills',
  name: 'Sabzero Grills',
};

/**
 * Log in via the UI login form and wait for redirect.
 */
export async function loginAs(page: Page, role: keyof typeof TEST_ACCOUNTS) {
  const { email, password } = TEST_ACCOUNTS[role];

  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('input[type="email"]', { timeout: 20_000 });

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"], app-button[type="submit"] button');

  // Wait for navigation away from /login
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 20_000 });
}

/**
 * Inject a JWT directly into localStorage to skip the UI login flow (faster).
 */
export async function injectToken(page: Page, token: string, tenantId: string, storeSlug: string) {
  await page.goto('/');
  await page.evaluate(
    ({ token, tenantId, storeSlug }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('tenantId', tenantId);
      localStorage.setItem('storeSlug', storeSlug);
    },
    { token, tenantId, storeSlug }
  );
}

export async function clearSession(page: Page) {
  try {
    await page.evaluate(() => localStorage.clear());
  } catch {
    // Page not yet on app origin (blank page) — navigate first
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  }
}
