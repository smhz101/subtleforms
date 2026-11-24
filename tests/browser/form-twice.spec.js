/**
 * Free #135: the same form twice on one page. No id is used twice, a label in
 * the second copy focuses the second copy's input, and a failed submit of the
 * second copy moves focus inside the second copy.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, publishForm, waitForForm } = require('./helpers');

let client;
let form;
let twicePageId;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: `Form twice ${Date.now()}`,
    fields: [
      { id: 'a', key: 'fullname', type: 'text', label: 'Full name', required: true },
      { id: 'b', key: 'email', type: 'email', label: 'Email address' },
    ],
  });
  const page = await client.call('POST', '/wp/v2/pages', {
    title: `Form twice page ${Date.now()}`,
    status: 'publish',
    content: `<!-- wp:shortcode -->[subtleforms id="${form.id}"]<!-- /wp:shortcode --><!-- wp:shortcode -->[subtleforms id="${form.id}"]<!-- /wp:shortcode -->`,
  });
  twicePageId = page.body?.id;
});

test.afterAll(async () => {
  if (twicePageId) await client.call('DELETE', `/wp/v2/pages/${twicePageId}?force=true`);
  if (form) await cleanup(client, form);
});

async function open(page) {
  await page.goto(`/?page_id=${twicePageId}`);
  await waitForForm(page);
  await expect(page.locator('form')).toHaveCount(2);
  await expect(page.locator('form').nth(1).getByLabel('Full name')).toBeVisible();
}

test('#135: no id is used twice on the page', async ({ page }) => {
  await open(page);
  const dupes = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((n) => n.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(dupes).toEqual([]);
});

test('#135: clicking a label in the second copy focuses the second copy input', async ({ page }) => {
  await open(page);
  const second = page.locator('form').nth(1);
  await second.getByText('Full name').first().click();
  const focusedInSecond = await page.evaluate(() => {
    const forms = document.querySelectorAll('form');
    return forms[1].contains(document.activeElement) && !forms[0].contains(document.activeElement);
  });
  expect(focusedInSecond).toBe(true);
  await expect(second.getByLabel('Full name')).toBeFocused();
});

test('#135: a failed submit of the second copy focuses its own field', async ({ page }) => {
  await open(page);
  const second = page.locator('form').nth(1);
  await second.locator('button[type="submit"], input[type="submit"]').first().click();
  await expect(second.locator('[aria-invalid="true"]').first()).toBeFocused();
  const stillFirst = await page.evaluate(() => document.querySelectorAll('form')[0].contains(document.activeElement));
  expect(stillFirst).toBe(false);
});
