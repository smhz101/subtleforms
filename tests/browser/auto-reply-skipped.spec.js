/**
 * #134: an auto-reply that is not sent because submitter emails are off is
 * logged as Skipped with the reason, and the notification editor warns.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage, openBuilder, spamToken } = require('./helpers');

let client;
let form;
let original;

async function setSubmitterEmails(on) {
  const saved = await client.call('PUT', '/settings', { user_confirmation_enabled: on });
  expect(saved.status, JSON.stringify(saved.body)).toBeLessThan(300);
}

test.beforeAll(async ({ playwright }) => {
  client = await adminApi();
  const current = await client.call('GET', '/settings');
  original = Boolean((current.body?.data ?? current.body).user_confirmation_enabled);
  await setSubmitterEmails(false);

  form = await publishForm(client, {
    title: 'Auto reply skipped',
    fields: [
      { id: 'n', key: 'name', type: 'text', label: 'Name' },
      { id: 'e', key: 'email', type: 'email', label: 'Email' },
    ],
    actions: [
      { id: 'mail_reply', type: 'email', enabled: true, settings: { to: '{email}', subject: 'Thanks', message: 'We got it.' } },
    ],
  });

  const anon = await playwright.request.newContext({ baseURL: process.env.SF_BASE_URL || 'http://localhost:8899' });
  const res = await anon.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: form.id, data: { name: 'Ada', email: 'ada@example.com', form_rendered_at: await spamToken(anon, form.id) } },
  });
  expect(res.status(), await res.text()).toBe(200);
  await anon.dispose();
});

test.afterAll(async () => {
  await setSubmitterEmails(original);
  await cleanup(client, form);
});

test('the notification editor warns that submitter emails are off', async ({ page }) => {
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('#sf-builder-view-settings').click();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();

  const notice = page.locator('.sf-actions-panel__switch-notice');
  await expect(notice).toContainText('Submitter emails are turned off, so this email will not be sent.');
  const link = notice.getByRole('link', { name: 'Turn them on in Settings, Email' });
  await expect(link).toHaveAttribute('href', /page=subtleforms-settings#tab=email$/);
});

test('the entry log shows the auto-reply as Skipped with the reason', async ({ page }) => {
  await expect.poll(async () => (await entries(client, form.id)).length).toBe(1);
  const [entry] = await entries(client, form.id);
  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&submission_id=${entry.id}&form_id=${form.id}`);

  const step = page.locator('.sf-pipe-step--skipped');
  await expect(step).toHaveCount(1, { timeout: 20000 });
  await expect(step.locator('.sf-pipe-status--skipped')).toHaveText('Skipped');
  await expect(step.locator('.sf-pipe-step__skip-note')).toHaveText('Submitter emails are turned off in Settings, Email.');
});
