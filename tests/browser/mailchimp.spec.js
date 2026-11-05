/**
 * Mailchimp in the free plugin, end to end on a real site with a pretend
 * Mailchimp (tests/browser/fixtures/mailchimp-mock.php): connect with an API
 * key, turn Mailchimp on for a form and map its fields in the builder, submit
 * the form in the browser, and read the "Mailchimp: subscribed" line on the
 * entry.
 *
 * Needs WP-CLI for the site: SF_WP_CLI="php wp-cli.phar --allow-root --path=/path/to/site"
 * (the default is wp-env's CLI, as in CI). SF_SHOTS_DIR saves screenshots.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, openBuilder, waitForForm } = require('./helpers');

const ROOT = path.resolve(__dirname, '..', '..');
const CLI = process.env.SF_WP_CLI || 'npx --yes @wordpress/env@10 run cli --env-cwd=wp-content/plugins/subtleforms wp';
const SHOTS = process.env.SF_SHOTS_DIR || '';
const SETTINGS = '/wp-admin/admin.php?page=subtleforms-settings#tab=extensions&ext=mailchimp';
// Built from parts so no key-shaped string sits in the repository.
const API_KEY = ['0123456789abcdef', '0123456789abcdef'].join('') + '-us21';

let client;
let form;

function wp(args) {
  return execSync(`${CLI} ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
}

// Run the queued Mailchimp jobs now instead of waiting for WP-Cron. WP-Cron
// itself may already have taken one; running again when nothing is queued is fine.
function runQueue() {
  try {
    wp('cron event run subtleforms_async_mailchimp');
  } catch (e) {
    // No event left to run.
  }
}

function mock(action) {
  const out = wp(`eval-file tests/browser/fixtures/mailchimp-mock.php ${action}`);
  const line = out.trim().split('\n').reverse().find((l) => l.trim().startsWith('{'));
  return line ? JSON.parse(line) : null;
}

async function shot(page, name, locator) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const target = locator || page;
  await target.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test.beforeAll(async () => {
  mock('install');
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Mailchimp browser test',
    fields: [
      { id: 'm1', key: 'fname', type: 'text', label: 'First name' },
      { id: 'm2', key: 'email', type: 'email', label: 'Email', required: true },
      { id: 'm3', key: 'company', type: 'text', label: 'Company' },
      { id: 'm4', key: 'news', type: 'checkbox', label: 'Send me news' },
    ],
  });
});

test.afterAll(async () => {
  if (form) await cleanup(client, form);
  mock('remove');
});

test.describe.configure({ mode: 'serial' });

// Tall enough for the whole form panel in screenshots.
if (SHOTS) test.use({ viewport: { width: 1280, height: 2000 } });

test('Settings: connect with an API key, see the account, test the connection', async ({ page }) => {
  await loginPage(page);
  await page.goto(SETTINGS);

  const card = page.locator('.sf-mc-card');
  await expect(card).toBeVisible({ timeout: 30000 });
  await expect(card.getByText('Not set up')).toBeVisible();
  await shot(page, 'free-connection-not-set-up', page.locator('.sf-settings__content'));

  await card.getByLabel('API key').fill(API_KEY);
  await card.getByRole('button', { name: 'Save and connect' }).click();
  await expect(card.getByText('Connected', { exact: true }).first()).toBeVisible();
  await expect(card.getByText('Connected to Acme Studio (owner@example.com).')).toHaveCount(1);

  // The key is masked: only its last four characters come back.
  await expect(card.locator('.sf-mc-card__masked-value')).toContainText('us21');
  await expect(card.locator('input')).toHaveCount(0);
  expect(await page.content()).not.toContain(API_KEY);

  await card.getByRole('button', { name: 'Test connection' }).click();
  await expect(card.locator('[role="status"]')).toContainText('Connected to Acme Studio');
  await shot(page, 'free-connection-connected', page.locator('.sf-settings__content'));

  // After a reload the key is still not in the page.
  await page.reload();
  await expect(page.locator('.sf-mc-card__masked-value')).toContainText('us21');
  expect(await page.content()).not.toContain(API_KEY);
});

test('Builder: turn Mailchimp on for the form, pick the audience, map fields and the consent box', async ({ page }) => {
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('#sf-builder-view-settings').click();
  await page.getByRole('button', { name: 'Integrations', exact: true }).click();

  const panel = page.locator('.sf-mc-form');
  await expect(panel).toBeVisible();
  await panel.getByLabel('Add people who submit this form to Mailchimp').check();

  await panel.getByLabel('Audience', { exact: true }).selectOption({ label: 'Newsletter (42)' });
  // The audience's own fields appear in the mapping table.
  await expect(panel.locator('.sf-mc-map__target', { hasText: 'Company' })).toBeVisible();
  await expect(panel.locator('.sf-mc-map__target', { hasText: 'Phone' })).toBeVisible();

  await panel.getByLabel('Form field for Company').selectOption('company');
  await panel.getByLabel('Form field for First name').selectOption('fname');
  await panel.getByLabel('Tags').fill('website, newsletter');
  await panel.getByLabel('Only subscribe if this box is ticked').selectOption('news');
  await shot(page, 'free-form-panel-mapping', panel);

  await page.locator('.sf-builder-header-bar__publish-button').click();
  await expect(page.locator('.sf-builder-header-bar__mode-badge')).toHaveText(/^Published$/, { timeout: 20000 });

  const saved = await client.call('GET', `/forms/${form.id}/schema`);
  const config = saved.body?.data?.schema?.metadata?.integrations?.mailchimp || saved.body?.data?.metadata?.integrations?.mailchimp;
  expect(config).toMatchObject({
    enabled: true,
    list_id: 'abc123',
    consent_field: 'news',
    tags: 'website, newsletter',
    merge_fields: [{ field: 'company', target: 'COMPANY' }],
  });
});

async function submit(page, { email, consent }) {
  await page.goto(form.url);
  await waitForForm(page);
  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Email', { exact: false }).first().fill(email);
  await page.getByLabel('Company').fill('Analytical Engines');
  if (consent) await page.getByLabel('Send me news').check();
  // The default minimum time between loading and sending a form is 3 seconds.
  await page.waitForTimeout(3500);
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-success, .subtleforms-form-container [role="status"], .subtleforms-confirmation').first()).toBeVisible({ timeout: 20000 });
}

test('Submitting: a consenting visitor is sent to Mailchimp and the entry says so; one who does not consent is skipped', async ({ page }) => {
  await submit(page, { email: 'ada@example.com', consent: true });
  await submit(page, { email: 'bob@example.com', consent: false });

  // The background job: run it now instead of waiting for WP-Cron.
  runQueue();

  await expect.poll(() => {
    runQueue();
    return mock('requests').requests.filter((r) => r.method === 'PUT').length;
  }, { timeout: 60000 }).toBe(1);
  const requests = mock('requests').requests.filter((r) => /\/members\//.test(r.url));
  const puts = requests.filter((r) => r.method === 'PUT');
  expect(puts).toHaveLength(1);
  expect(puts[0].url).toContain('/lists/abc123/members/');
  expect(puts[0].body).toMatchObject({
    email_address: 'ada@example.com',
    status_if_new: 'subscribed',
    merge_fields: { FNAME: 'Ada', COMPANY: 'Analytical Engines' },
  });
  const tagCall = requests.find((r) => /\/tags$/.test(r.url));
  expect(tagCall.body.tags.map((t) => t.name)).toEqual(['website', 'newsletter']);

  // The entry's activity shows the line.
  await loginPage(page);
  const list = await client.call('GET', `/forms/${form.id}/submissions?per_page=10`);
  const items = list.body?.data?.items || list.body?.data || [];
  expect(items.length).toBeGreaterThanOrEqual(2);
  const byEmail = (email) => items.find((e) => JSON.stringify(e.payload || {}).includes(email));

  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&submission_id=${byEmail('ada@example.com').id}`);
  const steps = page.locator('.sf-pipe-step', { hasText: 'Mailchimp' });
  await expect(steps.first()).toContainText('Mailchimp: subscribed', { timeout: 30000 });
  await shot(page, 'free-entry-activity-subscribed', page.locator('.sf-pipeline-timeline'));

  await expect(async () => {
    runQueue();
    await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&submission_id=${byEmail('bob@example.com').id}`);
    await expect(page.locator('.sf-pipe-step', { hasText: 'Mailchimp' }).first()).toContainText('Mailchimp: skipped (consent not given)', { timeout: 8000 });
  }).toPass({ timeout: 90000 });
  await shot(page, 'free-entry-activity-skipped', page.locator('.sf-pipeline-timeline'));
});
