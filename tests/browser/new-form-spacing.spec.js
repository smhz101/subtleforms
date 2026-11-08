/**
 * The New form screen sits 20px under the page header, like the other screens.
 */
const { test, expect } = require('@playwright/test');
const { loginPage } = require('./helpers');

test('the New form page has 20px of space above its content', async ({ page }) => {
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-new-form');
  const root = page.locator('.sf-new-form').first();
  await expect(root).toBeVisible({ timeout: 30000 });
  const top = await root.evaluate((el) => window.getComputedStyle(el).paddingTop);
  expect(top).toBe('20px');
});
