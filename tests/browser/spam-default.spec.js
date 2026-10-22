/**
 * 2.6.0: default spam protection and the blocked spam counter.
 *
 * - a filled hidden trap field is dropped quietly and the counter goes up
 * - a too-fast submit gets the same "thank you", stores nothing and counts
 * - a normal submit is still stored and not counted
 * - the trap field is hidden from screen readers and keyboards
 * - the dashboard card and the form's Spam protection settings show it
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, waitForForm, useBundleOverride, loginPage, openBuilder } = require('./helpers');

const SHOTS = path.join(process.cwd(), 'test-results', 'shots', 'spam260');

let client;
const created = [];

test.beforeAll(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
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

async function stats(formId) {
  const res = await client.call('GET', `/spam/stats?days=30${formId ? `&form_id=${formId}` : ''}`);
  expect(res.status).toBe(200);
  return res.body.data;
}

async function contactForm(title) {
  const form = await publishForm(client, {
    title,
    fields: [{ id: 'n1', key: 'name', type: 'text', label: 'Your name' }],
  });
  created.push(form);
  return form;
}

test('a new form starts with both traps on', async () => {
  const form = await contactForm('Spam defaults');
  const schema = await client.call('GET', `/forms/${form.id}/schema?context=builder`);
  const spam = schema.body?.data?.schema?.metadata?.spam;
  expect(spam).toEqual({ honeypot: true, timeTrap: true });
});

test('a filled trap field is dropped quietly and counted', async ({ page }) => {
  const form = await contactForm('Spam honeypot');
  const before = await stats(form.id);

  await page.goto(form.url);
  await waitForForm(page);

  // Hidden from screen readers and keyboards, not just from sight.
  const wrapper = page.locator('.subtleforms-honeypot');
  await expect(wrapper).toHaveAttribute('aria-hidden', 'true');
  const trap = page.locator('input[data-subtleforms-honeypot]');
  await expect(trap).toHaveAttribute('tabindex', '-1');
  await expect(trap).toHaveAttribute('autocomplete', 'off');
  await page.getByLabel('Your name').focus();
  await page.keyboard.press('Tab');
  expect(await trap.evaluate((el) => el === document.activeElement)).toBe(false);

  // What a robot does: fill every input it finds.
  await page.getByLabel('Your name').fill('Robot');
  await trap.evaluate((el) => {
    el.value = 'https://spam.example';
  });
  await page.waitForTimeout(3200);
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-success-message')).toBeVisible();

  expect(await entries(client, form.id)).toHaveLength(0);
  const after = await stats(form.id);
  expect(after.total).toBe(before.total + 1);
  expect(after.reasons.honeypot).toBe(before.reasons.honeypot + 1);
});

test('a too-fast submit gets a thank you, stores nothing and is counted', async ({ page }) => {
  const form = await contactForm('Spam too fast');
  const before = await stats(form.id);

  await page.goto(form.url);
  await waitForForm(page);
  await page.getByLabel('Your name').fill('Speedy');
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-success-message')).toBeVisible();

  expect(await entries(client, form.id)).toHaveLength(0);
  const after = await stats(form.id);
  expect(after.reasons.time_trap).toBe(before.reasons.time_trap + 1);
});

test('a normal submit is stored and not counted', async ({ page }) => {
  const form = await contactForm('Spam normal');

  await page.goto(form.url);
  await waitForForm(page);
  await page.getByLabel('Your name').fill('Ada');
  await page.waitForTimeout(3200);
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-success-message')).toBeVisible();

  await expect.poll(async () => (await entries(client, form.id)).length).toBe(1);
  expect((await stats(form.id)).total).toBe(0);
});

test('the dashboard shows the spam blocked in the last 30 days', async ({ page }) => {
  const site = await stats();
  test.skip(site.total < 1, 'Needs the blocked submissions from the tests above.');

  await loginPage(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/wp-admin/admin.php?page=subtleforms');
  const card = page.locator('.sf-spam-card');
  await expect(card).toBeVisible({ timeout: 30000 });
  const words = site.total === 1 ? 'spam message' : 'spam messages';
  await expect(card).toContainText(`SubtleForms blocked ${site.total.toLocaleString('en-US')} ${words} in the last 30 days.`);
  await expect(card).toContainText('Hidden trap field');
  await expect(card).toContainText('Sent too fast');

  // Every bar is reachable by keyboard and named for screen readers.
  const bars = card.locator('.sf-trend__col');
  await expect(bars).toHaveCount(30);
  await bars.last().focus();
  await expect(bars.last()).toHaveAttribute('aria-label', /blocked$/);

  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 0);
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: path.join(SHOTS, 'spam-dashboard-card.png') });
  await page.screenshot({ path: path.join(SHOTS, 'spam-dashboard.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 900 });
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
  await card.screenshot({ path: path.join(SHOTS, 'spam-dashboard-card-phone.png') });
});

test("a form's settings show its own switches and 30-day count", async ({ page }) => {
  const form = await contactForm('Spam settings');
  await loginPage(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openBuilder(page, form.id);

  await page.locator('#sf-builder-view-settings').click();
  await page.locator('.sf-form-settings__nav').getByRole('button', { name: 'Spam protection' }).click();

  const trap = page.getByRole('checkbox', { name: 'Hidden trap field' });
  const fast = page.getByRole('checkbox', { name: 'Too-fast check' });
  await expect(trap).toBeChecked();
  await expect(fast).toBeChecked();
  await expect(page.locator('.sf-spam-panel__count')).toContainText('No spam blocked yet.');
  await page.locator('.sf-form-settings__content').screenshot({ path: path.join(SHOTS, 'spam-form-settings.png') });
});

test('existing sites are offered protection for every form, with undo', async ({ page }) => {
  // A form that has both traps off, as an older form on an updated site may.
  const off = await publishForm(client, {
    title: 'Spam off',
    fields: [{ id: 'n1', key: 'name', type: 'text', label: 'Your name' }],
    metadata: { spam: { honeypot: false, timeTrap: false } },
  });
  created.push(off);
  const status = await client.call('GET', '/spam/protection');
  test.skip(status.body?.data?.notice !== 'invite', 'This site already answered the one-time offer.');

  await loginPage(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/wp-admin/admin.php?page=subtleforms');
  const notice = page.locator('.sf-spam-notice');
  await expect(notice).toContainText('Stop spam without a puzzle for your visitors');
  await notice.screenshot({ path: path.join(SHOTS, 'spam-notice.png') });

  await notice.getByRole('button', { name: 'Turn on for all forms' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Nothing else on your forms changes.');
  await dialog.screenshot({ path: path.join(SHOTS, 'spam-notice-confirm.png') });
  await dialog.getByRole('button', { name: 'Turn on for all forms' }).click();

  await expect(notice).toContainText('Spam protection is now on for');
  await notice.screenshot({ path: path.join(SHOTS, 'spam-notice-enabled.png') });
  let schema = await client.call('GET', `/forms/${off.id}/schema?context=builder`);
  expect(schema.body?.data?.schema?.metadata?.spam).toEqual({ honeypot: true, timeTrap: true });

  await notice.getByRole('button', { name: 'Undo' }).click();
  await expect(notice).toHaveCount(0);
  schema = await client.call('GET', `/forms/${off.id}/schema?context=builder`);
  expect(schema.body?.data?.schema?.metadata?.spam).toEqual({ honeypot: false, timeTrap: false });
});
