/**
 * 2.9.0: the builder preview loads the active theme's real styles. On a
 * classic theme the label font and button look match the published page.
 * Skipped unless a classic theme is active, which the CI site does not use.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, openBuilder } = require('./helpers');

let client;
let form;
let classic = false;

test.beforeAll(async () => {
  client = await adminApi();
  const res = await client.call('GET', '/appearance/theme-assets');
  const data = res.body?.data || res.body || {};
  classic = data.isBlockTheme === false;
  form = await publishForm(client, {
    title: `Classic theme ${Date.now()}`,
    metadata: { appearance: { preset: 'theme', tokens: { fontFamily: 'inherit', colorBackground: 'transparent' }, variants: { layout: 'inherit' } } },
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

test('preview label and button match the live page on a classic theme', async ({ page, context }) => {
  test.skip(!classic, 'needs a classic theme active');
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('#sf-builder-view-preview').click();
  const frame = page.frameLocator('iframe.sf-form-preview__frame');
  await frame.locator('.subtleforms-button-submit').waitFor({ timeout: 30000 });
  const live = await context.newPage();
  await live.goto(form.url);
  await live.waitForSelector('.subtleforms-button-submit');
  const probe = (root) => root.evaluate((body) => {
    const label = getComputedStyle(body.querySelector('.subtleforms-field-label'));
    const btn = getComputedStyle(body.querySelector('.subtleforms-button-submit'));
    return { font: label.fontFamily, color: label.color, bg: btn.backgroundColor, radius: btn.borderTopLeftRadius };
  });
  expect(await probe(frame.locator('body'))).toEqual(await probe(live.locator('body')));
});
