/**
 * 2.6.0: the form completion funnel in a real browser.
 *
 * A visitor fills two fields and leaves: the Reports funnel shows the drop-off
 * at the last field they touched. A visitor who sends the form raises
 * Submitted and adds no drop-off.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup, waitForForm, loginPage, useBundleOverride } = require('./helpers');

// A normal desktop browser: headless Chromium names itself HeadlessChrome,
// which the tracker treats as a robot.
const VISITOR_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SHOTS = path.join(process.cwd(), 'test-results', 'shots', 'funnel');

let client;
let form;

test.beforeAll(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Funnel check',
    fields: [
      { id: 'f1', key: 'name', type: 'text', label: 'Name' },
      { id: 'f2', key: 'email', type: 'email', label: 'Email' },
      { id: 'f3', key: 'phone', type: 'phone', label: 'Phone' },
      { id: 'f4', key: 'message', type: 'textarea', label: 'Message' },
    ],
  });
});

test.afterAll(async () => {
  if (form) {
    await cleanup(client, form);
  }
});

async function funnel() {
  const res = await client.call('GET', `/analytics/funnel?form_id=${form.id}&days=7`);
  return res.body?.data || {};
}

async function visitorPage(browser) {
  const context = await browser.newContext({ userAgent: VISITOR_UA });
  const page = await context.newPage();
  await useBundleOverride(page);
  return { context, page };
}

async function openFunnel(page) {
  await page.goto('/wp-admin/admin.php?page=subtleforms-reports');
  const panel = page.locator('.sf-funnel');
  await expect(panel).toBeVisible({ timeout: 30000 });
  await panel.getByLabel('Form for the funnel').selectOption(String(form.id));
  await panel.getByRole('button', { name: '7 days' }).click();
  return panel;
}

test('a visitor who leaves shows up as a drop-off; a sent form raises Submitted', async ({ browser, page }) => {
  const before = await funnel();
  expect(before.tracking).toBe(true);
  expect(before.left).toBe(0);

  // 1. A visitor fills Name and Phone, then leaves for another page.
  const visitor = await visitorPage(browser);
  const beacons = [];
  visitor.page.on('request', (req) => {
    if (req.url().includes(`/forms/${form.id}/funnel`)) {
      beacons.push(req.postData() || '');
    }
  });
  await visitor.page.goto(form.url);
  await waitForForm(visitor.page);
  // The page must be set up to report: tracking on in the page config, a
  // user agent the tracker does not take for a robot.
  const pageState = await visitor.page.evaluate(() => ({
    agent: navigator.userAgent,
    track: Boolean((window.subtleformsFrontend || {}).trackFunnel),
    rest: String((window.subtleformsFrontend || {}).restUrl || ''),
  }));
  expect(pageState.agent).not.toMatch(/headless/i);
  expect(pageState.track).toBe(true);
  expect(pageState.rest).toContain('/subtleforms/v1');
  await visitor.page.fill('#subtleforms-field-name', 'Ada Lovelace');
  await visitor.page.fill('#subtleforms-field-phone', '2025550143');

  // Leaving the page sends the beacon (pagehide). Wait for that request, so a
  // beacon that is never sent fails here with its own message. The page is
  // gone by the time the server answers, so the answer is read from the
  // report below.
  // The leave beacon uses fetch keepalive, so waitForEvent can see it.
  const isBeacon = (req) => req.url().includes(`/forms/${form.id}/funnel`) && req.method() === 'POST';
  const beaconSent = visitor.context.waitForEvent('request', { predicate: isBeacon, timeout: 20000 });
  await visitor.page.goto('/');
  await beaconSent;

  await expect.poll(async () => (await funnel()).left, { timeout: 20000 }).toBe(1);
  expect(beacons).toHaveLength(1);
  expect(beacons[0]).toContain('f=phone');
  expect(beacons[0]).not.toContain('Ada');
  expect(beacons[0]).not.toContain('2025550143');

  const afterDrop = await funnel();
  expect(afterDrop.fields.map((row) => [row.key, row.count])).toEqual([['phone', 1]]);
  expect(afterDrop.started).toBe(1);
  expect(afterDrop.submitted).toBe(0);
  expect(afterDrop.seen).toBeGreaterThanOrEqual(1);

  // 2. The admin funnel shows the drop-off at Phone.
  await loginPage(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  let panel = await openFunnel(page);
  await expect(panel.locator('.sf-funnel__summary')).toHaveText(
    `${afterDrop.seen} saw, 1 started, 1 stopped at Phone, 0 submitted.`
  );
  await expect(panel.locator('.sf-funnel__drop-name').first()).toHaveText('Phone');
  await expect(panel.locator('.sf-funnel__hint').first()).toContainText('1 person left at Phone.');
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: path.join(SHOTS, 'funnel-dropoff-desktop.png') });

  // 3. Another visitor sends the form, then leaves: no new drop-off.
  await visitor.page.goto(form.url);
  await waitForForm(visitor.page);
  await visitor.page.fill('#subtleforms-field-name', 'Grace Hopper');
  await visitor.page.fill('#subtleforms-field-email', 'grace@example.com');
  await visitor.page.fill('#subtleforms-field-message', 'Hello');
  // The spam time trap rejects forms sent within seconds of loading.
  await visitor.page.waitForTimeout(4000);
  await visitor.page.click('.subtleforms-button-submit');
  await expect(visitor.page.locator('.subtleforms-success')).toBeVisible({ timeout: 20000 });
  await visitor.page.goto('/');
  await visitor.context.close();

  await expect.poll(async () => (await funnel()).submitted, { timeout: 20000 }).toBe(1);
  const afterSubmit = await funnel();
  expect(afterSubmit.left).toBe(1);
  expect(afterSubmit.started).toBe(2);
  expect(beacons).toHaveLength(1);

  panel = await openFunnel(page);
  await expect(panel.locator('.sf-funnel__summary')).toHaveText(
    `${afterSubmit.seen} saw, 2 started, 1 stopped at Phone, 1 submitted.`
  );
  await expect(panel.locator('.sf-funnel__stage--submitted .sf-funnel__stage-count')).toHaveText('1');
  await expect(panel.locator('.sf-funnel__completion')).toContainText('50%');
  await panel.screenshot({ path: path.join(SHOTS, 'funnel-submitted-desktop.png') });

  // The Forms list Performance cell adds the completion rate.
  await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
  const row = page.locator('tr', { hasText: 'Funnel check' }).first();
  await expect(row.locator('.sf-perf__completion')).toHaveText('Completion rate 50%', { timeout: 30000 });
  await row.screenshot({ path: path.join(SHOTS, 'funnel-forms-list.png') });

  panel = await openFunnel(page);

  // Keyboard: the range buttons are reachable and report their state.
  const ninety = panel.getByRole('button', { name: '90 days' });
  await ninety.focus();
  await page.keyboard.press('Enter');
  await expect(ninety).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'false');

  // Phone width: no sideways scrolling.
  await page.setViewportSize({ width: 390, height: 844 });
  panel = await openFunnel(page);
  await expect(panel.locator('.sf-funnel__summary')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await panel.screenshot({ path: path.join(SHOTS, 'funnel-phone.png') });
});

test('people who manage SubtleForms are not counted as seen or started', async ({ page }) => {
  await loginPage(page);
  await page.goto(form.url);
  await waitForForm(page);
  const config = await page.evaluate(() => window.subtleformsFrontend || {});
  // wp_localize_script sends booleans as "1" and "". Neither views nor
  // drop-offs are counted for managers, so Seen and Started match.
  expect(Boolean(config.trackViews)).toBe(false);
  expect(Boolean(config.trackFunnel)).toBe(false);

  const before = (await funnel()).seen;
  const viewCalls = [];
  page.on('request', (req) => {
    if (/\/forms\/\d+\/(view|funnel)/.test(req.url())) viewCalls.push(req.url());
  });
  await page.reload();
  await waitForForm(page);
  await page.fill('#subtleforms-field-name', 'Admin test');
  await page.goto('/');
  expect(viewCalls).toEqual([]);
  expect((await funnel()).seen).toBe(before);
});

test('the tracking off note links to the switch', async ({ page }) => {
  const settings = await client.call('GET', '/settings');
  const original = settings.body?.data?.ext_analytics_view_tracking;
  const saved = await client.call('PUT', '/settings', { ext_analytics_view_tracking: false });
  expect(saved.status).toBeLessThan(300);
  try {
    await loginPage(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    const panel = await openFunnel(page);
    const note = panel.locator('.sf-funnel__notice');
    await expect(note).toContainText('Form statistics are off');
    await expect(note.getByRole('link', { name: 'Turn on Count form views' })).toHaveAttribute(
      'href',
      /page=subtleforms-settings#tab=extensions&ext=analytics/
    );
    await panel.screenshot({ path: path.join(SHOTS, 'funnel-tracking-off.png') });
  } finally {
    await client.call('PUT', '/settings', { ext_analytics_view_tracking: original !== false });
  }
});
