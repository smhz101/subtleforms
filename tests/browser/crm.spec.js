/**
 * CRM (HubSpot) in the free plugin, end to end on a real site with a pretend
 * HubSpot (tests/browser/fixtures/crm-mock.php): the one-tile grid, the
 * screen kept in the address, connecting with a token, the dismissible note
 * about Pro, no Save button in the section, the per-form panel, and a
 * submission that is sent and logged.
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
const SETTINGS = '/wp-admin/admin.php?page=subtleforms-settings#tab=extensions&ext=crm';
// Built from parts so no token-shaped string sits in the repository.
const TOKEN = ['pat', 'na1', '0123456789abcdef0123456789abcdef'].join('-');

let client;
let form;

function wp(args) {
  return execSync(`${CLI} ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
}

function runQueue() {
  try {
    wp('cron event run subtleforms_async_crm');
  } catch (e) {
    // No event left to run.
  }
}

function mock(action) {
  const out = wp(`eval-file tests/browser/fixtures/crm-mock.php ${action}`);
  const line = out.trim().split('\n').reverse().find((l) => l.trim().startsWith('{'));
  return line ? JSON.parse(line) : null;
}

async function shot(page, name, locator) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await (locator || page).screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

const content = (page) => page.locator('.sf-section-panel__content');

test.beforeAll(async () => {
  mock('install');
  client = await adminApi();
  form = await publishForm(client, {
    title: 'CRM browser test',
    fields: [
      { id: 'c1', key: 'fname', type: 'text', label: 'First name' },
      { id: 'c2', key: 'email', type: 'email', label: 'Email', required: true },
      { id: 'c3', key: 'job', type: 'text', label: 'Job' },
      { id: 'c4', key: 'agree', type: 'checkbox', label: 'You may contact me' },
    ],
  });
});

test.afterAll(async () => {
  if (form) await cleanup(client, form);
  mock('remove');
});

test.describe.configure({ mode: 'serial' });

if (SHOTS) test.use({ viewport: { width: Number(process.env.SF_SHOT_WIDTH || 1280), height: 1800 }, deviceScaleFactor: Number(process.env.SF_SHOT_SCALE || 1) });

test('Grid: a CRM entry after Email marketing, one HubSpot tile, off, no Save button, one note about Pro', async ({ page }) => {
  await loginPage(page);
  await page.goto(SETTINGS);

  const nav = page.locator('.sf-section-panel__sidebar');
  await expect(nav.getByText('CRM', { exact: true })).toBeVisible({ timeout: 30000 });
  const text = (await nav.innerText()).split('\n').map((l) => l.trim()).filter(Boolean);
  expect(text.indexOf('Webhooks')).toBeLessThan(text.indexOf('Email marketing'));
  expect(text.indexOf('Email marketing')).toBeLessThan(text.indexOf('CRM'));

  await expect(page.locator('.sf-svc-tile')).toHaveCount(1);
  await expect(page.getByLabel('Enable HubSpot')).not.toBeChecked();
  await expect(page.getByText('Send contacts to HubSpot from the forms you choose.')).toBeVisible();
  await expect(content(page).getByRole('button', { name: /save/i })).toHaveCount(0);
  await expect(page.getByText(/Choose this CRM for each form/)).toHaveCount(0);
  await expect(page.getByText(/Zapier|Make|n8n/)).toHaveCount(0);

  const note = page.locator('.sf-em-pro');
  await expect(note).toHaveCount(1);
  await shot(page, 'crm-free-grid', content(page));
});

test('Turning HubSpot on opens it; connect with a token, see the portal, test the connection', async ({ page }) => {
  await loginPage(page);
  await page.goto(SETTINGS);
  await page.getByLabel('Enable HubSpot').check();

  await expect(page).toHaveURL(/service=hubspot/);
  const detail = page.locator('.sf-em-detail[data-service="hubspot"]');
  await expect(detail.getByRole('heading', { name: 'HubSpot', exact: true })).toBeVisible();
  const card = detail.locator('.sf-em-card');
  await expect(card.getByText('Not set up')).toBeVisible();
  await shot(page, 'crm-free-detail-not-connected', content(page));

  await card.getByLabel('HubSpot service key').fill(TOKEN);
  await card.getByRole('button', { name: 'Save and connect' }).click();
  await expect(card.getByText(/Connected to Acme Portal/)).toHaveCount(1);
  await expect(card.getByText(/123456/)).toHaveCount(1);

  await expect(card.locator('.sf-em-card__masked-value')).toContainText('cdef');
  await expect(card.locator('input')).toHaveCount(0);
  expect(await page.content()).not.toContain(TOKEN);

  await card.getByRole('button', { name: 'Test connection' }).click();
  await expect(card.locator('[role="status"]')).toContainText('Acme Portal');
  await expect(card.locator('[role="status"]')).toContainText('123456');
  await expect(detail.getByRole('button', { name: /save changes/i })).toHaveCount(0);
  await shot(page, 'crm-free-detail-connected', content(page));

  await page.reload();
  await expect(page.locator('.sf-em-card__masked-value')).toContainText('cdef');
  expect(await page.content()).not.toContain(TOKEN);
});

test('The note shows at the bottom of HubSpot, one dismissal hides it, Back returns to the grid', async ({ page }) => {
  await loginPage(page);
  await page.goto(`${SETTINGS}&service=hubspot`);
  const note = page.locator('.sf-em-pro');
  await expect(note).toHaveCount(1);
  await expect(page.locator('.sf-em-detail > :last-child')).toHaveClass(/sf-em-pro/);

  await page.getByRole('button', { name: 'Back to CRM' }).click();
  await expect(page).not.toHaveURL(/service=/);
  await expect(page.locator('.sf-svc-tile')).toHaveCount(1);
  await expect(page.getByLabel('Enable HubSpot')).toBeChecked();

  await page.goBack();
  await expect(page).toHaveURL(/service=hubspot/);
  await page.goForward();

  const stored = page.waitForResponse((r) => /banner\/dismiss/.test(r.url()) && r.request().method() === 'POST');
  await page.locator('.sf-em-pro').getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.locator('.sf-em-pro')).toHaveCount(0);
  expect((await stored).status()).toBe(200);
  await page.reload();
  await expect(page.locator('.sf-em-pro')).toHaveCount(0);
});

test('Builder: map email, first name, a custom property and the consent box', async ({ page }) => {
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('#sf-builder-view-settings').click();
  await page.getByRole('button', { name: 'Integrations', exact: true }).click();

  const panel = page.locator('.sf-crm-form');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'CRM', level: 4 })).toHaveCount(1);
  const hs = panel.locator('.sf-em-form__service[data-service="hubspot"]');
  await hs.getByLabel('Send people who submit this form to HubSpot').check();
  await expect(hs.locator('.sf-em-map__target', { hasText: 'Job title' })).toBeVisible();

  await hs.getByLabel('Form field for First name').selectOption('fname');
  await hs.getByLabel('Form field for Job title').selectOption('job');
  await hs.getByLabel('Only send if this box is ticked').selectOption('agree');
  await shot(page, 'crm-free-form-panel', panel);

  await page.locator('.sf-builder-header-bar__publish-button').click();
  await expect(page.locator('.sf-builder-header-bar__mode-badge')).toHaveText(/^Published$/, { timeout: 20000 });

  const saved = await client.call('GET', `/forms/${form.id}/schema`);
  const integrations = saved.body?.data?.schema?.metadata?.integrations || saved.body?.data?.metadata?.integrations;
  expect(integrations.hubspot).toMatchObject({
    enabled: true,
    consent_field: 'agree',
    properties: [{ field: 'job', property: 'jobtitle' }],
  });
  expect(integrations.hubspot.fields.first_name).toBe('fname');
});

async function submit(page, { email, consent }) {
  await page.goto(form.url);
  await waitForForm(page);
  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Email', { exact: false }).first().fill(email);
  await page.getByLabel('Job').fill('Engineer');
  if (consent) await page.getByLabel('You may contact me').check();
  await page.waitForTimeout(3500);
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-success, .subtleforms-form-container [role="status"], .subtleforms-confirmation').first()).toBeVisible({ timeout: 20000 });
}

test('Submitting: a consenting visitor becomes a HubSpot contact and the entry says so; one who does not consent is skipped', async ({ page }) => {
  await submit(page, { email: 'ada@example.com', consent: true });
  await submit(page, { email: 'bob@example.com', consent: false });

  await expect.poll(() => {
    runQueue();
    return mock('requests').requests.filter((r) => /batch\/upsert$/.test(r.url)).length;
  }, { timeout: 60000 }).toBe(1);
  const upserts = mock('requests').requests.filter((r) => /batch\/upsert$/.test(r.url));
  expect(upserts).toHaveLength(1);
  expect(upserts[0].body.inputs[0]).toMatchObject({
    idProperty: 'email',
    id: 'ada@example.com',
    properties: { email: 'ada@example.com', firstname: 'Ada', jobtitle: 'Engineer' },
  });

  await loginPage(page);
  const list = await client.call('GET', `/forms/${form.id}/submissions?per_page=10`);
  const items = list.body?.data?.items || list.body?.data || [];
  const byEmail = (email) => items.find((e) => JSON.stringify(e.payload || {}).includes(email));

  await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&submission_id=${byEmail('ada@example.com').id}`);
  await expect(page.locator('.sf-pipe-step', { hasText: 'HubSpot' }).first()).toContainText('HubSpot: contact created', { timeout: 30000 });
  await shot(page, 'crm-free-entry-activity-created', page.locator('.sf-pipeline-timeline'));

  await expect(async () => {
    runQueue();
    await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&submission_id=${byEmail('bob@example.com').id}`);
    await expect(page.locator('.sf-pipe-step', { hasText: 'HubSpot' }).first()).toContainText('HubSpot: skipped (consent not given)', { timeout: 8000 });
  }).toPass({ timeout: 90000 });
});
