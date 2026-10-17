/**
 * 2.3.0 feature 20: entries bulk actions, star, notes, resend notifications
 * and export selected.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage } = require('./helpers');

let client;
let form;

/** Send an entry as a visitor would. */
async function submitEntry(api, formId, data) {
  const res = await api.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: formId, data: { ...data, form_rendered_at: Math.floor(Date.now() / 1000) - 60 } },
  });
  expect(res.status(), await res.text()).toBe(200);
}

test.beforeAll(async ({ playwright }) => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Entries tools',
    fields: [
      { id: 'n', key: 'name', type: 'text', label: 'Name' },
      { id: 'm', key: 'notes', type: 'textarea', label: 'Notes' },
    ],
    actions: [{ type: 'email', settings: { to: '{admin_email}', subject: 'Entry {entry_id}', message: '{all_fields}' } }],
  });
  const anon = await playwright.request.newContext({ baseURL: process.env.SF_BASE_URL || 'http://localhost:8899' });
  for (const name of ['Ada', 'Grace', 'Linus']) {
    await submitEntry(anon, form.id, { name, notes: `Hello from ${name}\nSecond line` });
  }
  await anon.dispose();
});

test.afterAll(async () => {
  await cleanup(client, form);
});

test('bulk star, mark read, export selected and delete', async ({ page }) => {
  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}`);
  const rows = page.locator('.sf-data-table__table tbody tr');
  await expect(rows).toHaveCount(3, { timeout: 20000 });

  await page.getByRole('checkbox', { name: /Select row/ }).nth(0).check();
  await page.getByRole('checkbox', { name: /Select row/ }).nth(1).check();
  await expect(page.locator('.sf-data-table__bulk-actions')).toContainText('2 items selected');

  await page.getByRole('button', { name: 'Star', exact: true }).first().click();
  await expect.poll(async () => (await entries(client, form.id)).filter((e) => Number(e.starred) === 1).length).toBe(2);

  // Starred tab lists only the starred entries.
  await page.getByRole('tab', { name: /Starred/ }).click().catch(async () => page.getByText('Starred', { exact: true }).first().click());
  await expect(rows).toHaveCount(2);

  // Export selected downloads a CSV (CSV export is a Pro capability).
  await page.getByRole('checkbox', { name: /Select row/ }).nth(0).check();
  const exportButton = page.getByRole('button', { name: 'Export selected (CSV)' });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    exportButton.click(),
  ]);
  if (download) {
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  } else {
    // Without Pro the upgrade dialog explains the lock instead.
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  }

  // Bulk delete asks first, then removes both.
  await page.getByRole('tab', { name: /All/ }).first().click().catch(() => {});
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}`);
  await expect(rows).toHaveCount(3, { timeout: 20000 });
  await page.getByRole('checkbox', { name: 'Select all' }).check();
  await page.getByRole('button', { name: 'Mark as Read' }).click();
  await expect.poll(async () => (await entries(client, form.id)).filter((e) => Number(e.is_read) === 1).length).toBe(3);

  // Bulk delete moves the entry to the Trash (2.3.1); it leaves the list.
  await page.reload();
  await expect(rows).toHaveCount(3, { timeout: 20000 });
  await page.getByRole('checkbox', { name: /Select row/ }).nth(2).check();
  await page.locator('.sf-data-table__bulk-actions').getByRole('button', { name: 'Move to Trash' }).click();
  await expect.poll(async () => (await entries(client, form.id)).length).toBe(2);
});

test('notes and resend notifications on an entry', async ({ page }) => {
  const [entry] = await entries(client, form.id);
  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&submission_id=${entry.id}&form_id=${form.id}`);
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible({ timeout: 20000 });

  // Multi-line answers keep their line breaks on screen.
  await expect(page.locator('.sf-answers__text--multiline').first()).toHaveCSS('white-space', 'pre-wrap');

  await page.getByLabel('Add a note').fill('Called back on Monday.\nWants a quote.');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.locator('.sf-notes__text')).toHaveText('Called back on Monday.\nWants a quote.');

  // Stored on the entry.
  const stored = await client.call('GET', `/submissions/${entry.id}`);
  expect(stored.body.data.meta.notes).toHaveLength(1);
  expect(stored.body.data.meta.notes[0].author_name).toBeTruthy();

  await page.getByRole('button', { name: 'Delete note' }).click();
  await expect(page.locator('.sf-notes__item')).toHaveCount(0);

  // Star from the entry screen.
  const star = page.locator('.sf-sub-toolbar button', { hasText: /^Star(red)?$/ });
  const before = (await star.textContent()).trim();
  await star.click();
  await expect(star).toHaveText(before === 'Star' ? 'Starred' : 'Star');

  // Resend asks first, then confirms.
  await page.getByRole('button', { name: 'Resend notifications' }).click();
  await page.getByRole('button', { name: 'Resend', exact: true }).click();
  await expect(page.locator('#sf-main .components-notice__content', { hasText: '1 notification queued again.' })).toBeVisible();
});
