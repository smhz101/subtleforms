/**
 * F240-5: SubtleForms admin screens at small and short windows.
 *
 * - UX2-16: a window shorter than the WordPress menu shows no dark band; the
 *   page stays at the window height and the menu scrolls in its own column.
 * - UX2-17: on a phone the builder says it needs a wider screen, and can be
 *   opened anyway.
 * - UX2-18: with the reading pane right of the inbox, an inbox narrower than
 *   960px shows the entry as a full-width overlay with every action visible.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, publishForm, spamToken, BASE } = require('./helpers');

let client;
let form;

test.beforeAll(async ({ playwright }) => {
  client = await adminApi();
  form = await publishForm(client, {
    title: `Small screens ${Date.now()}`,
    fields: [{ id: 'name', key: 'name', type: 'text', label: 'Name' }],
  });
  const anon = await playwright.request.newContext({ baseURL: BASE });
  const res = await anon.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: form.id, data: { name: 'Pane Tester', form_rendered_at: await spamToken(anon, form.id) } },
  });
  expect(res.status()).toBe(200);
});

async function openEntry(page, width, height) {
  await page.setViewportSize({ width, height });
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');
  await page.locator('.sf-inbox__list').getByText('Pane Tester').first().click();
  await expect(page.locator('.sf-inbox.is-open')).toBeVisible();
  await page.waitForTimeout(400); // the pane slides in once
  return page.evaluate(() => {
    const box = (sel) => document.querySelector(sel).getBoundingClientRect();
    return { inbox: box('.sf-inbox').width, pane: box('.sf-inbox__pane').width, paneLeft: box('.sf-inbox__pane').left, inboxLeft: box('.sf-inbox').left };
  });
}

async function actionsInView(page) {
  const pane = page.locator('.sf-inbox__pane');
  for (const name of [/Close/i, /Move to Trash/i, /Resend notifications/i, /^Star$/]) {
    const button = pane.getByRole('button', { name }).first();
    await expect(button).toBeInViewport();
  }
  // No two actions overlap.
  const boxes = await pane.locator('.sf-sub-toolbar__group .components-button').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlap = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      expect(overlap, `actions ${i} and ${j} overlap`).toBe(false);
    }
  }
}

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

test('UX2-18: at 1024 the entry covers the list as a full-width overlay', async ({ page }) => {
  const m = await openEntry(page, 1024, 768);
  expect(Math.abs(m.pane - m.inbox)).toBeLessThanOrEqual(2);
  expect(Math.abs(m.paneLeft - m.inboxLeft)).toBeLessThanOrEqual(2);
  await actionsInView(page);
});

test('UX2-18: at 390 every entry action is visible', async ({ page }) => {
  const m = await openEntry(page, 390, 844);
  expect(Math.abs(m.pane - m.inbox)).toBeLessThanOrEqual(2);
  await actionsInView(page);
});

test('UX2-18: a wide inbox keeps the list beside the entry', async ({ page }) => {
  const m = await openEntry(page, 1440, 900);
  expect(m.pane).toBeLessThan(m.inbox - 300);
});
