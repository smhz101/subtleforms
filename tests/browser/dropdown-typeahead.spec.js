/**
 * Issue 146: a Dropdown jumps to the option you type, and a list with more
 * than 15 options has a search box.
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');
const { adminApi, publishForm, cleanup, waitForForm } = require('./helpers');

// Screenshots are written only when a folder is given, so CI writes none.
const SHOTS = process.env.SF_SHOTS_DIR || '';

const big = Array.from({ length: 500 }, (_, i) => ({ label: `Option ${i + 1}`, value: `option-${i + 1}` }));
const branches = ['Lahore', 'Karachi', 'Islamabad', 'Peshawar', 'Quetta', 'Multan', 'Faisalabad', 'Sialkot', 'Gujranwala', 'Hyderabad', 'Rawalpindi', 'Sukkur']
  .map((city) => ({ label: `Branch ${city}`, value: city.toLowerCase() }));

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Dropdown type-ahead',
    fields: [
      { id: 'd1', key: 'big', type: 'select', label: 'Big list', options: big },
      { id: 'd2', key: 'branch', type: 'select', label: 'Branch', options: branches },
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

test('a 500-option list opens with a search box that takes typed text and Enter picks', async ({ page }) => {
  await open(page);
  const trigger = page.locator('#subtleforms-field-big');
  await trigger.focus();
  await page.keyboard.type('Option 37');
  const search = page.locator('.subtleforms-picker__search');
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('Option 37');
  await expect(page.locator('[data-active="true"]')).toHaveText('Option 37');
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('Option 37');
  await expect(page.locator('select[name="big"]')).toHaveValue('option-37');
  await expect(trigger).toBeFocused();
});

test('the search box has no axe violations and can be photographed', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.locator('#subtleforms-field-big').click();
  await expect(page.locator('.subtleforms-picker__search')).toBeFocused();
  await page.keyboard.type('Option 4');
  await expect(page.locator('[role="option"]').first()).toHaveText('Option 4');
  const results = await new AxeBuilder({ page })
    .include('.subtleforms-form-container')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    const box = await page.locator('.subtleforms-form-container').boundingBox();
    await page.screenshot({
      path: path.join(SHOTS, 'dropdown-search-open.png'),
      clip: { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 24), width: Math.min(1440, box.width + 48), height: Math.min(900, box.height + 48) },
    });
  }
});

test('Escape closes the search and gives focus back to the trigger', async ({ page }) => {
  await open(page);
  const trigger = page.locator('#subtleforms-field-big');
  await trigger.click();
  await page.keyboard.type('zzzz');
  await expect(page.locator('.subtleforms-picker__empty')).toHaveText('No options match that search.');
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="listbox"]')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('a 12-option list has no search box and typing jumps to the option', async ({ page }) => {
  await open(page);
  const trigger = page.locator('#subtleforms-field-branch');
  await trigger.focus();
  await page.keyboard.type('Branch Kar');
  await expect(page.locator('.subtleforms-picker__search')).toHaveCount(0);
  await expect(page.locator('[data-active="true"]')).toHaveText('Branch Karachi');
  await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-1$/);
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('Branch Karachi');
  await expect(page.locator('select[name="branch"]')).toHaveValue('karachi');
});
