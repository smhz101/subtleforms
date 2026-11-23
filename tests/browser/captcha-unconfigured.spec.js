/**
 * 2.9.2 (#142): a CAPTCHA field with no keys is skipped, not enforced.
 *
 * - a visitor can send a form whose reCAPTCHA field has no keys, and the entry is stored
 * - the visitor sees no setup text; a site admin sees the admin-only message
 * - the builder preview says the check is skipped, with a link to Settings
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, waitForForm, useBundleOverride, loginPage, openBuilder } = require('./helpers');

const SHOTS = process.env.SF_SHOTS_DIR || '';

let client;
const created = [];

test.beforeAll(async () => {
  client = await adminApi();
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
});

test.beforeEach(async ({ page }) => {
  await useBundleOverride(page);
});

test.afterAll(async () => {
  for (const form of created) {
    await cleanup(client, form);
  }
});

async function captchaForm(title) {
  const form = await publishForm(client, {
    title,
    fields: [
      { id: 'n1', key: 'name', type: 'text', label: 'Your name' },
      { id: 'c1', key: 'cap', type: 'recaptcha', label: 'Captcha' },
    ],
  });
  created.push(form);
  return form;
}

test('a visitor can send a form whose CAPTCHA has no keys', async ({ page }) => {
  const form = await captchaForm('Unconfigured captcha visitor');

  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms-captcha-warning')).toHaveCount(0);
  await expect(page.getByText('This CAPTCHA is not set up yet')).toHaveCount(0);

  await page.getByLabel('Your name').fill('Ada');
  await page.waitForTimeout(3200);
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-success-message')).toBeVisible();

  await expect.poll(async () => (await entries(client, form.id)).length).toBe(1);
});

test('a site admin sees the admin-only message on the front end', async ({ browser }) => {
  const form = await captchaForm('Unconfigured captcha admin');
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await useBundleOverride(page);
  await loginPage(page);
  await page.goto(form.url);
  await waitForForm(page);
  const note = page.locator('.subtleforms-captcha-warning');
  await expect(note).toBeVisible();
  await expect(note).toContainText('Only site admins see this message.');
  await expect(note).toContainText('Settings, Security & privacy');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/front-end-as-admin.png`, scale: 'device' });
  await context.close();
});

test('the builder preview says the check is skipped', async ({ browser }) => {
  const form = await captchaForm('Unconfigured captcha builder');
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await useBundleOverride(page);
  await loginPage(page);
  await openBuilder(page, form.id);

  const status = page.locator('.sf-captcha-preview__status').first();
  await expect(status).toContainText('No keys yet, so this check is skipped on the live form.');
  const link = status.getByRole('link', { name: 'Add keys in Settings, Security & privacy' });
  await expect(link).toHaveAttribute('href', /page=subtleforms-settings#tab=advanced/);
  if (SHOTS) {
    await status.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/builder-preview-warning.png`, scale: 'device' });
  }
  await context.close();
});

test('publishing a form with a keyless CAPTCHA shows a warning, not an error', async ({ page }) => {
  const created1 = await client.call('POST', '/forms', { title: 'Unconfigured captcha publish' });
  const id = created1.body?.data?.id ?? created1.body?.data?.form?.id;
  const schema = {
    schema_version: 1,
    metadata: { type: 'regular', name: 'Unconfigured captcha publish', title: 'Unconfigured captcha publish' },
    fields: [
      { id: 'n1', key: 'name', type: 'text', label: 'Your name' },
      { id: 'c1', key: 'cap', type: 'recaptcha', label: 'Captcha' },
    ],
  };
  const saved = await client.call('POST', `/forms/${id}/schema`, { schema, activate: true });
  expect(saved.status).toBeLessThan(300);
  created.push({ id });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginPage(page);
  await openBuilder(page, id);
  await page.getByRole('button', { name: 'Publish', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();

  const notice = page.locator('.subtleforms-snackbars .components-snackbar.is-warning');
  await expect(notice).toContainText('Published. The CAPTCHA field has no keys, so it is skipped until you add them in Settings, Security & privacy.');
  const state = await client.call('GET', `/forms/${id}`);
  expect(JSON.stringify(state.body)).toContain('published');
});
