/**
 * Review #21: the builder Preview lays a form out at the device width and
 * scales it to the canvas. A 1280px desktop preview in a pane narrower than
 * that must stay fully visible and centred, with no sideways scroll.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, openBuilder } = require('./helpers');

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: `Preview scale ${Date.now()}`,
    fields: [
      { id: 'n', key: 'name', type: 'text', label: 'Name' },
      { id: 'e', key: 'email', type: 'email', label: 'Email' },
    ],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

/** Where the scaled form sits inside the canvas, in viewport pixels. */
function measure(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.sf-preview-workspace__canvas');
    const formEl = document.querySelector('.sf-preview-workspace__form');
    const c = canvas.getBoundingClientRect();
    const f = formEl.getBoundingClientRect();
    const styles = window.getComputedStyle(canvas);
    const padLeft = parseFloat(styles.paddingLeft) || 0;
    const padRight = parseFloat(styles.paddingRight) || 0;
    return {
      canvasLeft: c.left + padLeft,
      canvasRight: c.right - padRight,
      formLeft: f.left,
      formRight: f.right,
      formWidth: f.width,
      layoutWidth: formEl.offsetWidth,
      scrollWidth: canvas.scrollWidth,
      clientWidth: canvas.clientWidth,
      pageScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

/** Make the Desktop preview 1280px wide, whatever the theme's breakpoints. */
async function desktopAt1280(page) {
  await page.addInitScript(() => {
    let value;
    Object.defineProperty(window, 'subtleformsAdmin', {
      configurable: true,
      get: () => value,
      set: (next) => {
        if (next && typeof next === 'object') {
          const bp = next.previewBreakpoints || {};
          next.previewBreakpoints = { tablet: 768, mobile: 375, ...bp, desktop: 1280 };
        }
        value = next;
      },
    });
  });
}

for (const width of [800, 1100, 1440]) {
  test(`a 1280px desktop preview in a ${width}px window is fully visible and centred`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await desktopAt1280(page);
    await loginPage(page);
    await openBuilder(page, form.id);
    await page.locator('#sf-builder-view-preview').click();
    await page.locator('.sf-preview-workspace__form').waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: /^Desktop/ }).click();
    // Let the ResizeObserver settle the scale.
    await page.waitForTimeout(500);

    const m = await measure(page);
    expect(m.layoutWidth).toBe(1280);
    // The pane is narrower than the device, so the form is scaled down.
    expect(m.canvasRight - m.canvasLeft).toBeLessThan(1280);
    expect(m.formWidth).toBeLessThan(1280);
    // Fully inside the canvas content box.
    expect(m.formLeft).toBeGreaterThanOrEqual(m.canvasLeft - 1);
    expect(m.formRight).toBeLessThanOrEqual(m.canvasRight + 1);
    // Centred: equal space either side.
    expect(Math.abs((m.formLeft - m.canvasLeft) - (m.canvasRight - m.formRight))).toBeLessThanOrEqual(2);
    // No sideways scroll in the canvas or the page.
    expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
    expect(m.pageScroll).toBeLessThanOrEqual(0);
  });
}

test('a mobile preview keeps its own width and is centred', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('#sf-builder-view-preview').click();
  await page.locator('.sf-preview-workspace__form').waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /^Mobile/ }).click();
  await page.waitForTimeout(500);

  const m = await measure(page);
  expect(Math.round(m.formWidth)).toBe(m.layoutWidth);
  expect(Math.abs((m.formLeft - m.canvasLeft) - (m.canvasRight - m.formRight))).toBeLessThanOrEqual(2);
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
});
