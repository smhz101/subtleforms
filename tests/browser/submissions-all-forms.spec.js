/**
 * #129: the Submissions Form filter lists every form, not only the newest 20,
 * and it can be searched.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, spamToken } = require('./helpers');

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

let client;
let oldest;
const fillers = [];
const stamp = Date.now().toString(36);
const oldTitle = `Legacy survey ${stamp}`;

test.beforeAll(async ({ playwright }) => {
  test.setTimeout(240000);
  client = await adminApi();
  oldest = await publishForm(client, {
    title: oldTitle,
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }],
  });
  const anon = await playwright.request.newContext({ baseURL: process.env.SF_BASE_URL || 'http://localhost:8899' });
  const res = await anon.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: oldest.id, data: { name: 'Old timer', form_rendered_at: await spamToken(anon, oldest.id) } },
  });
  expect(res.status(), await res.text()).toBe(200);
  await anon.dispose();

  for (let i = 1; i <= 25; i++) {
    const created = await client.call('POST', '/forms', { title: `Newer form ${stamp} ${i}` });
    fillers.push(created.body?.data?.id ?? created.body?.data?.form?.id);
  }
});

test.afterAll(async () => {
  for (const id of fillers) {
    if (id) await client.call('DELETE', `/forms/${id}?force=true`);
  }
  await cleanup(client, oldest);
});

test('the oldest form can be found, selected and its entry listed', async ({ page }) => {
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');
  await page.getByRole('button', { name: 'Filters' }).click();

  const combo = page.getByRole('combobox', { name: 'Form' });
  const shot = async (name) => {
    if (process.env.SF_SHOT_DIR) {
      await page.screenshot({ path: `${process.env.SF_SHOT_DIR}/${name}.png` });
    }
  };
  await expect(combo).toBeVisible();
  await shot('form-combobox-closed');
  await combo.click();
  await combo.fill(oldTitle);
  const option = page.getByRole('option', { name: new RegExp(`${oldTitle} \\(#${oldest.id}\\)`) });
  await expect(option).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await shot('form-combobox-search');

  await option.click();

  await expect(page.locator('.sf-data-table__table tbody tr')).toHaveCount(1, { timeout: 20000 });
  await expect(page.locator('.sf-data-table__table tbody')).toContainText('Old timer');
});

test.describe('narrow screen', () => {
  test.use({ viewport: { width: 782, height: 900 } });

  test('the Form filter fits at 782 px without sideways scrolling', async ({ page }) => {
    await loginPage(page);
    await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');
    await page.getByRole('button', { name: 'Filters' }).click();
    const combo = page.getByRole('combobox', { name: 'Form' });
    await expect(combo).toBeVisible();
    if (process.env.SF_SHOT_DIR) {
      await page.screenshot({ path: `${process.env.SF_SHOT_DIR}/form-combobox-closed-782.png` });
    }
    await combo.click();
    await combo.fill('Legacy');
    await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
    if (process.env.SF_SHOT_DIR) {
      await page.screenshot({ path: `${process.env.SF_SHOT_DIR}/form-combobox-search-782.png` });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
