/**
 * UX2-14: the create dialog and Form settings describe the form name and
 * description in the same words, and offer the same form types.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage } = require('./helpers');

const SHOTS = process.env.SF_SHOTS || '/home/claude/dist/screens-2.5.0';
let client;
let formId = 0;

test.afterAll(async () => {
  if (formId) await cleanup(client, { id: formId });
});

test('the create dialog and Form settings agree on names, help and types', async ({ page }) => {
  client = await adminApi();
  await loginPage(page);
  await page.goto('/wp-admin/admin.php?page=subtleforms-new-form');
  await page.getByRole('button', { name: /blank/i }).first().click();
  const modal = page.locator('.sf-create-modal');
  await expect(modal).toBeVisible();

  // The help text a screen reader gets: the element the control is described by.
  const read = async (scope, label) => {
    const field = scope.getByLabel(label, { exact: true }).first();
    const describedBy = (await field.getAttribute('aria-describedby')) || '';
    const id = describedBy.split(' ')[0];
    if (!id) return '';
    return ((await page.locator(`[id="${id}"]`).first().textContent({ timeout: 5000 })) || '').trim();
  };

  const modalName = await read(modal, 'Form name');
  const modalDescription = await read(modal, 'Description');
  const modalTypes = (await modal.locator('.sf-structure__option strong').allTextContents()).map((t) => t.trim());
  await modal.screenshot({ path: `${SHOTS}/bugs-create-modal-wording.png` });
  expect(modalName).toBe('The name shown to you and your visitors.');
  expect(modalDescription).toBe('Shown under the title when the block or shortcode displays it.');
  expect(modalTypes).toEqual(['Standard', 'Multi-step', 'Conversational']);

  await modal.getByRole('button', { name: 'Create form' }).click();
  await page.waitForURL(/form_id=(\d+)/, { timeout: 30000 });
  formId = Number(new URL(page.url()).searchParams.get('form_id'));
  await page.locator('#sf-builder-view-settings').click();
  const settings = page.locator('.sf-form-settings').first();
  await expect(settings.getByLabel('Form name', { exact: true })).toBeVisible();

  expect(await read(settings, 'Form name')).toBe(modalName);
  expect(await read(settings, 'Description')).toBe(modalDescription);
  const settingsTypes = (await settings.locator('[role="radio"]').allTextContents()).map((t) => t.trim());
  expect(settingsTypes).toEqual(modalTypes);
  // A blank form made from the dialog's default is Standard in Form settings.
  await expect(settings.locator('[role="radio"][aria-checked="true"], [role="radio"][data-state="checked"]').first()).toHaveText('Standard');
  await page.screenshot({ path: `${SHOTS}/bugs-form-settings-wording.png` });
});
