/**
 * Entry dates follow the site time zone (Settings, General), not the browser's.
 * The site is UTC and the browser is in Asia/Karachi (UTC+5): the panel header,
 * the first activity log row and the list row must all show the UTC time.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage, spamToken } = require('./helpers');

test.use({ timezoneId: 'Asia/Karachi', locale: 'en-US' });

let client;
let form;
let previousZone;

const SHORT = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
};

test.beforeAll(async ({ playwright }) => {
  client = await adminApi();
  const settings = await client.call('GET', '/wp/v2/settings');
  previousZone = settings.body?.timezone ?? '';
  const set = await client.call('POST', '/wp/v2/settings', { timezone: 'UTC' });
  expect(set.status, JSON.stringify(set.body)).toBe(200);

  form = await publishForm(client, {
    title: 'Site time zone',
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }],
  });
  const anon = await playwright.request.newContext({ baseURL: process.env.SF_BASE_URL || 'http://localhost:8899' });
  const res = await anon.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: form.id, data: { name: 'Ada', form_rendered_at: await spamToken(anon, form.id) } },
  });
  expect(res.status(), await res.text()).toBe(200);
  await anon.dispose();
});

test.afterAll(async () => {
  await cleanup(client, form);
  await client.call('POST', '/wp/v2/settings', { timezone: previousZone || 'UTC' });
});

test('header, first log row and list row show the site time, not the browser time', async ({ page }) => {
  const [entry] = await entries(client, form.id);
  const stored = String(entry.created_at).replace(' ', 'T') + 'Z';
  const expected = new Intl.DateTimeFormat('en-US', SHORT).format(new Date(stored));
  const browserTime = new Intl.DateTimeFormat('en-US', { ...SHORT, timeZone: 'Asia/Karachi' }).format(new Date(stored));
  expect(browserTime).not.toBe(expected);

  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}`);
  const rows = page.locator('.sf-data-table__table tbody tr');
  await expect(rows).toHaveCount(1, { timeout: 20000 });

  // The list row: its tooltip carries the site date and the zone.
  await expect(rows.first().locator('time.sf-sub-time')).toHaveAttribute('title', `${expected} (UTC)`);

  await rows.first().click();
  const detail = page.locator('.sf-inbox-entry');
  await expect(detail).toBeVisible();

  const received = detail.locator('dt', { hasText: /^Received$/ }).locator('xpath=following-sibling::dd[1]');
  await expect(received).toHaveText(expected);
  await expect(received).toHaveAttribute('title', `${expected} (UTC)`);

  await detail.getByRole('tab', { name: /^Log \(/ }).click();
  const firstLogTime = detail.locator('.sf-log-table__time').first();
  await expect(firstLogTime).toHaveText(expected);
  await expect(firstLogTime).toHaveText(await received.innerText());
});
