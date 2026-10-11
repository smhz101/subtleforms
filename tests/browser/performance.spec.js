/**
 * 2.3.0 feature 21: front-end weight.
 *
 * - A page without a form loads no SubtleForms script or stylesheet.
 * - The signature pad and rich text editor are downloaded only when the form
 *   on the page has those fields.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, waitForForm } = require('./helpers');

let client;
const created = [];
let plainPage;

test.beforeAll(async () => {
  client = await adminApi();
  const page = await client.call('POST', '/wp/v2/pages', {
    title: 'No form here',
    status: 'publish',
    content: '<!-- wp:paragraph --><p>Just text.</p><!-- /wp:paragraph -->',
  });
  plainPage = page.body.id;
});

test.afterAll(async () => {
  for (const form of created) await cleanup(client, form);
  if (plainPage) await client.call('DELETE', `/wp/v2/pages/${plainPage}?force=true`);
});

/** Free plugin asset requests made while a page loads. */
async function freeAssets(page, url) {
  const seen = [];
  page.on('request', (req) => {
    const u = req.url();
    if (/\/plugins\/subtleforms\/(build|assets)\//.test(u)) seen.push(u);
  });
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  return seen;
}

test('no assets on a page without a form', async ({ page }) => {
  const seen = await freeAssets(page, `/?page_id=${plainPage}`);
  expect(seen).toEqual([]);
  expect(await page.locator('link[href*="/plugins/subtleforms/"], script[src*="/plugins/subtleforms/"]').count()).toBe(0);
});

test('signature and rich text code loads only when needed', async ({ page }) => {
  const plain = await publishForm(client, {
    title: 'Perf plain',
    fields: [{ id: 'p1', key: 'name', type: 'text', label: 'Name' }],
  });
  const rich = await publishForm(client, {
    title: 'Perf rich',
    fields: [
      { id: 'r1', key: 'sig', type: 'signature', label: 'Signature' },
      { id: 'r2', key: 'bio', type: 'rich_text', label: 'Bio' },
    ],
  });
  created.push(plain, rich);

  let seen = await freeAssets(page, plain.url);
  await waitForForm(page);
  expect(seen.some((u) => /frontend\.js/.test(u))).toBe(true);
  expect(seen.filter((u) => /field-(signature|rich-text)/.test(u))).toEqual([]);

  const page2 = await page.context().newPage();
  seen = await freeAssets(page2, rich.url);
  await waitForForm(page2);
  await expect(page2.locator('canvas.subtleforms-signature__canvas')).toBeVisible();
  await expect(page2.locator('.subtleforms-richtext__editor')).toBeVisible();
  expect(seen.some((u) => /field-signature\./.test(u))).toBe(true);
  expect(seen.some((u) => /field-rich-text\./.test(u))).toBe(true);
});
