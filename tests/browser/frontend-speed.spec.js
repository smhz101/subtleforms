/**
 * 2.6.0 front-end speed.
 *
 * - A page without a form requests nothing from SubtleForms.
 * - A plain form loads the base script (deferred) and stylesheet only, and
 *   its data once, from the preload the page head started.
 * - Heavier field code is downloaded only for forms that have those fields,
 *   and each of those fields still works: the date picker opens and picks a
 *   day, the phone country list searches and switches the code, the country
 *   list opens, a file uploads, the order summary shows the total.
 * - Multi-step and conversational forms still move between pages.
 * - A form placed with the block is drawn once, without a layout shift.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup } = require('./helpers');

const SHOTS = 'test-results/shots/free260';
let client;
const created = [];
let plainPage;
let blockPage;

test.beforeAll(async () => {
  fs.mkdirSync(path.join(process.cwd(), SHOTS), { recursive: true });
  client = await adminApi();
  const page = await client.call('POST', '/wp/v2/pages', {
    title: 'Speed no form',
    status: 'publish',
    content: '<!-- wp:paragraph --><p>Just text.</p><!-- /wp:paragraph -->',
  });
  plainPage = page.body.id;
});

test.afterAll(async () => {
  for (const form of created) await cleanup(client, form);
  for (const id of [plainPage, blockPage]) {
    if (id) await client.call('DELETE', `/wp/v2/pages/${id}?force=true`);
  }
});

/** Everything the page asks SubtleForms for while it loads. */
function watch(page) {
  const seen = { assets: [], schema: [], all: [] };
  page.on('request', (req) => {
    const u = req.url();
    if (/subtleforms/.test(u)) seen.all.push(u);
    if (/\/plugins\/subtleforms\/(build|assets)\//.test(u)) seen.assets.push(u.replace(/^.*\/plugins\/subtleforms\//, ''));
    if (/subtleforms\/v1\/forms\/\d+\/schema/.test(u)) seen.schema.push(u);
  });
  return seen;
}

/** Wait until the form is drawn and no field is still loading. */
async function formReady(page) {
  // A conversational form has no <form> element, so wait for its root.
  await page.waitForSelector('.subtleforms-form-container .subtleforms', { timeout: 20000 });
  await expect(page.locator('.subtleforms-loading, .subtleforms-field-loading')).toHaveCount(0);
}

const chunk = (seen, name) => seen.assets.some((u) => new RegExp(`build/frontend/${name}\\.[0-9a-f]+\\.js`).test(u));

test('a page without a form asks SubtleForms for nothing', async ({ page }) => {
  const seen = watch(page);
  await page.goto(`/?page_id=${plainPage}`);
  await page.waitForLoadState('networkidle');
  expect(seen.all).toEqual([]);
  await expect(page.locator('[href*="subtleforms"], [src*="subtleforms"]')).toHaveCount(0);
});

test('a plain form loads only the base code, deferred, and its data once', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Speed plain',
    fields: [
      { id: 'n', key: 'name', type: 'text', label: 'Name' },
      { id: 'e', key: 'email', type: 'email', label: 'Email' },
      { id: 'p', key: 'phone', type: 'phone', label: 'Phone' },
    ],
  });
  created.push(form);
  const seen = watch(page);
  await page.goto(form.url);
  await formReady(page);
  await page.waitForLoadState('networkidle');

  const scripts = seen.assets.filter((u) => /\.js(\?|$)/.test(u));
  expect(scripts.map((u) => u.replace(/\?.*$/, ''))).toEqual(['build/frontend/frontend.js']);
  await expect(page.locator('script#subtleforms-frontend-js')).toHaveAttribute('defer', '');
  expect(await page.locator('script[src*="jquery"]').count()).toBe(0);
  // Visitors fetch the form's data from a preload in the head, once.
  await expect(page.locator('head link[rel="preload"][as="fetch"][href*="/schema"]')).toHaveCount(1);
  expect(seen.schema).toHaveLength(1);
  await page.locator('.subtleforms-form-container').screenshot({ path: `${SHOTS}/plain-form.png` });
});

test('special fields load their code and still work', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Speed special',
    fields: [
      { id: 'd1', key: 'when', type: 'date', label: 'Date' },
      { id: 'p1', key: 'phone', type: 'phone', label: 'Phone', enableCountryCode: true },
      { id: 'k1', key: 'country', type: 'country', label: 'Country' },
      { id: 'f1', key: 'upload', type: 'file_upload', label: 'Upload' },
      { id: 'pp', key: 'ticket', type: 'payment_product', label: 'Ticket', price: 10 },
      { id: 'ps', key: 'summary', type: 'payment_summary', label: 'Summary' },
    ],
  });
  created.push(form);
  const seen = watch(page);
  await page.goto(form.url);
  await formReady(page);
  for (const name of ['field-date', 'field-phone-country', 'field-upload', 'field-payments']) {
    expect(chunk(seen, name), name).toBe(true);
    // Hinted from the page head and downloaded once.
    await expect(page.locator(`head link[rel="preload"][as="script"][href*="/${name}."]`)).toHaveCount(1);
    expect(seen.assets.filter((u) => u.includes(`/${name}.`)), name).toHaveLength(1);
  }
  expect(chunk(seen, 'form-conversational')).toBe(false);
  expect(chunk(seen, 'field-repeater')).toBe(false);
  await expect(page.locator('.subtleforms-form-container')).toHaveAttribute('data-features', 'date geo payments upload');

  // Date picker opens and picks a day.
  const date = page.locator('.subtleforms-field-date .subtleforms-picker, .subtleforms-picker').first();
  await date.locator('.subtleforms-picker__trigger').click();
  const calendar = page.locator('.subtleforms-picker__menu--calendar');
  await expect(calendar).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/date-open.png` });
  await calendar.locator('.subtleforms-picker__day:not(.is-outside)').nth(14).click();
  await expect(date.locator('.subtleforms-picker__value')).toBeVisible();

  // Phone country list searches and switches the code.
  await page.locator('.subtleforms-phone__trigger').click();
  await expect(page.locator('.subtleforms-phone__menu')).toBeVisible();
  await page.locator('.subtleforms-phone__search').fill('Pakistan');
  await expect(page.locator('.subtleforms-phone__option')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/phone-open.png` });
  await page.locator('.subtleforms-phone__option').first().click();
  await expect(page.locator('.subtleforms-phone__dial')).toContainText('92');

  // Country list opens and has countries.
  const country = page.locator('.subtleforms-field-country .subtleforms-picker__trigger, [id="subtleforms-field-country"]').first();
  await country.click();
  await expect(page.locator('.subtleforms-picker__option', { hasText: 'Germany' }).first()).toBeVisible();
  await page.keyboard.press('Escape');

  // A file uploads.
  await page.locator('input[type="file"]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.locator('.subtleforms-upload__name', { hasText: 'notes.txt' })).toBeVisible({ timeout: 20000 });

  // The order summary shows the total.
  await expect(page.locator('.subtleforms-form-container')).toContainText('$10.00');
  await page.locator('.subtleforms-form-container').screenshot({ path: `${SHOTS}/special-fields.png` });
});

test('multi-step form moves between steps', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Speed steps',
    metadata: { type: 'multi-step' },
    fields: [
      { id: 's1', key: 'step_1', type: 'step', label: 'About you', children: [{ id: 'a', key: 'first', type: 'text', label: 'First name', required: true }] },
      { id: 's2', key: 'step_2', type: 'step', label: 'Contact', children: [{ id: 'b', key: 'mail', type: 'email', label: 'Email', required: true }] },
    ],
  });
  created.push(form);
  await page.goto(form.url);
  await formReady(page);
  await page.locator('input[name="first"]').fill('Ada');
  await page.getByRole('button', { name: /Next/ }).click();
  await expect(page.locator('input[name="mail"]')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/steps-second.png` });
  await page.getByRole('button', { name: /Previous|Back/ }).click();
  await expect(page.locator('input[name="first"]')).toHaveValue('Ada');
});

test('conversational form loads its layout and moves to the next question', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Speed conversational',
    metadata: { type: 'conversational' },
    fields: [
      { id: 'q1', key: 'name', type: 'text', label: 'What is your name?', required: true },
      { id: 'q2', key: 'mail', type: 'email', label: 'Your email' },
    ],
  });
  created.push(form);
  const seen = watch(page);
  await page.goto(form.url);
  await formReady(page);
  expect(chunk(seen, 'form-conversational')).toBe(true);
  await page.locator('input[name="name"]').fill('Ada');
  await page.locator('.subtleforms-button-next').click();
  await expect(page.getByText('Your email')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/conversational-second.png` });
});

test('a block form is drawn once, without a layout shift', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Speed block',
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }],
  });
  created.push(form);
  const res = await client.call('POST', '/wp/v2/pages', {
    title: 'Speed block page',
    status: 'publish',
    content: `<!-- wp:subtleforms/form {"formId":${form.id}} /-->`,
  });
  blockPage = res.body.id;
  await page.addInitScript(() => {
    window.__sfShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput && entry.sources.some((s) => s.node && s.node.closest && s.node.closest('.subtleforms-form-container'))) {
          window.__sfShift += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const seen = watch(page);
  await page.goto(`/?page_id=${blockPage}`);
  await formReady(page);
  await page.waitForTimeout(500);
  expect(seen.schema).toHaveLength(1);
  expect(await page.evaluate(() => window.__sfShift)).toBeLessThan(0.01);
  await expect(page.locator('.subtleforms-block form')).toHaveCount(1);
});

test('field code still loads when a speed plugin moves the main script', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Speed moved script',
    fields: [{ id: 'd1', key: 'when', type: 'date', label: 'Date' }],
  });
  created.push(form);
  const bundle = path.join(process.cwd(), 'build/frontend/frontend.js');
  // As a plugin that combines scripts into its cache folder would print it.
  await page.route('**/wp-content/cache/sf-combined.js', (route) =>
    route.fulfill({ path: bundle, contentType: 'application/javascript' })
  );
  await page.route(/page_id=\d+|\/speed-moved-script-page\/?$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(/<link rel='preload'[^>]*as='script'[^>]*>/g, '')
      .replace(/\/wp-content\/plugins\/subtleforms\/build\/frontend\/frontend\.js\?ver=[^"']*/, '/wp-content/cache/sf-combined.js');
    await route.fulfill({ response, body });
  });
  const seen = watch(page);
  const combined = [];
  page.on('request', (req) => {
    if (req.url().includes('/wp-content/cache/sf-combined.js')) combined.push(req.url());
  });
  await page.goto(form.url);
  await formReady(page);
  await expect(page.locator('.subtleforms-picker__trigger')).toBeVisible();
  expect(combined).toHaveLength(1);
  expect(seen.assets.some((u) => /build\/frontend\/frontend\.js/.test(u))).toBe(false);
  // Loaded from the plugin's build folder, not from the cache folder.
  expect(chunk(seen, 'field-date')).toBe(true);
});
