/**
 * Browser checks for fixes that shipped before 2.5.0 without a test:
 * Section Heading followed by Custom HTML (FA-20), the builder header at
 * common widths (UX2-01), conversational choice questions (UX2-03), the
 * coupon row on a narrow screen (UX2-04), the focus ring on the status
 * tabs (UX2-20), the builder loading state (UX2-07) and the Tools file
 * buttons from the keyboard (FF2-16).
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, loginPage, openBuilder, waitForForm } = require('./helpers');

let client;
const created = [];

test.beforeAll(async () => {
  client = await adminApi();
});

test.afterAll(async () => {
  for (const form of created) {
    await cleanup(client, form);
  }
});

const OPTIONS = [
  { label: 'Alpha', value: 'alpha' },
  { label: 'Bravo', value: 'bravo' },
  { label: 'Charlie', value: 'charlie' },
];

test('a Section Heading and the Custom HTML after it each take a full row (FA-20)', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'FA-20 heading and html',
    fields: [
      { id: 'a1', key: 'section_a', type: 'section_break', label: 'About you' },
      { id: 'a2', key: 'html_a', type: 'html', label: 'Note', content: '<p>Custom HTML text</p>' },
      { id: 'a3', key: 'name', type: 'text', label: 'Name' },
    ],
  });
  created.push(form);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(form.url);
  await waitForForm(page);

  const container = await page.locator('.subtleforms-form-container').boundingBox();
  const heading = await page.locator('.subtleforms-section-break').first().boundingBox();
  const html = await page.locator('.subtleforms-html').first().boundingBox();
  expect(heading).not.toBeNull();
  expect(html).not.toBeNull();
  // Each spans the form width and the second sits below the first.
  expect(heading.width).toBeGreaterThan(container.width * 0.95);
  expect(html.width).toBeGreaterThan(container.width * 0.95);
  expect(html.y).toBeGreaterThanOrEqual(heading.y + heading.height - 1);
});

for (const width of [1280, 1440, 1600]) {
  test(`the builder header keeps Preview reachable at ${width}px (UX2-01)`, async ({ page }) => {
    const form = await publishForm(client, {
      title: 'UX2-01 a rather long form name that wants the whole header',
      fields: [{ id: 'h1', key: 'name', type: 'text', label: 'Name' }],
    });
    created.push(form);
    await page.setViewportSize({ width, height: 900 });
    await loginPage(page);
    await openBuilder(page, form.id);

    const bar = page.locator('header.sf-topbar--editor').first();
    await expect(bar).toBeVisible();
    // No horizontal scroll inside the bar.
    const overflow = await bar.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // Preview and Entries are what the title and the status pill used to
    // cover: the point in the middle of each hits that button itself.
    for (const key of ['preview', 'entries']) {
      const view = page.locator(`#sf-builder-view-${key}`);
      await expect(view).toBeVisible();
      const box = await view.boundingBox();
      const hit = await page.evaluate(({ x, y, id }) => {
        const el = document.elementFromPoint(x, y);
        return Boolean(el && el.closest(`#${id}`));
      }, { x: box.x + box.width / 2, y: box.y + box.height / 2, id: `sf-builder-view-${key}` });
      expect(hit, `${key} is not covered`).toBe(true);
    }

    // The title, the status pill, the view switcher and the Publish group sit
    // side by side with no overlap.
    const rects = await page.evaluate(() => {
      const pick = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right };
      };
      return {
        title: pick('header.sf-topbar--editor .sf-builder-header-bar__title-input, header.sf-topbar--editor .sf-builder-header-bar__title-button'),
        status: pick('header.sf-topbar--editor .sf-builder-header-bar__save-status'),
        views: pick('#sf-builder-view-preview'),
        publish: pick('header.sf-topbar--editor .sf-builder-header-bar__publish-group'),
      };
    });
    const present = Object.entries(rects).filter(([, r]) => r);
    expect(present.length).toBeGreaterThanOrEqual(3);
    const ordered = [...present].sort((a, b) => a[1].left - b[1].left);
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i - 1][1].right, `${ordered[i - 1][0]} ends before ${ordered[i][0]} starts`).toBeLessThanOrEqual(ordered[i][1].left + 1);
    }
  });
}

for (const layout of ['inline', 'buttons', 'columns-2']) {
  test(`conversational choice questions are a vertical list, ${layout} layout (UX2-03)`, async ({ page }) => {
    const form = await publishForm(client, {
      title: `UX2-03 conversational ${layout}`,
      metadata: { type: 'conversational' },
      fields: [
        { id: 'c1', key: 'pick', type: 'radio', label: 'Pick one', options: OPTIONS, optionLayout: layout },
      ],
    });
    created.push(form);
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto(form.url);
    await page.waitForSelector('.subtleforms--type-conversational .subtleforms-radio-label', { timeout: 30000 });
    await expect(page.locator('.subtleforms-radio-group').first()).toHaveClass(new RegExp(`subtleforms-options--${layout}`));

    const boxes = await page.locator('.subtleforms--type-conversational .subtleforms-radio-label').evaluateAll(
      (nodes) => nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y) };
      })
    );
    expect(boxes.length).toBe(3);
    // One column: same left edge, each below the one before.
    expect(new Set(boxes.map((b) => b.x)).size).toBe(1);
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
    expect(boxes[2].y).toBeGreaterThan(boxes[1].y);
  });
}

test('the coupon field wraps on a narrow screen (UX2-04)', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'UX2-04 coupon row',
    fields: [{ id: 'k1', key: 'name', type: 'text', label: 'Name' }],
  });
  created.push(form);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(form.url);
  await waitForForm(page);

  // The coupon row is part of the payment summary. Draw the same markup in
  // the form so the rule that the bundle ships is what is measured.
  await page.evaluate(() => {
    const host = document.querySelector('.subtleforms-form-container');
    const row = document.createElement('div');
    row.className = 'subtleforms-coupon__row';
    row.innerHTML = '<input class="subtleforms-coupon__input" type="text" aria-label="Coupon code"><button type="button" class="subtleforms-coupon__apply">Apply</button>';
    host.appendChild(row);
  });
  const input = await page.locator('.subtleforms-coupon__input').boundingBox();
  const apply = await page.locator('.subtleforms-coupon__apply').boundingBox();
  const container = await page.locator('.subtleforms-form-container').boundingBox();
  // Stacked: the button is under the input and nothing leaves the form.
  expect(apply.y).toBeGreaterThan(input.y + input.height - 1);
  expect(input.x + input.width).toBeLessThanOrEqual(container.x + container.width + 1);
  expect(apply.x + apply.width).toBeLessThanOrEqual(container.x + container.width + 1);
  const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(scrolls).toBe(false);
});

for (const width of [1280, 390]) {
  test(`the focus ring on the Forms status tabs is not clipped at ${width}px (UX2-20)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loginPage(page);
    await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
    const tabs = page.locator('.sf-tab-bar [role="tab"]');
    await expect(tabs.first()).toBeVisible({ timeout: 30000 });

    // Tab to the first status tab from the keyboard so :focus-visible applies.
    await tabs.first().focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(tabs.first()).toBeFocused();

    const result = await tabs.first().evaluate((tab) => {
      const style = getComputedStyle(tab);
      const width = parseFloat(style.outlineWidth) || 0;
      const offset = parseFloat(style.outlineOffset) || 0;
      const reach = style.outlineStyle === 'none' ? 0 : width + Math.max(offset, 0);
      const rect = tab.getBoundingClientRect();
      const ring = { top: rect.top - reach, left: rect.left - reach, right: rect.right + reach, bottom: rect.bottom + reach };
      // Every ancestor that clips must still contain the ring.
      const clipped = [];
      for (let node = tab.parentElement; node && node !== document.documentElement; node = node.parentElement) {
        const s = getComputedStyle(node);
        const clips = [s.overflowX, s.overflowY].some((v) => v !== 'visible');
        if (!clips) continue;
        const box = node.getBoundingClientRect();
        if (ring.top < box.top - 0.5 || ring.left < box.left - 0.5 || ring.right > box.right + 0.5 || ring.bottom > box.bottom + 0.5) {
          clipped.push(node.className || node.tagName);
        }
      }
      return { outlineStyle: style.outlineStyle, reach, clipped };
    });
    expect(result.outlineStyle).not.toBe('none');
    expect(result.clipped).toEqual([]);
  });
}

test('the builder shows a loading skeleton, then the form (UX2-07)', async ({ page }) => {
  const form = await publishForm(client, {
    title: 'UX2-07 loading',
    fields: [{ id: 'l1', key: 'name', type: 'text', label: 'Name' }],
  });
  created.push(form);
  await loginPage(page);

  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route(/subtleforms\/v1\/forms\/\d+\/schema/, async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${form.id}`);

  const skeleton = page.locator('.sf-builder-loading');
  await expect(skeleton).toBeVisible({ timeout: 30000 });
  await expect(skeleton).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.sf-field-chrome')).toHaveCount(0);

  release();
  await page.waitForSelector('.sf-field-chrome', { timeout: 30000 });
  await expect(skeleton).toHaveCount(0);
});

test('the Tools file buttons open the file picker from the keyboard (FF2-16)', async ({ page }) => {
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-settings#tab=tools');
  const button = page.getByRole('button', { name: 'Import forms', exact: true });
  await expect(button).toBeVisible({ timeout: 30000 });

  for (const key of ['Enter', 'Space']) {
    await button.focus();
    const chooser = page.waitForEvent('filechooser', { timeout: 10000 });
    await page.keyboard.press(key);
    await expect(await chooser).toBeTruthy();
  }
});
