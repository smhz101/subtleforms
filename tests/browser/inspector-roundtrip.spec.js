/**
 * The field settings panel saves exactly what it saved before it became one
 * sheet of property rows. The same edits are made through the new panel
 * (label, help text, a choice, Width and Required from the quick rows, the
 * required message, a logic rule), the draft is saved and read back from the
 * REST API after a reload, and the fields are compared to the schema the
 * tabbed panel on main saved for the same edits.
 */
const { test, expect } = require('@playwright/test');
const fixture = require('./fixtures/inspector-roundtrip.schema.json');
const { adminApi, cleanup, loginPage, openBuilder, openPanel } = require('./helpers');

test('the settings panel saves the same schema as the tabbed panel did', async ({ page }) => {
  const client = await adminApi();
  const created = await client.call('POST', '/forms', { title: 'Inspector round trip' });
  const id = created.body.data.id;
  try {
    const fields = [
      { id: 'n1', key: 'name', type: 'text', label: 'Name' },
      {
        id: 'n2',
        key: 'topic',
        type: 'dropdown',
        label: 'Topic',
        options: [
          { label: 'Sales', value: 'sales' },
          { label: 'Support', value: 'support' },
        ],
      },
    ];
    const saved = await client.call('POST', `/forms/${id}/schema`, {
      activate: false,
      schema: { schema_version: 1, metadata: { type: 'regular', name: 'Inspector round trip', title: 'Inspector round trip' }, fields },
    });
    expect(saved.status).toBeLessThan(300);

    await loginPage(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openBuilder(page, id);
    await page.locator('.subtleforms-builder-canvas .sf-field-chrome', { hasText: 'Topic' }).first().click();
    const ins = page.locator('.sf-field-inspector');

    // Content: label and help text (every section starts closed).
    await openPanel(page, 'Content');
    await ins.getByLabel('Label', { exact: true }).fill('Topic of your message');
    await ins.getByLabel('Help text', { exact: true }).fill('We reply by email.');

    // Choices: add one and name it.
    await openPanel(page, 'Choices');
    await ins.getByRole('button', { name: 'Add choice' }).click();
    await ins.getByLabel('Option 3 label').fill('Other');

    // Quick rows: Width and Required.
    const quick = ins.locator('[data-section="quick"]');
    await quick.getByRole('radiogroup', { name: 'Width' }).getByRole('radio', { name: '½' }).check({ force: true });
    await quick.getByRole('checkbox', { name: 'Required' }).check();

    // Rules: the message shown when the field is left empty.
    await openPanel(page, 'Rules');
    await ins.getByLabel('If empty').fill('Pick a topic.');

    // Conditions: one condition, added from the section header.
    await openPanel(page, 'Logic');
    await ins.getByRole('button', { name: '+ Condition' }).click();
    await ins.getByLabel('Field', { exact: true }).selectOption('name');
    await ins.getByLabel('Condition').selectOption('not_empty');

    await page.locator('.sf-builder-header-bar__publish-arrow').click();
    await page.getByRole('menuitem', { name: /Save draft/ }).click();
    await expect(page.locator('.sf-builder-header-bar__save-status')).toHaveText(/^Saved$/, { timeout: 20000 });

    // Reload and read what was stored.
    await page.reload();
    const draft = (await client.call('GET', `/forms/${id}/schema?context=builder`)).body.data.schema.fields;
    expect(draft).toEqual(fixture);
  } finally {
    await cleanup(client, { id });
  }
});
