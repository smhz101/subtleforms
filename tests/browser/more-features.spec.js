/**
 * WordPress.org guideline 11: the one place this plugin mentions the separate
 * SubtleForms Pro plugin is a More features card at the bottom of the
 * Dashboard. It is informational, has one link, can be dismissed and stays
 * dismissed for that user. No other screen shows it, and no screen has an
 * upgrade button, a plan chip or a License tab.
 */
const path = require('path');
const { execSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { loginPage } = require('./helpers');

const ROOT = path.resolve(__dirname, '..', '..');
const SHOTS = path.join(ROOT, 'test-results', 'screens-2.7.2');
const CLI = process.env.SF_WP_CLI || 'npx --yes @wordpress/env@10 run cli --env-cwd=wp-content/plugins/subtleforms wp';
const USER = process.env.SF_ADMIN_USER || 'admin';
const META = 'subtleforms_more_features_dismissed';

function resetCard() {
  try {
    execSync(`${CLI} user meta delete ${USER} ${META}`, { cwd: ROOT, stdio: 'ignore', timeout: 180000 });
  } catch (e) {
    // Nothing stored yet.
  }
}

test.beforeAll(resetCard);
test.afterAll(resetCard);

test('the Dashboard shows the More features card once, at the bottom, with one link', async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await loginPage(page);
    await page.goto('/wp-admin/admin.php?page=subtleforms');
    const card = page.locator('.sf-more-features');
    await expect(card).toBeVisible({ timeout: 30000 });
    await expect(card).toContainText('SubtleForms Pro is a separate plugin');
    await expect(card.locator('a')).toHaveCount(1);
    await expect(card.locator('a')).toHaveAttribute('href', 'https://subtleforms.com/pro/');
    await expect(card).not.toContainText(/licen[cs]e|upgrade|unlock/i);
    // It is the last thing on the Dashboard.
    const last = await page.locator('.sf-dash > *').last().getAttribute('class');
    expect(last).toContain('sf-more-features');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, `more-features-${width}.png`), fullPage: true });
  }
});

test('no other screen has the card, an upgrade link or a plan chip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginPage(page);
  for (const screen of ['subtleforms-forms', 'subtleforms-submissions', 'subtleforms-reports', 'subtleforms-settings', 'subtleforms-new-form']) {
    await page.goto(`/wp-admin/admin.php?page=${screen}`);
    await expect(page.locator('#sf-main')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.sf-more-features')).toHaveCount(0);
    await expect(page.locator('.sf-plan-chip')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Upgrade|Go Pro|Activate Pro/i })).toHaveCount(0);
  }
  // No notice about another plugin on the WordPress Dashboard either.
  await page.goto('/wp-admin/index.php');
  await expect(page.locator('.notice', { hasText: /SubtleForms Pro|upgrade/i })).toHaveCount(0);
});

test('dismissing the card is remembered for the user', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms');
  const card = page.locator('.sf-more-features');
  await expect(card).toBeVisible({ timeout: 30000 });
  const stored = page.waitForResponse((r) => r.url().includes('more-features/dismiss') && r.request().method() === 'POST');
  await card.getByRole('button', { name: 'Dismiss' }).click();
  expect((await stored).status()).toBe(200);
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.sf-kpis')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.sf-more-features')).toHaveCount(0);
});
