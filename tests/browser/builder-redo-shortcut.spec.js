/**
 * Issue 146 (part b): Cmd/Ctrl+Shift+Z and Ctrl+Y redo in the builder, also
 * right after an undo while the draft autosave is running.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, openBuilder } = require('./helpers');

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

async function draftForm(title) {
  const res = await client.call('POST', '/forms', { title });
  const id = res.body.data.id;
  const fields = [1, 2].map((n) => ({
    id: `f${n}`,
    key: `f${n}`,
    type: 'text',
    label: `Field ${n}`,
  }));
  const saved = await client.call('POST', `/forms/${id}/schema`, {
    activate: false,
    schema: { schema_version: 1, metadata: { type: 'regular', name: title, title }, fields },
  });
  if (saved.status >= 300) throw new Error(JSON.stringify(saved.body).slice(0, 400));
  const form = { id };
  created.push(form);
  return form;
}

const canvasFields = (page) => page.locator('.sf-field-chrome');

async function addTextField(page) {
  await page.locator('.sf-inserter__item', { hasText: /^Text$|Single line|Text Input/ }).first().click();
}

async function focusCanvas(page) {
  // Move focus off any input so the typing-target guard does not apply.
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
}

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

async function openAndAdd(page, title) {
  const form = await draftForm(title);
  await loginPage(page);
  await openBuilder(page, form.id);
  await expect(canvasFields(page)).toHaveCount(2);
  await addTextField(page);
  await expect(canvasFields(page)).toHaveCount(3);
  // Let the edit settle into history (batch window).
  await page.waitForTimeout(500);
  await focusCanvas(page);
  return form;
}

test('Ctrl+Z undoes and Ctrl+Shift+Z redoes an added field', async ({ page }) => {
  await openAndAdd(page, 'Redo shift');
  await page.keyboard.press(`${MOD}+z`);
  await expect(canvasFields(page)).toHaveCount(2);
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect(canvasFields(page)).toHaveCount(3);
});

test('Ctrl+Z undoes and Ctrl+Y redoes an added field', async ({ page }) => {
  await openAndAdd(page, 'Redo y');
  await page.keyboard.press('Control+z');
  await expect(canvasFields(page)).toHaveCount(2);
  await page.keyboard.press('Control+y');
  await expect(canvasFields(page)).toHaveCount(3);
});

test('redo works when pressed within 300 ms of the undo', async ({ page }) => {
  await openAndAdd(page, 'Redo fast');
  await page.keyboard.press(`${MOD}+z`);
  await page.waitForTimeout(100);
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect(canvasFields(page)).toHaveCount(3);
});

test('redo works 3 seconds after the undo', async ({ page }) => {
  await openAndAdd(page, 'Redo slow');
  await page.keyboard.press(`${MOD}+z`);
  await expect(canvasFields(page)).toHaveCount(2);
  await page.waitForTimeout(3000);
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect(canvasFields(page)).toHaveCount(3);
});

/**
 * Hold every draft save for a while, so the builder stays in "saving" long
 * enough to press keys. Returns a function that lets the held saves through.
 */
async function holdSaves(page) {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let started = 0;
  await page.route(
    (url) => /\/forms\/\d+\/schema/.test(decodeURIComponent(url.href)),
    async (route) => {
      if (route.request().method() === 'POST') {
        started += 1;
        await gate;
      }
      await route.continue();
    }
  );
  return { release, started: () => started };
}

// The page flushes a dirty draft when the window loses focus.
async function flushAutosave(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
}

test('redo works while an autosave is in flight', async ({ page }) => {
  await openAndAdd(page, 'Redo during save');
  // A second field, then undo it: the draft (3 fields) still differs from
  // what the server holds (2), so the autosave sends a real request.
  await addTextField(page);
  await expect(canvasFields(page)).toHaveCount(4);
  await page.waitForTimeout(500);
  await focusCanvas(page);
  await page.keyboard.press(`${MOD}+z`);
  await expect(canvasFields(page)).toHaveCount(3);
  const saves = await holdSaves(page);
  await flushAutosave(page);
  await expect.poll(() => saves.started()).toBe(1);
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect(canvasFields(page)).toHaveCount(4);
  saves.release();
});

test('undo works while an autosave is in flight', async ({ page }) => {
  await openAndAdd(page, 'Undo during save');
  const saves = await holdSaves(page);
  await flushAutosave(page);
  await expect.poll(() => saves.started()).toBe(1);
  await page.keyboard.press(`${MOD}+z`);
  await expect(canvasFields(page)).toHaveCount(2);
  saves.release();
});

test('an autosave that finishes keeps the redo history', async ({ page }) => {
  await openAndAdd(page, 'Redo after save');
  await page.keyboard.press(`${MOD}+z`);
  await expect(canvasFields(page)).toHaveCount(2);
  await flushAutosave(page);
  await expect(page.locator('.sf-builder-header-bar__save-status')).toHaveText(/^Saved$/, {
    timeout: 20000,
  });
  await page.keyboard.press(`${MOD}+Shift+z`);
  await expect(canvasFields(page)).toHaveCount(3);
});
