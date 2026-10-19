/**
 * Shared helpers for the browser tests: an admin REST client that seeds
 * forms and pages, and small page utilities.
 */
const { request } = require('@playwright/test');

const BASE = process.env.SF_BASE_URL || 'http://localhost:8899';
const USER = process.env.SF_ADMIN_USER || 'admin';
const PASS = process.env.SF_ADMIN_PASS || 'admin';

/**
 * A logged-in REST client.
 *
 * @return {Promise<{api: import('@playwright/test').APIRequestContext, nonce: string, call: Function}>}
 */
async function adminApi() {
  const api = await request.newContext({ baseURL: BASE });
  await api.get('/wp-login.php');
  const login = await api.post('/wp-login.php', {
    form: { log: USER, pwd: PASS, rememberme: 'forever', 'wp-submit': 'Log In', testcookie: '1' },
    headers: { Cookie: 'wordpress_test_cookie=WP%20Cookie%20check' },
    maxRedirects: 0,
  });
  if (![200, 302].includes(login.status())) {
    throw new Error(`Login failed with ${login.status()}`);
  }
  const nonceRes = await api.get('/wp-admin/admin-ajax.php?action=rest-nonce');
  const nonce = (await nonceRes.text()).trim();
  if (!/^[a-f0-9]{6,}$/i.test(nonce)) {
    throw new Error(`Could not get a REST nonce: ${nonce.slice(0, 80)}`);
  }

  const call = async (method, path, data) => {
    const url = path.startsWith('/wp/') ? `/wp-json${path}` : `/wp-json/subtleforms/v1${path}`;
    const res = await api.fetch(url, {
      method,
      headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'application/json' },
      data: data === undefined ? undefined : JSON.stringify(data),
    });
    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      body = null;
    }
    return { status: res.status(), body };
  };

  return { api, nonce, call };
}

/**
 * Create and publish a form, and a page that shows it.
 *
 * @param {Object} client  adminApi() result.
 * @param {Object} options { title, fields, metadata, actions }.
 * @return {Promise<{id: number, url: string, pageId: number}>}
 */
async function publishForm(client, { title, fields, metadata = {}, actions }) {
  const created = await client.call('POST', '/forms', { title });
  const id = created.body?.data?.id ?? created.body?.data?.form?.id ?? created.body?.id;
  if (!id) {
    throw new Error(`Form create failed: ${JSON.stringify(created.body).slice(0, 300)}`);
  }
  const schema = {
    schema_version: 1,
    metadata: { type: 'regular', name: title, title, ...metadata },
    fields,
  };
  if (actions) schema.actions = actions;
  const saved = await client.call('POST', `/forms/${id}/schema`, { schema, activate: true });
  if (saved.status >= 300) {
    throw new Error(`Schema save failed (${saved.status}): ${JSON.stringify(saved.body).slice(0, 500)}`);
  }
  const pub = await client.call('PUT', `/forms/${id}`, { status: 'published' });
  if (pub.status >= 300) {
    throw new Error(`Publish failed (${pub.status}): ${JSON.stringify(pub.body).slice(0, 300)}`);
  }
  const page = await client.call('POST', '/wp/v2/pages', {
    title: `${title} page`,
    status: 'publish',
    content: `<!-- wp:shortcode -->[subtleforms id="${id}"]<!-- /wp:shortcode -->`,
  });
  const pageId = page.body?.id;
  if (!pageId) {
    throw new Error(`Page create failed: ${JSON.stringify(page.body).slice(0, 300)}`);
  }
  return { id, pageId, url: `/?page_id=${pageId}` };
}

/** Latest entries of a form, newest first. */
async function entries(client, formId) {
  const res = await client.call('GET', `/forms/${formId}/submissions?per_page=20`);
  const list = res.body?.data ?? [];
  return Array.isArray(list) ? list : list.items || [];
}

/** Remove what a test created. */
async function cleanup(client, { id, pageId }) {
  if (pageId) await client.call('DELETE', `/wp/v2/pages/${pageId}?force=true`);
  if (id) await client.call('DELETE', `/forms/${id}?force=true`);
}

/** Wait for a mounted SubtleForms form. */
async function waitForForm(page) {
  await page.waitForSelector('.subtleforms-form-container form, .subtleforms-block form', { timeout: 20000 });
}

module.exports = { adminApi, publishForm, entries, cleanup, waitForForm, BASE };

/**
 * Whether every given field type is registered on the site. Signature,
 * Calculation and Card Payment are registered by SubtleForms Pro since 2.3.9,
 * so on a site without Pro they are missing.
 *
 * @param {Object}   client adminApi() result.
 * @param {string[]} types  Field types.
 * @return {Promise<boolean>}
 */
async function hasFieldTypes(client, types) {
  const res = await client.call('GET', '/fields');
  const registered = res.body?.data || {};
  return types.every((type) => Object.prototype.hasOwnProperty.call(registered, type));
}

module.exports.hasFieldTypes = hasFieldTypes;

/** Log the browser page in as the admin. */
async function loginPage(page) {
  // The local PHP server occasionally stalls one request; a login that does
  // not land within 45 seconds is tried once more.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto('/wp-login.php');
    await page.fill('#user_login', USER);
    await page.fill('#user_pass', PASS);
    try {
      await Promise.all([
        page.waitForURL(/\/wp-admin\//, { timeout: 45000 }),
        page.click('#wp-submit'),
      ]);
      return;
    } catch (e) {
      if (attempt === 1) throw e;
    }
  }
}

/** Open a form in the builder and wait for the canvas. */
async function openBuilder(page, formId) {
  await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${formId}`);
  await page.waitForSelector('.sf-field-chrome, .sf-form-editor__canvas', { timeout: 30000 });
  // Dismiss the first-run tour when it shows.
  for (const label of ['Skip tour', 'Skip']) {
    const skip = page.getByRole('button', { name: label, exact: true });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => {});
    }
  }
}

module.exports.loginPage = loginPage;
module.exports.openBuilder = openBuilder;

/**
 * Serve a different frontend bundle (SF_FRONTEND_BUNDLE=/path/frontend.js),
 * to prove a test fails on an older build.
 */
async function useBundleOverride(page) {
  const file = process.env.SF_FRONTEND_BUNDLE;
  if (!file) return;
  await page.route('**/build/frontend/frontend.js*', (route) =>
    route.fulfill({ path: file, contentType: 'application/javascript' })
  );
}

module.exports.useBundleOverride = useBundleOverride;

/**
 * Open a collapsed inspector panel (for example Appearance, 2.3.3) if needed.
 */
async function openPanel(page, title) {
  const toggle = page.locator('.sf-field-inspector .components-panel__body-toggle', { hasText: title }).first();
  if ((await toggle.count()) && (await toggle.getAttribute('aria-expanded')) === 'false') {
    await toggle.click();
  }
}

module.exports.openPanel = openPanel;

/**
 * The server-signed spam time token for a form, aged past the time trap
 * (2.3.9, FF-11 and FF-12). One token per form is reused.
 *
 * @param {Object} api    A Playwright request context.
 * @param {number} formId Form ID.
 * @return {Promise<string>} Token.
 */
const spamTokens = new Map();
async function spamToken(api, formId) {
  if (!spamTokens.has(formId)) {
    const res = await api.get(`/wp-json/subtleforms/v1/forms/${formId}/schema`);
    const body = await res.json();
    spamTokens.set(formId, body?.data?.spam_token || '');
    // The default minimum time between loading and sending a form is 3 seconds.
    await new Promise((resolve) => setTimeout(resolve, 3500));
  }
  return spamTokens.get(formId);
}
module.exports.spamToken = spamToken;
