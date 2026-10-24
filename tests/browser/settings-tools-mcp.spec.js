/**
 * Settings has a Tools tab (the old Tools page moved in). It has no License
 * tab and no MCP tab of its own: an MCP tab is listed only when an add-on
 * registers it, and nothing in Settings links to an upgrade.
 */
const { test, expect } = require('@playwright/test');
const { loginPage } = require('./helpers');

const SETTINGS = '/wp-admin/admin.php?page=subtleforms-settings';
const nav = (page) => page.getByRole('navigation', { name: 'Settings sections' });

test('Settings lists Tools, no License or MCP tab, and Tools keeps its sections', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage(page);
  await page.goto(SETTINGS);
  await expect(nav(page)).toBeVisible({ timeout: 30000 });
  await expect(nav(page).getByRole('button', { name: /^Tools/ })).toBeVisible();
  await expect(nav(page).getByRole('button', { name: /^MCP/ })).toHaveCount(0);
  await expect(nav(page).getByRole('button', { name: /^Licen/ })).toHaveCount(0);
  await expect(nav(page)).not.toContainText(/\bPro\b/);

  await nav(page).getByRole('button', { name: /^Tools/ }).click();
  await expect(page.locator('.sf-settings__title')).toHaveText('Tools');
  const sections = page.getByRole('navigation', { name: 'Tools' });
  for (const name of ['Transfer', 'Migrate', 'Activity', 'Webhooks', 'API']) {
    await expect(sections.getByRole('button', { name })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Import forms', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Export/ }).first()).toBeVisible();
  await sections.getByRole('button', { name: 'Migrate' }).click();
  await expect(page.locator('.sf-tools__main')).toBeVisible();
  // Tools has its own controls: no Save button on the tab.
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/screens-2.5.1/settings-tools-tab.png' });
});

test('the old Tools URL opens the Tools tab of Settings', async ({ page }) => {
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-tools');
  await expect(page).toHaveURL(/page=subtleforms-settings/);
  await expect(page).toHaveURL(/#tab=tools/);
  await expect(page.locator('.sf-settings__title')).toHaveText('Tools', { timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Import forms', exact: true })).toBeVisible();
});

test('there is no separate Tools item in the menus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage(page);
  await page.goto(SETTINGS);
  await expect(nav(page)).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#toplevel_page_subtleforms .wp-submenu a[href*="subtleforms-tools"]')).toHaveCount(0);
  await expect(page.locator('.sf-appnav a[href*="subtleforms-tools"]')).toHaveCount(0);
});

test('an old tab=mcp or tab=license link opens the first tab, with no upgrade link', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage(page);
  for (const tab of ['mcp', 'license']) {
    await page.goto(`${SETTINGS}#tab=${tab}`);
    await expect(page.locator('.sf-settings__title')).toHaveText('General', { timeout: 30000 });
    await expect(page.getByRole('link', { name: /Upgrade|\bPro\b/ })).toHaveCount(0);
  }
  await page.screenshot({ path: 'test-results/screens-2.7.2/settings-no-license-tab.png' });
});

test('the tab list works from the keyboard', async ({ page }) => {
  await loginPage(page);
  await page.goto(SETTINGS);
  await expect(nav(page)).toBeVisible({ timeout: 30000 });
  const tools = nav(page).getByRole('button', { name: /^Tools/ });
  await tools.focus();
  await expect(tools).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.sf-settings__title')).toHaveText('Tools');
  await expect(tools).toHaveAttribute('aria-current', 'page');
  const general = nav(page).getByRole('button', { name: /^General/ });
  await general.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.sf-settings__title')).toHaveText('General');
});

test('Tools fits at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginPage(page);
  await page.goto(`${SETTINGS}#tab=tools`);
  await expect(page.locator('.sf-settings__title')).toHaveText('Tools', { timeout: 30000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/screens-2.5.1/settings-tools-phone.png' });
});
