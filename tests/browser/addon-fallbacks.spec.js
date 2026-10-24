/**
 * Picture choice, several files per upload and advanced conditional logic are
 * provided by an add-on. Without it the plugin shows no locked tiles, badges,
 * upgrade links or modals, and keeps saved forms working.
 *
 * - Builder: there is no Picture choice tile. A saved picture choice keeps its
 *   place on the canvas with a neutral note.
 * - Builder: the upload field has no several-files setting at all; a field
 *   with advanced logic says the rules are ignored, with no link.
 * - Live form: a saved picture choice is a plain radio group, a saved
 *   multi-file upload takes one file, advanced logic is ignored (the field is
 *   shown) and the form still sends.
 *
 * Screenshots go to test-results/shots/addon-fallbacks at desktop and phone
 * widths.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, waitForForm, loginPage, openBuilder, openPanel, entries } = require('./helpers');

const SHOTS = path.join(process.cwd(), 'test-results', 'shots', 'addon-fallbacks');
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
    title: 'Add-on fallbacks',
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

test.describe('builder without the add-on', () => {
  for (const width of BUILDER_WIDTHS) {
    test(`no locked tiles or notes at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginPage(page);
      await openBuilder(page, form.id);

      // A saved picture choice keeps its place on the canvas, with a neutral note.
      await expect(page.locator('.sf-field-chrome')).toHaveCount(4);
      await expect(page.locator('.sf-field-chrome', { hasText: 'Pet' }).first()).toContainText(
        'provided by an add-on that is not active'
      );

      // The library has no Picture choice tile, no Pro badge and no lock.
      await page.locator('.sf-inserter__search-input').fill('picture');
      await expect(page.locator('.sf-inserter__item', { hasText: 'Picture' })).toHaveCount(0);
      await page.locator('.sf-inserter__search-input').fill('');
      await expect(page.locator('.sf-inserter__item.is-locked, .sf-inserter__item-pro')).toHaveCount(0);
      await expect(page.locator('.sf-upgrade-modal')).toHaveCount(0);

      // Upload field: no several-files setting and no note in its place.
      await page.locator('.sf-field-chrome', { hasText: 'Documents' }).first().click();
      await openPanel(page, 'Display');
      await expect(page.locator('.sf-field-inspector')).not.toContainText('several files');
      await expect(page.locator('.sf-field-inspector .sf-pro-notice')).toHaveCount(0);
      await page.screenshot({ path: path.join(SHOTS, `upload-settings-${width}.png`) });

      // On a tablet the settings panel covers the canvas: close it first.
      await page.getByRole('button', { name: 'Close settings' }).click();

      // Field with advanced logic: the rules are kept and named as ignored, no link.
      await page.locator('.sf-field-chrome', { hasText: 'Nickname' }).first().click();
      await page.getByRole('tab', { name: /Logic/ }).click();
      const editor = page.locator('.sf-field-inspector .sf-logic-editor');
      await expect(editor).toContainText('ignored');
      await expect(editor).not.toContainText(/Pro\b|upgrade/i);
      await expect(editor.locator('a')).toHaveCount(0);
      await page.screenshot({ path: path.join(SHOTS, `logic-note-${width}.png`) });

      // Nothing in the builder names a paid plugin or links to an upgrade.
      await expect(page.getByRole('link', { name: /Upgrade|Pro\b/ })).toHaveCount(0);
    });
  }
});

test.describe('saved form without the add-on', () => {
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

test.describe('lists without the add-on', () => {
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
