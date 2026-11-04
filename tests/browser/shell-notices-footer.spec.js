/**
 * 2.7.4: notices from WordPress and other plugins sit under the SubtleForms
 * header, and the app has a footer with the version, links and list pagination.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage } = require('./helpers');

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, { title: 'Footer pagination', fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }] });
});

test.afterAll(async () => {
  if (form) await cleanup(client, form);
});

async function open(page, url) {
  await loginPage(page);
  await page.goto(url);
  await page.waitForSelector('.sf-app');
}

test('a notice added after load moves under the header and can be dismissed', async ({ page }) => {
  await open(page, '/wp-admin/admin.php?page=subtleforms-settings');
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'notice notice-success is-dismissible';
    el.innerHTML = '<p>Purged all caches successfully.</p>';
    document.getElementById('wpbody-content').prepend(el);
    // What core's common.js does for notices that exist at load.
    window.jQuery(document).trigger('wp-updates-notice-added');
  });
  const region = page.getByRole('region', { name: 'Notices' });
  await expect(region).toContainText('Purged all caches successfully.');
  expect(await page.evaluate(() => !!document.querySelector('#wpbody-content > .notice'))).toBe(false);
  const header = await page.locator('.sf-topbar').boundingBox();
  const box = await region.locator('.notice').first().boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  await region.locator('.notice-dismiss').first().click();
  await expect(region.locator('.notice')).toHaveCount(0);
});

test('more than two notices fold behind a button', async ({ page }) => {
  await open(page, '/wp-admin/admin.php?page=subtleforms-settings');
  await page.evaluate(() => {
    ['One', 'Two', 'Three', 'Four'].forEach((text) => {
      const el = document.createElement('div');
      el.className = 'notice notice-info';
      el.innerHTML = `<p>${text}</p>`;
      document.getElementById('wpbody-content').appendChild(el);
    });
  });
  const region = page.getByRole('region', { name: 'Notices' });
  const more = region.getByRole('button', { name: 'Show 2 more notices' });
  await expect(more).toBeVisible();
  await expect(region.locator('.notice:visible')).toHaveCount(2);
  await more.click();
  await expect(region.locator('.notice:visible')).toHaveCount(4);
});

test('the footer shows the version and links, and the page scrolls between header and footer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, '/wp-admin/admin.php?page=subtleforms-settings');
  const footer = page.locator('.sf-footer');
  await expect(footer).toContainText(/SubtleForms \d+\.\d+\.\d+/);
  await expect(footer.getByRole('link', { name: 'Documentation' })).toHaveAttribute('href', 'https://subtleforms.com/docs/');
  await expect(footer.getByRole('link', { name: 'Support' })).toHaveAttribute('href', 'https://wordpress.org/support/plugin/subtleforms/');
  await expect(page.locator('#wpfooter')).toBeHidden();
  const m = await page.evaluate(() => {
    const f = document.querySelector('.sf-footer').getBoundingClientRect();
    const main = document.querySelector('.sf-app__main');
    return { footerBottom: f.bottom, vh: window.innerHeight, doc: document.documentElement.scrollHeight - window.innerHeight, mainOverflow: getComputedStyle(main).overflowY };
  });
  expect(m.footerBottom).toBeLessThanOrEqual(m.vh);
  expect(m.doc).toBeLessThanOrEqual(1);
  expect(m.mainOverflow).toBe('auto');
});

test('the forms list pagination is in the footer', async ({ page }) => {
  await open(page, '/wp-admin/admin.php?page=subtleforms-forms');
  const footer = page.locator('.sf-footer__page');
  await expect(footer.getByLabel('Rows per page')).toBeVisible();
  await expect(footer).toContainText(/Page \d+ of \d+/);
  await expect(page.locator('.sf-app__main .sf-data-table__pagination')).toHaveCount(0);
});
