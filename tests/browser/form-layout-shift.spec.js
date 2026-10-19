/**
 * UX2-27: a page with a form does not jump when the form appears. The
 * cumulative layout shift stays under 0.05 on a desktop and on a phone
 * (it was 0.35 and 0.71).
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, publishForm } = require('./helpers');

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: `Layout shift ${Date.now()}`,
    fields: [
      { id: 'a', key: 'first', type: 'text', label: 'First name', appearance: { width: '50' } },
      { id: 'b', key: 'last', type: 'text', label: 'Last name', appearance: { width: '50' } },
      { id: 'c', key: 'email', type: 'email', label: 'Email' },
      { id: 'd', key: 'topic', type: 'radio', label: 'Topic', options: [{ label: 'One', value: 'one' }, { label: 'Two', value: 'two' }, { label: 'Three', value: 'three' }] },
      { id: 'e', key: 'message', type: 'textarea', label: 'Message' },
    ],
  });
});

test.afterAll(async () => {
  if (form) await cleanup(client, form);
});

for (const size of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`UX2-27: no layout shift when the form appears at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(form.url);
    await page.waitForSelector('.subtleforms form, .subtleforms');
    await page.waitForTimeout(1500);
    const container = page.locator('.subtleforms-form-container, .subtleforms-block').first();
    await expect(container).not.toHaveAttribute('data-reserve', /.*/);
    const cls = await page.evaluate(() => window.__cls);
    expect(cls).toBeLessThan(0.05);
  });
}
