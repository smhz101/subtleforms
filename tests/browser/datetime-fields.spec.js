/**
 * 2.9.0: Date, Time and Date & time fields. The calendar is a real seven
 * column grid, the pickers load their own stylesheet on a theme form, and the
 * control is a text input the theme styles. Each block below belongs to one
 * step of that work.
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { adminApi, publishForm, cleanup, waitForForm, entries, loginPage, openBuilder } = require('./helpers');

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: `Date fields ${Date.now()}`,
    fields: [
      { id: 'd1', key: 'visit', type: 'date', label: 'Visit date' },
      { id: 'd2', key: 'slot', type: 'time', label: 'Slot' },
      { id: 'd3', key: 'when', type: 'datetime', label: 'When' },
    ],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

async function openForm(page) {
  await page.goto(form.url);
  await waitForForm(page);
}

test('the calendar is a seven column grid: a week shares one row and the columns one width', async ({ page }) => {
  await openForm(page);
  await page.locator('#subtleforms-field-visit').click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  const rows = await page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const weeks = [...document.querySelectorAll('.subtleforms-picker__week')];
    const header = [...document.querySelectorAll('.subtleforms-picker__weekdays [role="columnheader"]')].map(box);
    return { weeks: weeks.map((week) => [...week.querySelectorAll('[role="gridcell"]')].map(box)), header };
  });
  expect(rows.weeks).toHaveLength(6);
  expect(rows.header).toHaveLength(7);
  for (const week of rows.weeks) {
    expect(week).toHaveLength(7);
    expect(new Set(week.map((cell) => Math.round(cell.y))).size).toBe(1);
    expect(new Set(week.map((cell) => Math.round(cell.w))).size).toBe(1);
    expect(new Set(week.map((cell) => Math.round(cell.x))).size).toBe(7);
  }
  // Rows stack: each week starts below the one before it.
  for (let i = 1; i < rows.weeks.length; i += 1) {
    expect(rows.weeks[i][0].y).toBeGreaterThan(rows.weeks[i - 1][0].y);
  }
  // The weekday header lines up with the first week's columns.
  expect(new Set(rows.header.map((cell) => Math.round(cell.y))).size).toBe(1);
  rows.header.forEach((cell, index) => {
    expect(Math.abs(cell.x - rows.weeks[0][index].x)).toBeLessThan(1);
  });
});

test('in the date and time picker the time columns sit beside the calendar, not over it', async ({ page }) => {
  await openForm(page);
  await page.locator('#subtleforms-field-when').click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  const boxes = await page.evaluate(() => {
    const r = (sel) => document.querySelector(sel).getBoundingClientRect().toJSON();
    return { calendar: r('.subtleforms-picker__calendar'), time: r('.subtleforms-picker__time'), menu: r('.subtleforms-picker__menu') };
  });
  expect(boxes.time.x).toBeGreaterThanOrEqual(boxes.calendar.x + boxes.calendar.width - 1);
  expect(boxes.time.x + boxes.time.width).toBeLessThanOrEqual(boxes.menu.x + boxes.menu.width + 1);
});

// ---- Picker CSS is plugin UI and loads on its own (#109) -------------------

const THEME = { appearance: { preset: 'theme', tokens: { fontFamily: 'inherit', colorBackground: 'transparent' }, variants: {} } };
let themeForm;
let textOnly;

test.describe('theme forms and the picker stylesheet', () => {
  test.beforeAll(async () => {
    themeForm = await publishForm(client, {
      title: `Theme picker ${Date.now()}`,
      metadata: THEME,
      fields: [
        { id: 't1', key: 'name', type: 'text', label: 'Name' },
        { id: 't2', key: 'topic', type: 'select', label: 'Topic', options: [{ label: 'Sales', value: 'sales' }, { label: 'Support', value: 'support' }] },
        { id: 't3', key: 'visit', type: 'date', label: 'Visit date' },
      ],
    });
    textOnly = await publishForm(client, {
      title: `Theme text ${Date.now()}`,
      metadata: THEME,
      fields: [{ id: 'x1', key: 'name', type: 'text', label: 'Name' }],
    });
  });

  test.afterAll(async () => {
    await cleanup(client, themeForm);
    await cleanup(client, textOnly);
  });

  test('a theme form loads layout lines and picker.css, not the main stylesheet', async ({ page }) => {
    await page.goto(themeForm.url);
    await waitForForm(page);
    const sheets = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href));
    expect(sheets.some((href) => /build\/frontend\/picker\.css/.test(href))).toBe(true);
    expect(sheets.some((href) => /build\/frontend\/index\.jsx\.css/.test(href))).toBe(false);
    expect(await page.locator('style#subtleforms-frontend-layout-inline-css').count()).toBe(1);
  });

  test('a theme form with only text fields loads no picker.css', async ({ page }) => {
    await page.goto(textOnly.url);
    await waitForForm(page);
    const sheets = await page.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href));
    expect(sheets.some((href) => /picker\.css/.test(href))).toBe(false);
  });

  test('the dropdown on a theme form is drawn once: no native select beside the custom trigger (#109)', async ({ page }) => {
    await page.goto(themeForm.url);
    await waitForForm(page);
    const field = page.locator('.subtleforms-field', { has: page.locator('#subtleforms-field-topic') });
    const boxes = await field.evaluate((el) => [...el.querySelectorAll('select, .subtleforms-picker__trigger')].map((node) => {
      const r = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { tag: node.tagName, w: r.width, h: r.height, clipped: style.clip, position: style.position };
    }));
    const visible = boxes.filter((box) => box.w > 2 && box.h > 2);
    expect(visible).toHaveLength(1);
    expect(visible[0].tag).toBe('BUTTON');
  });

  test('the calendar on a theme form is a seven column grid', async ({ page }) => {
    await page.goto(themeForm.url);
    await waitForForm(page);
    await page.locator('#subtleforms-field-visit').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    const xs = await page.evaluate(() => [...document.querySelector('.subtleforms-picker__week').querySelectorAll('[role="gridcell"]')].map((c) => Math.round(c.getBoundingClientRect().x)));
    expect(new Set(xs).size).toBe(7);
  });
});

// ---- The control is a real input the theme styles --------------------------

let inputForm;

test.describe('the date, time and date and time control', () => {
  test.beforeAll(async () => {
    inputForm = await publishForm(client, {
      title: `Date input ${Date.now()}`,
      metadata: THEME,
      fields: [
        { id: 'i1', key: 'name', type: 'text', label: 'Name' },
        { id: 'i2', key: 'visit', type: 'date', label: 'Visit date', format: 'd/m/Y', required: true },
        { id: 'i3', key: 'slot', type: 'time', label: 'Slot', format: 'g:i A' },
        { id: 'i4', key: 'when', type: 'datetime', label: 'When', format: 'd/m/Y H:i' },
      ],
    });
  });

  test.afterAll(async () => {
    await cleanup(client, inputForm);
  });

  async function openInputForm(page) {
    await page.goto(inputForm.url);
    await waitForForm(page);
  }

  test('on a theme form the date input has the theme border of the text field beside it', async ({ page }) => {
    await openInputForm(page);
    const probe = (selector) => page.locator(selector).evaluate((el) => {
      const s = getComputedStyle(el);
      return { border: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor, radius: s.borderTopLeftRadius, font: s.fontFamily, size: s.fontSize, height: Math.round(el.getBoundingClientRect().height) };
    });
    const text = await probe('#subtleforms-field-name');
    for (const id of ['visit', 'slot', 'when']) {
      const input = await probe(`#subtleforms-field-${id}`);
      expect(input).toEqual(text);
    }
    await expect(page.locator('#subtleforms-field-visit')).toHaveJSProperty('tagName', 'INPUT');
  });

  test('the placeholder is the format example, the icon button sits inside the input', async ({ page }) => {
    await openInputForm(page);
    await expect(page.locator('#subtleforms-field-visit')).toHaveAttribute('placeholder', '13/11/2026');
    await expect(page.locator('#subtleforms-field-slot')).toHaveAttribute('placeholder', '2:30 PM');
    const geometry = await page.locator('.subtleforms-picker').first().evaluate((root) => {
      const input = root.querySelector('input.subtleforms-picker__input').getBoundingClientRect();
      const button = root.querySelector('.subtleforms-picker__open').getBoundingClientRect();
      return { inside: button.right <= input.right + 0.5 && button.left >= input.left && button.top >= input.top - 0.5 && button.bottom <= input.bottom + 0.5, w: Math.round(button.width), h: Math.round(button.height), inputH: Math.round(input.height) };
    });
    // 36 by 36, or as tall as the field when the theme makes inputs shorter.
    expect(geometry.inside).toBe(true);
    expect(geometry.w).toBe(36);
    expect(geometry.h).toBe(Math.min(36, geometry.inputH));
  });

  test('the popover is styled, buttons keep the picker look and not the theme button look', async ({ page }) => {
    await openInputForm(page);
    await page.locator('#subtleforms-field-visit').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    const look = await page.evaluate(() => {
      const menu = document.querySelector('.subtleforms-picker__menu');
      const today = [...document.querySelectorAll('.subtleforms-picker__text-button')].find((b) => /today/i.test(b.textContent));
      const submit = document.querySelector('.subtleforms-button-submit');
      const cells = [...document.querySelector('.subtleforms-picker__week').querySelectorAll('[role="gridcell"]')];
      return {
        surface: getComputedStyle(menu).backgroundColor,
        todayBg: getComputedStyle(today).backgroundColor,
        todayText: getComputedStyle(today).textTransform,
        themeButtonBg: getComputedStyle(submit).backgroundColor,
        columns: new Set(cells.map((c) => Math.round(c.getBoundingClientRect().x))).size,
        fontSize: getComputedStyle(menu).fontSize,
      };
    });
    expect(look.surface).toBe('rgb(255, 255, 255)');
    expect(look.columns).toBe(7);
    expect(look.fontSize).toBe('14px');
    expect(look.todayBg).toBe('rgba(0, 0, 0, 0)');
    if (look.themeButtonBg !== 'rgba(0, 0, 0, 0)') {
      expect(look.todayBg).not.toBe(look.themeButtonBg);
    }
    expect(look.todayText).toBe('none');
  });

  test('type a date, a time and a date and time, submit, and the entry holds the ISO values', async ({ page }) => {
    await openInputForm(page);
    await page.fill('#subtleforms-field-name', 'Typed');
    await page.fill('#subtleforms-field-visit', '13/11/2026');
    await page.locator('#subtleforms-field-slot').fill('2:30 pm');
    await page.locator('#subtleforms-field-slot').press('Enter');
    await expect(page.locator('#subtleforms-field-slot')).toHaveValue('2:30 PM');
    await page.fill('#subtleforms-field-when', '14/11/2026 09:05');
    await page.locator('#subtleforms-field-when').blur();
    await expect(page.locator('#subtleforms-field-when')).toHaveValue('14/11/2026 09:05');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    // A form sent within a few seconds of loading is dropped as a bot's.
    await page.waitForTimeout(4500);
    await page.click('.subtleforms-button-submit');
    await expect(page.locator('.subtleforms-success-message')).toBeVisible();
    await expect.poll(async () => (await entries(client, inputForm.id)).length, { timeout: 20000 }).toBe(1);
    const [entry] = await entries(client, inputForm.id);
    const payload = entry.payload || {};
    expect(payload.visit).toBe('2026-11-13');
    expect(payload.slot).toBe('14:30');
    expect(String(payload.when).replace(' ', 'T')).toBe('2026-11-14T09:05');
  });

  test('text that is not a date is flagged and the form does not submit', async ({ page }) => {
    await openInputForm(page);
    await page.fill('#subtleforms-field-visit', 'someday');
    await page.click('.subtleforms-button-submit');
    await expect(page.locator('#subtleforms-field-visit')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#subtleforms-field-visit')).toHaveValue('someday');
    await expect(page.locator('.subtleforms-success-message')).toHaveCount(0);
  });

  test('ArrowDown opens the calendar and Enter on a day writes it into the input', async ({ page }) => {
    await openInputForm(page);
    await page.locator('#subtleforms-field-visit').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="gridcell"][tabindex="0"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator('#subtleforms-field-visit')).toBeFocused();
    await expect(page.locator('#subtleforms-field-visit')).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

// ---- Limits, mobile, accessibility and Preview ------------------------------

let limitForm;

test.describe('limits, small screens, axe and Preview', () => {
  test.beforeAll(async () => {
    limitForm = await publishForm(client, {
      title: `Date limits ${Date.now()}`,
      metadata: THEME,
      fields: [
        { id: 'l1', key: 'visit', type: 'date', label: 'Visit date', config: { minDate: '+1 day', maxDate: '+10 days', disabledWeekdays: [0, 6] } },
        { id: 'l2', key: 'slot', type: 'time', label: 'Slot', config: { minTime: '09:00', maxTime: '17:00', minuteStep: 30 } },
        { id: 'l3', key: 'when', type: 'datetime', label: 'When' },
      ],
    });
  });

  test.afterAll(async () => {
    await cleanup(client, limitForm);
  });

  test('arrows skip days outside the earliest and latest date and on unavailable weekdays', async ({ page }) => {
    await page.goto(limitForm.url);
    await waitForForm(page);
    await page.locator('#subtleforms-field-visit').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    const focused = page.locator('[role="gridcell"][tabindex="0"]');
    await expect(focused).toBeFocused();
    // The focus starts on a day that can be picked, never on today.
    expect(await focused.getAttribute('aria-disabled')).toBeNull();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('ArrowRight');
      await expect(focused).toBeFocused();
      expect(await focused.getAttribute('aria-disabled')).toBeNull();
      const label = await focused.getAttribute('aria-label');
      expect(label).not.toMatch(/Saturday|Sunday/);
    }
    // Disabled days exist in the grid and carry aria-disabled.
    expect(await page.locator('[role="gridcell"][aria-disabled="true"]').count()).toBeGreaterThan(5);
  });

  test('no picker button takes the theme button fill, on a form that inherits the theme', async ({ page }) => {
    await page.goto(limitForm.url);
    await waitForForm(page);
    await page.locator('#subtleforms-field-when').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    const fills = await page.evaluate(() => [...document.querySelectorAll('.subtleforms-picker__open, .subtleforms-picker__nav, .subtleforms-picker__title, .subtleforms-picker__tick:not(.is-selected), .subtleforms-picker__text-button')]
      .map((b) => ({ cls: b.className, bg: getComputedStyle(b).backgroundColor })));
    expect(fills.length).toBeGreaterThan(10);
    for (const fill of fills) {
      expect(fill.bg, fill.cls).toBe('rgba(0, 0, 0, 0)');
    }
  });

  test('the times outside the range are disabled and the server names the range', async ({ page }) => {
    await page.goto(limitForm.url);
    await waitForForm(page);
    await page.locator('#subtleforms-field-slot').click();
    const hours = page.locator('[role="listbox"][aria-label="Hour"] [role="option"]');
    await expect(hours.nth(8)).toHaveAttribute('aria-disabled', 'true');
    await expect(hours.nth(9)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(hours.nth(18)).toHaveAttribute('aria-disabled', 'true');
    const minutes = page.locator('[role="listbox"][aria-label="Minute"] [role="option"]');
    await expect(minutes).toHaveCount(2);
    await page.keyboard.press('Escape');
    await page.locator('#subtleforms-field-slot').fill('20:00');
    await page.locator('#subtleforms-field-slot').blur();
    await page.waitForTimeout(4500);
    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.getByText('Pick a time between 09:00 and 17:00.')).toBeVisible();
  });

  test('at 390 wide the popover fits the column and has a close button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(limitForm.url);
    await waitForForm(page);
    await page.locator('#subtleforms-field-when').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const column = await page.locator('.subtleforms-form-container').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.width).toBeLessThanOrEqual(column.width + 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
    await expect(dialog.getByText('Time', { exact: true })).toBeVisible();
  });

  for (const [field, label] of [['visit', 'date'], ['slot', 'time'], ['when', 'date and time']]) {
    test(`axe finds nothing on the open ${label} popover`, async ({ page }) => {
      await page.goto(limitForm.url);
      await waitForForm(page);
      await page.locator(`#subtleforms-field-${field}`).click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      const results = await new AxeBuilder({ page })
        .include('.subtleforms-form-container')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) }))).toEqual([]);
    });
  }

  test('the Preview screen shows the styled picker for a theme form', async ({ page }) => {
    await loginPage(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openBuilder(page, limitForm.id);
    await page.locator('#sf-builder-view-preview').click();
    await page.locator('.sf-preview-workspace__form').waitFor({ timeout: 30000 });
    const frame = page.frameLocator('iframe.sf-form-preview__frame');
    await frame.locator('#subtleforms-field-when').waitFor();
    await frame.locator('#subtleforms-field-when').click();
    const dialog = frame.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    const look = await dialog.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, shadow: cs.boxShadow };
    });
    expect(look.bg).toBe('rgb(255, 255, 255)');
    expect(look.shadow).not.toBe('none');
    const xs = await frame.locator('.subtleforms-picker__week').first().locator('[role="gridcell"]').evaluateAll((cells) => cells.map((c) => Math.round(c.getBoundingClientRect().x)));
    expect(new Set(xs).size).toBe(7);
  });
});
