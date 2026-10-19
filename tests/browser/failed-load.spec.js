/**
 * Review #21: a failed reload keeps the rows on screen only when it was a
 * retry of the same query. A failed switch to another tab clears them, so
 * Published forms or Inbox entries are never shown, and actionable, under
 * the Trash tab.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, BASE, spamToken } = require('./helpers');

let client;
let form;
const title = `Failed load ${Date.now()}`;

test.beforeAll(async ({ playwright }) => {
  client = await adminApi();
  form = await publishForm(client, { title, fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }] });
  const anon = await playwright.request.newContext({ baseURL: BASE });
  const res = await anon.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: form.id, data: { name: 'Stale Ada', form_rendered_at: await spamToken(anon, form.id) } },
  });
  expect(res.status()).toBe(200);
});

test.afterAll(async () => {
  await cleanup(client, form);
});

/** Fail every list request for the Trash tab of one REST collection. */
async function failTrash(page, collection) {
  await page.route(
    (url) => {
      const href = decodeURIComponent(url.toString());
      return href.includes(`subtleforms/v1/${collection}`) && /[?&]status=trash(&|$)/.test(href);
    },
    (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"boom"}' })
  );
}

test('forms list: a failed switch to Trash does not keep the Published forms', async ({ page }) => {
  await loginPage(page);
  await failTrash(page, 'forms');
  await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
  const liveRow = page.locator('tr', { hasText: title });
  await expect(liveRow).toBeVisible({ timeout: 30000 });

  await page.getByRole('tab', { name: /^Trash/ }).click();
  await expect(page.getByText('Forms could not be loaded.').first()).toBeVisible();
  await expect(liveRow).toHaveCount(0);
});
