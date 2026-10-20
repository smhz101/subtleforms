/**
 * 2.3.2 item 3: the conversational builder.
 *
 * A new conversational form starts with "Add your first question" (no locked
 * block). Clicking a field in the panel fills an empty question and adds a
 * new question after the current one otherwise. Every question, a welcome
 * screen too, can be edited, replaced, reordered and deleted, and the live
 * form shows the same questions in the same order.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, openBuilder, openPanel, BASE } = require('./helpers');

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

const label = (page) => page.locator('.sf-conversational-canvas__progress-label');
const question = (page) => page.locator('.sf-conversational-canvas__card .sf-field-chrome');
const dock = (page, name) =>
  page.locator('.sf-inserter__item').filter({ has: page.locator('.sf-inserter__item-label', { hasText: new RegExp(`^${name}$`) }) }).first();

async function draft(id) {
  return (await client.call('GET', `/forms/${id}/schema?context=builder`)).body.data.schema;
}

async function saveDraft(page) {
  await page.locator('.sf-builder-header-bar__publish-arrow').click();
  await page.getByRole('menuitem', { name: /Save draft/ }).click();
  await expect(page.locator('.sf-builder-header-bar__save-status')).toHaveText(/^Saved$/, { timeout: 20000 });
}

async function toolbar(page, name) {
  const chrome = question(page);
  await chrome.click();
  await chrome.hover();
  return chrome.getByRole('button', { name });
}

test('new conversational form: first question, fill, insert after current, empty question slot', async ({ page }) => {
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-new-form');
  await page.locator('.sf-tpl--blank').click();
  await page.getByRole('radio', { name: /Conversational/ }).click();
  const createResponse = page.waitForResponse((r) => /subtleforms\/v1\/forms(\?|$)/.test(r.url()) && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create form' }).click();
  const id = (await (await createResponse).json()).data.id;
  created.push({ id });

  await expect(page.getByRole('heading', { name: 'Add your first question' })).toBeVisible({ timeout: 30000 });
  await expect(label(page)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/item3-empty-state.png` });

  // The first field fills question 1.
  await dock(page, 'Text').click();
  await expect(label(page)).toHaveText('Question 1 of 1');
  await expect(question(page)).toHaveCount(1);

  // A second field goes after the current question.
  await dock(page, 'Email').click();
  await expect(label(page)).toHaveText('Question 2 of 2');

  // Back to question 1: the next field lands between 1 and 2.
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(label(page)).toHaveText('Question 1 of 2');
  await dock(page, 'Number').click();
  await expect(label(page)).toHaveText('Question 2 of 3');

  // "Add question" makes an empty question that the next field fills.
  await page.getByRole('button', { name: 'Add question' }).click();
  await expect(label(page)).toHaveText('Question 3 of 4');
  await expect(page.locator('.sf-conversational-canvas__slot')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/item3-empty-question.png` });
  await dock(page, 'Paragraph').click();
  await expect(label(page)).toHaveText('Question 3 of 4');
  await expect(page.locator('.sf-conversational-canvas__slot')).toHaveCount(0);

  await saveDraft(page);
  const saved = await draft(id);
  expect(saved.metadata.type).toBe('conversational');
  expect(saved.fields.map((f) => f.type)).toEqual(['text', 'number', 'textarea', 'email']);
});

test('any question (a welcome screen too) can be edited, replaced, reordered and deleted; live form matches', async ({ page, browser }) => {
  const res = await client.call('POST', '/forms', { title: 'Item 3 conversational' });
  const id = res.body.data.id;
  const form = { id };
  created.push(form);
  const saved = await client.call('POST', `/forms/${id}/schema`, {
    activate: true,
    schema: {
      schema_version: 1,
      metadata: { type: 'conversational', name: 'x', title: 'Item 3 conversational' },
      fields: [
        { id: 'w', key: 'welcome', type: 'html', label: 'Welcome', content: '<p>Welcome aboard</p>' },
        { id: 'q1', key: 'name', type: 'text', label: 'Your name', required: true },
        { id: 'q2', key: 'mail', type: 'email', label: 'Your email' },
      ],
    },
  });
  expect(saved.status).toBeLessThan(300);

  await loginPage(page);
  await openBuilder(page, id);
  await expect(label(page)).toHaveText('Question 1 of 3');
  await expect(question(page)).toContainText('Welcome aboard');

  // The welcome screen is editable in the inspector.
  await question(page).click();
  await openPanel(page, 'Display');
  const content = page.getByLabel('HTML Content');
  await expect(content).toBeVisible();
  await content.fill('<p>Hello and welcome</p>');
  await expect(question(page)).toContainText('Hello and welcome');
  await page.screenshot({ path: `${SHOTS}/item3-welcome-selected.png` });

  // Reorder: move the welcome screen later.
  await (await toolbar(page, 'Move question later')).click();
  await expect(label(page)).toHaveText('Question 2 of 3');

  // Replace "Your name" (now question 1) with a Paragraph; the label stays.
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(question(page)).toContainText('Your name');
  await (await toolbar(page, 'Replace with another field')).click();
  await page.locator('.sf-field-picker-popover__search-input').fill('Paragraph');
  await page.locator('.sf-field-picker-popover__item', { hasText: 'Paragraph' }).first().click();
  await expect(question(page).locator('textarea')).toHaveCount(1);
  await expect(question(page)).toContainText('Your name');
  await expect(label(page)).toHaveText('Question 1 of 3');

  // Delete the welcome screen (question 2).
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(question(page)).toContainText('Hello and welcome');
  await (await toolbar(page, 'Delete')).click();
  await expect(label(page)).toHaveText(/of 2$/);

  await saveDraft(page);
  const fields = (await draft(id)).fields;
  expect(fields.map((f) => f.type)).toEqual(['textarea', 'email']);
  expect(fields[0]).toMatchObject({ label: 'Your name', required: true });

  // Publish and check the live form asks the same questions in order.
  await client.call('PUT', `/forms/${id}`, { status: 'published' });
  const wpPage = await client.call('POST', '/wp/v2/pages', {
    title: 'Item 3 page',
    status: 'publish',
    content: `<!-- wp:shortcode -->[subtleforms id="${id}"]<!-- /wp:shortcode -->`,
  });
  form.pageId = wpPage.body.id;
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await visitor.goto(`${BASE}/?page_id=${form.pageId}`);
  await expect(visitor.locator('.subtleforms-question-number')).toHaveText('Question 1 of 2', { timeout: 20000 });
  await expect(visitor.locator('textarea')).toBeVisible();
  // Required, with the field's own message.
  await visitor.getByRole('button', { name: /Next/ }).click();
  await expect(visitor.locator('.subtleforms-field-error')).toBeVisible();
  await visitor.locator('textarea').fill('Ada');
  await visitor.getByRole('button', { name: /Next/ }).click();
  await expect(visitor.locator('.subtleforms-question-number')).toHaveText('Question 2 of 2');
  await expect(visitor.locator('input[type="email"]')).toBeVisible();
  await visitor.screenshot({ path: `${SHOTS}/item3-live.png` });
  await ctx.close();
});
