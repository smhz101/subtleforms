/**
 * 2.3.2 item 4: the label, help text and other settings of a Repeater,
 * Group and Columns container can be edited in the inspector, are saved and
 * show on the canvas and on the live form.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, openBuilder, openPanel, BASE } = require('./helpers');

const SHOTS = '/home/claude/shots/free232';
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

const container = (page, type) => page.locator(`.sf-container-renderer`).filter({ has: page.locator('.sf-container-renderer__header') }).nth(type);

test('Repeater, Group and Columns: label and help text are editable, saved and shown', async ({ page, browser }) => {
  const res = await client.call('POST', '/forms', { title: 'Item 4 containers' });
  const id = res.body.data.id;
  const form = { id };
  created.push(form);
  const fields = [
    {
      id: 'rep', key: 'companies', type: 'repeat_container', label: 'Repeater', min: 1, max: 3,
      children: [{ id: 'cn', key: 'company', type: 'text', label: 'Company' }],
    },
    {
      id: 'grp', key: 'grp', type: 'group_container', label: 'Group',
      children: [{ id: 'g1', key: 'city', type: 'text', label: 'City' }],
    },
    {
      id: 'col', key: 'cols', type: 'two_column_container', columns: [[{ id: 'c1', key: 'first', type: 'text', label: 'First' }], [{ id: 'c2', key: 'last', type: 'text', label: 'Last' }]],
    },
  ];
  const saved = await client.call('POST', `/forms/${id}/schema`, {
    activate: true,
    schema: { schema_version: 1, metadata: { type: 'regular', name: 'x', title: 'Item 4 containers' }, fields },
  });
  expect(saved.status).toBeLessThan(300);

  await loginPage(page);
  await openBuilder(page, id);

  const edits = [
    { index: 0, label: 'Companies you worked for', help: 'Add one group per company.', extra: async () => {
      await openPanel(page, 'Appearance');
      await page.getByLabel('Button Label').fill('Add a company');
      await page.getByLabel('Max Repeats').fill('4');
    } },
    { index: 1, label: 'Where you live', help: 'Your home city.' },
    { index: 2, label: 'Your full name', help: 'As on your passport.' },
  ];
  for (const edit of edits) {
    const box = container(page, edit.index);
    await box.locator('.sf-container-renderer__header').click();
    const labelInput = page.locator('.sf-field-inspector').getByLabel('Label', { exact: true });
    await expect(labelInput).toBeVisible();
    await labelInput.fill(edit.label);
    await page.locator('.sf-field-inspector').getByLabel('Help text', { exact: true }).fill(edit.help);
    if (edit.extra) await edit.extra();
    await expect(box.locator('.sf-container-renderer__header')).toContainText(edit.label);
    await expect(box.locator('.sf-container-renderer__header')).toContainText(edit.help);
  }
  await page.screenshot({ path: `${SHOTS}/item4-containers-builder.png`, fullPage: true });

  await saveDraft(page);
  const draft = (await client.call('GET', `/forms/${id}/schema?context=builder`)).body.data.schema.fields;
  expect(draft[0]).toMatchObject({ label: 'Companies you worked for', description: 'Add one group per company.', buttonLabel: 'Add a company' });
  expect(Number(draft[0].max)).toBe(4);
  expect(draft[1]).toMatchObject({ label: 'Where you live', description: 'Your home city.' });
  expect(draft[2]).toMatchObject({ label: 'Your full name', description: 'As on your passport.' });

  // Publish and check the live form.
  await page.locator('.sf-builder-header-bar__publish-button, button:has-text("Publish")').first().click();
  const confirm = page.getByRole('dialog').getByRole('button', { name: /Publish/ });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await expect.poll(async () => (await client.call('GET', `/forms/${id}`)).body.data.status, { timeout: 20000 }).toBe('published');
  await expect.poll(async () => (await client.call('GET', `/forms/${id}`)).body.data.has_unpublished_changes, { timeout: 20000 }).toBe(false);

  const wpPage = await client.call('POST', '/wp/v2/pages', {
    title: 'Item 4 page',
    status: 'publish',
    content: `<!-- wp:shortcode -->[subtleforms id="${id}"]<!-- /wp:shortcode -->`,
  });
  form.pageId = wpPage.body.id;
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await visitor.goto(`${BASE}/?page_id=${form.pageId}`);
  const live = visitor.locator('.subtleforms-form-container form');
  await expect(live).toContainText('Companies you worked for', { timeout: 20000 });
  await expect(live).toContainText('Add one group per company.');
  await expect(live.getByRole('button', { name: /Add a company/ })).toBeVisible();
  await expect(live).toContainText('Where you live');
  await expect(live).toContainText('Your home city.');
  await expect(live).toContainText('Your full name');
  await expect(live).toContainText('As on your passport.');
  await visitor.screenshot({ path: `${SHOTS}/item4-containers-live.png`, fullPage: true });
  await ctx.close();
});
