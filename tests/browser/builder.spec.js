/**
 * 2.2.1 builder fixes.
 *
 * - bug 7: a single checkbox saved with options opens as Multiple choice with a notice
 * - bug 8/9/10: empty matrix, calculation without a formula and empty
 *   disclaimer show a placeholder on the canvas
 * - bug 12: a published form shows "Published" and edits show "changes not
 *   live". Update saves without asking again. The first Publish still asks.
 * - bug 13: the width button has an accessible name that follows the width
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, openBuilder } = require('./helpers');

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

test('published status, publish dialog and width button name (bugs 12, 13)', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Builder status',
    fields: [
      { id: 'b1', key: 'first_name', type: 'text', label: 'First name', required: true },
      { id: 'b2', key: 'last_name', type: 'text', label: 'Last name' },
    ],
  });
  created.push(form);

  await loginPage(page);
  await openBuilder(page, form.id);

  const badge = page.locator('.sf-builder-header-bar__mode-badge');
  await expect(badge).toHaveText(/^Published$/);

  // Width button: named for screen readers, and the name follows the width.
  const chrome = page.locator('.sf-field-chrome').first();
  await chrome.click();
  const widthButton = chrome.locator('.sf-field-toolbar__width > button');
  await expect(widthButton).toHaveAttribute('aria-label', 'Field width: Full');
  await widthButton.click();
  await page.locator('.sf-field-toolbar__width-option[aria-label="Half"]').click();
  await expect(widthButton).toHaveAttribute('aria-label', 'Field width: Half');

  // The edit makes the live form out of date.
  await expect(badge).toContainText('changes not live');

  // Update on a form that is already live saves. It does not ask again.
  await page.locator('.sf-builder-header-bar__publish-button').click();
  await expect(page.getByText('Push your changes live?')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(badge).toHaveText(/^Published$/, { timeout: 20000 });
});

test('a draft form shows Draft and the first-publish dialog', async ({ page }) => {
  const res = await client.call('POST', '/forms', { title: 'Builder draft' });
  const id = res.body.data.id;
  await client.call('POST', `/forms/${id}/schema`, {
    activate: false,
    schema: {
      schema_version: 1,
      metadata: { type: 'regular', name: 'Builder draft', title: 'Builder draft' },
      fields: [{ id: 'd1', key: 'email', type: 'email', label: 'Email' }],
    },
  });
  created.push({ id });

  await loginPage(page);
  await openBuilder(page, id);
  await expect(page.locator('.sf-builder-header-bar__mode-badge')).toHaveText(/^Draft$/);
  await page.locator('.sf-builder-header-bar__publish-button').click();
  await expect(page.getByText('Publishing this form will make it visible on the frontend')).toBeVisible();
});

test('placeholders and checkbox conversion on the canvas (bugs 7, 8, 9, 10)', async ({ page }) => {
  const res = await client.call('POST', '/forms', { title: 'Builder placeholders' });
  const id = res.body.data.id;
  await client.call('POST', `/forms/${id}/schema`, {
    activate: false,
    schema: {
      schema_version: 1,
      metadata: { type: 'regular', name: 'Builder placeholders', title: 'Builder placeholders' },
      fields: [
        { id: 'p1', key: 'calc', type: 'calculation', label: 'Total', formula: '' },
        { id: 'p2', key: 'note', type: 'disclaimer', label: 'Note', content: '' },
        { id: 'p3', key: 'grid', type: 'checkbox_grid', label: 'Grid', rows: [], columns: [] },
      ],
    },
  });
  // The server no longer accepts a single checkbox with options, so the
  // older saved shape is added to the builder's copy on the way in.
  await page.route(`**/subtleforms/v1/forms/${id}/schema*`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    const json = await response.json();
    json.data.schema.fields.push({
      id: 'p4',
      key: 'extras',
      type: 'checkbox',
      label: 'Extras',
      options: [
        { label: 'Gift wrap', value: 'gift' },
        { label: 'Card', value: 'card' },
      ],
    });
    await route.fulfill({ response, json });
  });
  created.push({ id });

  await loginPage(page);
  await openBuilder(page, id);

  await expect(page.getByText('Add a formula in the field settings')).toBeVisible();
  await expect(page.getByText(/Add the disclaimer text in the field settings/)).toBeVisible();
  await expect(page.getByText('Add at least one row and one column in the field settings.')).toBeVisible();
  await expect(page.locator('.sf-form-editor__conversions')).toContainText('"Extras" was a single checkbox with a list of options');
  // No fake 0.00 result and no "unsupported" disclaimer.
  await expect(page.locator('.sf-field-renderer__calculation-value')).toHaveCount(0);
  await expect(page.getByText('Unsupported field (legacy)')).toHaveCount(0);
});

test('new matrix fields come with two rows and three columns (bug 8)', async () => {
  const res = await client.call('GET', '/fields');
  const list = res.body?.data?.fields ?? res.body?.data ?? [];
  const all = Array.isArray(list) ? list : Object.values(list).flat();
  const grid = all.find((f) => f.type === 'checkbox_grid');
  expect(grid).toBeTruthy();
  const attrs = grid.fieldSpecificAttributes || grid.defaultConfig || {};
  expect(attrs.rows).toHaveLength(2);
  expect(attrs.columns).toHaveLength(3);
});

test('email merge tags: Insert tag menu and help (2.3.0 feature 18)', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Merge tag menu',
    fields: [
      { id: 'n', key: 'name', type: 'text', label: 'Name' },
      { id: 'p', key: 'pw', type: 'password', label: 'Password' },
    ],
    actions: [{ type: 'email', settings: { to: '{admin_email}', subject: 'New entry', message: 'Hello ' } }],
  });
  created.push(form);

  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('#sf-builder-view-settings').click();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();

  const action = page.locator('.sf-actions-panel__item--email').first();
  const message = action.getByLabel('Message', { exact: true });
  await message.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Insert tag into Message' }).click();
  // Passwords are never offered.
  await expect(page.getByRole('menuitem', { name: /Password/ })).toHaveCount(0);
  await page.getByRole('menuitem', { name: /All fields/ }).click();
  await expect(message).toHaveValue('Hello {all_fields}');

  await page.getByRole('button', { name: 'Insert tag into Subject' }).click();
  await page.getByRole('menuitem', { name: /^Name/ }).click();
  await expect(action.getByLabel('Subject', { exact: true })).toHaveValue(/\{field:name\}/);

  await page.getByRole('button', { name: 'About merge tags' }).click();
  const dialog = page.getByRole('dialog', { name: 'Email merge tags' });
  await expect(dialog).toContainText('{entry_id}');
  await expect(dialog).toContainText('{field:key}');
  await expect(dialog).toContainText('Double braces work too');
});
