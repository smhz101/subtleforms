/**
 * Export CSV follows the tab (issue 133): on the Starred tab the file holds the
 * starred entries, and an export with nothing to write says so and stays on the
 * tab.
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage, spamToken } = require('./helpers');

let client;
let form;

const NOTHING = 'Nothing to export for these filters.';

/** The data rows of a downloaded CSV (without the heading). */
function dataRows(path) {
  const text = fs.readFileSync(path, 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.slice(1).filter((r) => r.some((c) => c !== ''));
}

test.beforeAll(async ({ playwright }) => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Export tabs',
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }],
  });
  const anon = await playwright.request.newContext({ baseURL: process.env.SF_BASE_URL || 'http://localhost:8899' });
  for (const name of ['Ada', 'Grace', 'Linus', 'Khan']) {
    const res = await anon.post('/wp-json/subtleforms/v1/submit', {
      data: { form_id: form.id, data: { name, form_rendered_at: await spamToken(anon, form.id) } },
    });
    expect(res.status(), await res.text()).toBe(200);
  }
  await anon.dispose();
  const list = await entries(client, form.id);
  expect(list.length).toBe(4);
  for (const entry of list.slice(0, 2)) {
    const res = await client.call('PUT', `/submissions/${entry.id}`, { starred: 1 });
    expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
  }
  await expect
    .poll(async () => (await entries(client, form.id)).filter((e) => Number(e.starred) === 1).length)
    .toBe(2);
});

test.afterAll(async () => {
  await cleanup(client, form);
});

test('Export CSV on the Starred tab downloads the starred entries', async ({ page }) => {
  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}&tab=starred`);
  const rows = page.locator('.sf-data-table__table tbody tr');
  await expect(rows).toHaveCount(2, { timeout: 20000 });

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const path = await download.path();
  const data = dataRows(path);
  expect(data).toHaveLength(2);
  const text = fs.readFileSync(path, 'utf8');
  const starredNames = (await entries(client, form.id))
    .filter((e) => Number(e.starred) === 1)
    .map((e) => (e.data && e.data.name) || '')
    .filter(Boolean);
  starredNames.forEach((name) => expect(text).toContain(name));
});

test('an export with nothing to write says so and stays on the tab', async ({ page }) => {
  await loginPage(page);
  // The Spam tab has no entries: the screen says so and starts no download.
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}&tab=spam`);
  await expect(page.locator('.sf-data-table__table tbody tr')).toHaveCount(0, { timeout: 20000 });
  await page.getByRole('button', { name: 'Export CSV' }).click();
  await expect(page.getByRole('dialog')).toContainText(NOTHING);
  await page.keyboard.press('Escape');
  expect(new URL(page.url()).searchParams.get('tab')).toBe('spam');

  // When the server is the one to refuse (a search it finds nothing for) it
  // sends the browser back to the same tab with the notice.
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}&tab=starred`);
  await expect(page.locator('.sf-data-table__table tbody tr')).toHaveCount(2, { timeout: 20000 });
  await page.evaluate(() => {
    const admin = window.subtleformsAdmin;
    const url = new URL(admin.exportCsvUrl, window.location.href);
    url.searchParams.set('status', 'starred');
    url.searchParams.set('search', 'nobody by this name');
    url.searchParams.set('_wpnonce', admin.exportCsvNonce);
    const link = document.createElement('a');
    link.href = url.toString();
    document.body.appendChild(link);
    link.click();
  });
  await page.waitForURL(/sf_export=empty|tab=starred.*search=/, { timeout: 30000 });
  await expect(page.getByText(NOTHING).first()).toBeVisible({ timeout: 20000 });
  const back = new URL(page.url());
  expect(back.searchParams.get('tab')).toBe('starred');
  expect(back.searchParams.get('search')).toBe('nobody by this name');
});
