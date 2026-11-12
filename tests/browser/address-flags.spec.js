/**
 * 2.9.0: optional country flags on the Address field.
 *
 * - Off (the default): the Country menu shows letters, the page makes no
 *   request for flag files or the flags code.
 * - On: the Country menu shows flag images and the page loads the flag asset.
 * - The builder canvas shows a flag and the setting turns it on and off.
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, openBuilder, openPanel, waitForForm } = require('./helpers');

const SHOTS = 'test-results/shots/address-flags';
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

const addressField = (extra = {}) => ({ id: 'a1', key: 'addr', type: 'address_group', label: 'Address', ...extra });

function watch(page) {
  const seen = { flags: [], chunk: [] };
  page.on('response', (response) => {
    const url = response.url();
    const file = /\/build\/frontend\/flags\/([a-z]{2})\.svg(\?|$)/.exec(url);
    if (file) seen.flags.push({ code: file[1], status: response.status() });
    if (/feature-flags\./.test(url)) seen.chunk.push(url);
  });
  return seen;
}

const countryTrigger = (page) => page.locator('.subtleforms-address-group .subtleforms-picker__trigger');

test('flags on: the Country menu shows flag images and the flag asset loads', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const form = await makeForm('Address flags on', [addressField({ showFlags: true })]);
  const seen = watch(page);
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms-form-container')).toHaveAttribute('data-features', 'flags geo');
  await expect(page.locator('head link[rel="preload"][href*="feature-flags"]')).toHaveCount(1);

  await countryTrigger(page).click();
  const options = page.locator('.subtleforms-picker__list [role="option"]');
  await expect(options.first()).toBeVisible();
  expect(await page.locator('.subtleforms-picker__list img.subtleforms-flag').count()).toBeGreaterThan(200);
  await page.locator('.subtleforms-picker__search').fill('pakistan');
  await page.keyboard.press('Enter');
  await expect(countryTrigger(page).locator('img.subtleforms-flag')).toHaveAttribute('src', /\/build\/frontend\/flags\/pk\.svg$/);
  await expect(countryTrigger(page)).toContainText('Pakistan');
  await page.waitForLoadState('networkidle');
  expect(seen.chunk).toHaveLength(1);
  expect(seen.flags.length).toBeGreaterThan(0);
  expect(seen.flags.every((hit) => hit.status === 200)).toBe(true);

  // The stored value is still the ISO code.
  await expect(page.locator('select[name="addr_country"]')).toHaveValue('PK');

  await countryTrigger(page).click();
  await expect(options.first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SHOTS}/address-flags-on.png` });
});

test('flags off: letters, no flag image, no flag request', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const form = await makeForm('Address flags off', [addressField()]);
  const seen = watch(page);
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms-form-container')).toHaveAttribute('data-features', 'geo');

  await countryTrigger(page).click();
  const options = page.locator('.subtleforms-picker__list [role="option"]');
  await expect(options.first()).toBeVisible();
  await page.locator('.subtleforms-picker__search').fill('pakistan');
  await page.keyboard.press('Enter');
  await expect(countryTrigger(page)).toContainText('PK');
  await expect(page.locator('img.subtleforms-flag')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(seen.flags).toEqual([]);
  expect(seen.chunk).toEqual([]);
  await expect(page.locator('head link[href*="feature-flags"]')).toHaveCount(0);

  await countryTrigger(page).click();
  await expect(options.first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/address-flags-off.png` });
});

test('the builder canvas shows a flag, and the setting turns it on and off', async ({ page }) => {
  const form = await makeForm('Address flags builder', [addressField()]);
  await loginPage(page);
  await openBuilder(page, form.id);
  const canvasField = page.locator('.subtleforms-builder-canvas .sf-field-chrome').first();
  await expect(canvasField.locator('.sf-composite-field')).toBeVisible();
  await expect(canvasField.locator('img.subtleforms-flag')).toHaveCount(0);

  await canvasField.click();
  await openPanel(page, 'General');
  const toggle = page.locator('.sf-field-inspector').getByLabel('Show country flags', { exact: true });
  await expect(toggle).not.toBeChecked();
  await expect(page.locator('.sf-field-inspector')).toContainText('Loads flag images only for forms that use it.');
  await toggle.check();
  await expect(canvasField.locator('img.subtleforms-flag')).toHaveCount(1);
  await toggle.uncheck();
  await expect(canvasField.locator('img.subtleforms-flag')).toHaveCount(0);
});
