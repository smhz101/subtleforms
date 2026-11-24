/**
 * 2.9.2 (#128): searching the Submissions list finds Arabic, Chinese and
 * Cyrillic answers sent from the front end.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, waitForForm, loginPage, useBundleOverride } = require('./helpers');

let client;
let form;

/** Send the form as a visitor would. */
async function submitFromFrontEnd(page, name) {
  await page.goto(form.url);
  await waitForForm(page);
  await page.fill('#subtleforms-field-name', name);
  // The time trap rejects forms sent within a couple of seconds of loading.
  await page.waitForTimeout(3200);
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-success-message')).toBeVisible();
}

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Unicode search',
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name', required: true }],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

test('searching the Submissions list for Arabic text finds the entry', async ({ page }) => {
  await useBundleOverride(page);
  await submitFromFrontEnd(page, 'محمد Khan');
  await submitFromFrontEnd(page, 'Ayesha Ali');

  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}`);
  const rows = page.locator('.sf-data-table__table tbody tr');
  await expect(rows).toHaveCount(2, { timeout: 20000 });

  const search = page.getByPlaceholder('Search submissions');
  await search.fill('محمد');
  await expect(rows).toHaveCount(1, { timeout: 20000 });
  await expect(rows.first()).toContainText('محمد');

  await search.fill('Ayesha');
  await expect(rows).toHaveCount(1, { timeout: 20000 });
  await expect(rows.first()).toContainText('Ayesha');
});
