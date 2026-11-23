/**
 * #140 item 3: the Rich text toolbar buttons have no visible text that
 * differs from their name, so axe finds no label-content-name-mismatch.
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { adminApi, publishForm, cleanup, waitForForm } = require('./helpers');

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Rich text names',
    fields: [{ id: 'rt1', key: 'notes', type: 'rich_text', label: 'Notes' }],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

test('rich text toolbar buttons pass the label-content-name-mismatch rule', async ({ page }) => {
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms-richtext__editor')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('.subtleforms-richtext__toolbar')
    .withRules(['label-content-name-mismatch'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  for (const name of ['Bold', 'Italic', 'Bulleted list', 'Numbered list']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button).toBeVisible();
    await expect(button.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  }
});
