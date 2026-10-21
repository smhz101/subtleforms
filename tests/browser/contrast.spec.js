/**
 * FLD2-18 and FB-19: the Columns layout header and the prefix and suffix
 * text keep at least 4.5:1 contrast (axe color-contrast), and the same text
 * colour token is used for helper text across the pickers.
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { adminApi, publishForm, cleanup, waitForForm } = require('./helpers');

const SHOTS = process.env.SF_SHOTS || 'test-results/shots/bugs250';
require('fs').mkdirSync(SHOTS, { recursive: true });
let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Contrast check',
    fields: [
      {
        id: 'c1',
        key: 'place',
        type: 'chained_select',
        label: 'Where',
        presentation: 'columns',
        levels: [
          { label: 'Region', options: [{ label: 'Nowhere', value: 'none' }, { label: 'Europe', value: 'eu' }] },
          { label: 'Country', options: [{ label: 'France', value: 'fr', parent: 'eu' }] },
          { label: 'City', options: [{ label: 'Paris', value: 'par', parent: 'fr' }] },
        ],
      },
      { id: 'c2', key: 'price', type: 'number', label: 'Price', prefix: '$', suffix: 'kg' },
      { id: 'c3', key: 'weight', type: 'text', label: 'Handle', prefix: 'https://', suffix: '.example' },
    ],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

async function contrast(page) {
  const results = await new AxeBuilder({ page })
    .include('.subtleforms-form-container')
    .withRules(['color-contrast'])
    .analyze();
  return results.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.any[0]?.message || v.help}`));
}

test('the Columns layout and the affixes pass colour contrast', async ({ page }) => {
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms-chained-select.is-columns')).toBeVisible();
  await expect(page.locator('.subtleforms-chained-select__level.is-inactive').first()).toBeVisible();
  await expect(page.locator('.subtleforms-input-affix__prefix').first()).toBeVisible();
  expect(await contrast(page)).toEqual([]);
  await page.locator('.subtleforms-form-container').screenshot({ path: `${SHOTS}/bugs-columns-and-affix-contrast.png` });
});

test('the Columns layout passes contrast after choosing a country', async ({ page }) => {
  await page.goto(form.url);
  await waitForForm(page);
  await page.locator('.subtleforms-chained-select__choice', { hasText: 'Europe' }).click();
  expect(await contrast(page)).toEqual([]);
});
