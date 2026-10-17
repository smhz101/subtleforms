/**
 * 2.2.1: submitting real forms in a real browser.
 *
 * - bug 2: server validation errors land on the fields
 * - bug 4/5/6: paragraph line breaks, rich text formatting, passwords
 * - bug 14/15: Toggle, Opinion scale, Picture choice, Signature and
 *   Calculation answers are saved
 * - bug 8/9/10: empty matrix, calculation without formula and empty
 *   disclaimer are not drawn
 * - bug 16: honeypot has a random name and no visible label text
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, waitForForm, useBundleOverride } = require('./helpers');

let client;
const created = [];

test.beforeAll(async () => {
  client = await adminApi();
});

test.beforeEach(async ({ page }) => {
  await useBundleOverride(page);
});

test.afterAll(async () => {
  for (const form of created) {
    await cleanup(client, form);
  }
});

// The time trap rejects forms sent within a couple of seconds of loading.
async function waitOutTimeTrap(page) {
  await page.waitForTimeout(3200);
}

test('server validation errors are shown on each field (bug 2)', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Server errors',
    fields: [
      { id: 'f1', key: 'first_name', type: 'text', label: 'First name', required: true },
      { id: 'f2', key: 'email', type: 'email', label: 'Email', required: true },
      {
        id: 'f3',
        key: 'topic',
        type: 'select',
        label: 'Topic',
        required: true,
        options: [
          { label: 'Sales', value: 'sales' },
          { label: 'Support', value: 'support' },
        ],
      },
      { id: 'f4', key: 'message', type: 'textarea', label: 'Message', required: true },
    ],
  });
  created.push(form);

  await page.goto(form.url);
  await waitForForm(page);
  await page.fill('#subtleforms-field-first_name', 'Ada');
  await page.fill('#subtleforms-field-email', 'ada@example.com');
  await page.locator('#subtleforms-field-topic').locator('xpath=ancestor::*[contains(@class,"subtleforms-picker")][1]//select').selectOption('sales');
  await page.fill('#subtleforms-field-message', 'Hello');
  await waitOutTimeTrap(page);

  // Strip the answers on the way out, as a visitor whose browser skipped the
  // client checks would; the real server answers 422 with meta.fields.
  let status = 0;
  await page.route('**/subtleforms/v1/submit', async (route) => {
    const body = JSON.parse(route.request().postData());
    ['first_name', 'email', 'topic', 'message'].forEach((k) => delete body.data[k]);
    const response = await route.fetch({ postData: JSON.stringify(body) });
    status = response.status();
    await route.fulfill({ response });
  });

  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-error[role="alert"]')).toHaveText('Please fix the 4 highlighted fields.');
  expect(status).toBe(422);

  for (const key of ['first_name', 'email', 'topic', 'message']) {
    const control = page.locator(`#subtleforms-field-${key}`);
    const tag = await control.evaluate((el) => el.tagName);
    // aria-invalid is not allowed on a button. The error is still named from the control.
    if (tag !== 'BUTTON') {
      await expect(control).toHaveAttribute('aria-invalid', 'true');
    }
    await expect(control).toHaveAttribute('aria-describedby', new RegExp(`subtleforms-field-${key}-error`));
    await expect(page.locator(`#subtleforms-field-${key}-error`)).not.toBeEmpty();
  }
  // Focus moves to the first field in error.
  await expect(page.locator('#subtleforms-field-first_name')).toBeFocused();

  // Fixing a field clears its error.
  await page.fill('#subtleforms-field-first_name', 'Ada Lovelace');
  await expect(page.locator('#subtleforms-field-first_name')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('.subtleforms-error[role="alert"]')).toBeVisible();
});

test('every answer type is saved as typed (bugs 4, 5, 6, 14, 15)', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Answer types',
    fields: [
      { id: 'a1', key: 'notes', type: 'textarea', label: 'Notes' },
      { id: 'a2', key: 'bio', type: 'rich_text', label: 'Bio' },
      { id: 'a3', key: 'secret', type: 'password', label: 'Password', minLength: 0 },
      { id: 'a4', key: 'newsletter', type: 'toggle', label: 'Newsletter', toggleLabel: 'Send me news' },
      { id: 'a5', key: 'score', type: 'scale', label: 'Score', scaleMin: 1, scaleMax: 5 },
      {
        id: 'a6',
        key: 'look',
        type: 'picture_choice',
        label: 'Look',
        options: [
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
        ],
      },
      { id: 'a7', key: 'sign', type: 'signature', label: 'Signature' },
      { id: 'a8', key: 'double', type: 'calculation', label: 'Double', formula: '{score} * 2', decimals: 0 },
    ],
  });
  created.push(form);

  await page.goto(form.url);
  await waitForForm(page);

  await page.fill('#subtleforms-field-notes', 'Multi\nline');
  const editor = page.locator('#subtleforms-field-bio');
  await editor.click();
  await page.click('.subtleforms-richtext__button[aria-label="Bold"]');
  await page.keyboard.type('Bold');
  await page.click('.subtleforms-richtext__button[aria-label="Bold"]');
  await page.keyboard.type(' rich');
  await page.fill('#subtleforms-field-secret', 's3cret<>!');
  await page.click('.subtleforms-field-toggle .subtleforms-toggle');
  await page.click('label[for="subtleforms-field-score-4"]');
  await page.click('label[for="subtleforms-field-look-1"]');

  const canvas = page.locator('canvas.subtleforms-signature__canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 60, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('.subtleforms-calculation__value')).toHaveText('8');
  await waitOutTimeTrap(page);
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-success-message')).toBeVisible();

  const [entry] = await entries(client, form.id);
  const p = entry.payload;
  expect(p.notes).toBe('Multi\nline');
  expect(p.bio).toMatch(/<(b|strong)>Bold<\/(b|strong)>(&nbsp;| )rich/);
  expect(p.secret).toBe('Password provided');
  expect(p.newsletter).toBe('yes');
  expect(String(p.score)).toBe('4');
  expect(p.look).toBe('dark');
  expect(String(p.sign)).toMatch(/^data:image\/png;base64,/);
  expect(String(p.double)).toBe('8');
});

test('fields with nothing to show are hidden; honeypot is anonymous (bugs 8, 9, 10, 16)', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Empty fields',
    fields: [
      { id: 'e1', key: 'name', type: 'text', label: 'Name' },
      { id: 'e2', key: 'calc', type: 'calculation', label: 'No formula', formula: '' },
      { id: 'e3', key: 'note', type: 'disclaimer', content: '' },
      { id: 'e4', key: 'grid', type: 'checkbox_grid', label: 'Empty grid', rows: [], columns: [], required: true },
    ],
  });
  created.push(form);

  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms-field-calculation')).toHaveCount(0);
  await expect(page.locator('.subtleforms-disclaimer')).toHaveCount(0);
  await expect(page.locator('.subtleforms-field-checkbox_grid')).toHaveCount(0);

  const honeypot = page.locator('input[data-subtleforms-honeypot]');
  await expect(honeypot).toHaveCount(1);
  const name = await honeypot.getAttribute('name');
  expect(name).toMatch(/^sf_hp_[a-z0-9]+$/);
  expect(name).not.toBe('website_url');
  await expect(honeypot).toHaveAttribute('autocomplete', 'off');
  await expect(honeypot).toHaveAttribute('tabindex', '-1');
  const text = await page.locator('.subtleforms-form-container').innerText();
  expect(text).not.toContain('Website');

  // The hidden required matrix does not block the form.
  await page.fill('#subtleforms-field-name', 'Grace');
  await waitOutTimeTrap(page);
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-success-message')).toBeVisible();
});

test('a single checkbox with options cannot be published (bug 7)', async () => {
  const created = await client.call('POST', '/forms', { title: 'Checkbox options' });
  const id = created.body.data.id;
  const res = await client.call('POST', `/forms/${id}/schema`, {
    activate: true,
    schema: {
      schema_version: 1,
      metadata: { type: 'regular', name: 'Checkbox options', title: 'Checkbox options' },
      fields: [
        { id: 'c1', key: 'pick', type: 'checkbox', label: 'Pick', options: [{ label: 'A', value: 'a' }] },
      ],
    },
  });
  expect(res.status).toBe(422);
  expect(JSON.stringify(res.body)).toContain('Multiple choice');
  await client.call('DELETE', `/forms/${id}?force=true`);
});
