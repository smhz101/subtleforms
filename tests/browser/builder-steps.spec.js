/**
 * QA-08: Page Break keeps existing fields, orphan repair, and the Step
 * setting that moves fields between steps (2.3.1).
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, openBuilder, BASE } = require('./helpers');

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
    placeholder: `Placeholder ${i + 1}`,
    required: i === 0,
  }));
}

async function draftForm(title, fields, { publish = false } = {}) {
  const res = await client.call('POST', '/forms', { title });
  const id = res.body.data.id;
  const saved = await client.call('POST', `/forms/${id}/schema`, {
    activate: publish,
    schema: { schema_version: 1, metadata: { type: 'regular', name: title, title }, fields },
  });
  if (saved.status >= 300) throw new Error(JSON.stringify(saved.body).slice(0, 400));
  if (publish) await client.call('PUT', `/forms/${id}`, { status: 'published' });
  const form = { id };
  created.push(form);
  return form;
}

async function draftFields(id) {
  const res = await client.call('GET', `/forms/${id}/schema?context=builder`);
  return res.body.data.schema.fields;
}

function stepKeys(fields) {
  return fields.map((s) => (s.children || []).map((c) => c.key));
}

const stepTabs = (page) => page.locator('.sf-step-navigator__step-button');
const canvasFields = (page) => page.locator('.subtleforms-step-canvas .sf-field-chrome, .subtleforms-builder-canvas .sf-field-chrome');

async function addPageBreakFromDock(page) {
  await page.locator('.sf-inserter__item', { hasText: 'Page Break' }).first().click();
}

async function addPageBreakAt(page, position) {
  // Insert buttons of the root drop zone: index 0 is "Add Field" (top), then
  // one after every field.
  const buttons = page.locator('.sf-column-dropzone').first().locator('.sf-insert-field-button__button');
  await buttons.nth(position).click({ force: true });
  await page.locator('.sf-field-picker-popover__search-input').fill('Page Break');
  await page.locator('.sf-field-picker-popover__item', { hasText: 'Page Break' }).first().click();
}

async function saveDraft(page) {
  await page.locator('.sf-builder-header-bar__publish-arrow').click();
  await page.getByRole('menuitem', { name: /Save draft/ }).click();
  await expect(page.locator('.sf-builder-header-bar__save-status')).toHaveText(/^Saved$/, { timeout: 20000 });
}

async function openStep(page, index) {
  await stepTabs(page).nth(index).click();
}

test('Page Break at the end keeps every field in step 1 (dock)', async ({ page }) => {
  const form = await draftForm('QA-08 end', textFields(5));
  await loginPage(page);
  await openBuilder(page, form.id);
  await expect(canvasFields(page)).toHaveCount(5);

  await addPageBreakFromDock(page);
  await expect(stepTabs(page)).toHaveCount(2);
  await openStep(page, 0);
  await expect(canvasFields(page)).toHaveCount(5);
  await openStep(page, 1);
  await expect(canvasFields(page)).toHaveCount(0);
  await page.screenshot({ path: 'test-results/shots/free231/qa08-page-break-end.png' });

  await saveDraft(page);
  const fields = await draftFields(form.id);
  expect(fields.map((f) => f.type)).toEqual(['step', 'step']);
  expect(stepKeys(fields)).toEqual([['f1', 'f2', 'f3', 'f4', 'f5'], []]);
  // Settings survive.
  expect(fields[0].children[0]).toMatchObject({ required: true, placeholder: 'Placeholder 1' });
});

test('Page Break in the middle splits the form; save and reload', async ({ page }) => {
  const form = await draftForm('QA-08 middle', textFields(5));
  await loginPage(page);
  await openBuilder(page, form.id);
  await addPageBreakAt(page, 2);
  await expect(stepTabs(page)).toHaveCount(2);
  await openStep(page, 0);
  await expect(canvasFields(page)).toHaveCount(2);
  await openStep(page, 1);
  await expect(canvasFields(page)).toHaveCount(3);

  await saveDraft(page);
  expect(stepKeys(await draftFields(form.id))).toEqual([['f1', 'f2'], ['f3', 'f4', 'f5']]);

  await page.reload();
  await openBuilder(page, form.id);
  await expect(stepTabs(page)).toHaveCount(2);
  await openStep(page, 1);
  await expect(canvasFields(page)).toHaveCount(3);
});

test('Page Break at the very top keeps all fields in step 1', async ({ page }) => {
  const form = await draftForm('QA-08 top', textFields(4));
  await loginPage(page);
  await openBuilder(page, form.id);
  await addPageBreakAt(page, 0);
  await expect(stepTabs(page)).toHaveCount(2);
  await openStep(page, 0);
  await expect(canvasFields(page)).toHaveCount(4);
  await saveDraft(page);
  expect(stepKeys(await draftFields(form.id))).toEqual([['f1', 'f2', 'f3', 'f4'], []]);
});

test('Undo and Redo reverse the conversion completely, then save and reload', async ({ page }) => {
  const form = await draftForm('QA-08 undo', textFields(4));
  await loginPage(page);
  await openBuilder(page, form.id);
  await addPageBreakAt(page, 2);
  await expect(stepTabs(page)).toHaveCount(2);

  const undo = page.locator('.sf-builder-header-bar__undo-button');
  const redo = page.getByRole('button', { name: 'Redo', exact: true });
  await undo.click();
  await expect(stepTabs(page)).toHaveCount(0);
  await expect(canvasFields(page)).toHaveCount(4);

  await redo.click();
  await expect(stepTabs(page)).toHaveCount(2);
  await openStep(page, 1);
  await expect(canvasFields(page)).toHaveCount(2);

  await saveDraft(page);
  expect(stepKeys(await draftFields(form.id))).toEqual([['f1', 'f2'], ['f3', 'f4']]);

  await undo.click();
  await expect(stepTabs(page)).toHaveCount(0);
  await saveDraft(page);
  const flat = await draftFields(form.id);
  expect(flat.map((f) => f.key)).toEqual(['f1', 'f2', 'f3', 'f4']);

  await page.reload();
  await openBuilder(page, form.id);
  await expect(stepTabs(page)).toHaveCount(0);
  await expect(canvasFields(page)).toHaveCount(4);
});

test('a saved form with orphaned root fields (form 9 shape) is repaired in the builder and on the site', async ({ page }) => {
  const fields = [
    ...textFields(3, 'o'),
    { id: 'st1', key: 'st1', type: 'step', title: 'Step 1' },
  ];
  const form = await draftForm('QA-08 orphans', fields, { publish: true });

  // The live form shows the fields (served schema is repaired).
  const pageRes = await client.call('POST', '/wp/v2/pages', {
    title: 'QA-08 orphans page',
    status: 'publish',
    content: `<!-- wp:shortcode -->[subtleforms id="${form.id}"]<!-- /wp:shortcode -->`,
  });
  form.pageId = pageRes.body.id;
  const anon = await page.context().browser().newContext();
  const visitor = await anon.newPage();
  await visitor.goto(`${BASE}/?page_id=${form.pageId}`);
  await expect(visitor.locator('input[name="o1"]')).toBeVisible({ timeout: 20000 });
  await expect(visitor.locator('input[name="o3"]')).toBeVisible();
  await anon.close();

  await loginPage(page);
  await openBuilder(page, form.id);
  await expect(stepTabs(page)).toHaveCount(1);
  await expect(canvasFields(page)).toHaveCount(3);
  await expect(page.locator('.sf-form-editor__conversions')).toContainText('outside every step');
  await page.screenshot({ path: 'test-results/shots/free231/qa08-orphan-repair.png' });
  // The repair counts as a change, so it can be saved.
  await expect(page.locator('.sf-builder-header-bar__save-status')).toHaveText('Unsaved changes');
  await saveDraft(page);
  const saved = await draftFields(form.id);
  expect(saved.map((f) => f.type)).toEqual(['step']);
  expect(stepKeys(saved)).toEqual([['o1', 'o2', 'o3']]);
});

test('Step setting moves a field to another step and keeps it selected; undoable', async ({ page }) => {
  const fields = [
    { id: 's1', key: 's1', type: 'step', title: 'Contact', children: textFields(3, 'c') },
    { id: 's2', key: 's2', type: 'step', title: 'Payment', children: textFields(1, 'p') },
  ];
  const form = await draftForm('QA-08 step setting', fields);
  await loginPage(page);
  await openBuilder(page, form.id);
  await openStep(page, 0);
  await canvasFields(page).nth(1).click();

  const select = page.getByLabel('Step', { exact: true });
  await expect(select).toBeVisible();
  await expect(select.locator('option')).toHaveText(['Step 1: Contact', 'Step 2: Payment']);
  await select.selectOption({ label: 'Step 2: Payment' });

  // Canvas switched to step 2; the field is last there and still selected.
  await expect(stepTabs(page).nth(1)).toHaveClass(/selected/);
  await expect(canvasFields(page)).toHaveCount(2);
  await expect(canvasFields(page).nth(1)).toHaveClass(/is-selected/);
  await expect(page.getByLabel('Step', { exact: true })).toHaveValue('s2');
  await page.screenshot({ path: 'test-results/shots/free231/qa08-step-setting.png' });

  await saveDraft(page);
  expect(stepKeys(await draftFields(form.id))).toEqual([['c1', 'c3'], ['p1', 'c2']]);

  await page.locator('.sf-builder-header-bar__undo-button').click();
  await openStep(page, 0);
  await expect(canvasFields(page)).toHaveCount(3);
});

test('dragging a field onto a step tab moves it there', async ({ page }) => {
  const fields = [
    { id: 's1', key: 's1', type: 'step', title: 'One', children: textFields(2, 'd') },
    { id: 's2', key: 's2', type: 'step', title: 'Two' },
  ];
  const form = await draftForm('QA-08 tab drag', fields);
  await loginPage(page);
  await openBuilder(page, form.id);
  await openStep(page, 0);
  const field = canvasFields(page).first();
  await field.hover();
  const handle = field.locator('.sf-field-toolbar__button--drag');
  const tab = stepTabs(page).nth(1);
  const from = await handle.boundingBox();
  const to = await tab.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();

  await expect(stepTabs(page).nth(1)).toHaveClass(/selected/);
  await expect(canvasFields(page)).toHaveCount(1);
  await saveDraft(page);
  expect(stepKeys(await draftFields(form.id))).toEqual([['d2'], ['d1']]);
});
