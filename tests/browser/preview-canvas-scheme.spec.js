/**
 * 2.9.0: the Light and Dark canvas switch changes only the page around the
 * form. The form keeps its own background in both.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, openBuilder } = require('./helpers');

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: `Canvas scheme ${Date.now()}`,
    metadata: { appearance: { preset: 'default' } },
    fields: [
      { id: 'n', key: 'name', type: 'text', label: 'Name' },
      { id: 'e', key: 'email', type: 'email', label: 'Email' },
    ],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

test('the Dark canvas darkens the page and leaves the form alone', async ({ page }) => {
  await loginPage(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openBuilder(page, form.id);
  await page.evaluate(() => window.localStorage.removeItem('sf-preview-scheme'));
  await page.locator('#sf-builder-view-preview').click();
  await page.locator('.sf-preview-workspace__form').waitFor({ timeout: 30000 });
  const frame = page.frameLocator('iframe.sf-form-preview__frame');
  await frame.locator('.subtleforms-button-submit').waitFor();

  const read = () => frame.locator('html').evaluate((root) => {
    const form = root.querySelector('.subtleforms');
    return {
      page: getComputedStyle(root).backgroundColor,
      body: getComputedStyle(root.ownerDocument.body).backgroundColor,
      form: form ? getComputedStyle(form).backgroundColor : '',
    };
  });

  await page.getByRole('button', { name: 'Light canvas' }).click();
  const light = await read();
  await page.getByRole('button', { name: 'Dark canvas' }).click();
  await expect.poll(async () => (await read()).page).toBe('rgb(31, 31, 31)');
  const dark = await read();
  expect(dark.form).toBe(light.form);
  expect(await page.evaluate(() => window.localStorage.getItem('sf-preview-scheme'))).toBe('dark');

  await page.getByRole('button', { name: 'Light canvas' }).click();
  await expect.poll(async () => (await read()).page).toBe(light.page);
});
