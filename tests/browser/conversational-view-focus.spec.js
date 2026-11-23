/**
 * #139: a conversational form keeps its Next button on screen and moves the
 * cursor to the next question.
 */
const { test, expect } = require('@playwright/test');
const { adminApi, publishForm, cleanup } = require('./helpers');

const fs = require('fs');

// Set SF_SHOTS_DIR to also save screenshots; CI leaves it unset.
const SHOTS = process.env.SF_SHOTS_DIR || '';
const shot = async (page, name) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};
test.use({ deviceScaleFactor: 2 });

let client;
let form;

test.beforeAll(async () => {
  client = await adminApi();
  form = await publishForm(client, {
    title: 'Conversational view focus',
    metadata: { type: 'conversational' },
    fields: [
      { id: 'a', key: 'name', type: 'text', label: 'Your name' },
      { id: 'b', key: 'email', type: 'email', label: 'Your email' },
      { id: 'c', key: 'age', type: 'number', label: 'Your age' },
      { id: 'd', key: 'notes', type: 'textarea', label: 'Anything else' },
    ],
  });
});

test.afterAll(async () => {
  await cleanup(client, form);
});

async function nextInView(page) {
  const box = await page.locator('.subtleforms-button-next').boundingBox();
  const vp = page.viewportSize();
  expect(box).not.toBeNull();
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
}

for (const height of [720, 650]) {
  test(`Next stays in view at 1280x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height });
    await page.goto(form.url);
    await page.waitForSelector('.subtleforms-question-card');
    for (let i = 0; i < 3; i++) {
      await nextInView(page);
      await page.locator('.subtleforms-field-wrapper input').first().fill(['Ada', 'ada@example.com', '36'][i]);
      await page.locator('.subtleforms-button-next').click();
      await page.waitForTimeout(700);
    }
    await nextInView(page);
  });
}

test('Enter moves the cursor to the next question', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(form.url);
  await page.waitForSelector('.subtleforms-question-card');
  await shot(page, 'question-1');
  await page.locator('.subtleforms-field-wrapper input').first().fill('Ada');
  await page.keyboard.press('Enter');
  await page.keyboard.type('ada@example.com');
  await expect(page.locator('.subtleforms-field-wrapper input').first()).toHaveValue('ada@example.com');
  await page.keyboard.press('Enter');
  await page.keyboard.type('36');
  await expect(page.locator('.subtleforms-field-wrapper input').first()).toHaveValue('36');
  await page.waitForTimeout(700);
  await shot(page, 'question-3');
});
