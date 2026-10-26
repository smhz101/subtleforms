/**
 * COMPAT5-01: Flag and Flagged on the entry detail toggle the entry and do not
 * throw a page error.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage, spamToken } = require('./helpers');

let client;
let form;

test.beforeAll(async ({ playwright }) => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Flag toggle',
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }],
  });
  const anon = await playwright.request.newContext({ baseURL: process.env.SF_BASE_URL || 'http://localhost:8899' });
  const res = await anon.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: form.id, data: { name: 'Ada', form_rendered_at: await spamToken(anon, form.id) } },
  });
  expect(res.status(), await res.text()).toBe(200);
  await anon.dispose();
});

test.afterAll(async () => {
  await cleanup(client, form);
});

test('Flag then Flagged on the entry detail flags and unflags the entry', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}`);
  const rows = page.locator('.sf-data-table__table tbody tr');
  await expect(rows).toHaveCount(1, { timeout: 20000 });
  await rows.first().click();

  // The list rows have their own Flag button; the detail pane is the target.
  const detail = page.locator('.sf-inbox-entry');
  await expect(detail).toBeVisible();

  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

  const status = async () => (await entries(client, form.id))[0]?.status;

  await detail.getByRole('button', { name: 'Flag', exact: true }).click();
  await expect.poll(status).toBe('flagged');
  await expect(detail.getByRole('button', { name: 'Flagged', exact: true })).toBeVisible();

  await detail.getByRole('button', { name: 'Flagged', exact: true }).click();
  await expect.poll(status).not.toBe('flagged');
  await expect(detail.getByRole('button', { name: 'Flag', exact: true })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
