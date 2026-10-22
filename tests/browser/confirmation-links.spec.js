/**
 * 2.7.0: links in confirmation messages are clickable, and only safe ones.
 *
 * http, https and site-relative addresses become links with rel="noopener".
 * A javascript: address stays plain text and nothing in the message becomes
 * markup.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, waitForForm, useBundleOverride } = require('./helpers');

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

test('a safe link in the confirmation is clickable and a javascript: link is not', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'Confirmation links',
    metadata: {
      confirmation: {
        type: 'message',
        title: 'Thanks {name}',
        message:
          'Read [our guide](https://example.com/guide) or go to [your account](/my-account/).\n\nBad: [click](javascript:alert(1)) <b>not bold</b> https://example.org/x.',
      },
    },
    fields: [
      { id: 'f1', key: 'name', type: 'text', label: 'Name', required: true },
    ],
  });
  created.push(form);

  await page.goto(form.url);
  await waitForForm(page);
  await page.fill('#subtleforms-field-name', 'Ada');
  // The time trap rejects forms sent within a couple of seconds of loading.
  await page.waitForTimeout(3200);
  await page.click('.subtleforms-button-submit');

  const box = page.locator('.subtleforms-success-message');
  await expect(box).toBeVisible();
  await expect(box.locator('h3')).toHaveText('Thanks Ada');

  const links = box.locator('a');
  await expect(links).toHaveCount(3);
  await expect(links.nth(0)).toHaveAttribute('href', 'https://example.com/guide');
  await expect(links.nth(0)).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(links.nth(1)).toHaveAttribute('href', '/my-account/');
  await expect(links.nth(2)).toHaveAttribute('href', 'https://example.org/x');

  // The javascript: address is plain text and no markup gets in (the server
  // also strips tags when the form is saved).
  await expect(box).toContainText('[click](javascript:alert(1))');
  await expect(box).toContainText('not bold');
  await expect(box.locator('b')).toHaveCount(0);
  const hrefs = await box.locator('a').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  expect(hrefs.some((h) => /^javascript:/i.test(h))).toBe(false);

  await page.screenshot({ path: 'test-results/confirmation-links.png', fullPage: false });
});
