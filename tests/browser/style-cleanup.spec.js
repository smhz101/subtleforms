/**
 * 2.4.1 style clean-up.
 *
 * - The form has no padding of its own in any preset, so it lines up with the
 *   content around it.
 * - Nothing draws a line above the submit button.
 * - "Inherit from theme" adds no visual CSS: a text input, a label and the
 *   submit button compute the same styles as the same elements placed on the
 *   page outside the form, which only the theme styles. The submit button
 *   carries the theme's button class.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, waitForForm, useBundleOverride } = require('./helpers');

const FIELDS = [
  { id: 'name', key: 'name', name: 'name', type: 'text', label: 'Name', placeholder: 'Ada' },
  { id: 'email', key: 'email', name: 'email', type: 'email', label: 'Email' },
  { id: 'msg', key: 'msg', name: 'msg', type: 'textarea', label: 'Message' },
];

const PRESETS = {
  default: {
    preset: 'default',
    variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', width: 'standard' },
  },
  theme: {
    preset: 'theme',
    tokens: { fontFamily: 'inherit', colorBackground: 'transparent' },
    variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', layout: 'inherit', width: 'theme' },
  },
  // "Inherit from theme" with a changed colour: SubtleForms styles it again.
  tuned: {
    preset: 'theme',
    tokens: { fontFamily: 'inherit', colorBackground: 'transparent', colorPrimary: '#aa3300' },
    variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', layout: 'inherit', width: 'theme' },
  },
};

// Properties a stylesheet would set to make a control look a certain way.
const LOOK = [
  'padding-top', 'padding-left', 'border-top-width', 'border-top-style', 'border-top-color',
  'border-top-left-radius', 'background-color', 'background-image', 'box-shadow',
  'font-family', 'font-size', 'font-weight', 'line-height', 'color', 'margin-top',
];

let client;
const forms = {};

test.beforeAll(async () => {
  client = await adminApi();
  for (const [name, appearance] of Object.entries(PRESETS)) {
    forms[name] = await publishForm(client, {
      title: `Style ${name}`,
      fields: FIELDS,
      metadata: { appearance },
    });
  }
});

test.beforeEach(async ({ page }) => {
  await useBundleOverride(page);
});

test.afterAll(async () => {
  for (const form of Object.values(forms)) {
    await cleanup(client, form);
  }
});

for (const name of Object.keys(PRESETS)) {
  test(`${name}: the form has no padding and no line above the submit button`, async ({ page }) => {
    await page.goto(forms[name].url);
    await waitForForm(page);
    const box = await page.locator('.subtleforms').first().evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft];
    });
    expect(box).toEqual(['0px', '0px', '0px', '0px']);

    const container = await page.locator('.subtleforms-form-container').first().evaluate((el) => getComputedStyle(el).paddingLeft);
    expect(container).toBe('0px');

    const row = await page.locator('.subtleforms-buttons').first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.borderTopWidth, style: s.borderTopStyle, padding: s.paddingTop };
    });
    expect(row.width === '0px' || row.style === 'none', `border-top ${JSON.stringify(row)}`).toBe(true);
    expect(row.padding).toBe('0px');
    expect(await page.locator('.subtleforms hr').count()).toBe(0);
  });
}

test('theme: controls get only the theme styles', async ({ page }) => {
  await page.goto(forms.theme.url);
  await waitForForm(page);

  // The same elements outside the form: whatever they compute is the theme.
  await page.evaluate(() => {
    const host = document.querySelector('.subtleforms-form-container').parentElement;
    const ref = document.createElement('div');
    ref.id = 'theme-reference';
    ref.innerHTML =
      '<label for="ref-input">Name</label><input id="ref-input" type="text">' +
      '<textarea id="ref-textarea"></textarea>' +
      '<button type="submit" class="wp-element-button" id="ref-button">Submit</button>';
    host.appendChild(ref);
  });

  const look = (selector) =>
    page.locator(selector).first().evaluate((el, props) => {
      const s = getComputedStyle(el);
      return Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]));
    }, LOOK);

  expect(await look('#subtleforms-field-name'), 'text input').toEqual(await look('#ref-input'));
  expect(await look('#subtleforms-field-msg'), 'textarea').toEqual(await look('#ref-textarea'));

  const button = page.locator('.subtleforms .subtleforms-button-submit');
  await expect(button).toHaveClass(/wp-element-button/);
  expect(await look('.subtleforms .subtleforms-button-submit'), 'submit button').toEqual(await look('#ref-button'));

  // The label keeps only the gap to its control.
  const label = await look('.subtleforms .subtleforms-field-label');
  const refLabel = await look('#theme-reference label');
  for (const prop of LOOK.filter((p) => !p.startsWith('margin'))) {
    expect(label[prop], `label ${prop}`).toBe(refLabel[prop]);
  }

  // The button is visible: its text does not match its background.
  const colors = await button.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor];
  });
  expect(colors[0]).not.toBe(colors[1]);
});

test('default: controls keep the plugin look', async ({ page }) => {
  await page.goto(forms.default.url);
  await waitForForm(page);
  const radius = await page.locator('#subtleforms-field-name').first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  expect(radius).not.toBe('0px');
  await expect(page.locator('.subtleforms .subtleforms-button-submit')).not.toHaveClass(/wp-element-button/);
});

test('tuned theme form: a changed colour applies and the button is visible', async ({ page }) => {
  await page.goto(forms.tuned.url);
  await waitForForm(page);
  const button = page.locator('.subtleforms .subtleforms-button-submit');
  await expect(button).not.toHaveClass(/wp-element-button/);
  await expect(page.locator('.subtleforms').first()).toHaveClass(/subtleforms--theme-tuned/);
  const colors = await button.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor];
  });
  expect(colors[1]).toBe('rgb(170, 51, 0)');
  expect(colors[0]).not.toBe(colors[1]);
});
