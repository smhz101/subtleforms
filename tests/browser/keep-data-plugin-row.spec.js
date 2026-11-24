/**
 * 2.10.0 (#140): the Plugins screen row says what deleting SubtleForms does.
 *
 * - Keep data off: a red "Deleting removes all forms and entries." line.
 * - Keep data on: "Forms and entries are kept if the plugin is deleted."
 * - "Change" opens Settings on the Advanced tab with the toggle visible.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, loginPage } = require('./helpers');

let client;
let original = false;

async function setKeep(value) {
  const res = await client.call('PUT', '/settings', { keep_data_on_uninstall: value });
  expect(res.status).toBe(200);
}

test.beforeAll(async () => {
  client = await adminApi();
  const current = await client.call('GET', '/settings');
  original = !!(current.body && current.body.data && current.body.data.keep_data_on_uninstall);
});

test.afterAll(async () => {
  await setKeep(original);
});

function row(page) {
  return page.locator('tr[data-plugin$="subtleforms.php"]').first();
}

test('the row warns that deleting removes the data when keep data is off', async ({ page }) => {
  await setKeep(false);
  await loginPage(page);
  await page.goto('/wp-admin/plugins.php');
  const warning = row(page).locator('.subtleforms-delete-warning');
  await expect(warning).toHaveText('Deleting removes all forms and entries.');
  await expect(warning).toHaveCSS('color', 'rgb(214, 54, 56)');
  await expect(row(page).getByRole('link', { name: 'Change' })).toBeVisible();
});

test('the row says the data is kept when keep data is on', async ({ page }) => {
  await setKeep(true);
  await loginPage(page);
  await page.goto('/wp-admin/plugins.php');
  await expect(row(page)).toContainText('Forms and entries are kept if the plugin is deleted.');
  await expect(row(page).locator('.subtleforms-delete-warning')).toHaveCount(0);
  await expect(row(page).getByRole('link', { name: 'Change' })).toBeVisible();
});

test('Change opens the Advanced tab with the toggle visible', async ({ page }) => {
  await setKeep(false);
  await loginPage(page);
  await page.goto('/wp-admin/plugins.php');
  await row(page).getByRole('link', { name: 'Change' }).click();
  await expect(page).toHaveURL(/page=subtleforms-settings#tab=advanced/);
  await expect(page.getByLabel('Keep my data when the plugin is deleted')).toBeVisible();
});
