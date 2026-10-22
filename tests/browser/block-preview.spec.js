/**
 * 2.6.1: the block editor preview looks like the form on the site. It is drawn
 * by the front-end renderer with the front-end stylesheet inside the editor
 * canvas (an iframe), keeps the form's own builder styling, cannot be used,
 * follows the selected form, and shows a placeholder when no form is chosen.
 *
 * The preview is checked against the accent colour a form is given in the
 * builder, not against defaults, so an unstyled preview fails it.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, publishForm, loginPage, BASE } = require('./helpers');

const SHOTS = process.env.SF_SHOTS_DIR || 'test-results/shots/block-preview';
const ACCENT = '#e11d48'; // rgb(225, 29, 72)
const ACCENT_RGB = 'rgb(225, 29, 72)';
const OTHER = '#0f766e'; // rgb(15, 118, 110)
const OTHER_RGB = 'rgb(15, 118, 110)';

let client;
let styled;
let teal;
let pageId;

/** The block as the editor saves it (its save() markup sits between the comments). */
const blockMarkup = (id) =>
  `<!-- wp:subtleforms/form {"formId":${id}} --><div class="subtleforms-block" data-form-id="${id}" data-show-title="1" data-show-description="1" data-theme="default" data-ajax="0" data-tabindex="0" data-field-values=""></div><!-- /wp:subtleforms/form -->`;

const fields = (label) => [
  { id: 'a', key: 'name', type: 'text', label: `${label} name` },
  { id: 'b', key: 'email', type: 'email', label: `${label} email` },
  { id: 'c', key: 'message', type: 'textarea', label: `${label} message` },
];

test.beforeAll(async () => {
  client = await adminApi();
  styled = await publishForm(client, {
    title: `Preview styled ${Date.now()}`,
    metadata: {
      appearance: {
        preset: 'default',
        tokens: { colorPrimary: ACCENT, colorPrimaryHover: ACCENT, radius: '14px' },
        variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', width: 'standard' },
      },
    },
    fields: fields('Styled'),
  });
  teal = await publishForm(client, {
    title: `Preview teal ${Date.now()}`,
    metadata: {
      appearance: {
        preset: 'default',
        tokens: { colorPrimary: OTHER, colorPrimaryHover: OTHER },
        variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', width: 'standard' },
      },
    },
    fields: fields('Teal'),
  });
  const page = await client.call('POST', '/wp/v2/pages', {
    title: `Block preview ${Date.now()}`,
    status: 'draft',
    content: blockMarkup(styled.id),
  });
  pageId = page.body.id;
});

test.afterAll(async () => {
  if (pageId) await client.call('DELETE', `/wp/v2/pages/${pageId}?force=true`);
  if (styled) await cleanup(client, styled);
  if (teal) await cleanup(client, teal);
});

async function openEditor(page, url) {
  await loginPage(page);
  await page.goto(url);
  await page.waitForSelector('iframe[name="editor-canvas"]', { timeout: 60000 });
  // Close the welcome guide when it shows.
  await page.evaluate(() => {
    const prefs = window.wp?.data?.dispatch?.('core/preferences');
    prefs?.set?.('core/edit-post', 'welcomeGuide', false);
    prefs?.set?.('core/edit-post', 'fullscreenMode', false);
  });
  const close = page.getByRole('button', { name: 'Close', exact: true });
  if (await close.isVisible().catch(() => false)) await close.click().catch(() => {});
  return page.frameLocator('iframe[name="editor-canvas"]');
}

/** The submit button's colour and the field radius, as the browser computes them. */
const styleOf = (canvas) =>
  canvas.locator('.subtleforms-block-preview .subtleforms').first().evaluate((root) => {
    const button = root.querySelector('.subtleforms-button-primary, button[type="submit"]');
    const input = root.querySelector('.subtleforms-input');
    return {
      accent: getComputedStyle(root).getPropertyValue('--subtleforms-color-primary').trim(),
      button: button ? getComputedStyle(button).backgroundColor : '',
      radius: input ? getComputedStyle(input).borderTopLeftRadius : '',
      frameDocument: root.ownerDocument !== window.top.document,
    };
  });

test('the preview in the editor canvas has the form\'s own styling', async ({ page }) => {
  const canvas = await openEditor(page, `/wp-admin/post.php?post=${pageId}&action=edit`);
  const preview = canvas.locator('.subtleforms-block-preview .subtleforms');
  await expect(preview).toBeVisible({ timeout: 30000 });
  await expect(preview).toContainText('Styled name');

  const style = await styleOf(canvas);
  expect(style.frameDocument).toBe(true);
  // The accent colour set in the builder reaches the buttons...
  expect(style.button).toBe(ACCENT_RGB);
  // ...and so does the rest of the front-end stylesheet (a 14px radius is
  // the builder's; the default is 4px).
  expect(style.radius).toBe('14px');
  // The front-end stylesheet is in the canvas document, not only in the editor around it.
  const sheets = await canvas.locator('link[rel="stylesheet"][href*="index.jsx.css"]').count();
  expect(sheets).toBeGreaterThan(0);

  await page.screenshot({ path: `${SHOTS}/block-preview.png` });
  await canvas.locator('.subtleforms-block-preview-frame').screenshot({ path: `${SHOTS}/block-preview-form.png` });
});

test('the preview cannot be used and says it is a preview', async ({ page }) => {
  const canvas = await openEditor(page, `/wp-admin/post.php?post=${pageId}&action=edit`);
  await expect(canvas.locator('.subtleforms-block-preview .subtleforms')).toBeVisible({ timeout: 30000 });

  await expect(canvas.locator('.subtleforms-block-preview__label')).toHaveText('Preview');
  const state = await canvas.locator('.subtleforms-block-preview').evaluate((node) => {
    const input = node.querySelector('input');
    input.focus();
    return {
      inert: node.hasAttribute('inert') || node.matches(':is([inert] *)') || node.inert === true,
      pointer: getComputedStyle(node).pointerEvents,
      focused: node.ownerDocument.activeElement === input,
    };
  });
  expect(state.inert).toBe(true);
  expect(state.pointer).toBe('none');
  expect(state.focused).toBe(false);
});

test('choosing a form shows it, and changing the form changes the preview', async ({ page }) => {
  const canvas = await openEditor(page, '/wp-admin/post-new.php?post_type=page');

  // Insert the block into an empty page.
  await page.evaluate(() => {
    const block = window.wp.blocks.createBlock('subtleforms/form');
    window.wp.data.dispatch('core/block-editor').insertBlock(block);
    window.wp.data.dispatch('core/block-editor').selectBlock(block.clientId);
  });

  // No form chosen: a placeholder, no preview.
  const placeholder = canvas.locator('.wp-block-subtleforms-form .components-placeholder');
  await expect(placeholder).toBeVisible({ timeout: 30000 });
  await expect(placeholder).toContainText('Select a published form to embed');
  await expect(canvas.locator('.subtleforms-block-preview')).toHaveCount(0);

  const setForm = (id) =>
    page.evaluate((formId) => {
      const store = window.wp.data.select('core/block-editor');
      const block = store.getBlocks().find((b) => b.name === 'subtleforms/form');
      window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, { formId });
    }, id);

  await setForm(styled.id);
  await expect(canvas.locator('.subtleforms-block-preview')).toContainText('Styled name', { timeout: 30000 });
  expect((await styleOf(canvas)).button).toBe(ACCENT_RGB);

  await setForm(teal.id);
  await expect(canvas.locator('.subtleforms-block-preview')).toContainText('Teal name', { timeout: 30000 });
  await expect(canvas.locator('.subtleforms-block-preview')).not.toContainText('Styled name');
  expect((await styleOf(canvas)).button).toBe(OTHER_RGB);

  // The block's theme setting still overrides the form's own look.
  await page.evaluate(() => {
    const store = window.wp.data.select('core/block-editor');
    const block = store.getBlocks().find((b) => b.name === 'subtleforms/form');
    window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, { theme: 'minimal' });
  });
  await expect
    .poll(async () => (await styleOf(canvas)).button, { timeout: 15000 })
    .not.toBe(OTHER_RGB);

  // The inspector select picks a form too.
  await page.evaluate(() => {
    const store = window.wp.data.select('core/block-editor');
    const block = store.getBlocks().find((b) => b.name === 'subtleforms/form');
    window.wp.data.dispatch('core/block-editor').updateBlockAttributes(block.clientId, { formId: 0, theme: 'default' });
  });
  await expect(placeholder).toBeVisible({ timeout: 15000 });
});

test('the preview matches the form on the site', async ({ page, browser }) => {
  // The same block on the front end.
  const published = await client.call('POST', '/wp/v2/pages', {
    title: `Block site ${Date.now()}`,
    status: 'publish',
    content: blockMarkup(styled.id),
  });
  try {
    const visitorContext = await browser.newContext({ baseURL: BASE });
    const visitor = await visitorContext.newPage();
    await visitor.goto(`/?page_id=${published.body.id}`);
    const site = await visitor.locator('.subtleforms .subtleforms-button-primary, .subtleforms button[type="submit"]').first();
    await expect(site).toBeVisible({ timeout: 30000 });
    const siteColor = await site.evaluate((n) => getComputedStyle(n).backgroundColor);
    await visitorContext.close();

    const canvas = await openEditor(page, `/wp-admin/post.php?post=${pageId}&action=edit`);
    await expect(canvas.locator('.subtleforms-block-preview .subtleforms')).toBeVisible({ timeout: 30000 });
    // Both show the accent set in the builder (the block no longer replaces it with the default theme).
    expect(siteColor).toBe(ACCENT_RGB);
    expect((await styleOf(canvas)).button).toBe(siteColor);
  } finally {
    await client.call('DELETE', `/wp/v2/pages/${published.body.id}?force=true`);
  }
});
