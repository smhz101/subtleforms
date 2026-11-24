/**
 * #124: the Star button in the entry panel shows whether the entry is starred,
 * and stays in step with the star in the list.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage, spamToken } = require('./helpers');

let client;
let form;

test.beforeAll(async ({ playwright }) => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Panel star',
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }],
  });
  const anon = await playwright.request.newContext({ baseURL: process.env.SF_BASE_URL || 'http://localhost:8899' });
  const res = await anon.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: form.id, data: { name: 'Grace Hopper', form_rendered_at: await spamToken(anon, form.id) } },
  });
  expect(res.status(), await res.text()).toBe(200);
  await anon.dispose();
});

test.afterAll(async () => {
  await cleanup(client, form);
});

test('the panel Star button shows the starred state and follows the row star', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}`);
  const row = page.locator('.sf-data-table__table tbody tr').first();
  await expect(row).toBeVisible({ timeout: 20000 });
  // Open the entry from its name, not the row centre (which can land on a row action).
  await row.getByText('Grace Hopper').first().click();

  const detail = page.locator('.sf-inbox__pane');
  await expect(detail).toBeVisible();
  const starred = async () => parseInt((await entries(client, form.id))[0]?.starred, 10);
  const panelStar = () => detail.locator('[aria-label="Submission actions"] button').filter({ hasText: /^Star(red)?$/ });
  const rowStar = () => page.locator('.sf-submissions-table__star-btn');

  // Not starred yet.
  await expect(panelStar()).toHaveText('Star');
  await expect(panelStar()).toHaveAttribute('aria-pressed', 'false');
  await expect(rowStar()).toHaveAttribute('aria-pressed', 'false');

  // Star from the panel.
  const before = await panelStar().boundingBox();
  await panelStar().click();
  await expect.poll(starred).toBe(1);
  await expect(panelStar()).toHaveText('Starred');
  await expect(panelStar()).toHaveAttribute('aria-pressed', 'true');
  await expect(rowStar()).toHaveAttribute('aria-pressed', 'true');
  const after = await panelStar().boundingBox();
  expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(24);
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);

  // Unstar from the panel.
  await panelStar().click();
  await expect.poll(starred).toBe(0);
  await expect(panelStar()).toHaveText('Star');
  await expect(panelStar()).toHaveAttribute('aria-pressed', 'false');
  await expect(rowStar()).toHaveAttribute('aria-pressed', 'false');

  // Star from the row while the panel is open: the panel follows.
  await rowStar().click();
  await expect.poll(starred).toBe(1);
  await expect(panelStar()).toHaveText('Starred');
  await expect(panelStar()).toHaveAttribute('aria-pressed', 'true');

  // And back off from the row.
  await rowStar().click();
  await expect.poll(starred).toBe(0);
  await expect(panelStar()).toHaveText('Star');
  await expect(panelStar()).toHaveAttribute('aria-pressed', 'false');

  expect(pageErrors).toEqual([]);
});
