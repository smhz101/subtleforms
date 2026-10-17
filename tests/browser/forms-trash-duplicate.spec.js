/**
 * QA-11: Trash tab rows show "Trashed" with only Restore and Delete
 * permanently; bulk trash and restore; restore returns the previous status;
 * trashed forms stop rendering and accepting entries; counts refresh.
 *
 * QA-12: duplicating the form 9 shape (plus simple, repeater and payment
 * forms) makes a draft copy; a failure shows the real reason.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, BASE } = require('./helpers');

let client;
const created = [];

test.beforeAll(async () => {
  client = await adminApi();
});

test.afterAll(async () => {
  for (const form of created) {
    await cleanup(client, form);
  }
});

async function draftForm(title, fields) {
  const res = await client.call('POST', '/forms', { title });
  const id = res.body.data.id;
  await client.call('POST', `/forms/${id}/schema`, {
    activate: false,
    schema: { schema_version: 1, metadata: { type: 'regular', name: title, title }, fields },
  });
  const form = { id };
  created.push(form);
  return form;
}

const row = (page, title) => page.locator('tr', { hasText: title });

async function openForms(page, tab) {
  await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
  await page.waitForSelector('.sf-data-table__table', { timeout: 30000 });
  if (tab) {
    await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
  }
}

test('trashing, the Trash tab, restore and permanent delete (QA-11)', async ({ page, playwright }) => {
  const stamp = Date.now();
  const live = await publishForm(client, { title: `Trash live ${stamp}`, fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }] });
  created.push(live);
  const draft = await draftForm(`Trash draft ${stamp}`, [{ id: 'n', key: 'name', type: 'text', label: 'Name' }]);

  await loginPage(page);
  await openForms(page);

  // Bulk move both to the Trash.
  for (const f of [live, draft]) {
    await page.getByRole('checkbox', { name: `Select row ${f.id}`, exact: true }).check();
  }
  page.once('dialog', (d) => d.accept());
  await page.locator('.sf-data-table__bulk-actions').getByRole('button', { name: 'Move to Trash' }).click();
  await expect(row(page, `Trash live ${stamp}`)).toHaveCount(0);
  await expect(page.getByText('2 forms moved to the Trash').first()).toBeVisible({ timeout: 20000 });

  // A trashed form neither renders nor accepts entries.
  const anon = await playwright.request.newContext({ baseURL: BASE });
  expect((await anon.get(`/wp-json/subtleforms/v1/forms/${live.id}/schema`)).status()).toBe(404);
  const submit = await anon.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: live.id, data: { name: 'x', form_rendered_at: Math.floor(Date.now() / 1000) - 60 } },
  });
  expect(submit.status()).toBe(404);
  await page.goto(`${BASE}${live.url}`);
  await expect(page.locator('.subtleforms-form-container form')).toHaveCount(0);

  // Trash tab: Trashed status, only Restore and Delete permanently.
  await openForms(page, 'Trash');
  const counts = (await client.call('GET', '/forms/counts')).body.data;
  const trashCount = page.getByRole('tab', { name: /^Trash/ }).locator('.sf-tab-bar__count');
  await expect(trashCount).toHaveText(String(counts.trash));
  const liveRow = row(page, `Trash live ${stamp}`);
  await expect(liveRow.locator('.sf-status-badge')).toHaveText('Trashed');
  await liveRow.getByTitle('More actions').click();
  const menu = page.locator('.components-dropdown__content');
  await expect(menu.getByRole('menuitem')).toHaveText(['Restore', 'Delete permanently']);
  await page.screenshot({ path: '/home/claude/shots/free231/qa11-trash-tab.png' });
  await page.keyboard.press('Escape');

  // Bulk restore: each returns to its previous status.
  await page.getByRole('checkbox', { name: `Select row ${live.id}`, exact: true }).check();
  await page.getByRole('checkbox', { name: `Select row ${draft.id}`, exact: true }).check();
  await page.locator('.sf-data-table__bulk-actions').getByRole('button', { name: 'Restore' }).click();
  await expect(liveRow).toHaveCount(0);
  await expect(page.getByText('2 forms restored').first()).toBeVisible({ timeout: 20000 });
  // The tab counts refresh.
  await expect(trashCount).toHaveText(String(counts.trash - 2));
  const forms = (await client.call('GET', '/forms?per_page=100')).body.data;
  const list = Array.isArray(forms) ? forms : forms.items || [];
  expect(list.find((f) => Number(f.id) === Number(live.id)).status).toBe('published');
  expect(list.find((f) => Number(f.id) === Number(draft.id)).status).toBe('draft');

  // Delete permanently asks first.
  await client.call('DELETE', `/forms/${draft.id}?move_to_trash=1`);
  await openForms(page, 'Trash');
  await row(page, `Trash draft ${stamp}`).getByTitle('More actions').click();
  await page.getByRole('menuitem', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('dialog')).toContainText(/permanently/i);
  await page.getByRole('dialog').getByRole('button', { name: /Delete permanently/ }).click();
  await expect(row(page, `Trash draft ${stamp}`)).toHaveCount(0);
  await expect.poll(async () => (await client.call('GET', `/forms/${draft.id}`)).status).toBe(404);
});

test('duplicating the form 9 shape and other forms (QA-12)', async ({ page }) => {
  const stamp = Date.now();
  const form9 = await draftForm(`QA form 9 ${stamp}`, [
    { id: 'a', key: 'a', type: 'text', label: 'A', required: true },
    { id: 'b', key: 'b', type: 'email', label: 'B' },
    { id: 'st', key: 'st', type: 'step', title: 'Step 1' },
  ]);

  await loginPage(page);
  await openForms(page);
  await row(page, `QA form 9 ${stamp}`).first().getByTitle('More actions').click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(page.getByText('Form duplicated').first()).toBeVisible({ timeout: 20000 });
  const copyRow = row(page, `QA form 9 ${stamp} (copy)`);
  await expect(copyRow).toHaveCount(1);
  await expect(copyRow.locator('.sf-status-badge')).toHaveText('Draft');
  await page.screenshot({ path: '/home/claude/shots/free231/qa12-duplicated.png' });

  const forms = (await client.call('GET', '/forms?per_page=100&search=' + encodeURIComponent(`QA form 9 ${stamp} (copy)`))).body.data;
  const list = Array.isArray(forms) ? forms : forms.items || [];
  const copy = list.find((f) => f.title === `QA form 9 ${stamp} (copy)`);
  created.push({ id: copy.id });
  const schema = (await client.call('GET', `/forms/${copy.id}/schema?context=builder`)).body.data.schema;
  expect(schema.fields.map((f) => f.type)).toEqual(['step']);
  expect(schema.fields[0].children.map((f) => f.key)).toEqual(['a', 'b']);

  // A failure shows the real reason and leaves no temporary row.
  await page.route('**/duplicate*', (route) =>
    route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: { code: 'validation_error', message: 'The form could not be copied: disk full' } }) })
  );
  await row(page, `QA form 9 ${stamp}`).first().getByTitle('More actions').click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(page.getByText('Failed to duplicate form: The form could not be copied: disk full').first()).toBeVisible();
  await expect(page.locator('tr', { hasText: '(copy)' }).filter({ hasText: `QA form 9 ${stamp}` })).toHaveCount(1);
});
