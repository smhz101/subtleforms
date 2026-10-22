/**
 * 2.6.1: the label of a SubtleForms select sits on one line with its select
 * ("Rows per page" in the list footers), and core controls and text inputs
 * keep their own layout.
 */
const { test, expect } = require('@playwright/test');
const { loginPage } = require('./helpers');

const SHOTS = process.env.SF_SHOTS_DIR || 'test-results/shots/select-label-row';

/** Vertical centre line of the label and of the select, and the row direction. */
const measure = (page, labelText) =>
  page.evaluate((text) => {
    const base = [...document.querySelectorAll('.subtleforms-admin .components-input-base')].find(
      (node) => node.querySelector('select') && node.querySelector('label')?.textContent.trim() === text
    );
    if (!base) return null;
    const label = base.querySelector('label').getBoundingClientRect();
    const select = base.querySelector('select').getBoundingClientRect();
    return {
      direction: getComputedStyle(base).flexDirection,
      labelCenter: label.top + label.height / 2,
      selectCenter: select.top + select.height / 2,
      labelRight: label.right,
      selectLeft: select.left,
      labelLines: Math.round(label.height / parseFloat(getComputedStyle(base.querySelector('label')).lineHeight || '16') || 1),
    };
  }, labelText);

for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`Rows per page: label and select share one line at ${size.width}px`, async ({ page }) => {
    await page.setViewportSize(size);
    await loginPage(page);
    await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');
    await page.getByLabel('Rows per page').first().waitFor({ timeout: 30000 });

    const m = await measure(page, 'Rows per page');
    if (size.width < 600) {
      // A phone gets the compact footer: a bare select named by its title, no
      // label to line up. It must still fit the screen.
      expect(m).toBeNull();
      const box = await page.locator('select.sf-data-table__per-page').boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      await page.locator('.sf-data-table__pagination').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/rows-per-page-390.png` });
      return;
    }
    expect(m).not.toBeNull();
    expect(m.direction).toBe('row');
    // Same centre line, label before the select, on one line.
    expect(Math.abs(m.labelCenter - m.selectCenter)).toBeLessThanOrEqual(2);
    expect(m.labelRight).toBeLessThanOrEqual(m.selectLeft);
    expect(m.labelLines).toBe(1);

    // A text input keeps its label above it.
    const search = await page.evaluate(() => {
      const base = [...document.querySelectorAll('.subtleforms-admin .components-input-base')].find((n) => !n.querySelector('select') && n.querySelector('label'));
      return base ? getComputedStyle(base).flexDirection : 'column';
    });
    expect(search).toBe('column');

    await page.locator('.sf-data-table__pagination').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/rows-per-page${size.width === 1440 ? '' : '-390'}.png` });
  });
}

test('full-width selects on the settings screen keep their label above and fit at both widths', async ({ page }) => {
  await loginPage(page);
  for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.goto('/wp-admin/admin.php?page=subtleforms-settings');
    await page.locator('.subtleforms-admin select').first().waitFor({ timeout: 30000 });
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('.subtleforms-admin .components-input-base select')]
        .filter((s) => s.offsetParent)
        .map((s) => s.getBoundingClientRect())
        .filter((r) => r.width < 70 || r.right > window.innerWidth)
        .length
    );
    expect(bad).toBe(0);
    // Settings selects are not inline: the label stays above the select.
    const dir = await page.evaluate(() => {
      const base = [...document.querySelectorAll('.subtleforms-admin .components-input-base')].find((n) => n.querySelector('select'));
      return getComputedStyle(base).flexDirection;
    });
    expect(dir).toBe('column');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  }
});
