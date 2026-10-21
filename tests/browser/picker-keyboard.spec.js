/**
 * FLD2-04, FLD2-05, FLD2-06: the date, time and country pickers work from
 * the keyboard on the live form, name the active option to a screen reader
 * and pass axe while open.
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { adminApi, publishForm, cleanup, waitForForm } = require('./helpers');

const SHOTS = process.env.SF_SHOTS || 'test-results/shots/bugs250';
require('fs').mkdirSync(SHOTS, { recursive: true });
let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Picker keyboard',
    fields: [
      { id: 'k1', key: 'when_time', type: 'time', label: 'Pick a time', required: true, format: 'H:i' },
      { id: 'k2', key: 'when_both', type: 'datetime', label: 'Pick a date and time', required: true },
      { id: 'k3', key: 'where', type: 'country', label: 'Where do you live', required: true },
      { id: 'k4', key: 'when_date', type: 'date', label: 'Pick a date', required: true },
    ],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

async function open(page) {
  await page.goto(form.url);
  await waitForForm(page);
}

async function axeOpen(page) {
  const results = await new AxeBuilder({ page })
    .include('.subtleforms-form-container')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => ({ id: v.id, targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
}

test('the time picker is usable from the keyboard only', async ({ page }) => {
  await open(page);
  const trigger = page.locator('#subtleforms-field-when_time');
  await expect(trigger).toHaveAttribute('aria-required', 'true');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  // Focus is already inside, on the hour column.
  await expect(page.locator('[role="listbox"][aria-label="Hour"] [tabindex="0"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('02:');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[role="listbox"][aria-label="Minute"] [tabindex="0"]')).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Space');
  await expect(trigger).toContainText('02:59');
  await page.screenshot({ path: `${SHOTS}/bugs-time-picker-keyboard-focus.png`, clip: await clipOf(page, trigger, dialog) });
  expect(await axeOpen(page)).toEqual([]);
  // Tab order inside the dialog: hour, minute, Clear.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Clear' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

async function clipOf(page, trigger, dialog) {
  const a = await trigger.boundingBox();
  const b = await dialog.boundingBox();
  const x = Math.max(0, Math.min(a.x, b.x) - 16);
  const y = Math.max(0, a.y - 16);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x + 16, height: b.y + b.height - y + 16 };
}

test('the date and time picker moves focus into the calendar and back on Escape', async ({ page }) => {
  await open(page);
  const trigger = page.locator('#subtleforms-field-when_both');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await expect(page.locator('[role="gridcell"][tabindex="0"]')).toBeFocused();
  const before = await page.locator('[role="gridcell"][tabindex="0"]').getAttribute('aria-label');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[role="gridcell"][tabindex="0"]')).toBeFocused();
  expect(await page.locator('[role="gridcell"][tabindex="0"]').getAttribute('aria-label')).not.toBe(before);
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText(/\d/);
  // The dialog stays open to set the time; one Tab leaves the calendar grid for the hours.
  await page.keyboard.press('Tab');
  await expect(page.locator('[role="listbox"][aria-label="Hour"] [tabindex="0"]')).toBeFocused();
  await page.screenshot({ path: `${SHOTS}/bugs-datetime-picker-keyboard-focus.png`, clip: await clipOf(page, trigger, dialog) });
  expect(await axeOpen(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('Country search names the active option and Escape returns to the trigger', async ({ page }) => {
  await open(page);
  const trigger = page.locator('#subtleforms-field-where');
  await expect(trigger).toHaveAttribute('aria-required', 'true');
  await trigger.focus();
  await page.keyboard.press('Enter');
  const search = page.locator('.subtleforms-picker__search');
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute('role', 'combobox');
  await page.keyboard.type('united');
  const active = await search.getAttribute('aria-activedescendant');
  expect(active).toBeTruthy();
  await expect(page.locator(`#${active}`)).toContainText('United');
  await page.keyboard.press('ArrowDown');
  const next = await search.getAttribute('aria-activedescendant');
  expect(next).not.toBe(active);
  await page.screenshot({ path: `${SHOTS}/bugs-country-search-combobox.png`, clip: await clipOf(page, trigger, page.locator('.subtleforms-picker__menu')) });
  expect(await axeOpen(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(search).toBeHidden();
  await expect(trigger).toBeFocused();
  // Picking with Enter also lands back on the trigger.
  await page.keyboard.press('Enter');
  await page.keyboard.type('fra');
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('France');
  await expect(trigger).toBeFocused();
});

test('every picker passes axe when required and closed, and after a failed submit', async ({ page }) => {
  await open(page);
  await page.click('.subtleforms-button-submit');
  await expect(page.locator('.subtleforms-error[role="alert"]').first()).toBeVisible();
  expect(await axeOpen(page)).toEqual([]);
  // The first invalid control takes focus.
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-invalid'))).toBe('true');
});
