/**
 * 2.3.2 item 2: creating a form from ANY template (free and Pro) gives the
 * full form: its fields, settings and type are saved, the builder shows the
 * fields and the live form renders them.
 *
 * Every template is created through the real New form screen (search, pick,
 * Create form), exactly as a user does it. Pro templates need an active Pro
 * license on the test site; without one they are skipped (they are locked).
 */
const { test, expect } = require('@playwright/test');
const { adminApi, cleanup, loginPage, BASE } = require('./helpers');

const STRUCTURE = ['step', 'form_step', 'section', 'section_break', 'html', 'disclaimer', 'hidden'];

/** Input leaves of a template schema (what a visitor answers). */
function leaves(fields, out = []) {
  (fields || []).forEach((f) => {
    if (!f || typeof f !== 'object') return;
    const children = f.children || f.fields;
    if (Array.isArray(children) && children.length) leaves(children, out);
    if (Array.isArray(f.columns)) f.columns.forEach((c) => leaves(Array.isArray(c) ? c : [], out));
    if (f.type && !STRUCTURE.includes(f.type) && !/container/.test(f.type) && !(Array.isArray(children) && children.length)) {
      out.push(f);
    }
  });
  return out;
}

function hasStep(fields) {
  return (fields || []).some((f) => f && f.type === 'step');
}

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

test('every template creates the full form in the builder and on the site', async ({ page, browser }) => {
  test.setTimeout(Number(process.env.SF_TEMPLATES_TIMEOUT_MIN || 45) * 60 * 1000);
  const res = await client.call('GET', '/templates');
  const all = Object.values(res.body.data.templates);
  const usable = all.filter((t) => !t.is_locked && t.schema && Array.isArray(t.schema.fields));
  expect(usable.length).toBeGreaterThanOrEqual(12);
  const only = process.env.SF_TEMPLATES ? process.env.SF_TEMPLATES.split(',') : null;

  await loginPage(page);
  const visitorCtx = await browser.newContext();
  const visitor = await visitorCtx.newPage();
  const failures = [];
  const summary = [];

  for (const tpl of usable) {
    if (only && !only.includes(tpl.id)) continue;
    const expected = leaves(tpl.schema.fields);
    const where = `${tpl.id} (${tpl.name})`;
    try {
      // New form screen: search, pick, create.
      await page.goto('/wp-admin/admin.php?page=subtleforms-new-form');
      await page.fill('.sf-new-form__search input', tpl.name);
      const card = page.locator('.sf-tpl:not(.sf-tpl--blank)').filter({
        has: page.locator('.sf-tpl__name', { hasText: new RegExp(`^${tpl.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }),
      });
      await card.first().click();
      await expect(page.locator('.sf-create-modal')).toBeVisible();
      const createResponse = page.waitForResponse(
        (r) => /subtleforms\/v1\/forms(\?|$)/.test(r.url()) && r.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Create form' }).click();
      const resp = await createResponse;
      expect(resp.status(), `${where}: create status`).toBe(201);
      const body = await resp.json();
      const id = body.data.id;
      const form = { id };
      created.push(form);

      // Builder shows the fields.
      await page.waitForSelector('.sf-form-editor', { timeout: 30000 });
      const isConversational = tpl.schema.metadata?.type === 'conversational';
      if (!isConversational) {
        await expect(page.locator('.sf-field-chrome').first(), `${where}: builder field`).toBeVisible({ timeout: 20000 });
      } else {
        await expect(page.locator('.sf-conversational-canvas .sf-field-chrome').first(), `${where}: question`).toBeVisible({ timeout: 20000 });
      }

      // Saved schema: every field, the actions and the type.
      const saved = (await client.call('GET', `/forms/${id}/schema?context=builder`)).body.data.schema;
      const savedLeaves = leaves(saved.fields);
      expect(savedLeaves.length, `${where}: saved fields`).toBeGreaterThan(0);
      expect(savedLeaves.length, `${where}: saved field count`).toBe(expected.length);
      const expectedType = isConversational ? 'conversational' : hasStep(tpl.schema.fields) ? 'multi-step' : 'regular';
      expect(saved.metadata.type, `${where}: type`).toBe(expectedType);
      if (Array.isArray(tpl.schema.actions) && tpl.schema.actions.length) {
        expect((saved.actions || []).length, `${where}: actions`).toBe(tpl.schema.actions.length);
      }

      // Live form renders the first field (and every field of a one-page form).
      await client.call('PUT', `/forms/${id}`, { status: 'published' });
      const wpPage = await client.call('POST', '/wp/v2/pages', {
        title: `Template ${tpl.id}`,
        status: 'publish',
        content: `<!-- wp:shortcode -->[subtleforms id="${id}"]<!-- /wp:shortcode -->`,
      });
      form.pageId = wpPage.body.id;
      await visitor.goto(`${BASE}/?page_id=${form.pageId}`);
      await visitor.waitForSelector('.subtleforms-form-container form, .subtleforms-conversational, .subtleforms-form-container [class*="conversational"]', { timeout: 20000 });
      const visible = expectedType === 'regular' ? savedLeaves : [savedLeaves[0]];
      for (const leaf of visible) {
        if (['rating', 'net_promoter_score', 'scale'].includes(leaf.type) || leaf.type === 'html') continue;
        const key = leaf.key || leaf.id;
        await expect(
          visitor.locator(`[name="${key}"], [name="${key}[]"], [name^="${key}["], [data-field-key="${key}"], #sf-field-${key}, [id="subtleforms-field-${key}-label"]`).first(),
          `${where}: live field ${key}`
        ).toBeAttached({ timeout: 10000 });
      }
      summary.push(`${tpl.id}: ${savedLeaves.length} fields, ${saved.metadata.type}`);
    } catch (e) {
      failures.push(`${String(e.message || e).split('\n')[0]}`);
    }
  }
  await visitorCtx.close();
  // eslint-disable-next-line no-console
  console.log(`Templates checked: ${summary.length}\n${summary.join('\n')}`);
  expect(failures, failures.join('\n')).toEqual([]);
});
