/**
 * QA-10: selecting a nested child opens the child's own inspector, for every
 * container type, with pointer and keyboard; the parent stays selectable.
 *
 * QA-09 (owner report): fields can be dragged from the library and from the
 * canvas into a Repeater, Group and Columns, and out again; only the
 * container's handle drags the container; the keyboard "Move to" menu does
 * the same.
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

async function draftForm(title, fields) {
  const res = await client.call('POST', '/forms', { title });
  const id = res.body.data.id;
  const saved = await client.call('POST', `/forms/${id}/schema`, {
    activate: false,
    schema: { schema_version: 1, metadata: { type: 'regular', name: title, title }, fields },
  });
  if (saved.status >= 300) throw new Error(JSON.stringify(saved.body).slice(0, 400));
  created.push({ id });
  return { id };
}

async function draftFields(id) {
  const res = await client.call('GET', `/forms/${id}/schema?context=builder`);
  return res.body.data.schema.fields;
}

async function saveDraft(page) {
  await page.locator('.sf-builder-header-bar__publish-arrow').click();
  await page.getByRole('menuitem', { name: /Save draft/ }).click();
  await expect(page.locator('.sf-builder-header-bar__save-status')).toHaveText(/^Saved$/, { timeout: 20000 });
}

const CONTAINERS = [
  {
    name: 'Repeater',
    field: {
      id: 'rep',
      key: 'companies',
      type: 'repeat_container',
      label: 'Companies',
      min: 1,
      max: 3,
      buttonLabel: 'Add another company',
      children: [
        { id: 'ticker', key: 'ticker', type: 'text', label: 'Ticker' },
        { id: 'shares', key: 'shares', type: 'number', label: 'Number of shares' },
      ],
    },
    child: 'Number of shares',
  },
  {
    name: 'Group',
    field: {
      id: 'grp',
      key: 'grp',
      type: 'group_container',
      label: 'Billing',
      children: [{ id: 'city', key: 'city', type: 'text', label: 'City name' }],
    },
    child: 'City name',
  },
  {
    name: 'Columns',
    field: {
      id: 'cols',
      key: 'cols',
      type: 'two_column_container',
      columns: [[{ id: 'left', key: 'left', type: 'text', label: 'Left field' }], [{ id: 'right', key: 'right', type: 'email', label: 'Right email' }]],
    },
    child: 'Right email',
  },
  {
    name: '3 Columns',
    field: {
      id: 'cols3',
      key: 'cols3',
      type: 'three_column_container',
      columns: [
        [{ id: 'c3a', key: 'c3a', type: 'text', label: 'First third' }],
        [{ id: 'c3b', key: 'c3b', type: 'number', label: 'Middle number' }],
        [{ id: 'c3c', key: 'c3c', type: 'text', label: 'Last third' }],
      ],
    },
    child: 'Middle number',
  },
  {
    name: '4 Columns',
    field: {
      id: 'cols4',
      key: 'cols4',
      type: 'four_column_container',
      columns: [
        [{ id: 'c4a', key: 'c4a', type: 'text', label: 'Quarter one' }],
        [{ id: 'c4b', key: 'c4b', type: 'text', label: 'Quarter two' }],
        [{ id: 'c4c', key: 'c4c', type: 'text', label: 'Quarter three' }],
        [{ id: 'c4d', key: 'c4d', type: 'email', label: 'Quarter email' }],
      ],
    },
    child: 'Quarter email',
  },
  {
    name: 'Group inside a Repeater',
    field: {
      id: 'rep2',
      key: 'holdings',
      type: 'repeat_container',
      label: 'Holdings',
      children: [
        {
          id: 'inner',
          key: 'inner',
          type: 'group_container',
          label: 'Inner group',
          children: [{ id: 'isin', key: 'isin', type: 'text', label: 'ISIN code' }],
        },
      ],
    },
    child: 'ISIN code',
  },
];

const inspectorTitle = (page) => page.locator('.sf-field-inspector__title');
const inspectorKey = (page) => page.locator('.sf-field-inspector__key code');

for (const container of CONTAINERS) {
  test(`${container.name}: click and Enter on a child open the child's inspector (QA-10)`, async ({ page }) => {
    const form = await draftForm(`QA-10 ${container.name}`, [container.field]);
    await loginPage(page);
    await openBuilder(page, form.id);

    const childChrome = page.locator('.sf-field-chrome', { hasText: container.child });
    await childChrome.click();
    await expect(childChrome).toHaveClass(/is-selected/);
    await expect(inspectorTitle(page)).not.toHaveText(/Repeat|Group|Column/i);
    // Every input-like child has Validation and Logic tabs.
    await expect(page.getByRole('tab', { name: /Validation/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Logic/ })).toBeVisible();
    await page.getByRole('tab', { name: /Validation/ }).click();
    await expect(page.locator('.sf-field-inspector__tab-content')).toBeVisible();

    // Keyboard: focus another child (or the same one after deselecting) and press Enter.
    await page.keyboard.press('Escape');
    await childChrome.focus();
    await page.keyboard.press('Enter');
    await expect(childChrome).toHaveClass(/is-selected/);
    await expect(inspectorTitle(page)).not.toHaveText(/Repeat|Group|Column/i);

    // The parent stays selectable on its own header.
    await page.locator('.sf-container-renderer__header', { hasText: container.field.label || 'Column' }).first().click();
    await expect(inspectorKey(page)).toHaveText(container.field.key);
    if (container.name === 'Repeater') {
      await page.screenshot({ path: '/home/claude/shots/free231/qa10-repeater-parent.png' });
      await childChrome.click();
      await page.screenshot({ path: '/home/claude/shots/free231/qa10-repeater-child-inspector.png' });
    }
  });
}

test('editing a child does not change the parent (QA-10)', async ({ page }) => {
  const form = await draftForm('QA-10 edit child', [CONTAINERS[0].field]);
  await loginPage(page);
  await openBuilder(page, form.id);
  await page.locator('.sf-field-chrome', { hasText: 'Number of shares' }).click();
  await page.getByRole('tab', { name: /Validation/ }).click();
  await page.getByRole('checkbox', { name: /Required/ }).first().check();
  await saveDraft(page);
  const [rep] = await draftFields(form.id);
  expect(rep.label).toBe('Companies');
  expect(rep.required).toBeFalsy();
  expect(rep.children.find((c) => c.key === 'shares').required).toBe(true);
});

async function dragTo(page, source, target, { offsetY = 0 } = {}) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + offsetY, { steps: 20 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

test('drag from the library into a Repeater, and a canvas field into and out of it (QA-09)', async ({ page }) => {
  const form = await draftForm('QA-09 dnd', [
    { id: 'a', key: 'a', type: 'text', label: 'Outside field' },
    { id: 'rep', key: 'rep', type: 'repeat_container', label: 'Companies', min: 1, max: 3, children: [] },
    { id: 'b', key: 'b', type: 'email', label: 'Last field' },
  ]);
  await loginPage(page);
  await openBuilder(page, form.id);

  const repZone = page.locator('.sf-container-renderer', { hasText: 'Companies' }).locator('.sf-column-dropzone').first();

  // Library tile -> empty Repeater drop zone. The zone highlights while over it.
  const tile = page.locator('.sf-inserter__item', { hasText: /^Number$/ }).first();
  const from = await tile.boundingBox();
  const to = await repZone.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await expect(repZone).toHaveClass(/is-over/);
  await page.screenshot({ path: '/home/claude/shots/free231/qa09-drop-highlight.png' });
  await page.mouse.up();
  await expect(repZone.locator('.sf-field-chrome')).toHaveCount(1);

  // Canvas field -> Repeater (by its drag handle).
  const outside = page.locator('.sf-field-chrome', { hasText: 'Outside field' });
  await outside.hover();
  await dragTo(page, outside.locator('.sf-field-toolbar__button--drag'), repZone);
  await expect(repZone.locator('.sf-field-chrome')).toHaveCount(2);

  // Out again: drag the child below the last field.
  const child = repZone.locator('.sf-field-chrome', { hasText: 'Outside field' });
  await child.hover();
  await dragTo(page, child.locator('.sf-field-toolbar__button--drag'), page.locator('.sf-field-chrome', { hasText: 'Last field' }), { offsetY: 12 });
  await expect(repZone.locator('.sf-field-chrome')).toHaveCount(1);

  await saveDraft(page);
  const fields = await draftFields(form.id);
  expect(fields.map((f) => f.key)).toEqual(['rep', 'b', 'a']);
  expect(fields[0].children.map((c) => c.type)).toEqual(['number']);
});

test('drops into a Group, a column and a nested Group highlight only the zone that takes them', async ({ page }) => {
  const form = await draftForm('QA-09 dnd groups', [
    { id: 'a', key: 'a', type: 'text', label: 'Loose field' },
    { id: 'grp', key: 'grp', type: 'group_container', label: 'Billing', children: [] },
    {
      id: 'cols',
      key: 'cols',
      type: 'two_column_container',
      columns: [[{ id: 'l', key: 'l', type: 'text', label: 'Left one' }], []],
    },
    {
      id: 'outer',
      key: 'outer',
      type: 'repeat_container',
      label: 'Outer repeater',
      children: [{ id: 'inner', key: 'inner', type: 'group_container', label: 'Inner group', children: [] }],
    },
  ]);
  // Tall enough that the canvas does not auto-scroll under the pointer.
  await page.setViewportSize({ width: 1440, height: 1500 });
  await loginPage(page);
  await openBuilder(page, form.id);

  // Library -> Group.
  const groupZone = page.locator('.sf-container-renderer', { hasText: 'Billing' }).locator('.sf-column-dropzone').first();
  await dragTo(page, page.locator('.sf-inserter__item', { hasText: /^Email$/ }).first(), groupZone);
  await expect(groupZone.locator('.sf-field-chrome')).toHaveCount(1);

  // Canvas field -> second column.
  const colZone = page.locator('[data-dropzone="cols-col-1"]');
  const loose = page.locator('.sf-field-chrome', { hasText: 'Loose field' });
  await loose.hover();
  await dragTo(page, loose.locator('.sf-field-toolbar__button--drag'), colZone);
  await expect(colZone.locator('.sf-field-chrome', { hasText: 'Loose field' })).toHaveCount(1);

  // Nested: over the inner Group only the inner zone is highlighted.
  const innerZone = page.locator('[data-dropzone="inner-root"]');
  const outerZone = page.locator('[data-dropzone="outer-root"]');
  const tile = page.locator('.sf-inserter__item', { hasText: /^Number$/ }).first();
  const from = await tile.boundingBox();
  const to = await innerZone.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 });
  await expect(innerZone).toHaveClass(/is-over/);
  await expect(outerZone).not.toHaveClass(/is-over/);
  await page.screenshot({ path: '/home/claude/shots/free231/qa09-nested-drop-highlight.png' });
  await page.mouse.up();
  await expect(innerZone.locator('.sf-field-chrome')).toHaveCount(1);

  await saveDraft(page);
  const fields = await draftFields(form.id);
  expect(fields.map((f) => f.key)).toEqual(['grp', 'cols', 'outer']);
  expect(fields[0].children.map((c) => c.type)).toEqual(['email']);
  expect(fields[1].columns[1].map((c) => c.key)).toEqual(['a']);
  expect(fields[2].children[0].children.map((c) => c.type)).toEqual(['number']);
});

test('pressing on the Repeater body does not drag it; its handle does (QA-09)', async ({ page }) => {
  const form = await draftForm('QA-09 handle', [
    { id: 'rep', key: 'rep', type: 'repeat_container', label: 'Companies', children: [{ id: 't', key: 't', type: 'text', label: 'Ticker' }] },
    { id: 'z', key: 'z', type: 'text', label: 'Zed' },
  ]);
  await loginPage(page);
  await openBuilder(page, form.id);
  const container = page.locator('.sf-container-renderer', { hasText: 'Companies' });
  // Drag starting on the container body (not the handle) moves nothing.
  await dragTo(page, container.locator('.sf-container-renderer__header-title'), page.locator('.sf-field-chrome', { hasText: 'Zed' }), { offsetY: 12 });
  // Nothing moved and nothing changed.
  await expect(page.locator('.sf-builder-header-bar__save-status')).toHaveText('Saved');
  const order = await page.locator('[data-dropzone="root-root"] > .sf-column-dropzone__items > .sf-column-dropzone__item').allInnerTexts();
  expect(order[0]).toContain('Companies');
  let fields;
  // The handle moves it.
  await dragTo(page, container.getByRole('button', { name: 'Drag container' }), page.locator('.sf-field-chrome', { hasText: 'Zed' }), { offsetY: 12 });
  await saveDraft(page);
  fields = await draftFields(form.id);
  expect(fields.map((f) => f.key)).toEqual(['z', 'rep']);
});

test('keyboard: Move to menu moves a field into and out of a container (QA-09)', async ({ page }) => {
  const form = await draftForm('QA-09 keyboard', [
    { id: 'a', key: 'a', type: 'text', label: 'Alpha' },
    { id: 'grp', key: 'grp', type: 'group_container', label: 'Billing', children: [] },
  ]);
  await loginPage(page);
  await openBuilder(page, form.id);
  const alpha = page.locator('.sf-field-chrome', { hasText: 'Alpha' });
  await alpha.focus();
  await page.keyboard.press('Enter');
  const moveTo = alpha.getByRole('button', { name: 'Move to' });
  await moveTo.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Billing' }).focus();
  await page.keyboard.press('Enter');
  const group = page.locator('.sf-container-renderer', { hasText: 'Billing' });
  await expect(group.locator('.sf-field-chrome', { hasText: 'Alpha' })).toHaveCount(1);

  const inside = group.locator('.sf-field-chrome', { hasText: 'Alpha' });
  await inside.focus();
  await page.keyboard.press('Enter');
  await inside.getByRole('button', { name: 'Move to' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: 'Top level' }).focus();
  await page.keyboard.press('Enter');
  await saveDraft(page);
  const fields = await draftFields(form.id);
  expect(fields.map((f) => f.key)).toEqual(['grp', 'a']);
});
