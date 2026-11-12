/**
 * 2.9.0: country flags on the Address field are a capability an add-on
 * switches on. Free draws the flags only when an add-on declares the
 * `address_flags` feature (the subtleforms/addon/features filter) and the
 * field's `showFlags` setting is true. The fixture address-flags-mu.php
 * declares the feature while the cookie sf_test_address_flags is set.
 *
 * - Feature declared and the setting on: the Country menu shows flag images
 *   and the page loads the flag asset.
 * - Feature declared, setting off: letters, no flag asset.
 * - No feature (Free alone), setting on in the schema: letters, no flag asset.
 * - The builder canvas follows the same rule, and Free has no control for it.
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, openBuilder, openPanel, waitForForm } = require('./helpers');

const SHOTS = 'test-results/shots/address-flags';
const BASE = process.env.SF_BASE_URL || 'http://localhost:8899';
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

/** Declare the add-on feature for this browser, the way an add-on would for the site. */
async function declareFeature(context) {
  await context.addCookies([{ name: 'sf_test_address_flags', value: '1', url: BASE }]);
}

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

async function pickPakistan(page) {
  await countryTrigger(page).click();
  const options = page.locator('.subtleforms-picker__list [role="option"]');
  await expect(options.first()).toBeVisible();
  await page.locator('.subtleforms-picker__search').fill('pakistan');
  await page.keyboard.press('Enter');
  return options;
}

async function expectLetters(page, seen) {
  await expect(countryTrigger(page)).toContainText('PK');
  await expect(page.locator('img.subtleforms-flag')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(seen.flags).toEqual([]);
  expect(seen.chunk).toEqual([]);
  await expect(page.locator('head link[href*="feature-flags"]')).toHaveCount(0);
  await expect(page.locator('.subtleforms-form-container')).toHaveAttribute('data-features', 'geo');
}

test('feature declared and option on: flag images show and the flag asset loads', async ({ page, context }) => {
  await declareFeature(context);
  await page.setViewportSize({ width: 1440, height: 1500 });
  const form = await makeForm('Address flags on', [addressField({ showFlags: true })]);
  const seen = watch(page);
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms-form-container')).toHaveAttribute('data-features', 'flags geo');
  await expect(page.locator('head link[rel="preload"][href*="feature-flags"]')).toHaveCount(1);

  await countryTrigger(page).click();
  await expect(page.locator('.subtleforms-picker__list [role="option"]').first()).toBeVisible();
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
  await expect(page.locator('.subtleforms-picker__list [role="option"]').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${SHOTS}/address-flags-on.png` });
});

test('feature declared, option off: letters and no flag asset', async ({ page, context }) => {
  await declareFeature(context);
  const form = await makeForm('Address flags option off', [addressField()]);
  const seen = watch(page);
  await page.goto(form.url);
  await waitForForm(page);
  await pickPakistan(page);
  await expectLetters(page, seen);
});

test('no feature, option on in the schema: letters and no flag asset', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1500 });
  const form = await makeForm('Address flags no feature', [addressField({ showFlags: true })]);
  const seen = watch(page);
  await page.goto(form.url);
  await waitForForm(page);
  await pickPakistan(page);
  await expectLetters(page, seen);
  await countryTrigger(page).click();
  await expect(page.locator('.subtleforms-picker__list [role="option"]').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/address-flags-off.png` });
});

test('the builder canvas draws the flag only with the feature, and Free has no control', async ({ page, context }) => {
  const form = await makeForm('Address flags builder', [addressField({ showFlags: true })]);

  // Free alone: no flag on the canvas, no checkbox in the settings.
  await loginPage(page);
  await openBuilder(page, form.id);
  const canvasField = page.locator('.subtleforms-builder-canvas .sf-field-chrome').first();
  await expect(canvasField.locator('.sf-composite-field')).toBeVisible();
  await expect(canvasField.locator('img.subtleforms-flag')).toHaveCount(0);
  await canvasField.click();
  await openPanel(page, 'General');
  await expect(page.locator('.sf-field-inspector').getByLabel('Show country flags', { exact: true })).toHaveCount(0);

  // Feature declared: the canvas shows a flag beside the Country placeholder.
  await declareFeature(context);
  await openBuilder(page, form.id);
  await expect(canvasField.locator('img.subtleforms-flag')).toHaveCount(1);
});
