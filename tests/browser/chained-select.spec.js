/**
 * FUN-01: Chained Select can be set up in the builder, and then works for a
 * visitor: required validation, submit, stored value.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, entries, loginPage, openBuilder, waitForForm } = require('./helpers');

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Chained select',
    fields: [{ id: 'c1', key: 'place', type: 'chained_select', label: 'Place', required: true }],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

test('set up dropdowns in the builder, then fill the field as a visitor', async ({ page }) => {
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('.sf-field-chrome').first().click();

  await page.getByRole('button', { name: 'Set up dropdowns' }).click();
  const modal = page.locator('.sf-chained-modal');
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Add the first dropdown' }).click();
  await modal.locator('.sf-chained-modal__paste').fill('Canada\n  Ontario\n  Quebec\nFrance\n  Paris');
  await modal.getByRole('button', { name: 'Replace dropdowns' }).click();
  if (process.env.SF_SHOT_DIR) await page.screenshot({ path: `${process.env.SF_SHOT_DIR}/chained-editor.png` });
  await modal.getByRole('button', { name: 'Close' }).first().click();
  await expect(modal).toBeHidden();

  // Update pushes the changes live.
  await page.locator('.sf-builder-header-bar__publish-button').click();
  await expect(page.locator('.sf-builder-header-bar__mode-badge')).toHaveText(/^Published$/, { timeout: 20000 });

  // Visitor: the field shows the first dropdown, not the "no options" text.
  await page.goto(form.url);
  await waitForForm(page);
  await expect(page.getByText('Options are added in the field settings.')).toHaveCount(0);
  const first = page.locator('.subtleforms-chained-select select').first();
  await expect(first).toBeVisible();

  // Required: sending with nothing chosen is blocked.
  await page.getByRole('button', { name: /submit|send/i }).click();
  await expect(page.locator('.subtleforms-form-container [role="alert"], .subtleforms-field-error, .subtleforms-error').first()).toBeVisible();
  expect(await entries(client, form.id)).toHaveLength(0);

  // Choose a parent, then its child, and submit.
  await first.selectOption({ label: 'Canada' });
  const second = page.locator('.subtleforms-chained-select select').nth(1);
  await expect(second.locator('option', { hasText: 'Ontario' })).toHaveCount(1);
  await expect(second.locator('option', { hasText: 'Paris' })).toHaveCount(0);
  await second.selectOption({ label: 'Ontario' });
  await page.getByRole('button', { name: /submit|send/i }).click();
  await expect.poll(async () => (await entries(client, form.id)).length, { timeout: 20000 }).toBe(1);

  const stored = (await entries(client, form.id))[0];
  expect(stored.payload.place).toEqual(['canada', 'ontario']);
});

/**
 * RFUN-02: a Chained Select with no dropdowns is hidden from visitors, is not
 * required, and the builder says so.
 */
test('a Chained Select that is not set up is hidden from visitors and does not block the form', async ({ page }) => {
  const bare = await publishForm(client, {
    title: 'Chained select not set up',
    fields: [
      { id: 'n1', key: 'name', type: 'text', label: 'Your name' },
      { id: 'c2', key: 'place', type: 'chained_select', label: 'Place', required: true },
    ],
  });
  try {
    await loginPage(page);
    await openBuilder(page, bare.id);
    await page.locator('.sf-field-chrome').nth(1).click();
    const warning = page.getByText('The dropdowns are not set up yet. Visitors will not see this field until you add them.').first();
    await expect(warning).toBeVisible();
    if (process.env.SF_SHOT_DIR) await page.screenshot({ path: `${process.env.SF_SHOT_DIR}/chained-warning.png` });

    await page.goto(bare.url);
    await waitForForm(page);
    await expect(page.getByText('Options are added in the field settings.')).toHaveCount(0);
    await expect(page.locator('.subtleforms-chained-select')).toHaveCount(0);
    await expect(page.getByText('Place')).toHaveCount(0);
    if (process.env.SF_SHOT_DIR) await page.screenshot({ path: `${process.env.SF_SHOT_DIR}/chained-visitor-unset.png` });

    await page.getByLabel('Your name').fill('Ada');
    await page.getByRole('button', { name: /submit|send/i }).click();
    await expect.poll(async () => (await entries(client, bare.id)).length, { timeout: 20000 }).toBe(1);
    expect((await entries(client, bare.id))[0].payload.place).toBeUndefined();
  } finally {
    await cleanup(client, bare);
  }
});
