/**
 * 2.7.2: custom styling. A form that inherits the theme previews with the
 * theme's fonts and colours, a palette colour and a button radius give the
 * same computed values in the builder preview and on the published page, and
 * a custom CSS rule applies to that form only.
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, publishForm, loginPage, openBuilder } = require('./helpers');

const SHOTS = process.env.SF_SHOTS_DIR || 'test-results/shots/custom-styling';
const DIST = '/home/claude/dist/screens-2.7.2';
const fields = (label) => [
  { id: 'a', key: 'name', type: 'text', label: `${label} name`, help: 'Help text' },
  { id: 'b', key: 'email', type: 'email', label: `${label} email` },
];
const themeAppearance = (extra = {}) => ({
  preset: 'theme',
  tokens: { fontFamily: 'inherit', colorBackground: 'transparent', ...(extra.tokens || {}) },
  variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', layout: 'inherit', width: 'theme' },
  ...(extra.root || {}),
});

let client;
let form;
let other;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, { title: `Styling ${Date.now()}`, metadata: { appearance: themeAppearance() }, fields: fields('Styled') });
  other = await publishForm(client, { title: `Styling other ${Date.now()}`, metadata: { appearance: themeAppearance() }, fields: fields('Other') });
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.mkdirSync(DIST, { recursive: true });
});

test.afterAll(async () => {
  await cleanup(client, { id: form?.id });
  await cleanup(client, { id: other?.id });
});

const probe = (root) => root.evaluate((body) => {
  const q = (s) => body.querySelector(s);
  const c = (e) => (e ? getComputedStyle(e) : {});
  const label = c(q('.subtleforms-field-label'));
  const btn = c(q('.subtleforms-button-submit'));
  return { labelFont: label.fontFamily, labelColor: label.color, btnRadius: btn.borderTopLeftRadius, btnBg: btn.backgroundColor };
});

test('theme form preview matches the live page and a palette pick and radius stay in sync', async ({ page, context }) => {
  await loginPage(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openBuilder(page, form.id);
  await page.locator('#sf-builder-view-preview').click();
  await page.locator('.sf-preview-workspace__form').waitFor({ timeout: 30000 });
  const frame = page.frameLocator('iframe.sf-form-preview__frame');
  await frame.locator('.subtleforms-button-submit').waitFor();

  const live = await context.newPage();
  await live.goto(form.url);
  await live.waitForSelector('.subtleforms-button-submit');
  const liveBody = live.locator('body');

  // Untouched theme form: the same fonts and colours as the site.
  const p0 = await probe(frame.locator('body'));
  const l0 = await probe(liveBody);
  expect(p0.labelFont).toBe(l0.labelFont);
  expect(p0.labelColor).toBe(l0.labelColor);
  expect(p0.btnBg).toBe(l0.btnBg);
  await page.screenshot({ path: `${SHOTS}/styling-preview-1440.png` });

  // Custom: pick a palette swatch for the label and a button radius.
  await page.getByRole('radio', { name: 'Custom', exact: true }).click();
  const panel = page.locator('.sf-form-appearance');
  await panel.locator('.components-panel__body-toggle', { hasText: 'Colours' }).click();
  await panel.locator('.sf-color-token__toggle[aria-label^="Label:"]').click();
  await page.locator('.components-popover button:has-text("Accent 3"), .components-popover [aria-label="Accent 3"]').first().click();
  await page.keyboard.press('Escape');
  await panel.locator('.components-panel__body-toggle', { hasText: 'Buttons' }).click();
  const radius = panel.locator('.sf-style-control', { hasText: 'Button radius' }).locator('input[type="number"], input').first();
  await radius.fill('22');
  await radius.blur();
  await page.screenshot({ path: `${SHOTS}/styling-panel-1440.png` });

  await expect.poll(async () => (await probe(frame.locator('body'))).btnRadius).toBe('22px');
  const p1 = await probe(frame.locator('body'));
  expect(p1.labelColor).not.toBe(p0.labelColor);

  await page.getByRole('button', { name: /^(Save|Publish|Update)/ }).first().click();
  await page.waitForTimeout(2000);
  await live.reload();
  await live.waitForSelector('.subtleforms-button-submit');
  const l1 = await probe(liveBody);
  expect(l1.btnRadius).toBe(p1.btnRadius);
  expect(l1.labelColor).toBe(p1.labelColor);
  expect(l1.labelFont).toBe(p1.labelFont);
});

test('custom CSS applies only to its own form', async ({ page, context }) => {
  const api = await adminApi();
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('#sf-builder-view-preview').click();
  await page.locator('.sf-preview-workspace__form').waitFor({ timeout: 30000 });
  await page.getByRole('radio', { name: 'Custom', exact: true }).click();
  const panel = page.locator('.sf-form-appearance');
  await panel.getByLabel('Show advanced').check();
  await panel.locator('textarea').fill('.subtleforms-button-submit{letter-spacing:7px}');
  const frame = page.frameLocator('iframe.sf-form-preview__frame');
  await expect(frame.locator('.subtleforms-button-submit')).toHaveCSS('letter-spacing', '7px');
  await page.getByRole('button', { name: /^(Save|Publish|Update)/ }).first().click();
  await page.waitForTimeout(2000);

  const a = await context.newPage();
  await a.goto(form.url);
  await expect(a.locator('.subtleforms-button-submit')).toHaveCSS('letter-spacing', '7px');
  const b = await context.newPage();
  await b.goto(other.url);
  await expect(b.locator('.subtleforms-button-submit')).not.toHaveCSS('letter-spacing', '7px');
});

test.afterAll(() => {
  for (const f of fs.readdirSync(SHOTS)) {
    if (/^styling-.*\.png$/.test(f)) fs.copyFileSync(`${SHOTS}/${f}`, `${DIST}/${f}`);
  }
});
