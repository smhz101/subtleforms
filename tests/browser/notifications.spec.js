/**
 * QA-02 / QA-03: new forms start with a ready admin notification; incomplete
 * actions show "Needs setup" and never block saving; form-scoped notices
 * clear when the user leaves the form; the form 11 shape (payment form with
 * checkout settings and a disabled blank email action) saves.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, openBuilder } = require('./helpers');

let client;
const created = [];

test.beforeAll(async () => {
  client = await adminApi();
});

test.afterAll(async () => {
  for (const form of created) {
    await cleanup(client, form);
  }
});

async function draftForm(title, schemaExtra) {
  const res = await client.call('POST', '/forms', { title });
  const id = res.body.data.id;
  const saved = await client.call('POST', `/forms/${id}/schema`, {
    activate: false,
    schema: { schema_version: 1, metadata: { type: 'regular', name: title, title }, fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }], ...schemaExtra },
  });
  if (saved.status >= 300) throw new Error(JSON.stringify(saved.body));
  created.push({ id });
  return { id };
}

async function openActions(page) {
  await page.locator('#sf-builder-view-settings').click();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
}

const saveStatus = (page) => page.locator('.sf-builder-header-bar__save-status');

async function saveDraft(page) {
  await page.locator('.sf-builder-header-bar__publish-arrow').click();
  await page.getByRole('menuitem', { name: /Save draft/ }).click();
}

test('a new blank form starts with a ready admin notification (QA-02)', async ({ page }) => {
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
  await page.getByRole('button', { name: 'New form' }).first().click();
  await page.getByRole('button', { name: /Blank form/ }).click();
  await page.getByRole('button', { name: 'Create form' }).click();
  await page.waitForSelector('.sf-form-editor__canvas', { timeout: 30000 });
  const id = Number(new URL(page.url()).searchParams.get('form_id')) || null;
  if (id) created.push({ id });

  await openActions(page);
  const panel = page.locator('.sf-actions-panel__item--email').first();
  await expect(panel.getByRole('textbox', { name: 'To', exact: true })).toHaveValue('{admin_email}');
  await expect(panel.getByRole('textbox', { name: 'Subject', exact: true })).toHaveValue('New entry: {form_title}');
  await expect(page.locator('.sf-actions-panel__field-notice', { hasText: 'A subject line is required.' })).toHaveCount(0);
  await expect(page.locator('.sf-actions-panel__field-notice', { hasText: 'A recipient email address is required.' })).toHaveCount(0);
  await expect(panel.locator('.sf-actions-panel__needs-setup')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/shots/free231/qa02-new-form-notification.png' });
});

test('an incomplete action shows Needs setup, warnings only while on, and never blocks saving (QA-02/03)', async ({ page }) => {
  const form = await draftForm('QA-03 incomplete', {
    actions: [{ id: 'e1', type: 'email', enabled: true, settings: { to: '', subject: '', message: '' } }],
  });
  await loginPage(page);
  await openBuilder(page, form.id);
  await openActions(page);
  const item = page.locator('.sf-actions-panel__item--email').first();
  await expect(item.locator('.sf-actions-panel__needs-setup')).toHaveText('Needs setup');
  await expect(item.getByText('A subject line is required.')).toBeVisible();

  // Switching it off clears the warnings; the form still saves.
  await item.getByRole('checkbox', { name: 'Enabled' }).uncheck();
  await expect(page.locator('.sf-actions-panel__field-notice', { hasText: 'A subject line is required.' })).toHaveCount(0);
  await expect(item.locator('.sf-actions-panel__needs-setup')).toBeVisible();
  await saveDraft(page);
  await expect(saveStatus(page)).toHaveText('Saved', { timeout: 20000 });
  await page.screenshot({ path: 'test-results/shots/free231/qa03-needs-setup.png' });

  // Fixing it clears the badge.
  await item.getByRole('checkbox', { name: 'Enabled' }).check();
  await item.getByRole('textbox', { name: 'To', exact: true }).fill('{admin_email}');
  await item.getByRole('textbox', { name: 'Subject', exact: true }).fill('Hello');
  await expect(item.locator('.sf-actions-panel__needs-setup')).toHaveCount(0);
  await expect(page.locator('.sf-actions-panel__field-notice', { hasText: 'A subject line is required.' })).toHaveCount(0);
});

test('form-scoped errors name the setting and clear when leaving the form (QA-03)', async ({ page }) => {
  const form = await draftForm('QA-03 notices', {});
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.route(`**/forms/${form.id}/schema*`, (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'validation_error', message: 'Validation failed', meta: { fields: { 'schema.metadata.payment': 'Choose a currency.' } } } }),
    });
  });
  await page.locator('.sf-field-chrome').first().click();
  await page.getByLabel('Label', { exact: true }).fill('Full name');
  await saveDraft(page);
  await expect(saveStatus(page)).toHaveAttribute('title', /Payment settings: Choose a currency\./, { timeout: 20000 });

  // Publishing fails the same way and shows a snackbar for this form.
  await page.locator('.sf-builder-header-bar__publish-button').click();
  const confirm = page.getByRole('dialog').getByRole('button', { name: /Publish|Update/ });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await page.unroute(`**/forms/${form.id}/schema*`);

  // The publish failure left a notice for this form.
  await expect(page.locator('.components-snackbar', { hasText: 'Payment settings' }).first()).toBeVisible({ timeout: 20000 });

  // Leaving the form clears its notices.
  await page.getByRole('button', { name: 'Back to forms' }).click();
  const discard = page.getByRole('button', { name: 'Discard Changes' });
  if (await discard.isVisible().catch(() => false)) await discard.click();
  await page.waitForSelector('.sf-data-table__table', { timeout: 30000 });
  await expect(page.locator('.components-snackbar, .components-notice', { hasText: /Payment settings|subject line/ })).toHaveCount(0);
  await expect(page.locator('#a11y-speak-polite')).not.toContainText(/Payment settings|subject line/);
});

test('the form 11 shape saves: payment form with checkout settings and a disabled blank email (QA-03)', async ({ page }) => {
  const form = await draftForm('QA form 11', {
    metadata: { type: 'payment', name: 'QA form 11', title: 'QA form 11', payment: { currency: 'USD', processor: 'woocommerce' } },
    fields: [
      { id: 'em', key: 'email', type: 'email', label: 'Email', required: true },
      { id: 'pp', key: 'ticket', type: 'payment_product', label: 'Ticket', price: 10 },
      { id: 'ps', key: 'summary', type: 'payment_summary', label: 'Summary' },
    ],
    actions: [{ id: 'e1', type: 'email', enabled: false, settings: { to: '', subject: '', message: '' } }],
  });
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('.sf-field-chrome').first().click();
  await page.getByLabel('Label', { exact: true }).fill('Email address');
  await saveDraft(page);
  await expect(saveStatus(page)).toHaveText('Saved', { timeout: 20000 });
  const schema = (await client.call('GET', `/forms/${form.id}/schema?context=builder`)).body.data.schema;
  expect(schema.fields[0].label).toBe('Email address');
  expect(schema.metadata.payment.processor).toBe('woocommerce');
});
