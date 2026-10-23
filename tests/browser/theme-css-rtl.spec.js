/**
 * 2.7.1: a form that inherits the theme gets no SubtleForms stylesheet, only a
 * few layout lines; a styled form on the same page brings the stylesheet back;
 * the RTL stylesheet exists next to the LTR one.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, publishForm, waitForForm, BASE } = require('./helpers');

const fields = [
  { id: 'a', key: 'name', type: 'text', label: 'Your name' },
  { id: 'b', key: 'topic', type: 'multiple_choice', label: 'Topic', options: [{ label: 'One', value: 'one' }, { label: 'Two', value: 'two' }] },
];

// Properties that arrange things or hide text; none of them paint.
const ALLOWED = new Set([
  'display', 'flex', 'flex-wrap', 'flex-direction', 'flex-basis', 'flex-grow', 'flex-shrink', 'gap', 'min-width', 'min-height',
  'position', 'left', 'width', 'height', 'overflow', 'clip', 'clip-path', 'white-space', 'border-width', 'margin', 'padding', 'float',
  'border', 'justify-content', 'pointer-events', 'user-select', 'color', 'border-style',
]);

let client;
const made = [];
const pages = [];

async function pageWith(forms) {
  const content = forms
    .map((f) => `<!-- wp:shortcode -->[subtleforms id="${f.id}"]<!-- /wp:shortcode -->`)
    .join('\n');
  const res = await client.call('POST', '/wp/v2/pages', { title: `Theme css ${Date.now()}`, status: 'publish', content });
  pages.push(res.body.id);
  return res.body.link;
}

test.beforeAll(async () => {
  client = await adminApi();
});

test.afterAll(async () => {
  for (const id of pages) await client.call('DELETE', `/wp/v2/pages/${id}?force=true`);
  for (const f of made) await cleanup(client, f);
});

test('a theme form loads no plugin stylesheet and only layout rules apply', async ({ page }) => {
  const theme = await publishForm(client, { title: `Theme ${Date.now()}`, metadata: { appearance: { preset: 'theme' } }, fields });
  made.push(theme);
  const url = await pageWith([theme]);

  const requested = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto(url);
  await waitForForm(page);

  expect(requested.filter((u) => /build\/frontend\/index\.jsx(-rtl)?\.css/.test(u))).toEqual([]);
  expect(await page.locator('link[href*="index.jsx.css"]').count()).toBe(0);

  const report = await page.evaluate(() => {
    const out = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try { rules = Array.from(sheet.cssRules); } catch (e) { continue; }
      for (const rule of rules) {
        if (!(rule instanceof CSSStyleRule) || !/subtleforms/.test(rule.selectorText)) continue;
        out.push({ selector: rule.selectorText, props: Array.from(rule.style) });
      }
    }
    return out;
  });
  expect(report.length).toBeGreaterThan(0);
  const painting = report.flatMap((r) => r.props.filter((p) => !ALLOWED.has(p) && !/^(--|border-|margin-|padding-|overflow-|row-gap|column-gap|white-space|text-wrap|clip)/.test(p)).map((p) => `${r.selector} { ${p} }`));
  expect(painting).toEqual([]);
  // The only colour is the field error text.
  const colours = report.filter((r) => r.props.includes('color')).map((r) => r.selector);
  expect(colours).toEqual(['.subtleforms-field-error']);

  // The group of choices is a fieldset with a legend.
  await expect(page.locator('fieldset.subtleforms-field > legend')).toHaveText(/Topic/);
  // Layout still works: the two fields stack at full width.
  const widths = await page.locator('.subtleforms-field').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(widths.length).toBe(2);
  expect(widths[0]).toBe(widths[1]);
});

test('a styled form on the page brings the stylesheet back', async ({ page }) => {
  const theme = await publishForm(client, { title: `Theme mix ${Date.now()}`, metadata: { appearance: { preset: 'theme' } }, fields });
  const styled = await publishForm(client, { title: `Styled mix ${Date.now()}`, metadata: { appearance: { preset: 'minimal' } }, fields });
  made.push(theme, styled);
  const url = await pageWith([theme, styled]);
  await page.goto(url);
  await waitForForm(page);
  expect(await page.locator('link[href*="index.jsx.css"]').count()).toBe(1);
});

test('the RTL stylesheet is built next to the LTR one', async ({ request }) => {
  const rtl = await request.get(`${BASE}/wp-content/plugins/subtleforms/build/frontend/index.jsx-rtl.css`);
  expect(rtl.status()).toBe(200);
  const ltr = await request.get(`${BASE}/wp-content/plugins/subtleforms/build/frontend/index.jsx.css`);
  expect(await rtl.text()).not.toBe(await ltr.text());
});
