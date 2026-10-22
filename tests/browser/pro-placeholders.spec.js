/**
 * 2.7.0: picture choice, several files per upload, advanced conditional logic
 * and form analytics moved to SubtleForms Pro. Without Pro the plugin shows
 * Pro placeholders in the builder and keeps saved forms working.
 *
 * - Builder: the Picture choice tile is badged Pro and opens the upgrade
 *   modal; it adds nothing to the form.
 * - Builder: the upload field shows a Pro note instead of "allow several
 *   files"; a field with advanced logic shows the Pro note.
 * - Live form: a saved picture choice is a plain radio group, a saved
 *   multi-file upload takes one file, advanced logic is ignored (the field is
 *   shown) and the form still sends.
 *
 * Screenshots go to test-results/shots/pro-placeholders at desktop and phone
 * widths.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, waitForForm, loginPage, openBuilder, openPanel, entries } = require('./helpers');

const SHOTS = path.join(process.cwd(), 'test-results', 'shots', 'pro-placeholders');
const WIDTHS = [1280, 390];
// The builder itself asks for a wider screen below 782px, so it is checked at
// desktop and tablet width; the live form is checked at desktop and phone.
const BUILDER_WIDTHS = [1280, 782];

let client;
let form;

test.beforeAll(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Moved to Pro',
    fields: [
      { id: 'p1', key: 'name', type: 'text', label: 'Name' },
      {
        id: 'p2',
        key: 'pet',
        type: 'picture_choice',
        label: 'Pet',
        options: [
          { label: 'Cat', value: 'cat', image: 'https://example.com/cat.png' },
          { label: 'Dog', value: 'dog', image: 'https://example.com/dog.png' },
        ],
      },
      { id: 'p3', key: 'docs', type: 'file_upload', label: 'Documents', multiple: true, maxFiles: 5 },
      {
        id: 'p4',
        key: 'nickname',
        type: 'text',
        label: 'Nickname',
        logic: {
          action: 'show',
          groups: [{ match: 'any', rules: [{ field: 'name', operator: 'starts_with', value: 'Zz' }] }],
        },
      },
    ],
  });
});

test.afterAll(async () => {
  if (form) {
    await cleanup(client, form);
  }
});

test.describe('builder placeholders', () => {
  for (const width of BUILDER_WIDTHS) {
    test(`Pro tiles and notes at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginPage(page);
      await openBuilder(page, form.id);

      // A saved picture choice keeps its place on the canvas.
      await expect(page.locator('.sf-field-chrome')).toHaveCount(4);

      // The palette tile: badged, locked, opens the modal, adds nothing.
      const tile = page.locator('.sf-inserter__item', { hasText: 'Picture choice' }).first();
      if (!(await tile.isVisible().catch(() => false))) {
        await page.locator('.sf-inserter__search-input').fill('picture');
      }
      await expect(tile).toBeVisible();
      await expect(tile.locator('.sf-inserter__item-pro')).toHaveText('Pro');
      await tile.click();
      await expect(page.locator('.sf-upgrade-modal')).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS, `upgrade-modal-${width}.png`) });
      await page.keyboard.press('Escape');
      await expect(page.locator('.sf-field-chrome')).toHaveCount(4);

      // Upload field: a Pro note in place of the several-files setting.
      await page.locator('.sf-field-chrome', { hasText: 'Documents' }).first().click();
      await openPanel(page, 'Display');
      const note = page.locator('.sf-field-inspector .sf-pro-notice[data-feature="uploads.multiple"]');
      await expect(note).toBeVisible();
      await expect(note.locator('.sf-pro-tag')).toBeVisible();
      await expect(note.locator('.sf-pro-link')).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS, `upload-note-${width}.png`) });

      // On a tablet the settings panel covers the canvas: close it first.
      await page.getByRole('button', { name: 'Close settings' }).click();

      // Field with advanced logic: the Logic tab says it is a Pro option.
      await page.locator('.sf-field-chrome', { hasText: 'Nickname' }).first().click();
      await page.getByRole('tab', { name: /Logic/ }).click();
      const pro = page.locator('.sf-logic-editor__pro');
      await expect(pro).toBeVisible();
      await expect(pro).toContainText('More ways to match');
      await page.screenshot({ path: path.join(SHOTS, `logic-note-${width}.png`) });
    });
  }
});

test.describe('saved form without Pro', () => {
  for (const width of WIDTHS) {
    test(`renders and sends at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(form.url);
      await waitForForm(page);

      // Picture choice is a plain radio group.
      const radios = page.locator('input[type="radio"][name="pet"]');
      await expect(radios).toHaveCount(2);
      await expect(page.locator('.subtleforms-picture-choice, .sf-field-renderer__picture')).toHaveCount(0);

      // Several files: one file input that takes one file.
      const upload = page.locator('input[type="file"]').first();
      await expect(upload).not.toHaveAttribute('multiple', /.*/);

      // Advanced logic is ignored: the field is shown.
      await expect(page.locator('#subtleforms-field-nickname')).toBeVisible();

      await page.fill('#subtleforms-field-name', 'Ada');
      await page.locator('label[for="subtleforms-field-pet-1"]').click();
      await page.screenshot({ path: path.join(SHOTS, `live-form-${width}.png`), fullPage: true });
    });
  }

  test('the server keeps an answer to the plain radio group', async ({ page }) => {
    await page.goto(form.url);
    await waitForForm(page);
    await page.fill('#subtleforms-field-name', 'Ada');
    await page.fill('#subtleforms-field-nickname', 'Ad');
    await page.locator('label[for="subtleforms-field-pet-1"]').click();
    // The default minimum time between loading and sending is 3 seconds.
    await page.waitForTimeout(3200);
    await page.click('.subtleforms-button-submit');
    await expect(page.locator('.subtleforms-success-message')).toBeVisible();
    const [entry] = await entries(client, form.id);
    expect(entry.payload.pet).toBe('dog');
    expect(entry.payload.nickname).toBe('Ad');
  });
});

test.describe('lists without Pro', () => {
  test('the Forms list has no conversion column and no toggle for one', async ({ page }) => {
    await loginPage(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
    await expect(page.locator('thead th', { hasText: 'Form Name' })).toBeVisible({ timeout: 30000 });
    await expect(page.locator('thead th', { hasText: 'Conversion' })).toHaveCount(0);
    await page.getByRole('button', { name: 'View' }).click();
    await expect(page.locator('.sf-col-picker__item', { hasText: 'Entries' })).toBeVisible();
    await expect(page.locator('.sf-col-picker__item', { hasText: 'Conversion' })).toHaveCount(0);
  });
});
