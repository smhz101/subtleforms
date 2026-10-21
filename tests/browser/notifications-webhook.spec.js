/**
 * Notifications in 2.5.0: the two add buttons above and below the list, the
 * webhook card (what is sent, ticked or as JSON, and the headers rows).
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, openBuilder: openWide } = require('./helpers');

const SHOTS = process.env.SF_SHOTS_DIR || '';
const WIDTH = Number(process.env.SF_SHOTS_WIDTH || 1280);
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

async function draftForm(title, schemaExtra = {}) {
  const res = await client.call('POST', '/forms', { title });
  const id = res.body.data.id;
  const saved = await client.call('POST', `/forms/${id}/schema`, {
    activate: false,
    schema: {
      schema_version: 1,
      metadata: { type: 'regular', name: title, title },
      fields: [
        { id: 'n', key: 'name', type: 'text', label: 'Name' },
        { id: 'e', key: 'email', type: 'email', label: 'Email' },
        { id: 'pw', key: 'secret', type: 'password', label: 'Password' },
        { id: 'r', key: 'offices', type: 'repeat_container', label: 'Offices', children: [{ id: 'c', key: 'city', type: 'text', label: 'City' }] },
      ],
      ...schemaExtra,
    },
  });
  if (saved.status >= 300) throw new Error(JSON.stringify(saved.body));
  created.push({ id });
  return { id };
}

// A phone is told the builder needs a wider screen; the link opens it anyway.
async function openBuilder(page, id) {
  if (WIDTH >= 600) return openWide(page, id);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${id}`);
  await page.getByRole('button', { name: 'Open the builder anyway' }).or(page.getByRole('link', { name: 'Open the builder anyway' })).click();
  await page.waitForSelector('.sf-field-chrome, .sf-form-editor__canvas', { timeout: 30000 });
}

async function openActions(page) {
  await page.locator('#sf-builder-view-settings').click();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
}

// Screenshots of the settings card, when SF_SHOTS_DIR is set. SF_SHOTS_WIDTH
// picks the width (1280 or 390) and ends up in the file name.
if (SHOTS) test.use({ viewport: { width: WIDTH, height: WIDTH > 600 ? 2600 : 4200 } });

async function shot(page, name) {
  if (SHOTS) await page.locator('.sf-form-settings__card').first().screenshot({ path: `${SHOTS}/notify-${name}-${WIDTH}.png` });
}

test('the add buttons sit above the list and below it once there is a card, with a gap', async ({ page }) => {
  const form = await draftForm('Notify buttons');
  await loginPage(page);
  await openBuilder(page, form.id);
  await openActions(page);

  const bars = page.locator('.sf-actions-panel__add');
  const first = bars.first();
  await expect(first.getByRole('button', { name: 'Send email' })).toBeVisible();
  await expect(first.getByRole('button', { name: 'Send to webhook' })).toHaveAttribute('title', 'Send form data to an API endpoint');

  // The buttons do not touch.
  const a = await first.getByRole('button', { name: 'Send email' }).boundingBox();
  const b = await first.getByRole('button', { name: 'Send to webhook' }).boundingBox();
  expect(b.x - (a.x + a.width)).toBeGreaterThanOrEqual(8);

  // Keyboard: a button is reached with Tab and added with Enter.
  await first.getByRole('button', { name: 'Send email' }).focus();
  await page.keyboard.press('Tab');
  await expect(first.getByRole('button', { name: 'Send to webhook' })).toBeFocused();
  await page.keyboard.press('Enter');

  const card = page.locator('.sf-actions-panel__item--webhook');
  await expect(card).toHaveCount(1);
  await expect(card.locator('.sf-actions-panel__item-type')).toHaveText('Webhook');
  await expect(card.locator('.sf-actions-panel__item-summary')).toHaveText('Send the form data to an API endpoint');
  await expect(bars).toHaveCount(2);
  const list = await card.boundingBox();
  const top = await bars.first().boundingBox();
  const bottom = await bars.nth(1).boundingBox();
  expect(top.y).toBeLessThan(list.y);
  expect(bottom.y).toBeGreaterThan(list.y + list.height);
  await shot(page, 'buttons');
});

test('the webhook card: checkboxes, live example, JSON view and header rows', async ({ page }) => {
  const form = await draftForm('Notify webhook');
  await loginPage(page);
  await openBuilder(page, form.id);
  await openActions(page);
  await page.getByRole('button', { name: 'Send to webhook' }).first().click();
  const card = page.locator('.sf-actions-panel__item--webhook');
  await card.getByRole('textbox', { name: 'Webhook URL' }).fill('https://hooks.example.com/abc');

  // The sentence under the URL says what happens.
  await expect(card.getByText('On every submission SubtleForms sends a POST request to this URL with the data you choose below.')).toBeVisible();

  // Groups, one box per field (a repeater is one box), no password.
  await expect(card.getByRole('group', { name: 'Form' })).toBeVisible();
  await expect(card.getByRole('group', { name: 'Submission' })).toBeVisible();
  await expect(card.getByRole('group', { name: 'Payment' })).toHaveCount(0);
  const answers = card.getByRole('group', { name: 'Answers' });
  await expect(answers.getByRole('checkbox', { name: 'Name' })).toBeChecked();
  await expect(answers.getByRole('checkbox', { name: 'Offices' })).toBeChecked();
  await expect(answers.getByRole('checkbox', { name: 'Password' })).toHaveCount(0);
  await expect(answers.getByRole('checkbox', { name: 'City' })).toHaveCount(0);

  // The example updates live.
  const preview = card.locator('.sf-webhook-preview__code');
  await expect(preview).toContainText('"form_title": "Notify webhook"');
  await card.getByRole('group', { name: 'Submission' }).getByRole('checkbox', { name: 'IP address' }).check();
  await expect(preview).toContainText('"ip_address": "203.0.113.10"');
  await answers.getByRole('button', { name: 'Select none' }).click();
  await expect(preview).not.toContainText('"fields"');
  await answers.getByRole('button', { name: 'Select all' }).click();
  await expect(preview).toContainText('"fields"');
  await answers.getByRole('checkbox', { name: 'Email' }).uncheck();
  await expect(preview).not.toContainText('name@example.com');
  await shot(page, 'webhook-checkboxes');

  // JSON view shows the same body as a template and goes back to the boxes.
  await card.getByRole('button', { name: 'View as JSON' }).first().click();
  const json = card.getByRole('textbox', { name: 'Body as JSON' });
  await expect(json).toHaveValue(/"ip_address": "\{\{entry:ip_address\}\}"/);
  await expect(json).toHaveValue(/"name": "\{\{field:name\}\}"/);
  await shot(page, 'webhook-json');
  await card.getByRole('button', { name: 'Back to checkboxes' }).click();
  await expect(answers.getByRole('checkbox', { name: 'Email' })).not.toBeChecked();

  // A body the boxes cannot show stays custom and says so.
  await card.getByRole('button', { name: 'View as JSON' }).first().click();
  await json.fill('{"who":"{{name}}"}');
  await expect(card.getByText('Custom JSON.')).toBeVisible();
  await expect(card.getByRole('button', { name: 'Back to checkboxes' })).toBeDisabled();
  await expect(preview).toContainText('"who": "Example text"');
  await shot(page, 'webhook-custom-json');
  await card.getByRole('button', { name: 'Start over with checkboxes' }).click();
  await expect(answers.getByRole('checkbox', { name: 'Name' })).toBeChecked();

  // Headers: typing keeps working, a refused header says why, JSON keeps text.
  const headers = card.locator('.sf-webhook-headers');
  await headers.getByRole('button', { name: 'Add header' }).click();
  const name = headers.getByRole('textbox', { name: 'Header name' });
  await name.pressSequentially('X-Api-Key');
  await expect(name).toHaveValue('X-Api-Key');
  await headers.getByRole('textbox', { name: 'Header value' }).pressSequentially('abc 123');
  await expect(headers.getByRole('textbox', { name: 'Header value' })).toHaveValue('abc 123');
  await headers.getByRole('button', { name: 'Add header' }).click();
  await headers.getByRole('textbox', { name: 'Header name' }).nth(1).fill('Host');
  await expect(headers.getByText('SubtleForms sets this header itself')).toBeVisible();
  await shot(page, 'webhook-headers');

  await headers.getByRole('button', { name: 'View as JSON' }).click();
  const hjson = headers.getByRole('textbox', { name: 'Headers as JSON' });
  await expect(hjson).toHaveValue(/"X-Api-Key": "abc 123"/);
  await hjson.fill('{"X-Api-Key": "abc 123", ');
  await expect(headers.getByText('This is not valid JSON yet')).toBeVisible();
  await expect(hjson).toHaveValue('{"X-Api-Key": "abc 123", ');
  await expect(headers.getByRole('button', { name: 'Back to rows' })).toBeDisabled();
  await hjson.fill('{"X-Api-Key": "abc 123", "X-Source": "subtleforms"}');
  await headers.getByRole('button', { name: 'Back to rows' }).click();
  await expect(headers.getByRole('textbox', { name: 'Header name' }).nth(1)).toHaveValue('X-Source');
});

test('a saved webhook with the standard body or its own JSON keeps its mode', async ({ page }) => {
  const form = await draftForm('Notify saved', {
    actions: [
      { id: 'w1', type: 'webhook', enabled: true, settings: { url: 'https://hooks.example.com/a', method: 'POST', payload_mode: 'full', headers: { 'X-Source': 'sf' } } },
      { id: 'w2', type: 'webhook', enabled: true, settings: { url: 'https://hooks.example.com/b', method: 'PUT', payload_mode: 'custom', custom_payload: '{"n":"{{name}}"}' } },
    ],
  });
  await loginPage(page);
  await openBuilder(page, form.id);
  await openActions(page);
  const [full, custom] = [page.locator('.sf-actions-panel__item--webhook').nth(0), page.locator('.sf-actions-panel__item--webhook').nth(1)];
  await expect(full.getByText('This webhook sends the standard body')).toBeVisible();
  await expect(full.locator('.sf-webhook-preview__code')).toContainText('"site_url"');
  await expect(full.getByRole('textbox', { name: 'Header name' })).toHaveValue('X-Source');
  await expect(custom.getByText('Custom JSON.')).toBeVisible();
  await expect(custom.getByRole('textbox', { name: 'Body as JSON' })).toHaveValue('{"n":"{{name}}"}');

  // Ticking a box in the standard webhook moves it to its own selection.
  await full.getByRole('group', { name: 'Answers' }).getByRole('checkbox', { name: 'Email' }).uncheck();
  await expect(full.getByText('This webhook sends the standard body')).toHaveCount(0);
  await expect(full.locator('.sf-webhook-preview__code')).not.toContainText('"site_url"');
});
