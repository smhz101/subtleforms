/**
 * One-click import (2.6.0): a Contact Form 7 form and a Gravity Forms form are
 * put on the site where those plugins keep them (the plugins are not
 * installed), then imported from Settings > Tools > Migrate, opened in the
 * builder and shown on the front end.
 *
 * The data is seeded with WP-CLI, because the source plugins are not on the
 * site and their tables cannot be filled over REST. SF_WP_CLI is the command
 * that runs WP-CLI with the plugin folder as working directory. When it is
 * not set, the spec uses wp-env exactly as the "PHPUnit inside WordPress"
 * step of .github/workflows/tests.yml does
 * (`npx --yes @wordpress/env@10 run cli --env-cwd=wp-content/plugins/subtleforms wp ...`).
 * Locally, for example:
 *   SF_WP_CLI="php /path/wp-cli.phar --allow-root --path=/path/to/site"
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { adminApi, loginPage, waitForForm } = require('./helpers');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(ROOT, 'test-results', 'screens-2.6.0');
const CLI = process.env.SF_WP_CLI || 'npx --yes @wordpress/env@10 run cli --env-cwd=wp-content/plugins/subtleforms wp';
const SEED = 'tests/browser/fixtures/import-seed.php';
const MIGRATE = '/wp-admin/admin.php?page=subtleforms-settings#tab=tools';

let client;
let seeded;
const created = [];
const pages = [];

function wp(args) {
  const out = execSync(`${CLI} ${args}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
  const line = out.trim().split('\n').reverse().find((l) => l.trim().startsWith('{'));
  return line ? JSON.parse(line) : null;
}

async function openMigrate(page) {
  await page.goto(MIGRATE);
  const sections = page.getByRole('navigation', { name: 'Tools' });
  await expect(sections).toBeVisible({ timeout: 30000 });
  await sections.getByRole('button', { name: 'Migrate' }).click();
  await expect(page.getByRole('heading', { name: 'From this site' })).toBeVisible({ timeout: 30000 });
}

function formRow(page, title) {
  return page.locator('.sf-import__list li').filter({ hasText: title }).first();
}

async function importOne(page, title) {
  await formRow(page, title).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Import 1 form' }).click();
  const card = page.locator('.sf-import__result').filter({ hasText: title }).first();
  await expect(card).toBeVisible({ timeout: 60000 });
  return card;
}

function formIdFrom(href) {
  const match = /form_id=(\d+)/.exec(href || '');
  return match ? Number(match[1]) : 0;
}

test.beforeAll(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  seeded = wp(`eval-file ${SEED} seed`);
  client = await adminApi();
});

test.afterAll(async () => {
  for (const id of pages) {
    await client.call('DELETE', `/wp/v2/pages/${id}?force=true`);
  }
  for (const id of created) {
    await client.call('DELETE', `/forms/${id}?force=true`);
  }
  wp(`eval-file ${SEED} clean`);
});

test('finds the forms, imports them as drafts and reports what was not copied', async ({ page }) => {
  expect(seeded.cf7.length).toBe(2);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginPage(page);
  await openMigrate(page);

  const sources = page.locator('.sf-import__sources');
  await expect(sources.getByRole('radio', { name: /Contact Form 7/ })).toBeChecked();
  await expect(sources).toContainText('2 forms');
  await expect(sources).toContainText('plugin not active');
  await expect(page.locator('.sf-import__promise')).toContainText('Entries and payment settings are not imported');
  await expect(formRow(page, 'Contact form 1')).toContainText('4 fields');
  await page.locator('.sf-import').screenshot({ path: path.join(SHOTS, 'import-sources.png') });

  // Contact Form 7.
  const cf7 = await importOne(page, 'Contact form 1');
  // Reply-To [your-email] now comes across, so nothing needs attention.
  await expect(cf7).toContainText('Imported with 4 fields.');
  await cf7.locator('summary').click();
  await expect(cf7.locator('.sf-import__report')).toContainText('1 email notification was copied.');
  await expect(cf7.locator('.sf-import__report')).not.toContainText('Reply-To');
  created.push(formIdFrom(await cf7.getByRole('link', { name: /Open in the builder/ }).getAttribute('href')));

  // Gravity Forms.
  await sources.getByRole('radio', { name: /Gravity Forms/ }).check();
  await expect(formRow(page, 'Job application')).toContainText('fields');
  const gf = await importOne(page, 'Job application');
  await expect(gf).toContainText(/Imported with \d+ fields, \d+ notes\./);
  await gf.locator('summary').click();
  await expect(gf.locator('.sf-import__report')).toContainText("Gravity Forms field 'Application fee' (type product) was skipped: payments are not imported.");
  created.push(formIdFrom(await gf.getByRole('link', { name: /Open in the builder/ }).getAttribute('href')));
  await page.locator('.sf-import__results').screenshot({ path: path.join(SHOTS, 'import-results.png') });

  // The same form again asks first.
  await sources.getByRole('radio', { name: /Contact Form 7/ }).check();
  await expect(formRow(page, 'Contact form 1')).toContainText('Imported before');
  const again = await importOne(page, 'Contact form 1');
  await expect(page.locator('.sf-import__result.is-exists')).toContainText('Import again as a copy?');
  await page.locator('.sf-import__result.is-exists').screenshot({ path: path.join(SHOTS, 'import-reimport.png') });
  await again.getByRole('button', { name: 'Keep the one I have' }).click();
  await expect(page.locator('.sf-import__result.is-exists')).toHaveCount(0);

  // Nothing was created by asking.
  const list = await client.call('GET', '/forms?per_page=100&search=Contact%20form%201');
  const titles = (list.body?.data || []).map((f) => f.title);
  expect(titles.filter((t) => t === 'Contact form 1').length).toBe(1);
  expect((list.body?.data || []).find((f) => f.title === 'Contact form 1').status).toBe('draft');
});

test('the screen works from the keyboard and passes axe', async ({ page }) => {
  await loginPage(page);
  await openMigrate(page);
  const first = page.locator('.sf-import__all input');
  await first.focus();
  await page.keyboard.press('Space');
  await expect(first).toBeChecked();
  await expect(page.getByRole('button', { name: /^Import 2 forms$/ })).toBeEnabled();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();

  const results = await new AxeBuilder({ page })
    .include('.sf-import')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(300);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(400);
  await page.locator('.sf-import__sources').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('.sf-import__sources').scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: path.join(SHOTS, 'import-phone.png') });
});

test('an imported form opens in the builder and renders on the front end', async ({ page }) => {
  test.skip(created.length < 2, 'Needs the forms imported by the first test.');
  const [cf7Id, gfId] = created;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginPage(page);

  // The Gravity Forms application keeps its two pages as steps.
  await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${gfId}`);
  await page.waitForSelector('.sf-field-chrome, .sf-form-editor__canvas', { timeout: 30000 });
  for (const label of ['Skip tour', 'Skip']) {
    const skip = page.getByRole('button', { name: label, exact: true });
    if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {});
  }
  await expect(page.locator('.sf-builder-header-bar__mode-badge')).toHaveText(/^Draft$/);
  await expect(page.getByText('About you').first()).toBeVisible();
  await expect(page.getByText('Your application').first()).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, 'import-builder.png') });

  // The imported Mail replies to the sender: Reply-To holds the field tag.
  await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${cf7Id}`);
  await page.waitForSelector('.sf-field-chrome, .sf-form-editor__canvas', { timeout: 30000 });
  for (const label of ['Skip tour', 'Skip']) {
    const skip = page.getByRole('button', { name: label, exact: true });
    if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => {});
  }
  await page.locator('#sf-builder-view-settings').click();
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  const mail = page.locator('.sf-actions-panel__item--email').first();
  await expect(mail.getByRole('textbox', { name: 'Reply-To', exact: true })).toHaveValue('{field:your-email}');
  await mail.screenshot({ path: path.join(SHOTS, 'import-reply-to.png') });

  // Publish the Contact Form 7 copy and show it on a page.
  const pub = await client.call('PUT', `/forms/${cf7Id}`, { status: 'published' });
  expect(pub.status).toBeLessThan(300);
  const pageRes = await client.call('POST', '/wp/v2/pages', {
    title: 'Imported contact form',
    status: 'publish',
    content: `<!-- wp:shortcode -->[subtleforms id="${cf7Id}"]<!-- /wp:shortcode -->`,
  });
  pages.push(pageRes.body.id);
  await page.goto(`/?page_id=${pageRes.body.id}`);
  await waitForForm(page);
  const form = page.locator('.subtleforms-form-container form').first();
  for (const label of ['Your name', 'Your email', 'Subject', 'Your message']) {
    await expect(form.getByLabel(label, { exact: false }).first()).toBeVisible();
  }
  await expect(form.getByRole('button', { name: 'Submit' })).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, 'import-frontend.png'), fullPage: true });
});
