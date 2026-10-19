/**
 * 2.3.2 item 1: the form type follows the structure.
 *
 * Adding the first Page Break to a Standard form makes it Multi-step in the
 * builder badge, the Settings type selector, the saved schema, All Forms and
 * the live form. Removing the last Page Break makes it Standard again and the
 * snackbar can undo it. Changing the type in Settings wraps the fields in a
 * first step, or flattens the steps (keeping every field) after a
 * confirmation.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, openBuilder, BASE } = require('./helpers');

const SHOTS = 'test-results/shots/free232';
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

function textFields(n, prefix = 'f') {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    key: `${prefix}${i + 1}`,
    type: 'text',
    label: `Field ${i + 1}`,
  }));
}

async function draftForm(title, fields, type = 'regular') {
  const res = await client.call('POST', '/forms', { title });
  const id = res.body.data.id;
  const saved = await client.call('POST', `/forms/${id}/schema`, {
    activate: false,
    schema: { schema_version: 1, metadata: { type, name: title, title }, fields },
  });
  if (saved.status >= 300) throw new Error(JSON.stringify(saved.body).slice(0, 400));
  const form = { id };
  created.push(form);
  return form;
}

async function draft(id) {
  return (await client.call('GET', `/forms/${id}/schema?context=builder`)).body.data.schema;
}

const badge = (page) => page.locator('.sf-builder-header-bar__form-type-badge');
const stepTabs = (page) => page.locator('.sf-step-navigator__step-button');
const canvasFields = (page) => page.locator('.subtleforms-step-canvas .sf-field-chrome, .subtleforms-builder-canvas .sf-field-chrome');
// Other notices (for example "Field added") can show at the same time.
const snackbar = (page) => page.locator('.components-snackbar', { hasText: /now (Multi-step|Standard|Conversational)/ }).last();

async function saveDraft(page) {
  await page.locator('.sf-builder-header-bar__publish-arrow').click();
  await page.getByRole('menuitem', { name: /Save draft/ }).click();
  await expect(page.locator('.sf-builder-header-bar__save-status')).toHaveText(/^Saved$/, { timeout: 20000 });
}

async function typeSelector(page) {
  await page.locator('#sf-builder-view-settings').click();
  return page.locator('.sf-form-type-control');
}

test('first Page Break makes the form Multi-step everywhere; removing it makes it Standard with Undo', async ({ page }) => {
  const form = await draftForm('Item 1 page break', textFields(3));
  await loginPage(page);
  await openBuilder(page, form.id);
  await expect(badge(page)).toHaveText('Standard');

  await page.locator('.sf-inserter__item', { hasText: 'Page Break' }).first().click();
  await expect(stepTabs(page)).toHaveCount(2);
  await expect(badge(page)).toHaveText('Multi-step');
  await expect(snackbar(page)).toContainText('now Multi-step');
  await page.screenshot({ path: `${SHOTS}/item1-page-break-multistep.png` });

  const settings = await typeSelector(page);
  await expect(settings.getByRole('radio', { name: 'Multi-step' })).toBeChecked();
  await page.screenshot({ path: `${SHOTS}/item1-settings-type.png` });
  await page.locator('#sf-builder-view-build').click();

  await saveDraft(page);
  expect((await draft(form.id)).metadata.type).toBe('multi-step');

  // All Forms shows the new type.
  const list = await client.call('GET', '/forms?per_page=100&orderby=updated_at&order=desc');
  const rows = list.body.data.items || list.body.data;
  expect(rows.find((r) => String(r.id) === String(form.id)).type).toBe('multi-step');
  await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
  const row = page.locator('tr', { hasText: 'Item 1 page break' }).first();
  await expect(row.locator('.sf-form-type-badge')).toHaveText('Multi-step');
  await page.screenshot({ path: `${SHOTS}/item1-all-forms.png` });

  // Remove the Page Break (step 2): back to Standard, every field kept.
  await openBuilder(page, form.id);
  await stepTabs(page).nth(1).click();
  await page.locator('.sf-step-navigator__delete-button').nth(1).click();
  await expect(stepTabs(page)).toHaveCount(0);
  await expect(canvasFields(page)).toHaveCount(3);
  await expect(badge(page)).toHaveText('Standard');
  await expect(snackbar(page)).toContainText('now Standard');
  await page.screenshot({ path: `${SHOTS}/item1-removed-standard-snackbar.png` });

  // Undo from the snackbar.
  await snackbar(page).getByRole('button', { name: 'Undo' }).click();
  await expect(stepTabs(page)).toHaveCount(2);
  await expect(badge(page)).toHaveText('Multi-step');

  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(badge(page)).toHaveText('Standard');
  await saveDraft(page);
  const saved = await draft(form.id);
  expect(saved.metadata.type).toBe('regular');
  expect(saved.fields.map((f) => f.key)).toEqual(['f1', 'f2', 'f3']);
});

test('Settings type selector wraps fields into a step and flattens steps after confirming', async ({ page }) => {
  const form = await draftForm('Item 1 selector', textFields(4));
  await loginPage(page);
  await openBuilder(page, form.id);

  let settings = await typeSelector(page);
  await settings.getByRole('radio', { name: 'Multi-step' }).click();
  await expect(badge(page)).toHaveText('Multi-step');
  await page.locator('#sf-builder-view-build').click();
  await expect(stepTabs(page)).toHaveCount(1);
  await expect(canvasFields(page)).toHaveCount(4);
  await saveDraft(page);
  let saved = await draft(form.id);
  expect(saved.metadata.type).toBe('multi-step');
  expect(saved.fields).toHaveLength(1);
  expect(saved.fields[0].type).toBe('step');
  expect(saved.fields[0].children.map((f) => f.key)).toEqual(['f1', 'f2', 'f3', 'f4']);

  // Split into two steps, then back to Standard: a confirmation first.
  await page.locator('.sf-inserter__item', { hasText: 'Page Break' }).first().click();
  await expect(stepTabs(page)).toHaveCount(2);
  settings = await typeSelector(page);
  await settings.getByRole('radio', { name: 'Standard' }).click();
  const dialog = page.getByRole('dialog', { name: 'Change to Standard?' });
  await expect(dialog).toContainText('All 4 fields stay');
  await page.screenshot({ path: `${SHOTS}/item1-flatten-confirm.png` });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(badge(page)).toHaveText('Multi-step');

  await settings.getByRole('radio', { name: 'Standard' }).click();
  await page.getByRole('dialog', { name: 'Change to Standard?' }).getByRole('button', { name: 'Remove steps' }).click();
  await expect(badge(page)).toHaveText('Standard');
  await page.locator('#sf-builder-view-build').click();
  await expect(stepTabs(page)).toHaveCount(0);
  await expect(canvasFields(page)).toHaveCount(4);
  await saveDraft(page);
  saved = await draft(form.id);
  expect(saved.metadata.type).toBe('regular');
  expect(saved.fields.map((f) => f.key)).toEqual(['f1', 'f2', 'f3', 'f4']);
});

test('a stored Standard form with Page Breaks shows and renders as Multi-step', async ({ page, browser }) => {
  // Saved by an older build: type "regular" with steps.
  const fields = [
    { id: 's1', key: 's1', type: 'step', title: 'One', children: textFields(2, 'a') },
    { id: 's2', key: 's2', type: 'step', title: 'Two', children: textFields(1, 'b') },
  ];
  const res = await client.call('POST', '/forms', { title: 'Item 1 legacy' });
  const id = res.body.data.id;
  const form = { id };
  created.push(form);
  await client.call('POST', `/forms/${id}/schema`, {
    activate: true,
    schema: { schema_version: 1, metadata: { type: 'regular', name: 'x', title: 'Item 1 legacy' }, fields },
  });
  await client.call('PUT', `/forms/${id}`, { status: 'published' });
  // The server stores the type its structure gives.
  expect((await draft(id)).metadata.type).toBe('multi-step');
  const one = await client.call('GET', `/forms/${id}`);
  expect(one.body.data.type).toBe('multi-step');

  const wpPage = await client.call('POST', '/wp/v2/pages', {
    title: 'Item 1 legacy page',
    status: 'publish',
    content: `<!-- wp:shortcode -->[subtleforms id="${id}"]<!-- /wp:shortcode -->`,
  });
  form.pageId = wpPage.body.id;
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await visitor.goto(`${BASE}/?page_id=${form.pageId}`);
  await expect(visitor.locator('.subtleforms--type-steps')).toBeVisible({ timeout: 20000 });
  await expect(visitor.locator('input[name="a1"]')).toBeVisible();
  await expect(visitor.locator('input[name="b1"]')).toHaveCount(0);
  await ctx.close();
});
