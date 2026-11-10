/**
 * 2.8.0: input masks on Text, Number and Phone fields.
 *
 * - Builder: the Rules section has an Input mask select, a Pattern box for
 *   Custom, a Try it box that applies the mask, and Save as.
 * - Front end: the field formats as the visitor types, shows the format as
 *   placeholder and hint (linked with aria-describedby), the mask code is
 *   downloaded only by forms that have a mask, and a bad value shows an error.
 * - The stored value is what the field says: as typed, or digits only.
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage, openBuilder, waitForForm, spamToken } = require('./helpers');

const SHOTS = process.env.SF_SHOTS || 'test-results/shots/input-mask';
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

const maskFields = () => [
  { id: 'd1', key: 'birthday', type: 'text', label: 'Date of birth', required: true, inputMask: 'date_dmy', description: 'As on your passport.' },
  { id: 'c1', key: 'code', type: 'text', label: 'Booking code', inputMask: 'custom', maskPattern: 'AA-9999', maskStore: 'typed' },
  { id: 'z1', key: 'zip', type: 'text', label: 'ZIP code', inputMask: 'zip_us', maskStore: 'digits' },
  { id: 'p1', key: 'mobile', type: 'phone', label: 'Mobile', inputMask: 'phone' },
];

/** The time trap: a form is not accepted a moment after it loads. */
const waitOutTimeTrap = (page) => page.waitForTimeout(3300);

test('front end: formats as typed, hint is linked, bad value shows an error, stored value follows the field', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const form = await makeForm('Mask live', maskFields());
  const chunks = [];
  page.on('response', (response) => {
    if (/field-mask\./.test(response.url())) chunks.push(response.url());
  });
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms-form-container')).toHaveAttribute('data-features', /\bmask\b/);
  expect(chunks.length).toBeGreaterThan(0);

  const birthday = page.getByRole('textbox', { name: /Date of birth/ });
  await expect(birthday).toHaveAttribute('placeholder', 'DD/MM/YYYY');
  await expect(birthday).toHaveAttribute('inputmode', 'numeric');
  const described = (await birthday.getAttribute('aria-describedby')).split(' ');
  expect(described.length).toBe(2);
  for (const id of described) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.locator('#subtleforms-field-birthday-mask')).toHaveText('Format: DD/MM/YYYY');

  // Typing: literals appear, the caret stays where the visitor is.
  await birthday.click();
  await page.keyboard.type('31122026');
  await expect(birthday).toHaveValue('31/12/2026');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  // Backspace over the slash: the slash is put back and the caret moves in
  // front of it, so the next Backspace removes the digit before it.
  await page.keyboard.press('Backspace');
  await expect(birthday).toHaveValue('31/12/2026');
  await page.keyboard.press('Backspace');
  await expect(birthday).toHaveValue('31/22/026');
  await birthday.fill('');
  await page.keyboard.type('31022026');
  await expect(birthday).toHaveValue('31/02/2026');

  await page.getByRole('textbox', { name: /Booking code/ }).click();
  await page.keyboard.type('ab12x34567');
  await expect(page.getByRole('textbox', { name: /Booking code/ })).toHaveValue('ab-1234');

  const zip = page.getByRole('textbox', { name: /ZIP code/ });
  await zip.click();
  await page.keyboard.type('123456789');
  await expect(zip).toHaveValue('12345-6789');

  const mobile = page.getByRole('textbox', { name: /Mobile/ });
  await expect(mobile).toHaveAttribute('inputmode', 'tel');
  await mobile.click();
  await page.keyboard.type('(555) 010-1234 abc');
  await expect(mobile).toHaveValue('(555) 010-1234 ');

  await birthday.fill('');
  await page.keyboard.type('31');
  await page.locator('.subtleforms-form-container').screenshot({ path: `${SHOTS}/frontend-field-hint.png` });
  await birthday.fill('');
  await page.keyboard.type('31022026');
  await waitOutTimeTrap(page);
  await page.getByRole('button', { name: /Submit/ }).click();
  const error = page.locator('#subtleforms-field-birthday-error');
  await expect(error).toHaveText('That date does not exist. Enter the date as DD/MM/YYYY.');
  await page.screenshot({ path: `${SHOTS}/frontend-error.png`, fullPage: true });

  // Fix the date and send.
  await birthday.fill('');
  await page.keyboard.type('29022024');
  await page.getByRole('button', { name: /Submit/ }).click();
  await expect(page.locator('.subtleforms-success-message')).toBeVisible({ timeout: 20000 });

  const [entry] = await entries(client, form.id);
  expect(entry.payload.birthday).toBe('29/02/2024');
  expect(entry.payload.code).toBe('ab-1234');
  expect(entry.payload.zip).toBe('123456789');
  expect(entry.payload.mobile.trim()).toBe('(555) 010-1234');
});

test('front end: a form without a mask downloads no mask code', async ({ page }) => {
  const form = await makeForm('No mask', [{ id: 'a', key: 'name', type: 'text', label: 'Name' }]);
  const chunks = [];
  page.on('response', (response) => {
    if (/field-mask\./.test(response.url())) chunks.push(response.url());
  });
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.getByRole('textbox', { name: 'Name' })).toBeVisible();
  expect(chunks).toEqual([]);
  await expect(page.locator('.subtleforms-form-container')).not.toHaveAttribute('data-features', /mask/);
});

test('server: a bad value sent straight to the endpoint is refused with the format message', async ({ playwright }) => {
  const anon = await playwright.request.newContext({ baseURL: process.env.SF_BASE_URL || 'http://localhost:8899' });
  const form = await makeForm('Mask server', maskFields());
  const token = await spamToken(anon, form.id);
  const res = await anon.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: form.id, data: { birthday: '31/02/2026', code: 'ab-1234', form_rendered_at: token } },
  });
  expect(res.status()).toBe(422);
  const body = await res.json();
  expect(body.error.meta.fields.birthday).toBe('That date does not exist. Enter the date as DD/MM/YYYY.');
  await anon.dispose();
});

test('conversational and multi-step forms use the mask too', async ({ page }) => {
  const steps = await makeForm(
    'Mask steps',
    [
      { id: 's1', key: 'step_one', type: 'step', title: 'One', children: [{ id: 'a', key: 'name', type: 'text', label: 'Name' }] },
      { id: 's2', key: 'step_two', type: 'step', title: 'Two', children: [{ id: 'b', key: 'time', type: 'text', label: 'Time', inputMask: 'time_24' }] },
    ],
    { type: 'multi-step' }
  );
  await page.goto(steps.url);
  await waitForForm(page);
  await page.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await page.getByRole('button', { name: /Next/ }).click();
  const time = page.getByRole('textbox', { name: /Time/ });
  await time.click();
  await page.keyboard.type('0930');
  await expect(time).toHaveValue('09:30');

  const talk = await makeForm('Mask talk', [{ id: 'b', key: 'zip', type: 'text', label: 'Your ZIP code', inputMask: 'zip_us' }], { type: 'conversational' });
  await page.goto(talk.url);
  await expect(page.locator('.subtleforms-question-number')).toHaveText('Question 1 of 1', { timeout: 20000 });
  const zip = page.locator('input[name="zip"]');
  await expect(zip).toBeVisible();
  await zip.click();
  await page.keyboard.type('123456');
  await expect(zip).toHaveValue('12345-6');
});

test('builder: choose a mask, try it, and it is saved on the field', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const form = await makeForm('Mask builder', [{ id: 't', key: 'code', type: 'text', label: 'Booking code' }]);
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('.subtleforms-builder-canvas .sf-field-chrome').first().click();
  const inspector = page.locator('.sf-field-inspector');

  const select = inspector.getByLabel('Input mask');
  await expect(select).toHaveValue('');
  await expect(inspector.getByLabel('Pattern', { exact: true })).toHaveCount(0);
  await expect(inspector.getByLabel('Try it')).toHaveCount(0);
  const options = await select.locator('option').allTextContents();
  expect(options).toEqual(['None', 'Phone', 'Date DD/MM/YYYY', 'Date MM/DD/YYYY', 'Date YYYY-MM-DD', 'Time HH:MM (24-hour)', 'Postcode or ZIP (US)', 'Custom']);

  await select.selectOption('date_dmy');
  await expect(inspector.getByLabel('Try it')).toBeVisible();
  await expect(inspector.getByLabel('Save as')).toHaveCount(0);
  await inspector.getByLabel('Try it').click();
  await page.keyboard.type('31122026');
  await expect(inspector.getByLabel('Try it')).toHaveValue('31/12/2026');

  await select.selectOption('custom');
  await expect(inspector.getByText('9 is a digit, A is a letter, * is a letter or digit.', { exact: false })).toBeVisible();
  await inspector.getByLabel('Pattern', { exact: true }).fill('AA-9999');
  await inspector.getByLabel('Save as').selectOption('digits');
  const tryIt = inspector.getByLabel('Try it');
  await tryIt.fill('');
  await tryIt.click();
  await page.keyboard.type('ab12345');
  await expect(tryIt).toHaveValue('ab-1234');
  await page.screenshot({ path: `${SHOTS}/builder-validation-tab.png` });
  await inspector.getByLabel('Save as').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/builder-validation-tab-scrolled.png` });

  await page.locator('.sf-builder-header-bar__publish-arrow').click();
  await page.getByRole('menuitem', { name: /Save draft/ }).click();
  await expect(page.locator('.sf-builder-header-bar__save-status')).toHaveText(/^Saved$/, { timeout: 20000 });
  const draft = (await client.call('GET', `/forms/${form.id}/schema?context=builder`)).body.data.schema.fields;
  expect(draft[0]).toMatchObject({ inputMask: 'custom', maskPattern: 'AA-9999', maskStore: 'digits' });
});
