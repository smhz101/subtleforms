/**
 * Settings has a Tools tab (the old Tools page moved in) and an MCP tab
 * (Pro supplies its screen; Free shows a note with an upgrade link).
 */
const { test, expect } = require('@playwright/test');
const { loginPage } = require('./helpers');

const SETTINGS = '/wp-admin/admin.php?page=subtleforms-settings';
const nav = (page) => page.getByRole('navigation', { name: 'Settings sections' });

test('Settings lists Tools and MCP, and Tools keeps its sections', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage(page);
  await page.goto(SETTINGS);
  await expect(nav(page)).toBeVisible({ timeout: 30000 });
  await expect(nav(page).getByRole('button', { name: /^Tools/ })).toBeVisible();
  await expect(nav(page).getByRole('button', { name: /^MCP/ })).toBeVisible();

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

test('MCP without Pro explains itself with an upgrade link', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage(page);
  await page.goto(`${SETTINGS}#tab=mcp`);
  await expect(page.locator('.sf-settings__title')).toHaveText('MCP', { timeout: 30000 });
  const note = page.locator('.sf-mcp-placeholder');
  await expect(note).toContainText('part of SubtleForms Pro');
  const link = note.getByRole('link', { name: /Upgrade to Pro/ });
  await expect(link).toHaveAttribute('href', /subtleforms\.com\/pro.*utm_campaign=mcp/);
  await expect(link).toHaveAttribute('target', '_blank');
  await page.screenshot({ path: 'test-results/screens-2.5.1/settings-mcp-free.png' });
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
  const mcp = nav(page).getByRole('button', { name: /^MCP/ });
  await mcp.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.sf-settings__title')).toHaveText('MCP');
  await expect(page.getByRole('link', { name: /Upgrade to Pro/ }).first()).toBeVisible();
});

test('Tools and MCP fit at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginPage(page);
  await page.goto(`${SETTINGS}#tab=tools`);
  await expect(page.locator('.sf-settings__title')).toHaveText('Tools', { timeout: 30000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'test-results/screens-2.5.1/settings-tools-phone.png' });
});
