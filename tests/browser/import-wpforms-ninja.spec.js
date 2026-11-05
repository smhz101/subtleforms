/**
 * Import from WPForms and Ninja Forms: both appear next to the other plugins
 * with their counts (their data is seeded where each plugin keeps it; neither
 * plugin is installed), the entry consent box is unticked by default, entries
 * are copied only when it is ticked, and the report names what was not copied.
 *
 * Seeding uses WP-CLI like import.spec.js (see SF_WP_CLI there).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { adminApi, loginPage } = require('./helpers');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = process.env.SF_SHOTS || path.join(ROOT, 'test-results', 'screens-import');
const CLI = process.env.SF_WP_CLI || 'npx --yes @wordpress/env@10 run cli --env-cwd=wp-content/plugins/subtleforms wp';
const SEED = 'tests/browser/fixtures/import-seed.php';
const MIGRATE = '/wp-admin/admin.php?page=subtleforms-settings#tab=tools';

let client;
let seeded;
const created = [];

function wp(args) {
  const out = execSync(`${CLI} ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
  const line = out.trim().split('\n').reverse().find((l) => l.trim().startsWith('{'));
  return line ? JSON.parse(line) : null;
}

async function openMigrate(page) {
  await page.goto(MIGRATE);
  const offer = page.getByRole('dialog', { name: 'Import your existing forms?' });
  const sections = page.getByRole('navigation', { name: 'Tools' });
  await expect(offer.or(sections)).toBeVisible({ timeout: 30000 });
  if (await offer.isVisible()) {
    // The fresh-site offer lists the two new plugins too.
    await expect(offer).toContainText('WPForms');
    await expect(offer).toContainText('Ninja Forms');
    await offer.getByRole('button', { name: 'Import forms' }).click();
    await expect(offer).toBeHidden();
  }
  await sections.getByRole('button', { name: 'Migrate' }).click();
  await expect(page.getByRole('heading', { name: 'From this site' })).toBeVisible({ timeout: 30000 });
}

const row = (page, title) => page.locator('.sf-import__list li').filter({ hasText: title }).first();
const formId = (href) => Number(/form_id=(\d+)/.exec(href || '')?.[1] || 0);

async function entriesOf(id) {
  const res = await client.call('GET', `/submissions?form_id=${id}&per_page=100`);
  const data = res.body?.data;
  return Array.isArray(data) ? data : (data?.items || data?.rows || []);
}

test.beforeAll(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  seeded = wp(`eval-file ${SEED} seed`);
  client = await adminApi();
});

test.afterAll(async () => {
  for (const id of created) {
    await client.call('DELETE', `/forms/${id}?force=true`);
  }
  wp(`eval-file ${SEED} clean`);
});

test('WPForms and Ninja Forms are listed with counts and the consent box starts unticked', async ({ page }) => {
  expect(seeded.wpforms.length).toBe(1);
  expect(seeded.ninja.length).toBe(1);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await loginPage(page);
  await openMigrate(page);

  const sources = page.locator('.sf-import__sources');
  await expect(sources.getByRole('radio', { name: /WPForms/ })).toBeEnabled();
  await expect(sources.locator('label').filter({ hasText: 'WPForms' })).toContainText('1 form');
  await expect(sources.locator('label').filter({ hasText: 'Ninja Forms' })).toContainText('1 form');
  await page.locator('.sf-import').screenshot({ path: path.join(SHOTS, 'source-list.png') });

  await sources.getByRole('radio', { name: /WPForms/ }).check();
  const wpRow = row(page, 'Contact request');
  await expect(wpRow).toContainText('4 entries');
  await expect(page.locator('.sf-import__consent')).toHaveCount(0);

  await wpRow.getByRole('checkbox').check();
  const consent = page.locator('.sf-import__consent');
  await expect(consent).toContainText('Also import 4 entries. Entries contain personal data your visitors sent. They are copied into SubtleForms; the originals are not changed or deleted.');
  await expect(consent.getByRole('checkbox')).not.toBeChecked();
  await page.locator('.sf-import').screenshot({ path: path.join(SHOTS, 'consent-checkbox.png') });

  // Without the box ticked only the form comes across, and the report lists what did not.
  await page.getByRole('button', { name: 'Import 1 form' }).click();
  const card = page.locator('.sf-import__result').filter({ hasText: 'Contact request' }).first();
  await expect(card).toBeVisible({ timeout: 60000 });
  await expect(card).not.toContainText('entries copied');
  created.push(formId(await card.getByRole('link', { name: /Open in the builder/ }).getAttribute('href')));
  await card.locator('summary').click();
  await expect(card.locator('.sf-import__report')).toContainText("WPForms field 'Prove you are human' (type captcha) was skipped");
  await expect(card.locator('.sf-import__report')).toContainText("The conditional logic of 'Order number' has several groups joined by OR");
  await page.locator('.sf-import__results').screenshot({ path: path.join(SHOTS, 'import-report.png') });
  expect((await entriesOf(created[0])).length).toBe(0);
});

test('ticking the box copies the entries with progress, and the screen works on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await loginPage(page);
  await openMigrate(page);
  await page.locator('.sf-import__sources').getByRole('radio', { name: /Ninja Forms/ }).check();
  const ninjaRow = row(page, 'Ninja contact');
  await expect(ninjaRow).toContainText('3 entries');
  await ninjaRow.getByRole('checkbox').check();
  await page.locator('.sf-import__consent').getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Import 1 form' }).click();

  const card = page.locator('.sf-import__result').filter({ hasText: 'Ninja contact' }).first();
  await expect(card).toBeVisible({ timeout: 60000 });
  await expect(card.locator('.sf-import__entries')).toContainText('3 entries copied');
  await expect(card.locator('.sf-import__entries')).toContainText('3 uploaded files were not copied');
  const id = formId(await card.getByRole('link', { name: /Open in the builder/ }).getAttribute('href'));
  created.push(id);
  const entries = await entriesOf(id);
  expect(entries.length).toBe(3);
  await page.locator('.sf-import__results').screenshot({ path: path.join(SHOTS, 'entries-copied.png') });

  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(400);
});
