/**
 * 2.10.0: autofill hints.
 *
 * - Front end: Text fields keyed name and company render autocomplete="name"
 *   and "organization"; a Notes field renders no attribute.
 * - Builder: the Autofill select in the Advanced section sets the token on
 *   the field, and Off renders autocomplete="off".
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { adminApi, openPanel, publishForm, cleanup, loginPage, openBuilder, waitForForm } = require('./helpers');

const SHOTS = process.env.SF_SHOTS || 'test-results/shots/autocomplete';
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

async function makeForm(title, fields, metadata = {}) {
  const form = await publishForm(client, { title: `${title} ${Date.now()}`, fields, metadata });
  created.push(form);
  return form;
}

const fields = () => [
  { id: 'n', key: 'name', type: 'text', label: 'Name' },
  { id: 'c', key: 'company', type: 'text', label: 'Company' },
  { id: 'o', key: 'notes', type: 'text', label: 'Notes' },
];

test('front end: Name and Company get autofill tokens, Notes gets none', async ({ page }) => {
  const form = await makeForm('Autofill live', fields());
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('input[name="name"]')).toHaveAttribute('autocomplete', 'name');
  await expect(page.locator('input[name="company"]')).toHaveAttribute('autocomplete', 'organization');
  await expect(page.locator('input[name="notes"]')).not.toHaveAttribute('autocomplete', /.*/);
});

test.describe('builder', () => {
  test.use({ deviceScaleFactor: 2 });
  test('choosing Off for Name renders autocomplete="off"', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const form = await makeForm('Autofill builder', fields());
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('.subtleforms-builder-canvas .sf-field-chrome').first().click();
  const inspector = page.locator('.sf-field-inspector');
  await openPanel(page, 'Advanced');

  const select = inspector.getByLabel('Autofill', { exact: true });
  await expect(select).toHaveValue('');
  expect(await select.locator('option').allTextContents()).toEqual([
    'Automatic', 'Off', 'Full name', 'First name', 'Last name', 'Email', 'Phone', 'Company', 'Job title',
    'Street address', 'Address line 1', 'Address line 2', 'City', 'State or region', 'Postal code', 'Country', 'Website', 'Birthday',
  ]);
  await expect(inspector.getByText('Tells browsers and password managers what this field asks for, so they can fill it in.')).toBeVisible();
  await select.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/autofill-inspector.png` });

  await select.selectOption('off');
  const badge = page.locator('.sf-builder-header-bar__mode-badge');
  await expect(badge).toContainText('changes not live');
  await page.locator('.sf-builder-header-bar__publish-button').click();
  await expect(badge).toHaveText(/^Published$/, { timeout: 20000 });
  const [first] = (await client.call('GET', `/forms/${form.id}/schema?context=builder`)).body.data.schema.fields;
  expect(first.autocomplete ?? first.config?.autocomplete).toBe('off');

  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('input[name="name"]')).toHaveAttribute('autocomplete', 'off');
  await expect(page.locator('input[name="company"]')).toHaveAttribute('autocomplete', 'organization');
});
});

test('front end: a field set to Off renders autocomplete="off"', async ({ page }) => {
  const form = await makeForm('Autofill off', [
    { id: 'n', key: 'name', type: 'text', label: 'Name', autocomplete: 'off' },
    { id: 'c', key: 'company', type: 'text', label: 'Company', autocomplete: 'name' },
  ]);
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('input[name="name"]')).toHaveAttribute('autocomplete', 'off');
  await expect(page.locator('input[name="company"]')).toHaveAttribute('autocomplete', 'name');
});
