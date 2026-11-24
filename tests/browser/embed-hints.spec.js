/**
 * 2.10.0 (#136): a note for admins where an embed points to a missing form,
 * nothing new for visitors, and a message when JavaScript is off.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, publishForm, loginPage, BASE } = require('./helpers');

const SHOTS = process.env.SF_SHOTS_DIR || 'test-results/shots/embed-hints';

let client;
let form;
let brokenPageId;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: `Embed hints ${Date.now()}`,
    fields: [
      { id: 'a', key: 'name', type: 'text', label: 'Your name' },
      { id: 'b', key: 'email', type: 'email', label: 'Your email' },
    ],
  });
  const page = await client.call('POST', '/wp/v2/pages', {
    title: `Broken embed ${Date.now()}`,
    status: 'publish',
    content: '<!-- wp:shortcode -->[subtleforms id="999999"]<!-- /wp:shortcode -->',
  });
  brokenPageId = page.body.id;
});

test.afterAll(async () => {
  if (brokenPageId) await client.call('DELETE', `/wp/v2/pages/${brokenPageId}?force=true`);
  if (form) await cleanup(client, form);
});

test('an admin sees a note for a missing form and a visitor does not', async ({ browser }) => {
  const admin = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const adminPage = await admin.newPage();
  await loginPage(adminPage);
  await adminPage.goto(`/?page_id=${brokenPageId}`);
  const note = adminPage.locator('.subtleforms-embed-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText('form #999999 was not found');
  await expect(note).toContainText('Only people who can manage forms see this note.');
  await note.screenshot({ path: `${SHOTS}/admin-note.png` });
  await admin.close();

  const visitor = await browser.newContext({ baseURL: BASE });
  const visitorPage = await visitor.newPage();
  await visitorPage.goto(`/?page_id=${brokenPageId}`);
  await expect(visitorPage.locator('.subtleforms-embed-note')).toHaveCount(0);
  await expect(visitorPage.locator('body')).not.toContainText('was not found');
  await visitor.close();
});

test('with JavaScript off the form shows a message and no loading outline', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: BASE,
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(form.url);
  const message = page.locator('.subtleforms-noscript');
  await expect(message).toBeVisible();
  await expect(message).toHaveText('This form needs JavaScript. Turn it on in your browser to fill it in.');
  await expect(page.locator('.subtleforms-skeleton')).toBeHidden();
  const height = await page.locator(`.subtleforms-form-container[data-form-id="${form.id}"]`).evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(120);
  await page.locator(`.subtleforms-form-container[data-form-id="${form.id}"]`).screenshot({ path: `${SHOTS}/noscript.png` });
  await context.close();
});
