/**
 * F240-5: SubtleForms admin screens at small and short windows.
 *
 * - UX2-16: a window shorter than the WordPress menu shows no dark band; the
 *   page stays at the window height and the menu scrolls in its own column.
 * - UX2-17: on a phone the builder says it needs a wider screen, and can be
 *   opened anyway.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, publishForm } = require('./helpers');

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Small screens',
    fields: [{ id: 'name', key: 'name', type: 'text', label: 'Name' }],
  });
});

test.afterAll(async () => {
  if (form) await cleanup(client, form);
});

test('UX2-16: a short window shows the stage to the bottom edge', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms');
  await page.waitForSelector('.sf-app');
  await expect(page.locator('body')).toHaveClass(/sf-menu-scrolls/);

  const metrics = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const stage = document.querySelector('.sf-app__stage').getBoundingClientRect();
    return { doc: document.documentElement.scrollHeight, inner: window.innerHeight, scrollY: window.scrollY, stageBottom: stage.bottom };
  });
  expect(metrics.doc).toBeLessThanOrEqual(metrics.inner);
  expect(metrics.scrollY).toBe(0);
  expect(metrics.inner - metrics.stageBottom).toBeLessThanOrEqual(12);

  // The last menu item can be reached by scrolling the menu column.
  const collapse = page.locator('#collapse-button');
  await collapse.scrollIntoViewIfNeeded();
  await expect(collapse).toBeInViewport();
});

test('UX2-16: a tall window keeps the core menu and its flyouts', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms');
  await page.waitForSelector('.sf-app');
  await expect(page.locator('body')).not.toHaveClass(/sf-menu-scrolls/);
  await page.hover('#menu-settings > a');
  await expect(page.locator('#menu-settings .wp-submenu')).toBeInViewport();
});

test('UX2-17: on a phone the builder says it needs a wider screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginPage(page);
  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${form.id}`);
  await expect(page.getByRole('heading', { name: 'The form builder needs a wider screen' })).toBeVisible();
  await expect(page.locator('.sf-form-editor__canvas')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open the builder anyway' }).click();
  await expect(page.locator('.sf-form-editor__canvas, .sf-field-chrome').first()).toBeVisible({ timeout: 30000 });
});

test('UX2-17: a desktop window opens the builder directly', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${form.id}`);
  await expect(page.locator('.sf-form-editor__canvas, .sf-field-chrome').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('The form builder needs a wider screen')).toHaveCount(0);
});
