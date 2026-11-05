/**
 * Email marketing in the free plugin, end to end on a real site with pretend
 * services (tests/browser/fixtures/email-marketing-mock.php): the grid of
 * Mailchimp, Brevo and Kit, a detail screen kept in the address, connecting
 * with an API key, the dismissible note about Pro, the per-form panel, and a
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
const SETTINGS = '/wp-admin/admin.php?page=subtleforms-settings#tab=extensions&ext=email_marketing';
// Built from parts so no key-shaped string sits in the repository.
const KEYS = {
  mailchimp: ['0123456789abcdef', '0123456789abcdef'].join('') + '-us21',
  brevo: 'xkeysib-' + ['0123456789abcdef', '0123456789abcdef'].join(''),
  kit: 'kit_' + ['0123456789abcdef', '0123456789abcdef'].join(''),
};

let client;
let form;

function wp(args) {
  return execSync(`${CLI} ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
}

// Run the queued jobs now instead of waiting for WP-Cron. WP-Cron itself may
// already have taken one; running again when nothing is queued is fine.
function runQueue() {
  try {
    wp('cron event run subtleforms_async_email_marketing');
  } catch (e) {
    // No event left to run.
  }
}

function mock(action) {
  const out = wp(`eval-file tests/browser/fixtures/email-marketing-mock.php ${action}`);
  const line = out.trim().split('\n').reverse().find((l) => l.trim().startsWith('{'));
  return line ? JSON.parse(line) : null;
}

async function shot(page, name, locator) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  const target = locator || page;
  await target.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

const content = (page) => page.locator('.sf-ext-settings__content');
const tile = (page, slug) => page.locator(`.sf-em-tile[data-service="${slug}"]`);

test.beforeAll(async () => {
  mock('install');
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Newsletter browser test',
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
if (SHOTS) test.use({ viewport: { width: Number(process.env.SF_SHOT_WIDTH || 1280), height: 2000 } });

test('Grid: one Email marketing entry, three tiles, all off, and one plain note about Pro', async ({ page }) => {
  await loginPage(page);
  await page.goto(SETTINGS);

  const nav = page.locator('.sf-ext-settings__sidebar');
  await expect(nav.getByText('Email marketing', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(nav.getByText('Webhooks', { exact: true })).toBeVisible();
  await expect(nav.getByText('Mailchimp', { exact: true })).toHaveCount(0);

  await expect(page.locator('.sf-em-tile')).toHaveCount(3);
  for (const label of ['Mailchimp', 'Brevo', 'Kit']) {
    await expect(page.getByLabel(`Enable ${label}`)).not.toBeChecked();
  }
  // Names are text for screen readers only; the logos are the tiles.
  await expect(tile(page, 'mailchimp').locator('.sf-sr-only')).toHaveText('Mailchimp');

  const note = page.locator('.sf-em-pro');
  await expect(note).toHaveCount(1);
  await expect(note.getByRole('heading', { name: 'Do more with SubtleForms Pro' })).toBeVisible();
  const link = note.getByRole('link', { name: /Learn about SubtleForms Pro/ });
  await expect(link).toHaveAttribute('href', 'https://subtleforms.com/pro/');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await shot(page, 'free-grid-all-off', content(page));
});

test('Turning Mailchimp on opens it; connect with a key, see the account, test the connection', async ({ page }) => {
  await loginPage(page);
  await page.goto(SETTINGS);
  await page.getByLabel('Enable Mailchimp').check();

  await expect(page).toHaveURL(/service=mailchimp/);
  const detail = page.locator('.sf-em-detail[data-service="mailchimp"]');
  await expect(detail.getByRole('heading', { name: 'Mailchimp' })).toBeVisible();
  const card = detail.locator('.sf-em-card');
  await expect(card.getByText('Not set up')).toBeVisible();
  await shot(page, 'free-detail-not-connected', content(page));

  await card.getByLabel('API key').fill(KEYS.mailchimp);
  await card.getByRole('button', { name: 'Save and connect' }).click();
  await expect(card.getByText('Connected to Acme Studio (owner@example.com).')).toHaveCount(1);

  // The key is masked: only its last four characters come back.
  await expect(card.locator('.sf-em-card__masked-value')).toContainText('us21');
  await expect(card.locator('input')).toHaveCount(0);
  expect(await page.content()).not.toContain(KEYS.mailchimp);

  await card.getByRole('button', { name: 'Test connection' }).click();
  await expect(card.locator('[role="status"]')).toContainText('Connected to Acme Studio');
  await shot(page, 'free-detail-connected', content(page));

  // After a reload the key is still not in the page, and the screen is the same.
  await page.reload();
  await expect(page.locator('.sf-em-card__masked-value')).toContainText('us21');
  expect(await page.content()).not.toContain(KEYS.mailchimp);
});

test('The note shows at the bottom of a service, one dismissal hides it everywhere, back returns to the grid', async ({ page }) => {
  await loginPage(page);
  await page.goto(`${SETTINGS}&service=mailchimp`);
  const note = page.locator('.sf-em-pro');
  await expect(note).toHaveCount(1);
  // It is the last thing in the screen.
  await expect(page.locator('.sf-em-detail > :last-child')).toHaveClass(/sf-em-pro/);
  await shot(page, 'free-detail-with-note', content(page));

  await page.getByRole('button', { name: 'Back to email marketing' }).click();
  await expect(page).not.toHaveURL(/service=/);
  await expect(page.locator('.sf-em-tile')).toHaveCount(3);
  await expect(tile(page, 'mailchimp').locator('input[type="checkbox"]')).toBeChecked();
  await shot(page, 'free-grid-mailchimp-on', content(page));

  // The browser Back button returns to the screen it left.
  await page.goBack();
  await expect(page).toHaveURL(/service=mailchimp/);
  await page.goForward();
  await expect(page.locator('.sf-em-tile')).toHaveCount(3);

  await page.locator('.sf-em-pro').getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.locator('.sf-em-pro')).toHaveCount(0);
  await tile(page, 'mailchimp').locator('.sf-em-tile__open').click();
  await expect(page.locator('.sf-em-detail')).toBeVisible();
  await expect(page.locator('.sf-em-pro')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.sf-em-detail')).toBeVisible();
  await expect(page.locator('.sf-em-pro')).toHaveCount(0);
});

test('Switching a service off keeps its key; switching it on restores it', async ({ page }) => {
  await loginPage(page);
  await page.goto(`${SETTINGS}&service=mailchimp`);
  await page.locator('.sf-em-detail__head').getByRole('checkbox').click();
  await expect(page).not.toHaveURL(/service=/);
  await expect(page.getByLabel('Enable Mailchimp')).not.toBeChecked();

  await page.getByLabel('Enable Mailchimp').click();
  await expect(page.locator('.sf-em-card__masked-value')).toContainText('us21');
  // Leave it on for the form test; grid-only off keeps it too.
  await page.getByRole('button', { name: 'Back to email marketing' }).click();
  await page.getByLabel('Enable Mailchimp').click();
  await expect(page.getByLabel('Enable Mailchimp')).not.toBeChecked();
  await page.getByLabel('Enable Mailchimp').click();
  await expect(page.locator('.sf-em-card__masked-value')).toContainText('us21');
});

test('Brevo and Kit connect the same way', async ({ page }) => {
  await loginPage(page);
  for (const [slug, label] of [['brevo', 'Brevo'], ['kit', 'Kit']]) {
    await page.goto(`${SETTINGS}&service=${slug}`);
    const card = page.locator(`.sf-em-detail[data-service="${slug}"] .sf-em-card`);
    await card.getByLabel('API key').fill(KEYS[slug]);
    await card.getByRole('button', { name: 'Save and connect' }).click();
    await expect(card.getByText('Connected to Acme Studio (owner@example.com).')).toHaveCount(1);
    expect(await page.content()).not.toContain(KEYS[slug]);
    // Switch it on from its header; the screen stays.
    await page.locator('.sf-em-detail__head').getByRole('checkbox').click();
    await expect(page.locator('.sf-em-detail__head').getByRole('checkbox')).toBeChecked();
  }
  // Leave Kit on; switching Brevo off from its header returns to the grid.
  await page.goto(`${SETTINGS}&service=brevo`);
  await page.locator('.sf-em-detail__head').getByRole('checkbox').click();
  await expect(page.locator('.sf-em-tile')).toHaveCount(3);
  await expect(page.getByLabel('Enable Brevo')).not.toBeChecked();
  await expect(page.getByLabel('Enable Kit')).toBeChecked();
});

test('Builder: one Email marketing section lists the enabled services; map Mailchimp and the consent box', async ({ page }) => {
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('#sf-builder-view-settings').click();
  await page.getByRole('button', { name: 'Integrations', exact: true }).click();

  const panel = page.locator('.sf-em-form');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Email marketing', level: 4 })).toHaveCount(1);
  await expect(panel.locator('.sf-em-form__service[data-service="mailchimp"]')).toBeVisible();
  await expect(panel.locator('.sf-em-form__service[data-service="kit"]')).toBeVisible();
  await expect(panel.locator('.sf-em-form__service[data-service="brevo"]')).toHaveCount(0);

  const mc = panel.locator('.sf-em-form__service[data-service="mailchimp"]');
  await mc.getByLabel('Add people who submit this form to Mailchimp').check();
  await mc.getByLabel('Audience', { exact: true }).selectOption({ label: 'Newsletter (42)' });
  await expect(mc.locator('.sf-em-map__target', { hasText: 'Company' })).toBeVisible();
  await expect(mc.locator('.sf-em-map__target', { hasText: 'Phone' })).toBeVisible();

  await mc.getByLabel('Form field for Company').selectOption('company');
  await mc.getByLabel('Form field for First name').selectOption('fname');
  await mc.getByLabel('Tags').fill('website, newsletter');
  await mc.getByLabel('Only subscribe if this box is ticked').selectOption('news');
  await shot(page, 'free-form-panel', panel);

  await page.locator('.sf-builder-header-bar__publish-button').click();
  await expect(page.locator('.sf-builder-header-bar__mode-badge')).toHaveText(/^Published$/, { timeout: 20000 });

  const saved = await client.call('GET', `/forms/${form.id}/schema`);
  const integrations = saved.body?.data?.schema?.metadata?.integrations || saved.body?.data?.metadata?.integrations;
  expect(integrations.mailchimp).toMatchObject({
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
  // Kit was switched on for the site but not for this form, and Brevo is off.
  expect(mock('requests').requests.filter((r) => /api\.(brevo|kit)\.com\/v[34]\/(contacts|subscribers)$/.test(r.url) && r.method === 'POST')).toHaveLength(0);

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
