/**
 * 2.6.0 UI fixes after the first test of the release zip.
 *
 * - Reports and the dashboard report cards: no panel has a scrollbar of its
 *   own and nothing scrolls sideways, from a 390px phone to a 1920px screen.
 *   The report endpoints are answered with a large, fixed data set (many
 *   forms with long titles, every spam reason), so the layout is checked at
 *   its worst. The analytics panels and the funnel moved to SubtleForms Pro
 *   in 2.7.0; their layout checks live in the Pro repository. Here Reports
 *   shows the Pro card in their place.
 * - Settings lists MCP right after Tools.
 * - Submissions: in the split inbox the pagination footer sits on the bottom
 *   edge of the list pane with one entry and with many.
 * - Settings > Tools > Activity: the two filters stay on one line and fit at
 *   390px.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage } = require('./helpers');

const SHOTS = path.join(process.cwd(), 'test-results', 'screens-2.6.0-fixes');
const WIDTHS = [390, 782, 1280, 1920];
const REPORTS = '/wp-admin/admin.php?page=subtleforms-reports';
const DASHBOARD = '/wp-admin/admin.php?page=subtleforms';
const SETTINGS = '/wp-admin/admin.php?page=subtleforms-settings';
const SCREEN = '#sf-main';
const SUBMISSIONS = '/wp-admin/admin.php?page=subtleforms-submissions';

// Entries are added with WP-CLI, as in import.spec.js: SF_WP_CLI locally,
// wp-env in CI.
const ROOT = path.resolve(__dirname, '..', '..');
const CLI = process.env.SF_WP_CLI || 'npx --yes @wordpress/env@10 run cli --env-cwd=wp-content/plugins/subtleforms wp';

const LONG = 'Request a callback from the regional sales and support team about an existing order';

function days(n, value) {
  const out = [];
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    out.push({ date: d.toISOString().slice(0, 10), ...value(i) });
  }
  return out;
}

const FORMS = Array.from({ length: 40 }, (_, i) => ({
  id: 900 + i,
  title: i % 3 === 0 ? `${LONG} number ${i + 1}` : `Contact form ${i + 1}`,
}));

const DATA = {
  overview: {
    total_forms: FORMS.length,
    total_submissions: 1234567,
    unread_submissions: 12345,
    series: days(7, (i) => ({ count: 1000 + i * 137 })),
    forms: FORMS,
  },
  spam: {
    total: 98765,
    since: '',
    days: days(30, (i) => ({ count: 100 + i * 7 })),
    reasons: { honeypot: 50000, time_trap: 30000, rate_limit: 10000, captcha_failed: 5000, spam_rule: 3000, other: 765 },
  },
};

/** Answer the report endpoints with the large data set. */
async function mockReports(page) {
  await page.route(
    (url) => /subtleforms(\/|%2F)v1(\/|%2F)(reports|spam)/.test(url.toString()),
    (route) => {
      const url = decodeURIComponent(route.request().url());
      let body = null;
      if (url.includes('/reports/overview')) body = DATA.overview;
      else if (url.includes('/spam/stats')) body = DATA.spam;
      if (!body) return route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: body }) });
    }
  );
}

/**
 * The screen's own scroll container (.sf-app__main, the one page scroller of
 * the SubtleForms screens) is the root, so the page may scroll; only what is
 * inside it is checked.
 *
 * Inside root: every element that scrolls on its own (overflow auto, scroll
 * or overlay with more content than room), and whether the page or anything
 * in root is wider than the window.
 */
function scan(page, root) {
  return page.evaluate((selector) => {
    const scope = document.querySelector(selector);
    const describe = (el) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${String(el.className || '').trim().split(/\s+/).slice(0, 3).join('.')}`;
    const scrollers = [];
    const wide = [];
    const spills = [];
    const vw = document.documentElement.clientWidth;
    for (const el of scope ? scope.querySelectorAll('*') : []) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || el.closest('.screen-reader-text')) continue;
      const scrollsY = /(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
      const scrollsX = /(auto|scroll|overlay)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
      if (scrollsX || scrollsY) {
        scrollers.push(`${describe(el)} ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`);
      }
      // Text or boxes wider than their own box (cut off, or over the next box).
      if (
        el.clientWidth > 1 &&
        el.scrollWidth > el.clientWidth + 1 &&
        style.textOverflow !== 'ellipsis' &&
        !el.closest('.components-visually-hidden')
      ) {
        spills.push(`${describe(el)} ${el.scrollWidth} in ${el.clientWidth}`);
      }
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > vw + 1 && style.position !== 'fixed') {
        wide.push(`${describe(el)} right=${Math.round(rect.right)} vw=${vw}`);
      }
    }
    return {
      scrollers,
      wide: wide.slice(0, 10),
      spills: spills.slice(0, 10),
      pageScrollsX:
        document.documentElement.scrollWidth > document.documentElement.clientWidth ||
        (scope ? scope.scrollWidth > scope.clientWidth + 1 : false),
    };
  }, root);
}

/**
 * Screenshot of the whole screen. The SubtleForms screens scroll inside
 * .sf-app__main, so the window is made as tall as the content first.
 */
async function shot(page, name) {
  const size = page.viewportSize();
  const height = await page.evaluate((sel) => {
    const main = document.querySelector(sel);
    return main ? main.scrollHeight + main.getBoundingClientRect().top + 16 : document.body.scrollHeight;
  }, SCREEN);
  await page.setViewportSize({ width: size.width, height: Math.min(Math.max(height, size.height), 12000) });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, name) });
  await page.setViewportSize(size);
}

async function expectNoScrollers(page, root, label) {
  const result = await scan(page, root);
  expect(result.scrollers, `${label}: panels with their own scrollbar`).toEqual([]);
  expect(result.wide, `${label}: elements wider than the window`).toEqual([]);
  expect(result.spills, `${label}: content wider than its box`).toEqual([]);
  expect(result.pageScrollsX, `${label}: page scrolls sideways`).toBe(false);
}

test.describe('Reports and dashboard cards fit without scrollbars', () => {
  test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

  test('Reports screen at every width', async ({ page }) => {
    await loginPage(page);
    await mockReports(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(REPORTS);
      // Entry counts stay free; analytics is a Pro card with an upgrade link.
      await expect(page.locator('.sf-kpis')).toBeVisible({ timeout: 30000 });
      const card = page.locator('.sf-pro-notice').first();
      await expect(card).toBeVisible();
      await expect(card).toContainText('Views, conversion rate and form funnel');
      await expect(card.locator('.sf-pro-tag').first()).toBeVisible();
      await expect(page.locator('.sf-funnel, .sf-analytics-panel')).toHaveCount(0);
      await expectNoScrollers(page, SCREEN, `Reports ${width}px`);
      await shot(page, `reports-${width}.png`);
    }
  });

  test('dashboard report cards at every width', async ({ page }) => {
    await loginPage(page);
    await mockReports(page);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(DASHBOARD);
      await expect(page.locator('.sf-spam-card__reasons')).toBeVisible({ timeout: 30000 });
      await expectNoScrollers(page, SCREEN, `Dashboard ${width}px`);
      await shot(page, `dashboard-${width}.png`);
    }
  });
});

test('Settings lists MCP right after Tools', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage(page);
  await page.goto(SETTINGS);
  const nav = page.getByRole('navigation', { name: 'Settings sections' });
  await expect(nav).toBeVisible({ timeout: 30000 });
  const tools = nav.getByRole('button', { name: /^Tools/ });
  // The next item in the same list as Tools is MCP.
  const next = tools.locator('xpath=ancestor::li[1]/following-sibling::li[1]//button');
  await expect(next).toHaveText(/^MCP/);
  await page.screenshot({ path: path.join(SHOTS, 'settings-tab-order.png') });
});

test.describe('Submissions: the footer sits on the bottom edge of the list pane', () => {
  let client;
  let form;

  test.beforeAll(async () => {
    fs.mkdirSync(SHOTS, { recursive: true });
    client = await adminApi();
    form = await publishForm(client, {
      title: 'Footer pane check',
      fields: [{ id: 'f1', key: 'name', type: 'text', label: 'Name' }],
    });
  });

  test.afterAll(async () => {
    if (form) await cleanup(client, form);
  });

  function send(count) {
    const out = execSync(`${CLI} eval-file tests/browser/fixtures/entries-seed.php ${form.id} ${count}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180000,
    });
    expect(out).toContain(`"created":${count}`);
  }

  async function paneEdges(page) {
    return page.evaluate(() => {
      const list = document.querySelector('.sf-inbox__list');
      const footer = list.querySelector('.sf-data-table__pagination');
      const l = list.getBoundingClientRect();
      const f = footer.getBoundingClientRect();
      return {
        pane: Math.round(l.bottom),
        footer: Math.round(f.bottom),
        scrolls: list.scrollHeight > list.clientHeight + 1,
        nested: [...list.querySelectorAll('*')].filter((el) => {
          const s = getComputedStyle(el);
          return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1;
        }).length,
      };
    });
  }

  async function open(page, width) {
    await page.setViewportSize({ width, height: 900 });
    // A fresh query string each time, so the list is loaded again.
    await page.goto(`${SUBMISSIONS}&form_id=${form.id}&r=${Date.now()}`);
    await expect(page.locator('.sf-inbox__list .sf-data-table__pagination')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('.sf-inbox__list .sf-data-table__row--clickable').first()).toBeVisible();
    // Let the pane settle after the first paint.
    await page.waitForTimeout(400);
  }

  test('with one entry and with many, at desktop and phone widths', async ({ page }) => {
    await loginPage(page);
    // Right of inbox is the default reading pane; set it to be sure.
    for (let i = 0; i < 4; i++) {
      const res = await client.call('POST', '/settings/inbox-view', { reading_pane: 'right', density: 'default' });
      if (res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 15000));
    }
    send(1);
    for (const width of [1440, 390]) {
      await open(page, width);
      const one = await paneEdges(page);
      expect(Math.abs(one.footer - one.pane), `1 entry at ${width}px`).toBeLessThanOrEqual(1);
      expect(one.nested).toBe(0);
      await page.screenshot({ path: path.join(SHOTS, `submissions-1-entry-${width}.png`) });
    }

    send(59);
    for (const width of [1440, 390]) {
      await open(page, width);
      await expect(page.locator('.sf-data-table__pagination-info-text').first()).toContainText('60');
      const many = await paneEdges(page);
      expect(many.scrolls, 'the rows fill more than the pane').toBe(true);
      expect(Math.abs(many.footer - many.pane), `many entries at ${width}px`).toBeLessThanOrEqual(1);
      expect(many.nested, 'no scroller inside the list').toBe(0);
      await page.screenshot({ path: path.join(SHOTS, `submissions-many-${width}.png`) });
    }

    // 50 rows on one page: still only the list scrolls, footer at the bottom.
    await open(page, 1440);
    await page.locator('.sf-inbox__list').getByLabel('Rows per page').selectOption('50');
    await expect(page.locator('.sf-data-table__pagination-info-text').first()).toContainText('1–50');
    const fifty = await paneEdges(page);
    expect(Math.abs(fifty.footer - fifty.pane), '50 rows per page').toBeLessThanOrEqual(1);
    expect(fifty.nested, 'no scroller inside the list with 50 rows').toBe(0);

    // With an entry open beside the list (narrow list) the footer stays down too.
    await page.locator('.sf-inbox__list .sf-data-table__row--clickable').first().click();
    await expect(page.locator('.sf-inbox-entry').first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(400);
    const open1 = await paneEdges(page);
    expect(Math.abs(open1.footer - open1.pane), 'entry open beside the list').toBeLessThanOrEqual(1);
    expect(open1.nested).toBe(0);
    await page.screenshot({ path: path.join(SHOTS, 'submissions-entry-open-1440.png') });
  });
});

test('Tools filters stay on one line and fit at 390px', async ({ page }) => {
  await loginPage(page);
  for (const width of [1280, 782, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${SETTINGS}&r=${width}#tab=tools`);
    const sections = page.getByRole('navigation', { name: 'Tools' });
    await expect(sections).toBeVisible({ timeout: 30000 });
    await sections.getByRole('button', { name: 'Activity' }).click();
    const filters = page.locator('.sf-tools__filters');
    await expect(filters).toBeVisible();
    const box = await filters.evaluate((el) => {
      const s = getComputedStyle(el);
      const kids = [...el.children].map((c) => c.getBoundingClientRect());
      const r = el.getBoundingClientRect();
      return {
        display: s.display,
        wrap: s.flexWrap,
        oneLine: kids.every((k) => Math.abs(k.top - kids[0].top) < 2),
        fits: r.right <= document.documentElement.clientWidth && kids.every((k) => k.right <= r.right + 1),
        pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(box.display).toBe('flex');
    expect(box.wrap).toBe('nowrap');
    expect(box.oneLine).toBe(true);
    expect(box.fits).toBe(true);
    expect(box.pageScrollsX).toBe(false);
    await page.screenshot({ path: path.join(SHOTS, `tools-filters-${width}.png`) });
  }
});
