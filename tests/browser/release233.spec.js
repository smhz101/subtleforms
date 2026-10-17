/**
 * 2.3.3: a signature shows as an image in the entry, and one submit stores
 * one entry (Enter on a focused Submit, double clicks).
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage, BASE } = require('./helpers');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
let client;
const made = [];

test.beforeAll(async () => {
  client = await adminApi();
});
test.afterAll(async () => {
  for (const f of made) await cleanup(client, f);
});

test('a signature answer shows as an image in the entry, not as its code', async ({ page, playwright }) => {
  const form = await publishForm(client, {
    title: 'Signature entry',
    fields: [
      { id: 'n', key: 'name', type: 'text', label: 'Name' },
      { id: 's', key: 'sig', type: 'signature', label: 'Your signature' },
    ],
  });
  made.push(form);
  const anon = await playwright.request.newContext({ baseURL: BASE });
  const res = await anon.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: form.id, data: { name: 'Ada', sig: PNG, form_rendered_at: Math.floor(Date.now() / 1000) - 60 } },
  });
  expect(res.status(), await res.text()).toBe(200);
  await anon.dispose();
  const [entry] = await entries(client, form.id);

  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&submission_id=${entry.id}&form_id=${form.id}`);
  const img = page.locator('.sf-answers img.sf-answers__signature');
  await expect(img).toBeVisible({ timeout: 20000 });
  await expect(img).toHaveAttribute('alt', 'Signature');
  await expect(page.locator('.sf-answers')).not.toContainText('base64');
  await page.screenshot({ path: '/home/claude/shots/free233/signature-entry.png' });
});

test('Enter on the focused Submit of a conversational form stores one entry', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'One entry conversational',
    metadata: { type: 'conversational' },
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }],
  });
  made.push(form);
  await page.goto(form.url);
  await page.waitForTimeout(4000); // past the minimum fill time
  await page.getByLabel('Name').first().fill('Zed');
  await page.keyboard.press('Enter');
  const submit = page.getByRole('button', { name: /Submit/ }).first();
  await expect(submit).toBeVisible();
  await submit.focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await entries(client, form.id)).length, { timeout: 15000 }).toBe(1);
  await page.waitForTimeout(2500);
  expect((await entries(client, form.id)).length).toBe(1);
});

test('a double click on Submit stores one entry', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'One entry standard',
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }],
  });
  made.push(form);
  await page.goto(form.url);
  await page.waitForTimeout(4000);
  await page.getByLabel('Name').first().fill('Zed');
  await page.getByRole('button', { name: /Submit/ }).first().dblclick();
  await expect.poll(async () => (await entries(client, form.id)).length, { timeout: 15000 }).toBe(1);
  await page.waitForTimeout(2500);
  expect((await entries(client, form.id)).length).toBe(1);
});
