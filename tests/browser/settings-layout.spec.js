/**
 * Every Settings screen has the same content width as Integrations, and Logs
 * is a section panel with Activity, Webhooks and API.
 */
const { test, expect } = require('@playwright/test');
const { loginPage } = require('./helpers');

const SETTINGS = '/wp-admin/admin.php?page=subtleforms-settings';

for (const width of [1440, 1024, 390]) {
  test(`all Settings screens share one content width at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginPage(page);
    const widths = {};
    for (const tab of ['general', 'frontend', 'email', 'advanced', 'extensions', 'logs', 'tools']) {
      await page.goto(`${SETTINGS}#tab=${tab}`);
      await page.reload();
      const content = page.locator('.sf-settings__content');
      await expect(content).toBeVisible({ timeout: 30000 });
      await expect(page.locator(`.sf-settings__panel--${tab}`)).toBeVisible();
      widths[tab] = Math.round((await content.boundingBox()).width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    expect(new Set(Object.values(widths)).size).toBe(1);
  });
}

test('Logs lists Activity, Webhooks and API, each with a header', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage(page);
  await page.goto(`${SETTINGS}#tab=logs`);
  const list = page.locator('.sf-section-panel__list');
  await expect(list).toBeVisible({ timeout: 30000 });
  for (const name of ['Activity', 'Webhooks', 'API']) {
    await list.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.sf-section-header h2')).toHaveText(name);
  }
});
