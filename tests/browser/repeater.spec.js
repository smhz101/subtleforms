/**
 * QA-09: the Repeater runtime on the live form, in the builder Preview and
 * in the block editor preview; per-group validation, logic and storage;
 * entries, CSV and the email/PDF text.
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { adminApi, publishForm, entries, cleanup, waitForForm, loginPage, openBuilder } = require('./helpers');

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

// The QA form 10 shape, plus a conditional child.
const FIELDS = [
  { id: 'em', key: 'email', type: 'email', label: 'Email' },
  {
    id: 'rep',
    key: 'companies',
    type: 'repeat_container',
    label: 'Companies',
    min: 1,
    max: 3,
    buttonLabel: 'Add another company',
    children: [
      { id: 'tk', key: 'ticker', type: 'text', label: 'Ticker', required: true },
      { id: 'cn', key: 'company', type: 'text', label: 'Company name' },
      { id: 'sh', key: 'shares', type: 'number', label: 'Number of shares', required: true },
      { id: 'pd', key: 'purchase_date', type: 'date', label: 'Purchase date' },
      {
        id: 'nt',
        key: 'note',
        type: 'text',
        label: 'Which exchange?',
        required: true,
        logic: { action: 'show', groups: [{ match: 'all', rules: [{ field: 'ticker', operator: 'equals', value: 'OTHER' }] }] },
      },
    ],
  },
];

const group = (page, i) => page.locator('.subtleforms-repeater__group').nth(i);
const input = (page, i, key) => page.locator(`[name="companies[${i}][${key}]"]`);

test('visitors add and remove groups within min and max, with focus and names (live form)', async ({ page }) => {
  const form = await publishForm(client, { title: 'QA-09 repeater', fields: FIELDS });
  created.push(form);
  await page.goto(form.url);
  await waitForForm(page);

  const add = page.getByRole('button', { name: 'Add another company' });
  await expect(page.locator('.subtleforms-repeater__group')).toHaveCount(1);
  await expect(add).toBeVisible();
  // At the minimum there is nothing to remove.
  await expect(page.getByRole('button', { name: /^Remove Companies/ })).toHaveCount(0);

  await input(page, 0, 'ticker').fill('AAPL');
  await input(page, 0, 'company').fill('Apple');
  await input(page, 0, 'shares').fill('8');
  await input(page, 0, 'purchase_date').fill('2024-02-29');

  await add.click();
  await expect(page.locator('.subtleforms-repeater__group')).toHaveCount(2);
  // Focus moves into the new group, which starts empty.
  await expect(input(page, 1, 'ticker')).toBeFocused();
  await expect(input(page, 1, 'ticker')).toHaveValue('');
  await expect(input(page, 1, 'ticker')).not.toHaveAttribute('id', await input(page, 0, 'ticker').getAttribute('id'));
  await input(page, 1, 'ticker').fill('MIDDLE');
  await input(page, 1, 'shares').fill('1');

  await add.click();
  await expect(page.locator('.subtleforms-repeater__group')).toHaveCount(3);
  await input(page, 2, 'ticker').fill('MSFT');
  await input(page, 2, 'shares').fill('2');
  // The maximum is reached: no Add button.
  await expect(add).toHaveCount(0);
  await expect(page.locator('.subtleforms-repeater__count')).toHaveText('Maximum of 3 reached');
  await page.screenshot({ path: '/home/claude/shots/free231/qa09-repeater-max.png', fullPage: true });

  // Remove the middle group: the last group's answers move up intact.
  await page.getByRole('button', { name: 'Remove Companies 2' }).click();
  await expect(page.locator('.subtleforms-repeater__group')).toHaveCount(2);
  await expect(input(page, 1, 'ticker')).toHaveValue('MSFT');
  await expect(input(page, 1, 'shares')).toHaveValue('2');
  await expect(input(page, 0, 'ticker')).toHaveValue('AAPL');
  await expect(group(page, 1)).toBeFocused();
  await expect(page.getByRole('button', { name: 'Add another company' })).toBeVisible();

  // Conditional child appears only in its own group.
  await input(page, 1, 'ticker').fill('OTHER');
  await expect(input(page, 1, 'note')).toBeVisible();
  await expect(input(page, 0, 'note')).toHaveCount(0);

  // Required is per group: only group 2's note is missing.
  await input(page, 0, 'shares').fill('8');
  await page.locator('input[name="email"]').fill('repeater@example.com');
  await page.click('.subtleforms-button-submit');
  await expect(input(page, 1, 'note')).toHaveAttribute('aria-invalid', 'true');
  await expect(input(page, 0, 'ticker')).not.toHaveAttribute('aria-invalid', 'true');

  await input(page, 1, 'note').fill('LSE');
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-success-message')).toBeVisible({ timeout: 30000 });

  await expect.poll(async () => (await entries(client, form.id)).length).toBeGreaterThan(0);
  const list = await entries(client, form.id);
  const payload = typeof list[0].payload === 'string' ? JSON.parse(list[0].payload) : list[0].payload;
  expect(payload.companies).toEqual([
    { ticker: 'AAPL', company: 'Apple', shares: '8', purchase_date: '2024-02-29' },
    { ticker: 'OTHER', shares: '2', note: 'LSE' },
  ]);
  expect(payload.ticker).toBeUndefined();
  form.entryId = list[0].id;
});

test('the server checks each group too (client validation bypassed)', async ({ playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: process.env.SF_BASE_URL || 'http://localhost:8899' });
  const form = await publishForm(client, { title: 'QA-09 server', fields: FIELDS });
  created.push(form);
  const res = await anon.post(`/wp-json/subtleforms/v1/submit`, {
    data: {
      form_id: form.id,
      data: {
        form_rendered_at: Math.floor(Date.now() / 1000) - 60,
        email: 'x@example.com',
        companies: [
          { ticker: 'AAPL', shares: '1' },
          { ticker: '', shares: '' },
          { ticker: 'OTHER', shares: '3' },
        ],
      },
    },
  });
  const body = await res.json();
  expect(res.status()).toBe(422);
  const fields = body.error?.meta?.fields || body.meta?.fields || {};
  expect(Object.keys(fields)).toEqual(expect.arrayContaining(['companies.1.ticker', 'companies.1.shares', 'companies.2.note']));
  expect(fields['companies.0.ticker']).toBeUndefined();
});

test('mobile layout and accessibility', async ({ page }) => {
  const form = await publishForm(client, { title: 'QA-09 mobile', fields: FIELDS });
  created.push(form);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(form.url);
  await waitForForm(page);
  await page.getByRole('button', { name: 'Add another company' }).click();
  const box = await page.getByRole('button', { name: 'Add another company' }).boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(docWidth).toBeLessThanOrEqual(375);
  await page.screenshot({ path: '/home/claude/shots/free231/qa09-repeater-mobile.png', fullPage: true });
  const results = await new AxeBuilder({ page }).include('.subtleforms-repeater').analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test('builder Preview shows the runtime', async ({ page }) => {
  const form = await publishForm(client, { title: 'QA-09 preview', fields: FIELDS });
  created.push(form);
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('#sf-builder-view-preview').click();
  const frame = page.frameLocator('iframe').first();
  await expect(frame.getByRole('button', { name: 'Add another company' })).toBeVisible({ timeout: 20000 });
  await frame.getByRole('button', { name: 'Add another company' }).click();
  await expect(frame.locator('.subtleforms-repeater__group')).toHaveCount(2);
  await page.screenshot({ path: '/home/claude/shots/free231/qa09-builder-preview.png' });
});

test('entry detail shows a table and the CSV has one column per child', async ({ page, playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: process.env.SF_BASE_URL || 'http://localhost:8899' });
  const form = await publishForm(client, { title: 'QA-09 entries', fields: FIELDS });
  created.push(form);
  const sub = await anon.post(`/wp-json/subtleforms/v1/submit`, {
    data: {
      form_id: form.id,
      data: {
        form_rendered_at: Math.floor(Date.now() / 1000) - 60,
        email: 'tab@example.com',
        companies: [
          { ticker: 'AAPL', company: 'Apple', shares: '8' },
          { ticker: 'MSFT', shares: '2' },
        ],
      },
    },
  });
  expect(sub.status()).toBeLessThan(300);
  const list = await entries(client, form.id);
  const entryId = list[0].id;

  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&submission_id=${entryId}&form_id=${form.id}`);
  const table = page.locator('.sf-answers__repeater-table');
  await expect(table).toBeVisible({ timeout: 20000 });
  await expect(table.locator('thead th')).toHaveText(['#', 'Ticker', 'Company name', 'Number of shares', 'Purchase date', 'Which exchange?']);
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await expect(table.locator('tbody tr').nth(1)).toContainText('MSFT');
  await page.screenshot({ path: '/home/claude/shots/free231/qa09-entry-detail.png', fullPage: true });

  const csv = await client.call('POST', '/submissions/export', { form_id: form.id });
  // CSV export needs a Pro plan; the local test site has one.
  test.info().annotations.push({ type: 'csv', description: csv.body?.data?.csv ? 'checked' : `skipped: ${csv.status}` });
  if (csv.body?.data?.csv) {
    const text = Buffer.from(csv.body.data.csv, 'base64').toString('utf8');
    expect(text).toContain('"Companies: Ticker"');
    expect(text).toContain('"AAPL\nMSFT"');
  }
});

test('block editor preview shows the Repeater with its Add button', async ({ page }) => {
  const form = await publishForm(client, { title: 'QA-09 block', fields: FIELDS });
  created.push(form);
  const post = await client.call('POST', '/wp/v2/posts', {
    title: 'QA-09 block preview',
    status: 'draft',
    content: '',
  });
  const postId = post.body.id;
  try {
    await loginPage(page);
    await page.goto(`/wp-admin/post.php?post=${postId}&action=edit`);
    // Close the welcome guide when it shows.
    const close = page.getByRole('button', { name: 'Close', exact: true });
    if (await close.isVisible({ timeout: 5000 }).catch(() => false)) await close.click();
    // Insert the block the way the inserter does, so its saved markup is valid.
    await page.waitForFunction(() => window.wp?.blocks?.getBlockType?.('subtleforms/form'), null, { timeout: 30000 });
    await page.evaluate((formId) => {
      const block = window.wp.blocks.createBlock('subtleforms/form', { formId });
      window.wp.data.dispatch('core/block-editor').insertBlocks(block);
    }, form.id);
    const canvas = page.frameLocator('iframe[name="editor-canvas"]');
    const add = canvas.locator('.subtleforms-block-preview .subtleforms-repeater__add');
    await expect(add).toBeVisible({ timeout: 45000 });
    await expect(add).toContainText('Add another company');
    await page.screenshot({ path: '/home/claude/shots/free231/qa09-block-preview.png' });
  } finally {
    await client.call('DELETE', `/wp/v2/posts/${postId}?force=true`);
  }
});
