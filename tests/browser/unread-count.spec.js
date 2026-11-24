/**
 * Opening an unread entry lowers the Unread count at once and the entry
 * leaves the Unread list when the pane closes (issue 130).
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage, BASE, spamToken } = require('./helpers');

let client;
let form;

test.beforeAll(async ({ playwright }) => {
  client = await adminApi();
  form = await publishForm(client, { title: `Unread count ${Date.now()}`, fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }] });
  const anon = await playwright.request.newContext({ baseURL: BASE });
  for (const name of ['Ada', 'Grace', 'Linus']) {
    const res = await anon.post('/wp-json/subtleforms/v1/submit', {
      data: { form_id: form.id, data: { name, form_rendered_at: await spamToken(anon, form.id) } },
    });
    expect(res.status()).toBe(200);
  }
});

test.afterAll(async () => {
  await cleanup(client, form);
});

const rows = (page) => page.locator('.sf-data-table__table tbody tr, .sf-data-table__row--compact');
const unreadTab = (page) => page.getByRole('tab', { name: /^Unread/ });

test('opening unread entries lowers the Unread count and the row leaves on close', async ({ page }) => {
  expect(await entries(client, form.id)).toHaveLength(3);

  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}`);
  await unreadTab(page).click();
  await expect(rows(page)).toHaveCount(3, { timeout: 30000 });
  await expect(unreadTab(page)).toContainText('3');

  // Open the first: the count drops while the pane is open and the row
  // stays in place, shown as read.
  await rows(page).first().click();
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
  await expect(unreadTab(page)).toContainText('2');
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).first()).not.toHaveClass(/--unread/);

  // Close: the Unread list refreshes and the row is gone.
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(unreadTab(page)).toContainText('2');

  // Open the next entry and step on: each newly opened entry counts once.
  await rows(page).first().click();
  await expect(unreadTab(page)).toContainText('1');
  await page.getByRole('button', { name: 'Older submission' }).click();
  await expect(unreadTab(page)).toHaveText(/^Unread0?$/);
});
