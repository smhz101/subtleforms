/**
 * 2.9.0: Date, Time and Date & time fields. The calendar is a real seven
 * column grid, the pickers load their own stylesheet on a theme form, and the
 * control is a text input the theme styles. Each block below belongs to one
 * step of that work.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, waitForForm } = require('./helpers');

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
