/**
 * Issue 126: a visitor who sends within a second of the page loading (browser
 * autofill) is not silently dropped by the time trap. The form holds the send
 * until the minimum has passed, and the entry is saved.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, entries, cleanup, waitForForm, BASE } = require('./helpers');

let client;
let form;
let convo;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: `Time trap hold ${Date.now()}`,
    fields: [
      { id: 'n', key: 'name', type: 'text', label: 'Name' },
      { id: 'e', key: 'email', type: 'email', label: 'Email' },
    ],
  });
  convo = await publishForm(client, {
    title: `Time trap hold conversational ${Date.now()}`,
    metadata: { type: 'conversational' },
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
  await cleanup(client, convo);
});

test('a fast human submit is saved, not dropped', async ({ browser }) => {
  // A fresh context: no admin cookie, so the server applies the time trap.
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  const before = (await entries(client, form.id)).length;

  await page.goto(form.url);
  await waitForForm(page);
  await page.getByLabel('Name').fill('Fast Ada');
  await page.getByLabel('Email').fill('fast.ada@example.com');
  await page.getByRole('button', { name: /send|submit/i }).first().click();

  await expect(page.getByText(/thank you|received/i).first()).toBeVisible({ timeout: 20000 });

  await expect
    .poll(async () => (await entries(client, form.id)).length, { timeout: 15000 })
    .toBe(before + 1);
  await context.close();
});

test('a fast human submit on a conversational form is saved, not dropped', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  const before = (await entries(client, convo.id)).length;

  await page.goto(convo.url);
  await page.waitForSelector('.subtleforms--type-conversational', { timeout: 30000 });
  await page.getByLabel('Name').first().fill('Fast Grace');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Submit/ }).first().click();

  await expect(page.locator('.subtleforms-conversational-success')).toBeVisible({ timeout: 20000 });
  await expect
    .poll(async () => (await entries(client, convo.id)).length, { timeout: 15000 })
    .toBe(before + 1);
  await context.close();
});
