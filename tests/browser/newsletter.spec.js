/**
 * 2.3.0 feature 19: Newsletter template, inline layout and the dark-surface
 * appearance preset.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, waitForForm } = require('./helpers');

let client;
const created = [];

test.beforeAll(async () => {
  client = await adminApi();
});

test.afterAll(async () => {
  for (const form of created) await cleanup(client, form);
});

test('the Newsletter template puts email and button on one row', async ({ page }) => {
  const res = await client.call('GET', '/templates');
  const templates = res.body?.data?.templates || res.body?.templates || {};
  const tpl = templates.newsletter;
  expect(tpl).toBeTruthy();
  expect(tpl.schema.fields).toHaveLength(1);
  expect(tpl.schema.fields[0].type).toBe('email');
  expect(tpl.schema.metadata.appearance.variants.layout).toBe('inline');

  const form = await publishForm(client, {
    title: 'Newsletter inline',
    metadata: tpl.schema.metadata,
    fields: tpl.schema.fields.map((f) => ({ ...f, key: f.id })),
  });
  created.push(form);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms.subtleforms--layout-inline')).toHaveCount(1);
  await expect(page.locator('.subtleforms-form-title')).toHaveCount(0);
  await expect(page.locator('.subtleforms-button-submit')).toHaveText('Subscribe');

  const input = await page.locator('#subtleforms-field-email').boundingBox();
  const button = await page.locator('.subtleforms-button-submit').boundingBox();
  // Same row: the button sits to the right of the input and their rows overlap.
  expect(button.x).toBeGreaterThan(input.x + input.width - 1);
  expect(Math.abs(button.y + button.height / 2 - (input.y + input.height / 2))).toBeLessThan(input.height);

  // On a phone they stack.
  await page.setViewportSize({ width: 375, height: 800 });
  const inputM = await page.locator('#subtleforms-field-email').boundingBox();
  const buttonM = await page.locator('.subtleforms-button-submit').boundingBox();
  expect(buttonM.y).toBeGreaterThan(inputM.y + inputM.height - 1);
});

test('the dark-surface preset drops the card and keeps its colours', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Dark surface',
    metadata: {
      appearance: {
        preset: 'dark-surface',
        tokens: { colorBackground: 'transparent', colorButtonText: '#111318', colorPrimary: '#ffffff' },
        variants: { layout: 'inline' },
      },
    },
    fields: [{ id: 'e', key: 'email', type: 'email', label: 'Email' }],
  });
  created.push(form);
  await page.goto(form.url);
  await waitForForm(page);
  const root = page.locator('.subtleforms.subtleforms--preset-dark-surface');
  await expect(root).toHaveCount(1);
  await expect(root).toHaveCSS('box-shadow', 'none');
  await expect(page.locator('.subtleforms-button-submit')).toHaveCSS('color', 'rgb(17, 19, 24)');
});
