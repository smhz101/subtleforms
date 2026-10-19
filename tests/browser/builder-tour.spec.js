/**
 * UX2-26: the builder tour keeps the builder still, and its toolbar and
 * settings steps point at a selected field.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, openBuilder, publishForm } = require('./helpers');

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: `Tour ${Date.now()}`,
    fields: [
      { id: 'a', key: 'a', type: 'text', label: 'First' },
      { id: 'b', key: 'b', type: 'text', label: 'Second' },
    ],
  });
});

test.afterAll(async () => {
  if (form) await cleanup(client, form);
});

test('UX2-26: the tour never scrolls the window and points at a selected field', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.getByRole('button', { name: 'Help & tour' }).first().click();
  await page.getByRole('menuitem', { name: 'Start Tour' }).click();

  const seen = [];
  for (let i = 0; i < 8; i++) {
    const tooltip = page.locator('.sf-builder-tour__tooltip--positioned');
    await expect(tooltip).toBeVisible();
    const m = await page.evaluate(() => {
      const t = document.querySelector('.sf-builder-tour__tooltip').getBoundingClientRect();
      return { y: window.scrollY, inView: t.top >= 0 && t.bottom <= window.innerHeight && t.left >= 0 && t.right <= window.innerWidth };
    });
    expect(m.y, `step ${i + 1} scrolled the window`).toBe(0);
    expect(m.inView, `step ${i + 1} tooltip off screen`).toBe(true);
    const title = (await tooltip.locator('h3, h2').first().textContent()).trim();
    seen.push(title);
    if (title === 'Field toolbar') {
      await expect(page.locator('.sf-field-toolbar--visible')).toBeVisible();
    }
    if (title === 'Field settings') {
      await expect(page.locator('[data-tour="field-inspector"] .sf-field-inspector')).toBeVisible();
    }
    const next = page.getByRole('button', { name: /^(Next|Finish)$/ }).first();
    await next.click();
  }
  expect(seen).toContain('Field toolbar');
  expect(seen).toContain('Field settings');
});
