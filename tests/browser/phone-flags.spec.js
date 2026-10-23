/**
 * 2.7.2: optional country flags on the Phone and Country fields.
 *
 * - Off (the default): the form looks as before and makes no request for the
 *   flag file, nor for the flags code.
 * - On: the closed button shows the flag of the country beside its dial code,
 *   every country in the open list has a flag, picking Pakistan shows the PK
 *   flag and +92. Flags are decorative (hidden from screen readers) and the
 *   button keeps its name.
 * - The builder canvas and the preview show the same flags.
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, openBuilder, openPanel, waitForForm } = require('./helpers');

const SHOTS = 'test-results/shots/phone-flags';
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

async function makeForm(title, fields) {
  const form = await publishForm(client, { title: `${title} ${Date.now()}`, fields });
  created.push(form);
  return form;
}

const phoneField = (extra = {}) => ({
  id: 'p1',
  key: 'phone',
  type: 'phone',
  label: 'Phone',
  enableCountryCode: true,
  defaultCountry: 'GB',
  ...extra,
});

/** Requests for flag files or the flags code, and how they ended. */
function watch(page) {
  const seen = { flags: [], chunk: [], any: [] };
  page.on('response', async (response) => {
    const url = response.url();
    const file = /\/build\/frontend\/flags\/([a-z]{2})\.svg(\?|$)/.exec(url);
    if (/flags\.svg|\/flags\/[a-z]{2}\.svg/.test(url)) seen.any.push(url);
    if (file) {
      const body = await response.body().catch(() => Buffer.alloc(0));
      seen.flags.push({ code: file[1], status: response.status(), type: response.headers()['content-type'] || '', bytes: body.length });
    }
    if (/feature-flags\./.test(url)) seen.chunk.push(url);
  });
  return seen;
}

const codes = (seen) => [...new Set(seen.flags.map((hit) => hit.code))].sort();
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] || 0;

const flagOf = (locator) => locator.locator('img.subtleforms-flag').first().getAttribute('src');

test('flags off: no flag request, no flag image, the picker works as before', async ({ page }) => {
  const form = await makeForm('Flags off', [phoneField(), { id: 'k1', key: 'country', type: 'country', label: 'Country' }]);
  const seen = watch(page);
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms-form-container')).toHaveAttribute('data-features', 'geo');
  await expect(page.locator('.subtleforms-phone__dial')).toHaveText('+44');

  await page.locator('.subtleforms-phone__trigger').click();
  await expect(page.locator('.subtleforms-phone__option').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.subtleforms-field-country .subtleforms-picker__trigger, #subtleforms-field-country').first().click().catch(() => {});

  await expect(page.locator('img.subtleforms-flag')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(seen.flags).toEqual([]);
  expect(seen.any).toEqual([]);
  expect(seen.chunk).toEqual([]);
  await expect(page.locator('head link[href*="feature-flags"]')).toHaveCount(0);
});

for (const [name, size] of [['1280', { width: 1280, height: 900 }], ['390', { width: 390, height: 844 }]]) {
  test(`flags on at ${name}px: button, list and picking Pakistan`, async ({ page }) => {
    await page.setViewportSize(size);
    const form = await makeForm('Flags on', [phoneField({ showFlags: true })]);
    const seen = watch(page);
    await page.goto(form.url);
    await waitForForm(page);
    await expect(page.locator('.subtleforms-form-container')).toHaveAttribute('data-features', 'flags geo');
    await expect(page.locator('head link[rel="preload"][href*="feature-flags"]')).toHaveCount(1);

    const trigger = page.locator('.subtleforms-phone__trigger');
    // Default country: the GB flag and +44, in the closed button.
    await expect(trigger.locator('img.subtleforms-flag')).toHaveCount(1);
    expect(await flagOf(trigger)).toMatch(/\/build\/frontend\/flags\/gb\.svg$/);
    await expect(trigger.locator('.subtleforms-phone__dial')).toHaveText('+44');
    // Decorative, and the button keeps the name it had.
    await expect(trigger.locator('.subtleforms-phone__flag')).toHaveAttribute('aria-hidden', 'true');
    await expect(trigger).toHaveAttribute('aria-label', 'Country code, United Kingdom +44');
    // Drawn at 20 by 15, at the start of the button.
    const box = await trigger.locator('img.subtleforms-flag').boundingBox();
    expect(Math.round(box.width)).toBe(20);
    expect(Math.round(box.height)).toBe(15);
    const dialBox = await trigger.locator('.subtleforms-phone__dial').boundingBox();
    expect(box.x).toBeLessThan(dialBox.x);

    // First view: only the selected country's flag was requested, once.
    await page.waitForLoadState('networkidle');
    expect(codes(seen)).toEqual(['gb']);
    expect(seen.flags).toHaveLength(1);
    seen.flags.forEach((hit) => {
      expect(hit.status).toBe(200);
      expect(hit.type).toContain('svg');
    });
    expect(seen.chunk).toHaveLength(1);
    await expect(trigger.locator('img.subtleforms-flag')).toHaveAttribute('loading', 'eager');
    console.log(`first view at ${name}px: ${seen.flags.length} flag file, ${seen.flags.reduce((n, h) => n + h.bytes, 0)} bytes`);
    const gb = await trigger.locator('img.subtleforms-flag').screenshot();

    await page.screenshot({ path: `${SHOTS}/phone-flags-closed-${name}.png` });

    // The open list: a flag on every option; search by name and by code still works.
    await trigger.click();
    const options = page.locator('.subtleforms-phone__option');
    await expect(options.first()).toBeVisible();
    expect(await options.count()).toBeGreaterThan(150);
    expect(await options.locator('img.subtleforms-flag').count()).toBe(await options.count());
    await expect(options.first().locator('img.subtleforms-flag')).toHaveAttribute('loading', 'lazy');
    // Only the rows in view load their flags, not the whole list.
    await page.waitForLoadState('networkidle');
    const visible = await options.evaluateAll((nodes) => {
      const list = nodes[0].closest('.subtleforms-phone__list').getBoundingClientRect();
      return nodes.filter((n) => {
        const r = n.getBoundingClientRect();
        return r.bottom > list.top && r.top < list.bottom;
      }).length;
    });
    const listed = codes(seen).filter((code) => code !== 'gb');
    expect(listed.length).toBeGreaterThan(0);
    // The browser also loads rows just below the view; never the whole list.
    expect(listed.length).toBeGreaterThanOrEqual(visible - 1);
    expect(listed.length).toBeLessThan(60);
    expect(listed).not.toContain('zw');
    const sizes = seen.flags.map((hit) => hit.bytes);
    console.log(`open list at ${name}px: ${visible} rows visible, ${seen.flags.length} flag files loaded, median ${median(sizes)} bytes, total ${sizes.reduce((n, b) => n + b, 0)} bytes`);
    await expect(options.first().locator('.subtleforms-phone__flag')).toHaveAttribute('aria-hidden', 'true');
    const search = page.locator('.subtleforms-phone__search');
    await search.fill('pak');
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText('Pakistan');
    await expect(options.first()).toContainText('+92');
    expect(await flagOf(options.first())).toMatch(/\/pk\.svg$/);
    await search.fill('+92');
    await expect(options.filter({ hasText: 'Pakistan' })).toHaveCount(1);
    await search.fill('');
    await page.screenshot({ path: `${SHOTS}/phone-flags-list-${name}.png` });

    // Pick Pakistan with the keyboard.
    await search.fill('pakistan');
    await page.keyboard.press('Enter');
    await expect(page.locator('.subtleforms-phone__menu')).toHaveCount(0);
    await expect(trigger.locator('.subtleforms-phone__dial')).toHaveText('+92');
    expect(await flagOf(trigger)).toMatch(/\/pk\.svg$/);
    await expect(trigger).toHaveAttribute('aria-label', 'Country code, Pakistan +92');
    const pk = await trigger.locator('img.subtleforms-flag').screenshot();
    expect(Buffer.compare(gb, pk)).not.toBe(0);
    await page.locator('.subtleforms-phone__input').fill('300 1234567');
    await page.screenshot({ path: `${SHOTS}/phone-flags-pakistan-${name}.png` });
  });
}

test('flags on: the Country field shows flags too', async ({ page }) => {
  const form = await makeForm('Flags country', [{ id: 'k1', key: 'country', type: 'country', label: 'Country', default_country: 'PK', showFlags: true }]);
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms-form-container')).toHaveAttribute('data-features', 'flags geo');
  const trigger = page.locator('.subtleforms-picker__trigger').first();
  expect(await flagOf(trigger)).toMatch(/\/pk\.svg$/);
  await trigger.click();
  const options = page.locator('.subtleforms-picker__list [role="option"]');
  await expect(options.first()).toBeVisible();
  expect(await page.locator('.subtleforms-picker__list img.subtleforms-flag').count()).toBeGreaterThan(200);
  await page.locator('.subtleforms-picker__search').fill('germany');
  expect(await flagOf(page.locator('.subtleforms-picker__list [role="option"]:not(:has-text("Clear"))').first())).toMatch(/\/de\.svg$/);
});

test('a theme form with flags still draws them at 20 by 15 without the main stylesheet', async ({ page }) => {
  const form = await makeForm('Flags theme', [phoneField({ showFlags: true })]);
  // An inherit-the-theme form skips the plugin stylesheet when it can; the
  // layout lines are inline either way.
  const meta = { appearance: { preset: 'theme' } };
  const schema = { schema_version: 1, metadata: { type: 'regular', name: 'Flags theme', title: 'Flags theme', ...meta }, fields: [phoneField({ showFlags: true })] };
  await client.call('POST', `/forms/${form.id}/schema`, { schema, activate: true });
  await page.goto(form.url);
  await waitForForm(page);
  const box = await page.locator('.subtleforms-phone__trigger img.subtleforms-flag').boundingBox();
  expect(Math.round(box.width)).toBe(20);
  expect(Math.round(box.height)).toBe(15);
});

test('RTL: the flag stays at the start of the button', async ({ page }) => {
  const form = await makeForm('Flags rtl', [phoneField({ showFlags: true })]);
  await page.goto(form.url);
  await waitForForm(page);
  await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
  const trigger = page.locator('.subtleforms-phone__trigger');
  const flag = await trigger.locator('img.subtleforms-flag').boundingBox();
  const dial = await trigger.locator('.subtleforms-phone__dial').boundingBox();
  expect(flag.x).toBeGreaterThan(dial.x);
});

test('the builder canvas and the preview show flags, and the setting turns them on and off', async ({ page }) => {
  const form = await makeForm('Flags builder', [phoneField()]);
  const seen = watch(page);
  await loginPage(page);
  await openBuilder(page, form.id);
  const canvasField = page.locator('.subtleforms-builder-canvas .sf-field-chrome').first();
  await expect(canvasField.locator('.subtleforms-phone__trigger')).toBeVisible();
  await expect(canvasField.locator('img.subtleforms-flag')).toHaveCount(0);

  await canvasField.click();
  await openPanel(page, 'General');
  const toggle = page.locator('.sf-field-inspector').getByLabel('Show country flags');
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('.sf-field-inspector')).toContainText('Loads a flag image only for forms that use it.');
  await toggle.check();
  await expect(canvasField.locator('img.subtleforms-flag')).toHaveCount(1);
  expect(await flagOf(canvasField)).toMatch(/\/build\/frontend\/flags\/gb\.svg$/);
  await expect(canvasField.locator('.subtleforms-phone__trigger')).toHaveAttribute('aria-label', 'Country code, United Kingdom +44');
  await expect.poll(() => seen.flags.filter((hit) => hit.code === 'gb').length).toBeGreaterThan(0);
  expect(seen.flags.every((hit) => hit.status === 200)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/phone-flags-builder-1280.png` });

  // The preview draws the form the way the site does.
  await page.locator('#sf-builder-view-preview').click();
  await page.locator('.sf-preview-workspace__form').waitFor({ timeout: 30000 });
  await expect
    .poll(async () => {
      let total = 0;
      for (const frame of page.frames()) {
        total += await frame.locator('.subtleforms-phone__trigger img.subtleforms-flag').count();
      }
      return total;
    }, { timeout: 20000 })
    .toBe(1);
  await page.screenshot({ path: `${SHOTS}/phone-flags-preview-1280.png` });

});
