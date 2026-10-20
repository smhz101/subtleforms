/**
 * Review of #47: the phone layout follows the styles' (max-width: 599px).
 * useViewportMatch('small', '<') is (max-width: 600px), so at exactly 600px
 * the builder showed its "needs a wider screen" notice and long lists kept
 * card logic while the styles drew the desktop table.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, publishForm } = require('./helpers');

let client;
const forms = [];
const tag = `Phone ${Date.now()}`;

// Creating 24 forms can reach the admin write limit (120 a minute); wait
// for the window to reset instead of failing.
async function patiently(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const wait = /"retry_after":(\d+)/.exec(String(error && error.message));
      if (!wait || attempt > 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, (Number(wait[1]) + 1) * 1000));
    }
  }
}

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(600000);
  client = await adminApi();
  for (let i = 0; i < 24; i++) {
    forms.push(
      await patiently(() =>
        publishForm(client, {
          title: `${tag} ${String(i).padStart(2, '0')}`,
          fields: [{ id: 'name', key: 'name', type: 'text', label: 'Name' }],
        })
      )
    );
  }
});

test.afterAll(async ({}, testInfo) => {
  testInfo.setTimeout(600000);
  for (const form of forms) {
    await patiently(() => cleanup(client, form));
  }
});

test('at 540px a long forms list shows cards that do not overlap', async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 900 });
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
  await page.getByLabel('Rows per page').selectOption('50');
  await expect.poll(() => page.locator('.sf-data-table__row').count()).toBeGreaterThan(20);

  const boxes = await page
    .locator('.sf-data-table__row')
    .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().toJSON()).filter((b) => b.height > 0));
  expect(boxes.length).toBeGreaterThan(20);
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlap = a.top < b.bottom - 1 && b.top < a.bottom - 1 && a.left < b.right - 1 && b.left < a.right - 1;
      expect(overlap, `rows ${i} and ${j} overlap`).toBe(false);
    }
  }
});

test('at 540px the builder says it needs a wider screen', async ({ page }) => {
  await page.setViewportSize({ width: 540, height: 900 });
  await loginPage(page);
  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${forms[0].id}`);
  await expect(page.getByRole('heading', { name: 'The form builder needs a wider screen' })).toBeVisible();
});

test('at 600px the builder opens directly', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await loginPage(page);
  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${forms[0].id}`);
  await expect(page.locator('.sf-form-editor__canvas, .sf-field-chrome').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('The form builder needs a wider screen')).toHaveCount(0);
});
