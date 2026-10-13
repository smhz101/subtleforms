/**
 * 2.3.0 feature 22: every field type passes axe-core (WCAG 2.1 A and AA)
 * on the live form, before and after a failed submit, at desktop and phone
 * widths. Runs in CI (.github/workflows/tests.yml).
 */
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { adminApi, publishForm, cleanup, waitForForm } = require('./helpers');
const { SAMPLES, buildField } = require('./fixtures/fields');

let client;
let form;

const extra = [
  { id: 'x1', key: 'name', type: 'name_group', label: 'Your name', required: true },
  { id: 'x2', key: 'address', type: 'address_group', label: 'Address' },
  { id: 'x3', key: 'intro', type: 'section_break', title: 'About you', description: 'A few details.' },
  { id: 'x4', key: 'notice', type: 'disclaimer', content: '<p>We never share your details.</p>' },
  { id: 'x5', key: 'img', type: 'image_upload', label: 'Photo' },
  { id: 'x6', key: 'tel', type: 'tel', label: 'Telephone' },
];

test.beforeAll(async () => {
  client = await adminApi();
  const fields = SAMPLES.map((s) => buildField(s, '50', 'flat'));
  form = await publishForm(client, { title: 'Accessibility check', fields: [...extra, ...fields] });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

async function audit(page) {
  const results = await new AxeBuilder({ page })
    .include('.subtleforms-form-container')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
  }));
  return summary;
}

for (const [width, height, label] of [
  [1280, 900, 'desktop'],
  [390, 844, 'phone'],
]) {
  test(`every field type has no axe violations (${label})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(form.url);
    await waitForForm(page);
    // Lazy fields finish loading first.
    await expect(page.locator('canvas.subtleforms-signature__canvas')).toBeVisible();
    await expect(page.locator('.subtleforms-richtext__editor')).toBeVisible();

    expect(await audit(page)).toEqual([]);

    // With every error showing.
    await page.click('.subtleforms-button-submit');
    await expect(page.locator('.subtleforms-error[role="alert"]')).toBeVisible();
    expect(await audit(page)).toEqual([]);
  });
}

test('newsletter on a dark surface and a multi-step form have no axe violations', async ({ page }) => {
  const dark = await publishForm(client, {
    title: 'A11y newsletter',
    metadata: {
      submitText: 'Subscribe',
      appearance: {
        preset: 'dark-surface',
        tokens: {
          colorPrimary: '#ffffff',
          colorPrimaryHover: '#dfe3ea',
          colorButtonText: '#111318',
          colorText: '#f4f5f7',
          colorLabel: '#f4f5f7',
          colorTextLight: '#b8bfcc',
          colorBackground: 'transparent',
          colorSurface: 'rgba(255, 255, 255, 0.08)',
          colorInputText: '#ffffff',
          colorBorder: 'rgba(255, 255, 255, 0.28)',
          colorFocus: '#ffffff',
          colorError: '#ffb4a8',
        },
        variants: { layout: 'inline', width: 'full' },
      },
    },
    fields: [
      { id: 'e', key: 'email', type: 'email', label: 'Email address', placeholder: 'you@example.com', required: true, appearance: { hideLabel: true } },
    ],
  });
  const steps = await publishForm(client, {
    title: 'A11y steps',
    metadata: { type: 'multi-step' },
    fields: [
      { id: 's1', key: 'step_1', type: 'step', label: 'About you', children: [{ id: 'a', key: 'first', type: 'text', label: 'First name', required: true }] },
      { id: 's2', key: 'step_2', type: 'step', label: 'Contact', children: [{ id: 'b', key: 'mail', type: 'email', label: 'Email', required: true }] },
    ],
  });
  const host = await client.call('POST', '/wp/v2/pages', {
    title: 'A11y dark footer',
    status: 'publish',
    content: `<!-- wp:html --><div style="background:#111318;padding:32px"><h2 style="color:#fff">Newsletter</h2>[subtleforms id="${dark.id}"]</div><!-- /wp:html -->`,
  });
  try {
    await page.goto(`/?page_id=${host.body.id}`);
    await waitForForm(page);
    expect(await audit(page)).toEqual([]);
    await page.click('.subtleforms-button-submit');
    await expect(page.locator('.subtleforms-error[role="alert"]')).toBeVisible();
    expect(await audit(page)).toEqual([]);

    await page.goto(steps.url);
    await waitForForm(page);
    expect(await audit(page)).toEqual([]);
    await page.click('.subtleforms-button-next');
    await expect(page.locator('#subtleforms-field-first')).toHaveAttribute('aria-invalid', 'true');
    expect(await audit(page)).toEqual([]);
  } finally {
    await client.call('DELETE', `/wp/v2/pages/${host.body.id}?force=true`);
    await cleanup(client, dark);
    await cleanup(client, steps);
  }
});
