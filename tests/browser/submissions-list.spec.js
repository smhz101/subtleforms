/**
 * Submissions list polish (2.5.0): a narrow list pane never scrolls sideways,
 * the footer stays at the bottom of the pane, the bulk bar is icon buttons,
 * every tab shows its count and keeps it right after each action, starred
 * rows have no background tint, and each icon's tooltip is its own.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage, BASE, spamToken } = require('./helpers');

let client;
let form;
// The public form allows 10 sends a minute, so nine entries.
const NAMES = ['Ada', 'Grace', 'Linus', 'Margaret', 'Alan', 'Katherine', 'Dennis', 'Barbara', 'Ken'];

const listUrl = () => `/wp-admin/admin.php?page=subtleforms-submissions&form_id=${form.id}`;
const rowNamed = (page, name) => rows(page).filter({ hasText: name }).first();
const rows = (page) => page.locator('.sf-data-table__row--compact, .sf-data-table__table tbody tr');

/** Count shown on a tab, 0 when there is no badge. Read in one step so a badge that goes away mid-read cannot stall the check. */
async function tabCount(page, label) {
  const tab = page.getByRole('tab', { name: new RegExp(`^${label}`) });
  const text = await tab.evaluate((el) => el.querySelector('.sf-tab-bar__count')?.textContent || '0');
  return parseInt(text, 10) || 0;
}

async function expectCounts(page, expected) {
  for (const [label, count] of Object.entries(expected)) {
    await expect.poll(() => tabCount(page, label), { message: `${label} count`, timeout: 10000 }).toBe(count);
  }
}

// Saving the display option is limited to 10 a minute: set it once.
/** Open an entry so the list sits in its narrow pane (compact rows). */
async function openNarrowPane(page) {
  await rows(page).nth(1).locator('.sf-sub-compact__title, td[data-column="id"] .sf-sub-entry__name').first().click();
  await expect(page.locator('.sf-inbox-entry').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.sf-data-table__row--compact').first()).toBeVisible();
  await page.waitForTimeout(400); // the pane slides in once
}

async function setPane(pane) {
  // Other specs share the per-minute limit on this endpoint: wait it out.
  let res;
  for (let i = 0; i < 4; i++) {
    res = await client.call('POST', '/settings/inbox-view', { reading_pane: pane, density: 'default' });
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 15000));
  }
  expect(res.status).toBeLessThan(300);
}

test.beforeAll(async ({ playwright }, testInfo) => {
  testInfo.setTimeout(300000);
  client = await adminApi();
  form = await publishForm(client, {
    title: `Submissions list ${Date.now()}`,
    fields: [{ id: 'n', key: 'name', type: 'text', label: 'Name' }],
  });
  await setPane('right');
  const anon = await playwright.request.newContext({ baseURL: BASE });
  for (const name of NAMES) {
    let res;
    for (let i = 0; i < 6; i++) {
      res = await anon.post('/wp-json/subtleforms/v1/submit', {
        data: { form_id: form.id, data: { name, form_rendered_at: await spamToken(anon, form.id) } },
      });
      if (res.status() !== 429) break;
      // The public form allows 10 sends a minute across every spec.
      await new Promise((r) => setTimeout(r, 15000));
    }
    expect(res.status(), await res.text()).toBe(200);
  }
  await anon.dispose();
  // 9 entries: 2 read, 1 spam, 1 flagged, 2 starred, 1 trashed.
  const all = await entries(client, form.id);
  expect(all).toHaveLength(NAMES.length);
  // Entries made in the same second can list in any order: find each by name.
  const ids = NAMES.map((name) => all.find((e) => e.payload?.name === name).id);
  await client.call('POST', '/submissions/bulk', { ids: ids.slice(0, 2), action: 'read' });
  await client.call('POST', '/submissions/bulk', { ids: [ids[2]], action: 'spam' });
  await client.call('POST', '/submissions/bulk', { ids: [ids[3]], action: 'flagged' });
  await client.call('POST', '/submissions/bulk', { ids: ids.slice(4, 6), action: 'star' });
  await client.call('POST', '/submissions/bulk', { ids: [ids[6]], action: 'trash' });
});

test.afterAll(async () => {
  await setPane('right').catch(() => {});
  await cleanup(client, form);
});

test('every tab shows its count on first load, from one request', async ({ page }) => {
  await loginPage(page);
  const counted = [];
  page.on('request', (request) => {
    if (request.url().includes('unread-count')) counted.push(request.url());
  });
  await page.goto(listUrl());
  await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
  // 9 entries, 1 trashed: 8 live. Read: 2. New: 6.
  await expectCounts(page, { All: 8, New: 6, Read: 2, Spam: 1, Starred: 2, Flagged: 1, Trash: 1 });
  expect(counted.length).toBe(1);
});

test('counts follow every action without a reload', async ({ page }) => {
  await loginPage(page);
  await page.goto(listUrl());
  await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
  await expectCounts(page, { All: 8, New: 6, Read: 2, Spam: 1, Starred: 2, Flagged: 1, Trash: 1 });

  // Star then unstar the first row.
  const first = rowNamed(page, 'Ada');
  await first.hover();
  await first.getByRole('button', { name: 'Star', exact: true }).click();
  await expectCounts(page, { Starred: 3 });
  await first.hover();
  await first.getByRole('button', { name: 'Remove star' }).click();
  await expectCounts(page, { Starred: 2 });

  // Trash (the newest entry is a read one): leaves All and Read, joins Trash.
  await first.hover();
  await first.getByRole('button', { name: 'Move to Trash' }).click();
  await expectCounts(page, { All: 7, Read: 1, New: 6, Trash: 2 });

  // Restore it from the Trash tab.
  await page.getByRole('tab', { name: /^Trash/ }).click();
  await expect(rows(page)).toHaveCount(2, { timeout: 15000 });
  const trashed = rowNamed(page, 'Ada');
  await trashed.hover();
  await trashed.getByRole('button', { name: 'Restore' }).click();
  await expectCounts(page, { All: 8, Read: 2, New: 6, Trash: 1 });

  // Delete forever the entry that was trashed before.
  const remaining = rowNamed(page, 'Dennis');
  await remaining.hover();
  await remaining.getByRole('button', { name: 'Delete permanently' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete permanently' }).click();
  await expectCounts(page, { Trash: 0, All: 8 });

  // Bulk: select all on the All tab, mark read, then unread.
  await page.getByRole('tab', { name: /^All/ }).click();
  await expect(rows(page).first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Select all' }).check();
  await page.getByRole('toolbar', { name: 'Bulk actions' }).getByRole('button', { name: 'Mark read' }).click();
  await expectCounts(page, { New: 0, Read: 8 });
  await page.getByRole('checkbox', { name: 'Select all' }).check();
  await page.getByRole('toolbar', { name: 'Bulk actions' }).getByRole('button', { name: 'Mark unread' }).click();
  await expectCounts(page, { New: 8, Read: 0 });

  // The numbers are what the server says.
  const server = await client.call('GET', `/submissions/unread-count?form_id=${form.id}`);
  expect(server.body.data.counts.all).toBe(8);
  expect(server.body.data.counts.unread).toBe(8);
});

test('actions in the entry pane update the counts too', async ({ page }) => {
  await loginPage(page);
  await page.goto(listUrl());
  await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
  const before = { starred: await tabCount(page, 'Starred'), trash: await tabCount(page, 'Trash'), all: await tabCount(page, 'All') };

  await rowNamed(page, 'Ken').locator('.sf-sub-compact__title, td[data-column="id"] .sf-sub-entry__name').first().click();
  const pane = page.locator('.sf-inbox-entry');
  await expect(pane.getByRole('button', { name: 'Star', exact: true })).toBeVisible({ timeout: 20000 });
  await pane.getByRole('button', { name: 'Star', exact: true }).click();
  await expectCounts(page, { Starred: before.starred + 1 });
  await pane.getByRole('button', { name: 'Move to Trash' }).click();
  await expectCounts(page, { Trash: before.trash + 1, All: before.all - 1, Starred: before.starred });
});

for (const width of [782, 1000, 1280, 1600, 2000]) {
  test(`no sideways scroll at ${width}px, pane open or closed, with the bulk bar`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
    await loginPage(page);
    await page.goto(listUrl());
    await expect(rows(page).first()).toBeVisible({ timeout: 30000 });

    const check = async (label) => {
      const widths = await page.evaluate(() => {
        const list = document.querySelector('.sf-inbox__list');
        return {
          list: [list.scrollWidth, list.clientWidth],
          doc: [document.documentElement.scrollWidth, window.innerWidth],
          bar: (() => {
            const bar = document.querySelector('.sf-data-table__bulk-actions');
            return bar ? [bar.scrollWidth, bar.clientWidth] : null;
          })(),
        };
      });
      expect(widths.list[0], `${label}: list scrollWidth`).toBeLessThanOrEqual(widths.list[1]);
      expect(widths.doc[0], `${label}: page scrollWidth`).toBeLessThanOrEqual(widths.doc[1]);
      if (widths.bar) expect(widths.bar[0], `${label}: bulk bar scrollWidth`).toBeLessThanOrEqual(widths.bar[1]);
    };

    await check('closed');
    await page.getByRole('checkbox', { name: /Select row/ }).nth(0).check();
    await page.getByRole('checkbox', { name: /Select row/ }).nth(1).check();
    await expect(page.getByRole('toolbar', { name: 'Bulk actions' })).toBeVisible();
    await check('closed with bulk bar');
    await page.getByRole('button', { name: 'Clear' }).click();

    await rows(page).nth(1).locator('.sf-sub-compact__title, td[data-column="id"] .sf-sub-entry__name').first().click();
    await expect(page.locator('.sf-inbox__pane .sf-sub-toolbar__group, .sf-inbox__pane h2, .sf-inbox__pane h1').first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(500);
    await check('open');
  });
}

test('a narrow pane shows two-line rows with the actions under the title', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginPage(page);
  await page.goto(listUrl());
  await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
  await openNarrowPane(page);
  const row = page.locator('.sf-data-table__row--compact').nth(2);
  await row.hover();
  const geometry = await row.evaluate((el) => {
    const box = (sel) => el.querySelector(sel).getBoundingClientRect();
    return { title: box('.sf-sub-compact__title'), chip: box('.sf-pill'), time: box('.sf-sub-time'), actions: box('.subtleforms-row-actions') };
  });
  expect(geometry.chip.top).toBeGreaterThan(geometry.title.bottom - 2);
  expect(geometry.actions.top).toBeGreaterThan(geometry.title.bottom - 2);
  expect(geometry.time.top).toBeGreaterThan(geometry.title.bottom - 2);
  expect(geometry.actions.left).toBeLessThan(geometry.title.left + 400);
  // Full title in the title attribute, number on the first line.
  await expect(row.locator('.sf-sub-compact__title')).toHaveAttribute('title', /.+/);
  await expect(row.locator('.sf-sub-time')).toHaveAttribute('title', /\d{4}/);
});

test('the footer stays at the bottom of the list pane while the rows scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  await loginPage(page);
  await page.goto(listUrl());
  await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
  const footer = page.locator('.sf-data-table__pagination--compact');
  await openNarrowPane(page);
  const pane = await page.locator('.sf-inbox__list').boundingBox();
  const before = await footer.boundingBox();
  expect(Math.abs(before.y + before.height - (pane.y + pane.height))).toBeLessThan(3);
  await page.locator('.sf-inbox__list').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForTimeout(200);
  const after = await footer.boundingBox();
  expect(Math.abs(after.y + after.height - (pane.y + pane.height))).toBeLessThan(3);
  await expect(footer).toContainText(/1 to \d+ of \d+/);
  await expect(footer.getByLabel('Rows per page')).toBeVisible();
});

test('starred rows have no background tint, only the filled star', async ({ page }) => {
  await loginPage(page);
  await page.goto(listUrl());
  await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
  await openNarrowPane(page);
  await page.mouse.move(2, 2); // no row is hovered
  await page.waitForTimeout(300);
  const backgrounds = await page.locator('.sf-data-table__row--compact').evaluateAll((items) =>
    items.map((el) => ({
      starred: !!el.querySelector('.sf-sub-compact__star'),
      unread: !!el.querySelector('.sf-sub-compact.is-unread'),
      reading: el.classList.contains('sf-submissions-table__row--reading'),
      bg: getComputedStyle(el).backgroundColor,
    }))
  );
  // The open entry has its own highlight; every other row is compared.
  const starred = backgrounds.filter((b) => b.starred && !b.reading);
  const plain = backgrounds.filter((b) => !b.starred && !b.reading);
  expect(starred.length).toBeGreaterThan(0);
  for (const row of starred) {
    expect(row.bg).toBe(plain.find((p) => p.unread === row.unread).bg);
  }
  const star = page.locator('.sf-sub-compact__star svg').first();
  await expect(star).toBeVisible();
  expect(await star.evaluate((el) => getComputedStyle(el).fill)).not.toBe('none');
});

test('each icon button shows its own tooltip', async ({ page }) => {
  await loginPage(page);
  await page.goto(listUrl());
  await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
  await openNarrowPane(page);
  const row = rows(page).nth(3);
  await row.hover();
  const buttons = row.locator('.subtleforms-row-actions button');
  const count = await buttons.count();
  expect(count).toBe(4);
  for (let i = 0; i < count; i++) {
    const label = await buttons.nth(i).getAttribute('aria-label');
    await buttons.nth(i).hover();
    const tip = page.getByRole('tooltip');
    await expect(tip).toHaveCount(1);
    await expect(tip).toHaveText(label);
    // The tooltip sits over its own button.
    const tipBox = await tip.boundingBox();
    const buttonBox = await buttons.nth(i).boundingBox();
    const tipCentre = tipBox.x + tipBox.width / 2;
    expect(Math.abs(tipCentre - (buttonBox.x + buttonBox.width / 2))).toBeLessThan(buttonBox.width);
  }
});

test('the bulk bar is icon buttons with names and a More menu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginPage(page);
  await page.goto(listUrl());
  await expect(rows(page).first()).toBeVisible({ timeout: 30000 });
  await page.getByRole('checkbox', { name: /Select row/ }).nth(0).check();
  const bar = page.getByRole('toolbar', { name: 'Bulk actions' });
  await expect(bar).toContainText('1 selected');
  for (const name of ['Mark read', 'Mark unread', 'Star', 'Remove star', 'Mark as spam', 'Export selected (CSV)', 'Move to Trash', 'More actions']) {
    await expect(bar.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await bar.getByRole('button', { name: 'More actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Mark as flagged' })).toBeVisible();
});
