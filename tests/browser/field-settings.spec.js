/**
 * 2.3.2 item 5: settings every field has, applied on the builder canvas and
 * on the live form.
 *
 * - Field label visibility: Visible (top aligned) or Hidden. A hidden label
 *   stays in the accessibility tree (the field keeps its name).
 * - Help text placement: below or above the input.
 * - Custom validation message and the required message, in the browser.
 * - Admin label: used in the entry instead of the public label.
 * - Form-level defaults for label visibility and help text placement.
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { adminApi, cleanup, loginPage, openBuilder, openInspectorTab, entries, BASE } = require('./helpers');

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

async function saveDraft(page) {
  await page.locator('.sf-builder-header-bar__publish-arrow').click();
  await page.getByRole('menuitem', { name: /Save draft/ }).click();
  await expect(page.locator('.sf-builder-header-bar__save-status')).toHaveText(/^Saved$/, { timeout: 20000 });
}

async function makeForm(title, fields, metadata = {}) {
  const res = await client.call('POST', '/forms', { title });
  const id = res.body.data.id;
  const form = { id };
  created.push(form);
  const saved = await client.call('POST', `/forms/${id}/schema`, {
    activate: true,
    schema: { schema_version: 1, metadata: { type: 'regular', name: title, title, ...metadata }, fields },
  });
  if (saved.status >= 300) throw new Error(JSON.stringify(saved.body).slice(0, 400));
  return form;
}

async function publishWithPage(form, title) {
  await client.call('PUT', `/forms/${form.id}`, { status: 'published' });
  const wpPage = await client.call('POST', '/wp/v2/pages', {
    title: `${title} page`,
    status: 'publish',
    content: `<!-- wp:shortcode -->[subtleforms id="${form.id}"]<!-- /wp:shortcode -->`,
  });
  form.pageId = wpPage.body.id;
  return `${BASE}/?page_id=${form.pageId}`;
}

const inspector = (page) => page.locator('.sf-field-inspector');
const chrome = (page, i) => page.locator('.subtleforms-builder-canvas .sf-field-chrome').nth(i);

test('label visibility, help text placement, messages and admin label: builder, live form and entry', async ({ page, browser }) => {
  const form = await makeForm('Item 5 settings', [
    { id: 'n', key: 'name', type: 'text', label: 'Name', required: true },
    { id: 'e', key: 'email', type: 'email', label: 'Email', required: true },
    { id: 'm', key: 'message', type: 'textarea', label: 'Message' },
  ]);
  await loginPage(page);
  await openBuilder(page, form.id);

  // Name: hidden label (Style tab).
  await chrome(page, 0).click();
  await openInspectorTab(page, 'Style');
  await inspector(page).getByLabel('Field label visibility').selectOption('hidden');
  await expect(chrome(page, 0).locator('.sf-field-renderer__header')).toHaveClass(/is-label-hidden/);
  await expect(chrome(page, 0).locator('.sf-field-renderer__label-hidden-badge')).toBeVisible();

  // Email: help text above, messages, admin label.
  await chrome(page, 1).click();
  await inspector(page).getByLabel('Help text', { exact: true }).fill('We only use it to reply.');
  await openInspectorTab(page, 'Style');
  await inspector(page).getByLabel('Help text placement').selectOption('above');
  const emailChrome = chrome(page, 1);
  await expect(emailChrome.locator('.sf-field-renderer__help-text--above')).toHaveText('We only use it to reply.');
  // Above means before the input.
  const order = await emailChrome.evaluate((el) => {
    const help = el.querySelector('.sf-field-renderer__help-text--above');
    const input = el.querySelector('input');
    return help.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING ? 'help-first' : 'input-first';
  });
  expect(order).toBe('help-first');
  await page.screenshot({ path: `${SHOTS}/item5-builder-canvas.png` });

  await inspector(page).getByRole('tab', { name: 'Validation' }).click();
  await inspector(page).getByLabel('Message when left empty').fill('We need your email.');
  await inspector(page).getByLabel('Custom validation message').fill('That does not look like an email address.');
  await page.screenshot({ path: `${SHOTS}/item5-validation-tab.png` });
  await openInspectorTab(page, 'Field');
  await inspector(page).getByRole('button', { name: 'Advanced' }).click();
  await inspector(page).getByLabel('Admin label').fill('Contact email');
  await page.screenshot({ path: `${SHOTS}/item5-settings-tab.png` });

  await saveDraft(page);
  const draft = (await client.call('GET', `/forms/${form.id}/schema?context=builder`)).body.data.schema.fields;
  expect(draft[0].labelVisibility).toBe('hidden');
  expect(draft[1]).toMatchObject({
    descriptionPlacement: 'above',
    requiredMessage: 'We need your email.',
    validationMessage: 'That does not look like an email address.',
    adminLabel: 'Contact email',
  });

  // Live form.
  const url = await publishWithPage(form, 'Item 5 settings');
  // Publishing promotes the saved draft.
  await expect.poll(async () => (await client.call('GET', `/forms/${form.id}`)).body.data.has_unpublished_changes, { timeout: 20000 }).toBe(false);

  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await visitor.goto(url);
  const live = visitor.locator('.subtleforms-form-container form');
  await expect(live).toBeVisible({ timeout: 20000 });
  // Hidden label: not visible, still the input's accessible name.
  const nameField = live.locator('.subtleforms-field-text').first();
  await expect(nameField).toHaveClass(/subtleforms-field--no-label/);
  const box = await nameField.locator('label.subtleforms-field-label').boundingBox();
  expect(box.width).toBeLessThanOrEqual(1);
  await expect(visitor.getByRole('textbox', { name: 'Name' })).toBeVisible();
  // Help text above the email input.
  const helpFirst = await live.locator('.subtleforms-field-email').evaluate((el) => {
    const help = el.querySelector('.subtleforms-field-help');
    const input = el.querySelector('input');
    return !!help && !!(help.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(helpFirst).toBe(true);

  // Messages in the browser.
  await visitor.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await live.getByRole('button', { name: /Submit/ }).click();
  await expect(live.locator('.subtleforms-field-email .subtleforms-field-error')).toHaveText('We need your email.');
  await visitor.getByRole('textbox', { name: /Email/ }).fill('not-an-email');
  await live.getByRole('button', { name: /Submit/ }).click();
  await expect(live.locator('.subtleforms-field-email .subtleforms-field-error')).toHaveText('That does not look like an email address.');
  await visitor.screenshot({ path: `${SHOTS}/item5-live-errors.png`, fullPage: true });

  const axe = await new AxeBuilder({ page: visitor })
    .include('.subtleforms-form-container')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  await visitor.getByRole('textbox', { name: /Email/ }).fill('ada@example.com');
  await visitor.waitForTimeout(3500); // past the 3 second minimum fill time
  await live.getByRole('button', { name: /Submit/ }).click();
  await expect(visitor.locator('.subtleforms-success, .subtleforms-confirmation, [role="status"]').first()).toBeVisible({ timeout: 20000 });
  await ctx.close();

  // The entry names the field by its admin label.
  const list = await entries(client, form.id);
  expect(list.length).toBeGreaterThan(0);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&submission_id=${list[0].id}&form_id=${form.id}`);
  await expect(page.getByText('Contact email').first()).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: `${SHOTS}/item5-entry-admin-label.png` });
});

test('form-level defaults: hidden labels and help text above for every field that does not set its own', async ({ page, browser }) => {
  const form = await makeForm('Item 5 defaults', [
    { id: 'a', key: 'a', type: 'text', label: 'First', description: 'Help one' },
    { id: 'b', key: 'b', type: 'text', label: 'Second', labelVisibility: 'visible', descriptionPlacement: 'below', description: 'Help two' },
    {
      id: 'g', key: 'grp', type: 'group_container', label: 'Grouped', description: 'Group help',
      children: [{ id: 'c', key: 'c', type: 'text', label: 'Inside' }],
    },
  ]);
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('#sf-builder-view-settings').click();
  await page.getByRole('button', { name: 'Field defaults' }).click();
  await page.getByLabel('Field label visibility').selectOption('hidden');
  await page.getByLabel('Help text placement').selectOption('above');
  await page.screenshot({ path: `${SHOTS}/item5-form-defaults.png` });
  await page.locator('#sf-builder-view-build').click();
  await expect(chrome(page, 0).locator('.sf-field-renderer__header')).toHaveClass(/is-label-hidden/);
  await expect(chrome(page, 0).locator('.sf-field-renderer__help-text--above')).toHaveText('Help one');
  await expect(chrome(page, 1).locator('.sf-field-renderer__header')).not.toHaveClass(/is-label-hidden/);
  await expect(chrome(page, 1).locator('.sf-field-renderer__help-text--above')).toHaveCount(0);
  await saveDraft(page);
  const meta = (await client.call('GET', `/forms/${form.id}/schema?context=builder`)).body.data.schema.metadata;
  expect(meta).toMatchObject({ labelVisibility: 'hidden', descriptionPlacement: 'above' });

  // Promote the draft and check the live form.
  const url = await publishWithPage(form, 'Item 5 defaults');
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await visitor.goto(url);
  const live = visitor.locator('.subtleforms-form-container form');
  await expect(live).toBeVisible({ timeout: 20000 });
  await expect(live.locator('.subtleforms-field-text').first()).toHaveClass(/subtleforms-field--no-label/);
  await expect(visitor.getByRole('textbox', { name: 'First' })).toBeVisible();
  await expect(visitor.getByRole('textbox', { name: 'Inside' })).toBeVisible();
  // The explicit "Visible" field keeps its label; the Group label is hidden
  // but the field inside keeps its own label visible only if it says so.
  await expect(live.getByText('Second', { exact: true })).toBeVisible();
  await expect(live.locator('.subtleforms-field-help--above').first()).toHaveText('Help one');
  await ctx.close();
});
