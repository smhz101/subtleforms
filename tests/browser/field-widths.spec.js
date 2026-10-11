/**
 * 2.2.1 bug 1: a field width must only change layout.
 *
 * Every field type is published at every width, in both saved shapes (width
 * on the node, and width in a partial `config` object, the shape that lost
 * `required` and `options` on a live site). On the live page each field must
 * keep its required marker, its options, its placeholder and its help text,
 * and every control must carry a name (bug 11). The standalone Country field
 * must list the countries (bug 3).
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, waitForForm, useBundleOverride } = require('./helpers');
const { SAMPLES, WIDTHS, fieldsForWidth } = require('./fixtures/fields');

let client;
const created = [];

test.beforeAll(async () => {
  client = await adminApi();
});

test.beforeEach(async ({ page }) => {
  await useBundleOverride(page);
});

test.afterAll(async () => {
  for (const form of created) {
    await cleanup(client, form);
  }
});

for (const width of WIDTHS) {
  test(`every field type keeps its settings at width ${width}`, async ({ page }) => {
    const form = await publishForm(client, {
      title: `Widths ${width}`,
      fields: fieldsForWidth(width),
    });
    created.push(form);

    await page.goto(form.url);
    await waitForForm(page);

    for (const sample of SAMPLES) {
      for (const shape of ['flat', 'wrapped']) {
        const key = `${sample.key || sample.type}_${shape}`;
        const id = `subtleforms-field-${key}`;
        const wrapper = page.locator(`.subtleforms-field:has([id^="${id}"])`).first();
        await expect(wrapper, `${key} is drawn`).toBeVisible();

        // Width affects layout only.
        const style = (await wrapper.getAttribute('style')) || '';
        if (width === '100') {
          expect(style, `${key} full width`).not.toContain('flex-basis');
        } else {
          expect(style, `${key} width`).toContain(`${width}%`);
        }

        // Required marker and help text survive.
        if (!sample.check.noRequired) {
          await expect(wrapper.locator('.subtleforms-required').first(), `${key} asterisk`).toBeVisible();
          const requiredHolder = wrapper.locator('[aria-required="true"], [required], [role="group"]');
          expect(await requiredHolder.count(), `${key} aria-required or required`).toBeGreaterThan(0);
        }
        await expect(wrapper.locator(`#${id}-help`), `${key} help`).toHaveText(`Help for ${key}`);

        if (sample.check.native) {
          const control = page.locator(`#${id}`);
          expect(await control.getAttribute('required'), `${key} required attribute`).not.toBeNull();
        }

        if (sample.check.placeholder) {
          const control = page.locator(`#${id}`);
          const tag = await control.evaluate((el) => el.tagName);
          if (tag === 'SELECT') {
            await expect(control.locator('option').first(), `${key} placeholder`).toHaveText(sample.extra.placeholder);
          } else {
            await expect(control, `${key} placeholder`).toHaveAttribute('placeholder', sample.extra.placeholder);
          }
        }

        if (sample.check.options) {
          if (['select', 'dropdown'].includes(sample.type)) {
            // Plus the placeholder option.
            await expect(page.locator(`#${id} option`), `${key} options`).toHaveCount(sample.check.options + 1);
          } else {
            await expect(
              wrapper.locator('input[type="radio"], input[type="checkbox"]'),
              `${key} options`
            ).toHaveCount(sample.check.options);
          }
        }

        if (sample.check.countries) {
          // 249 ISO countries plus the placeholder (bug 3).
          expect(await page.locator(`#${id} option`).count(), `${key} countries`).toBeGreaterThan(240);
          await expect(page.locator(`#${id} option[value="PK"]`)).toHaveText('Pakistan');
        }

        // Every control has a stable name (bug 11).
        const unnamed = await wrapper.evaluate((el) =>
          Array.from(el.querySelectorAll('input, select, textarea'))
            .filter((c) => c.type !== 'button' && c.type !== 'submit' && !c.name)
            .map((c) => c.id || c.className)
        );
        expect(unnamed, `${key} unnamed controls`).toEqual([]);
      }
    }
  });
}
