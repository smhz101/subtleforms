/**
 * Free #145: a builder tab opened before someone else's save must not
 * overwrite their changes. The save is refused, the tab asks whether to reload
 * or replace, and a tab that keeps saving its own work is never in conflict
 * with itself.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, openBuilder } = require('./helpers');

const SHOTS = path.join(process.cwd(), 'test-results', 'shots', '145');

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

let client;
const created = [];

test.beforeAll(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  client = await adminApi();
});

test.afterAll(async () => {
  for (const form of created) {
    await cleanup(client, form);
  }
});

async function freshForm(title) {
  const form = await publishForm(client, {
    title,
    fields: [{ id: 's1', key: 'name', type: 'text', label: 'Name' }],
  });
  created.push(form);
  return form;
}

const canvas = (page) => page.locator('.sf-form-editor__canvas');
const inserter = (page, name) =>
  page.locator('.sf-inserter__item').filter({ has: page.locator('.sf-inserter__item-label', { hasText: new RegExp(`^${name}$`) }) }).first();
const badge = (page) => page.locator('.sf-builder-header-bar__mode-badge');
const conflict = (page) => page.getByRole('dialog', { name: 'This form changed somewhere else' });

async function addField(page, name) {
  const before = await page.locator('.sf-field-chrome').count();
  await inserter(page, name).click();
  await expect(page.locator('.sf-field-chrome')).toHaveCount(before + 1);
}

async function update(page) {
  await page.locator('.sf-builder-header-bar__publish-button').click();
}

async function liveKeys(id) {
  const res = await client.call('GET', `/forms/${id}/schema?context=builder`);
  return (res.body.data.schema.fields || []).map((f) => f.type);
}

async function twoTabs(browser, id) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const a = await context.newPage();
  await loginPage(a);
  await openBuilder(a, id);
  const b = await context.newPage();
  await openBuilder(b, id);
  return { context, a, b };
}

test('a stale tab is asked, and Reload latest version shows the newer save', async ({ browser }) => {
  const form = await freshForm('Stale tab reload');
  const { context, a, b } = await twoTabs(browser, form.id);

  // Tab A adds Email and updates the live form.
  await addField(a, 'Email');
  await update(a);
  await expect(badge(a)).toHaveText(/^Published$/, { timeout: 20000 });

  // Tab B, still on the old version, adds Number and updates.
  await addField(b, 'Number');
  await update(b);
  const dialog = conflict(b);
  await expect(dialog).toBeVisible({ timeout: 20000 });
  await expect(dialog).toContainText('Someone saved this form in another tab or browser after you opened it.');
  await expect(dialog.getByRole('button', { name: 'Reload latest version' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Replace with my changes' })).toBeVisible();
  await b.screenshot({ path: path.join(SHOTS, 'conflict-modal.png') });

  // Nothing of tab B reached the form.
  expect(await liveKeys(form.id)).toEqual(['text', 'email']);

  await dialog.getByRole('button', { name: 'Reload latest version' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(canvas(b).getByText('Email', { exact: true }).first()).toBeVisible({ timeout: 20000 });
  await expect(canvas(b).getByText('Number', { exact: true })).toHaveCount(0);

  // The reloaded tab can save again without a conflict.
  await addField(b, 'Number');
  await update(b);
  await expect(badge(b)).toHaveText(/^Published$/, { timeout: 20000 });
  await expect(conflict(b)).toHaveCount(0);
  expect(await liveKeys(form.id)).toEqual(['text', 'email', 'number']);

  await context.close();
});

test('Replace with my changes saves this tab and drops the other save', async ({ browser }) => {
  const form = await freshForm('Stale tab replace');
  const { context, a, b } = await twoTabs(browser, form.id);

  await addField(a, 'Email');
  await update(a);
  await expect(badge(a)).toHaveText(/^Published$/, { timeout: 20000 });

  await addField(b, 'Number');
  await update(b);
  const dialog = conflict(b);
  await expect(dialog).toBeVisible({ timeout: 20000 });
  await dialog.getByRole('button', { name: 'Replace with my changes' }).click();

  await expect(dialog).toHaveCount(0);
  await expect(badge(b)).toHaveText(/^Published$/, { timeout: 20000 });
  expect(await liveKeys(form.id)).toEqual(['text', 'number']);

  // The version this save returned is the one the tab sends next.
  await addField(b, 'Email');
  await update(b);
  await expect(badge(b)).toHaveText(/^Published$/, { timeout: 20000 });
  await expect(conflict(b)).toHaveCount(0);
  expect(await liveKeys(form.id)).toEqual(['text', 'number', 'email']);

  await context.close();
});

test('closing the modal keeps the changes unsaved', async ({ browser }) => {
  const form = await freshForm('Stale tab close');
  const { context, a, b } = await twoTabs(browser, form.id);

  await addField(a, 'Email');
  await update(a);
  await expect(badge(a)).toHaveText(/^Published$/, { timeout: 20000 });

  await addField(b, 'Number');
  await update(b);
  await expect(conflict(b)).toBeVisible({ timeout: 20000 });
  await b.keyboard.press('Escape');
  await expect(conflict(b)).toHaveCount(0);

  // Tab B still shows its own change, and the form is untouched by it.
  await expect(canvas(b).getByText('Number', { exact: true }).first()).toBeVisible();
  expect(await liveKeys(form.id)).toEqual(['text', 'email']);

  await context.close();
});

test('one tab updating twice with edits in between is never in conflict', async ({ page }) => {
  const form = await freshForm('Same tab twice');
  await loginPage(page);
  await openBuilder(page, form.id);

  await addField(page, 'Email');
  await update(page);
  await expect(badge(page)).toHaveText(/^Published$/, { timeout: 20000 });

  await addField(page, 'Number');
  await update(page);
  await expect(badge(page)).toHaveText(/^Published$/, { timeout: 20000 });

  await expect(conflict(page)).toHaveCount(0);
  expect(await liveKeys(form.id)).toEqual(['text', 'email', 'number']);
});

test('Replace with my changes also sends the rename that was refused', async ({ browser }) => {
  const form = await freshForm('Stale tab rename');
  const { context, a, b } = await twoTabs(browser, form.id);

  await addField(a, 'Email');
  await update(a);
  await expect(badge(a)).toHaveText(/^Published$/, { timeout: 20000 });

  // Tab B adds a field and renames the form after tab A saved.
  await addField(b, 'Number');
  const title = `Renamed in tab B ${Date.now()}`;
  await b.locator('.sf-builder-header-bar__title-button').click();
  await b.getByRole('textbox', { name: 'Form title' }).fill(title);
  await b.getByRole('textbox', { name: 'Form title' }).press('Enter');
  const dialog = conflict(b);
  await expect(dialog).toBeVisible({ timeout: 20000 });

  await dialog.getByRole('button', { name: 'Replace with my changes' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(b.locator('.sf-builder-header-bar__save-status')).toHaveText(/^Saved$/, { timeout: 20000 });

  const stored = await client.call('GET', `/forms/${form.id}`);
  expect(stored.body.data.title).toBe(title);

  // The Forms list shows it. The local SQLite test site cannot run the list
  // query (JSON_EXTRACT), so the list check runs where the list API answers.
  const listed = await client.call('GET', '/forms?per_page=100');
  if ((listed.body?.data || []).length > 0) {
    await b.goto('/wp-admin/admin.php?page=subtleforms-forms', { waitUntil: 'domcontentloaded' });
    await b.getByRole('tab', { name: /^All/ }).waitFor({ timeout: 30000 });
    await b.getByPlaceholder('Search forms').fill(title);
    await expect(b.locator('tr', { hasText: title }).first()).toBeVisible({ timeout: 45000 });
  }

  await context.close();
});
