/**
 * 2.9.2 (#144): a rule that compares a Date field with greater than or less
 * than works in the browser and on the server. It used to read the dates as
 * numbers, so the rule never matched and the dependent field stayed hidden.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, entries, cleanup, waitForForm } = require('./helpers');

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: `Date compare ${Date.now()}`,
    fields: [
      { id: 'd', key: 'event_date', type: 'date', label: 'Event date' },
      {
        id: 'r',
        key: 'late_reason',
        type: 'text',
        label: 'Late booking reason',
        logic: { action: 'show', groups: [{ match: 'all', rules: [{ field: 'event_date', operator: 'less_than', value: '2026-12-01' }] }] },
      },
    ],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

test('the field shows for an earlier date and hides for a later one, and the server drops the hidden answer', async ({ page }) => {
  await page.goto(form.url);
  await waitForForm(page);
  const date = page.locator('#subtleforms-field-event_date');
  const reason = page.locator('#subtleforms-field-late_reason');

  await expect(reason).toBeHidden();
  await date.fill('25/11/2026');
  await date.blur();
  await expect(reason).toBeVisible();
  await reason.fill('Booked in a hurry');

  await date.fill('20/12/2026');
  await date.blur();
  await expect(reason).toBeHidden();

  // A form sent within a few seconds of loading is dropped as a bot's.
  await page.waitForTimeout(4500);
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-success-message')).toBeVisible();
  await expect.poll(async () => (await entries(client, form.id)).length, { timeout: 20000 }).toBe(1);
  const [entry] = await entries(client, form.id);
  const payload = entry.payload || {};
  expect(payload.event_date).toBe('2026-12-20');
  expect(payload.late_reason).toBeUndefined();
});
