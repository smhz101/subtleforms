/**
 * #102: Tabs and Accordion layout containers on the live form. A required
 * field in a closed tab or section is revealed and focused on submit, tabs
 * switch from the keyboard, and the form passes axe-core.
 *
 * Set SF_SHOT_DIR to also write the review screenshots (1440 and 390 wide).
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { adminApi, publishForm, cleanup, waitForForm, loginPage, openBuilder } = require('./helpers');

const SHOT_DIR = process.env.SF_SHOT_DIR || '';

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

let client;
const forms = {};

const panel = (id, type, label, children) => ({ id, key: id, type, label, children });
const text = (id, label, extra = {}) => ({ id, key: id, type: 'text', label, ...extra });

function tabsFields(position = 'top') {
  return [
    {
      id: 'tabs', key: 'tabs', type: 'tabs_container', label: 'Sections', position, collapse_mobile: true, active: 0,
      children: [
        panel('t1', 'tab_panel', 'Personal', [text('first', 'First name')]),
        panel('t2', 'tab_panel', 'Contact', [text('email', 'Contact email', { required: true }), text('phone', 'Phone number')]),
        panel('t3', 'tab_panel', 'Extras', [text('note', 'Anything else')]),
      ],
    },
  ];
}

function accordionFields() {
  return [
    {
      id: 'acc', key: 'acc', type: 'accordion_container', label: 'Details', multiple: false, open: 'first', icon: 'chevron',
      children: [
        panel('a1', 'accordion_panel', 'About you', [text('who', 'Your name')]),
        panel('a2', 'accordion_panel', 'Your company', [text('company', 'Company name', { required: true })]),
        panel('a3', 'accordion_panel', 'Anything else', [text('more', 'Other notes')]),
      ],
    },
  ];
}

test.beforeAll(async () => {
  client = await adminApi();
  forms.tabs = await publishForm(client, { title: 'Tabs check', fields: tabsFields('top') });
  forms.left = await publishForm(client, { title: 'Tabs left check', fields: tabsFields('left') });
  forms.accordion = await publishForm(client, { title: 'Accordion check', fields: accordionFields() });
});

test.afterAll(async () => {
  for (const form of Object.values(forms)) {
    await cleanup(client, form);
  }
});

async function shot(page, name) {
  if (!SHOT_DIR) return;
  await page.waitForTimeout(500); // let icon transitions finish
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false });
}

async function submit(page) {
  await page.locator('.subtleforms-form-container form button[type="submit"]').first().click();
}

const focusedId = (page) => page.evaluate(() => document.activeElement && document.activeElement.id);

test('Tabs: submit empty opens the tab with the error and focuses the field', async ({ page }) => {
  await page.goto(forms.tabs.url);
  await waitForForm(page);
  const second = page.getByRole('tab', { name: /Contact/ });
  await expect(page.getByRole('tab', { name: /Personal/ })).toHaveAttribute('aria-selected', 'true');
  await expect(second).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByRole('tabpanel', { name: /Contact/ })).toBeHidden();
  await shot(page, 'tabs-top-1440');

  await submit(page);

  await expect(second).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: /Contact/ })).toBeVisible();
  await expect(page.getByLabel('Contact email')).toBeFocused();
  await expect(second.locator('.subtleforms-tab-badge')).toHaveText('1');
  await shot(page, 'tabs-error-badge-1440');
});

test('Tabs: keyboard only switching with arrows, Home and End', async ({ page }) => {
  await page.goto(forms.tabs.url);
  await waitForForm(page);
  const tabs = page.getByRole('tab');
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.nth(1)).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: /Contact/ })).toBeVisible();
  await page.keyboard.press('End');
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(tabs.first()).toBeFocused();
  // Tab leaves the tablist and lands in the open panel.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tabpanel', { name: /Personal/ })).toBeFocused();
});

test('Tabs on the left use Up and Down', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(forms.left.url);
  await waitForForm(page);
  const tabs = page.getByRole('tab');
  await expect(page.locator('.subtleforms-tabs--left')).toBeVisible();
  await tabs.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await shot(page, 'tabs-left-1440');
});

test('Accordion: submit empty opens the closed section and focuses the field', async ({ page }) => {
  await page.goto(forms.accordion.url);
  await waitForForm(page);
  const trigger = page.getByRole('button', { name: /Your company/ });
  await expect(page.getByRole('button', { name: /About you/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  await submit(page);

  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Company name')).toBeFocused();
  await expect(trigger.locator('.subtleforms-tab-badge')).toHaveText('1');
  await shot(page, 'accordion-open-1440');
});

test('Accordion: Up, Down, Home and End move between triggers', async ({ page }) => {
  await page.goto(forms.accordion.url);
  await waitForForm(page);
  const triggers = page.locator('.subtleforms-accordion-trigger');
  await triggers.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(triggers.nth(1)).toBeFocused();
  await page.keyboard.press('End');
  await expect(triggers.nth(2)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(triggers.first()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(triggers.first()).toHaveAttribute('aria-expanded', 'false');
});

test('Phone width: Tabs fall back to an accordion', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(forms.tabs.url);
  await waitForForm(page);
  await expect(page.locator('.subtleforms-accordion')).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await submit(page);
  await expect(page.getByLabel('Contact email')).toBeFocused();
  await shot(page, 'phone-accordion-fallback-390');
  await context.close();
});

for (const key of ['tabs', 'left', 'accordion']) {
  test(`axe: ${key} form passes before and after a failed submit`, async ({ page }) => {
    await page.goto(forms[key].url);
    await waitForForm(page);
    const run = async () => {
      const results = await new AxeBuilder({ page })
        .include('.subtleforms-form-container')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    };
    await run();
    await submit(page);
    await expect(page.locator('.subtleforms-form-container [aria-invalid="true"]').first()).toBeVisible();
    await run();
  });
}

test('Builder: a tabs container shows its tabs and panels', async ({ page }) => {
  const res = await client.call('POST', '/forms', { title: 'Tabs builder' });
  const form = { id: res.body.data.id };
  forms.builder = form;
  await client.call('POST', `/forms/${form.id}/schema`, {
    activate: true,
    schema: { schema_version: 1, metadata: { type: 'regular', name: 'x', title: 'Tabs builder' }, fields: tabsFields('top') },
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginPage(page);
  await openBuilder(page, form.id);
  await expect(page.locator('.sf-panel-container')).toBeVisible();
  await expect(page.getByRole('tab', { name: /Contact/ })).toBeVisible();
  await page.getByRole('tab', { name: /Contact/ }).click();
  await expect(page.getByText('Contact email').first()).toBeVisible();
  await shot(page, 'builder-tabs-1440');
});
