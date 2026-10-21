/**
 * F240-5: SubtleForms admin screens at small and short windows.
 *
 * - The WordPress admin menu keeps its core behaviour on SubtleForms screens.
 * - UX2-17: on a phone the builder says it needs a wider screen, and can be
 *   opened anyway.
 * - UX2-18: with the reading pane right of the inbox, an inbox narrower than
 *   960px shows the entry as a full-width overlay with every action visible.
 * - UX2-19: on a phone the forms and submissions lists are cards with no
 *   sideways scrolling, normal-size checkboxes and one line of tabs.
 * - UX2-25: at 1440x900 every Quick Start Wizard step fits, with its buttons
 *   inside the dialog, and the help menu closes when an item is chosen.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, publishForm, spamToken, BASE } = require('./helpers');

let client;
let form;

test.beforeAll(async ({ playwright }) => {
  client = await adminApi();
  form = await publishForm(client, {
    title: `Small screens ${Date.now()}`,
    fields: [{ id: 'name', key: 'name', type: 'text', label: 'Name' }],
  });
  const anon = await playwright.request.newContext({ baseURL: BASE });
  const res = await anon.post('/wp-json/subtleforms/v1/submit', {
    data: { form_id: form.id, data: { name: 'Pane Tester', form_rendered_at: await spamToken(anon, form.id) } },
  });
  expect(res.status()).toBe(200);
});

async function openEntry(page, width, height) {
  await page.setViewportSize({ width, height });
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');
  await page.locator('.sf-inbox__list').getByText('Pane Tester').first().click();
  await expect(page.locator('.sf-inbox.is-open')).toBeVisible();
  await page.waitForTimeout(400); // the pane slides in once
  return page.evaluate(() => {
    const box = (sel) => document.querySelector(sel).getBoundingClientRect();
    return { inbox: box('.sf-inbox').width, pane: box('.sf-inbox__pane').width, paneLeft: box('.sf-inbox__pane').left, inboxLeft: box('.sf-inbox').left };
  });
}

async function actionsInView(page) {
  const pane = page.locator('.sf-inbox__pane');
  for (const name of [/Close/i, /Move to Trash/i, /Resend notifications/i, /^Star$/]) {
    const button = pane.getByRole('button', { name }).first();
    await expect(button).toBeInViewport();
  }
  // No two actions overlap.
  const boxes = await pane.locator('.sf-sub-toolbar__group .components-button').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlap = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      expect(overlap, `actions ${i} and ${j} overlap`).toBe(false);
    }
  }
}

test.afterAll(async () => {
  if (form) await cleanup(client, form);
});

test('the WordPress admin menu keeps its core positioning and stays reachable on a short window', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms');
  await page.waitForSelector('.sf-app');
  await expect(page.locator('body')).not.toHaveClass(/sf-menu-scrolls/);
  const wrap = await page.evaluate(() => {
    const s = window.getComputedStyle(document.getElementById('adminmenuwrap'));
    return { position: s.position, overflowY: s.overflowY };
  });
  expect(wrap.position).not.toBe('fixed');
  expect(wrap.overflowY).not.toBe('auto');
  // The page scrolls as in WordPress, so the last menu item can be reached.
  const collapse = page.locator('#collapse-button');
  await collapse.scrollIntoViewIfNeeded();
  await expect(collapse).toBeInViewport();
  await page.screenshot({ path: 'test-results/screens-2.5.1/menu-core-short-window.png' });
});

test('a tall window does not scroll the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms');
  await page.waitForSelector('.sf-app');
  const over = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  expect(over).toBeLessThanOrEqual(1);
});

test('UX2-17: on a phone the builder says it needs a wider screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginPage(page);
  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${form.id}`);
  await expect(page.getByRole('heading', { name: 'The form builder needs a wider screen' })).toBeVisible();
  await expect(page.locator('.sf-form-editor__canvas')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open the builder anyway' }).click();
  await expect(page.locator('.sf-form-editor__canvas, .sf-field-chrome').first()).toBeVisible({ timeout: 30000 });
});

test('UX2-17: a desktop window opens the builder directly', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginPage(page);
  await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${form.id}`);
  await expect(page.locator('.sf-form-editor__canvas, .sf-field-chrome').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('The form builder needs a wider screen')).toHaveCount(0);
});

test('UX2-18: at 1024 the entry covers the list as a full-width overlay', async ({ page }) => {
  const m = await openEntry(page, 1024, 768);
  expect(Math.abs(m.pane - m.inbox)).toBeLessThanOrEqual(2);
  expect(Math.abs(m.paneLeft - m.inboxLeft)).toBeLessThanOrEqual(2);
  await actionsInView(page);
});

test('UX2-18: at 390 every entry action is visible', async ({ page }) => {
  const m = await openEntry(page, 390, 844);
  expect(Math.abs(m.pane - m.inbox)).toBeLessThanOrEqual(2);
  await actionsInView(page);
});

test('UX2-18: a wide inbox keeps the list beside the entry', async ({ page }) => {
  const m = await openEntry(page, 1440, 900);
  expect(m.pane).toBeLessThan(m.inbox - 300);
});

// Submissions has its own two-line rows on a phone (see submissions-list.spec.js).
for (const screen of [{ slug: 'subtleforms-forms', name: 'All Forms' }]) {
  test(`UX2-19: ${screen.name} at 390 shows cards without sideways scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginPage(page);
    await page.goto(`/wp-admin/admin.php?page=${screen.slug}`);
    await page.waitForSelector('.sf-data-table__row');
    const m = await page.evaluate(() => {
      const sc = document.querySelector('.sf-data-table__scroll-container');
      const box = document.querySelector('.sf-data-table__row input[type="checkbox"]').getBoundingClientRect();
      const row = document.querySelector('.sf-data-table__row');
      const tabs = [...document.querySelectorAll('.sf-tab-bar__tab')].map((t) => Math.round(t.getBoundingClientRect().top));
      return {
        scroll: sc.scrollWidth - sc.clientWidth,
        doc: document.documentElement.scrollWidth - window.innerWidth,
        box: [box.width, box.height],
        rowDisplay: getComputedStyle(row).display,
        labelled: row.querySelectorAll('td[data-label]').length,
        tabRows: new Set(tabs).size,
      };
    });
    expect(m.scroll).toBeLessThanOrEqual(1);
    expect(m.doc).toBeLessThanOrEqual(1);
    expect(m.box[0]).toBeLessThanOrEqual(26);
    expect(m.box[1]).toBeLessThanOrEqual(26);
    expect(m.rowDisplay).not.toBe('table-row');
    expect(m.labelled).toBeGreaterThan(0);
    expect(m.tabRows).toBe(1);

    // The column headers stay for screen readers, and a sortable one sorts
    // from the keyboard.
    expect(await page.getByRole('columnheader').count()).toBeGreaterThan(2);
    const sortable = page.locator('.sf-data-table__th--sortable').first();
    await expect(sortable).toBeVisible();
    const before = await sortable.getAttribute('aria-sort');
    await sortable.focus();
    await page.keyboard.press('Enter');
    await expect(sortable).not.toHaveAttribute('aria-sort', before || 'none');
  });
}

test('UX2-19: Submissions at 390 shows two-line rows without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');
  await page.waitForSelector('.sf-data-table__row--compact');
  const m = await page.evaluate(() => {
    const list = document.querySelector('.sf-inbox__list');
    const row = document.querySelector('.sf-data-table__row--compact');
    const box = row.querySelector('input[type="checkbox"]').getBoundingClientRect();
    const tabs = [...document.querySelectorAll('.sf-tab-bar__tab')].map((t) => Math.round(t.getBoundingClientRect().top));
    return {
      scroll: list.scrollWidth - list.clientWidth,
      doc: document.documentElement.scrollWidth - window.innerWidth,
      box: [box.width, box.height],
      title: !!row.querySelector('.sf-sub-compact__title'),
      meta: !!row.querySelector('.sf-sub-compact__meta .sf-sub-time'),
      tabRows: new Set(tabs).size,
    };
  });
  expect(m.scroll).toBeLessThanOrEqual(1);
  expect(m.doc).toBeLessThanOrEqual(1);
  expect(m.box[0]).toBeLessThanOrEqual(26);
  expect(m.box[1]).toBeLessThanOrEqual(26);
  expect(m.title).toBe(true);
  expect(m.meta).toBe(true);
  expect(m.tabRows).toBe(1);
  // Sorting is a select and a direction button above the rows.
  await expect(page.getByLabel('Sort by')).toBeVisible();
});

test('UX2-19: a desktop window keeps the table', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
  await page.waitForSelector('.sf-data-table__row');
  expect(await page.locator('.sf-data-table__row').first().evaluate((r) => getComputedStyle(r).display)).toBe('table-row');
  await expect(page.locator('.sf-data-table__header th').nth(1)).toBeVisible();
});

test('UX2-25: every Quick Start Wizard step fits at 1440x900', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
  await page.getByRole('button', { name: 'Help & tour' }).first().click();
  await page.getByRole('menuitem', { name: 'Quick Start Wizard' }).click();
  await expect(page.locator('.subtleforms-help-menu__content')).toHaveCount(0);

  const fits = () =>
    page.evaluate(() => {
      const content = document.querySelector('.components-modal__content');
      const frame = document.querySelector('.components-modal__frame').getBoundingClientRect();
      const actions = document.querySelector('.sf-onboarding-wizard__actions').getBoundingClientRect();
      return { overflow: content.scrollHeight - content.clientHeight, inside: actions.bottom <= frame.bottom + 1 && frame.bottom <= window.innerHeight };
    });

  // Welcome, goal, fields and review.
  for (let step = 0; step < 4; step++) {
    const m = await fits();
    expect(m.overflow, `step ${step} scrolls`).toBeLessThanOrEqual(1);
    expect(m.inside, `step ${step} buttons`).toBe(true);
    if (step === 1) {
      await page.locator('.sf-onboarding-wizard__option').first().click();
    }
    const next = page.getByRole('button', { name: 'Next' });
    if (step < 3) {
      await next.click();
    }
  }
});
