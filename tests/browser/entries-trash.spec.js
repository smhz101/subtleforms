/**
 * Submissions Trash (2.3.1, owner request): deleting entries moves them to a
 * Trash tab (single and bulk), with Restore and Delete permanently; trashed
 * entries leave the other tabs and counts.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage, BASE } = require('./helpers');

let client;
let form;

async function submitEntry(api, formId, name) {
  const res = await api.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: formId, data: { name, form_rendered_at: Math.floor(Date.now() / 1000) - 60 } },
  });
  expect(res.status()).toBe(200);
}

test.beforeAll(async ({ playwright }) => {
  client = await adminApi();
  form = await publishForm(client, { title: `Entries trash ${Date.now()}`, fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }] });
  const anon = await playwright.request.newContext({ baseURL: BASE });
  for (const name of ['Ada', 'Grace', 'Linus']) {
    await submitEntry(anon, form.id, name);
  }
});

test.afterAll(async () => {
  await cleanup(client, form);
});

const listUrl = () => `/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}`;
const rows = (page) => page.locator('.sf-data-table__table tbody tr');

test('single and bulk trash, Trash tab, restore and delete permanently', async ({ page }) => {
  const all = await entries(client, form.id);
  expect(all).toHaveLength(3);
  const named = (n) =>
    all.find((e) => (typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload).name === n);
  const [linus, grace, ada] = ['Linus', 'Grace', 'Ada'].map(named);

  await loginPage(page);
  await page.goto(listUrl());
  await expect(rows(page)).toHaveCount(3, { timeout: 30000 });

  // Single: Move to Trash, no "cannot be undone" warning, with Undo.
  await rows(page).filter({ hasText: 'Linus' }).getByRole('button', { name: 'Move to Trash' }).click();
  await expect(page.getByText('1 entry moved to the Trash').first()).toBeVisible();
  await expect(rows(page)).toHaveCount(2);

  // Bulk: the other two.
  await page.getByRole('checkbox', { name: `Select row ${grace.id}`, exact: true }).check();
  await page.getByRole('checkbox', { name: `Select row ${ada.id}`, exact: true }).check();
  await page.locator('.sf-data-table__bulk-actions').getByRole('button', { name: 'Move to Trash' }).click();
  await expect(page.getByText('2 entries moved to the Trash').first()).toBeVisible();

  // Counts and lists leave trashed entries out.
  await expect.poll(async () => (await entries(client, form.id)).length).toBe(0);

  // Trash tab lists them with Restore and Delete permanently.
  await page.getByRole('tab', { name: /^Trash/ }).click();
  await expect(rows(page)).toHaveCount(3);
  const adaRow = rows(page).filter({ hasText: 'Ada' });
  await expect(adaRow.getByRole('button', { name: 'Restore' })).toBeVisible();
  await expect(adaRow.getByRole('button', { name: 'Delete permanently' })).toBeVisible();
  await page.screenshot({ path: '/home/claude/shots/free231/entries-trash-tab.png' });

  // Restore one: it returns with its previous status.
  await adaRow.getByRole('button', { name: 'Restore' }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect.poll(async () => (await entries(client, form.id)).length).toBe(1);
  const back = await entries(client, form.id);
  expect(back.map((e) => String(e.id))).toEqual([String(ada.id)]);
  expect(back[0].status).toBe(ada.status);

  // Delete one permanently, with confirmation.
  await rows(page).filter({ hasText: 'Grace' }).getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('dialog')).toContainText('cannot be undone');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete permanently' }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect.poll(async () => (await client.call('GET', `/submissions/${grace.id}`)).status).toBe(404);

  // Bulk restore from the Trash.
  await page.getByRole('checkbox', { name: `Select row ${linus.id}`, exact: true }).check();
  await page.locator('.sf-data-table__bulk-actions').getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByText('1 entry restored').first()).toBeVisible();
  await expect
    .poll(async () => (await entries(client, form.id)).map((e) => String(e.id)).sort())
    .toEqual([String(ada.id), String(linus.id)].sort());
});

test('the entry screen moves an entry to the Trash and restores it', async ({ page }) => {
  const [entry] = await entries(client, form.id);
  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&submission_id=${entry.id}&form_id=${form.id}`);
  await page.getByRole('button', { name: 'Move to Trash' }).click();
  await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
  const stored = await client.call('GET', `/submissions/${entry.id}`);
  expect((stored.body.data || stored.body).status).toBe('trash');

  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&submission_id=${entry.id}&form_id=${form.id}`);
  await expect(page.locator('.sf-pill', { hasText: 'Trashed' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('.sf-pill', { hasText: 'Trashed' })).toHaveCount(0);
});
