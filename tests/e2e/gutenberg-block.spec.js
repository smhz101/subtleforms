/**
 * Phase 6.3 E2E Tests - Gutenberg Block
 *
 * Tests the SubtleForm Gutenberg block:
 * - Block insertion
 * - Form selection
 * - Editor preview
 * - Frontend rendering
 */

const { test, expect } = require('@playwright/test');

async function loginAsAdmin(page) {
  await page.goto('/wp-admin');
  const isLoggedIn = await page
    .locator('#wpadminbar')
    .isVisible()
    .catch(() => false);
  if (isLoggedIn) return;

  await page.fill('#user_login', process.env.WP_ADMIN_USER || 'admin');
  await page.fill('#user_pass', process.env.WP_ADMIN_PASS || 'password');
  await page.click('#wp-submit');
  await page.waitForURL('**/wp-admin/**');
}

test.describe('[F3] Gutenberg Block - Editor + Frontend', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('[T12] Block appears in inserter and can be inserted', async ({ page }) => {
    // Create new post
    await page.goto('/wp-admin/post-new.php');

    // Wait for page load and editor to be interactive
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.block-editor .block-editor-writing-flow', {
      state: 'visible',
      timeout: 30000,
    });

    // Open block inserter
    const inserterButton = page.locator(
      'button[aria-label*="Add block"], .edit-post-header-toolbar__inserter-toggle'
    );
    await inserterButton.click();
    await page.waitForTimeout(500);

    // Search for SubtleForm block
    const searchInput = page.locator(
      'input[placeholder*="Search"], .block-editor-inserter__search input'
    );
    await searchInput.fill('SubtleForm');
    await page.waitForTimeout(500);

    // Verify block appears in results
    const blockItem = page.locator('.block-editor-block-types-list__item:has-text("SubtleForm")');
    await expect(blockItem).toBeVisible();

    // Insert block
    await blockItem.click();
    await page.waitForTimeout(1000);

    // Verify block is inserted
    const block = page.locator('.wp-block-subtleforms-form, [data-type="subtleforms/form"]');
    await expect(block).toBeVisible();
  });

  test('[T13] Block shows form selector and preview in editor', async ({ page }) => {
    await page.goto('/wp-admin/post-new.php');

    // Wait for page load and editor to be interactive
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.block-editor .block-editor-writing-flow', {
      state: 'visible',
      timeout: 30000,
    });

    // Insert SubtleForm block (via slash command)
    await page.click('.block-editor-default-block-appender__content');
    await page.keyboard.type('/subtleform');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Should see form selector
    const formSelect = page.locator(
      'select[aria-label*="Select"], .components-select-control__input'
    );
    await expect(formSelect).toBeVisible();

    // Select first form
    await formSelect.selectOption({ index: 1 }); // Index 0 is "Select a form"
    await page.waitForTimeout(1500);

    // Should see preview
    const preview = page.locator('.subtleforms-block-preview, .subtleforms-form');
    await expect(preview).toBeVisible();

    // Preview should show form fields
    const fields = preview.locator('input, textarea, select');
    const fieldCount = await fields.count();
    expect(fieldCount).toBeGreaterThan(0);
  });

  test('[T14] Block renders correctly on frontend', async ({ page }) => {
    // First create and publish a post with the block
    await loginAsAdmin(page);
    await page.goto('/wp-admin/post-new.php');
    await page.waitForSelector('.block-editor', { timeout: 10000 });

    // Add title
    const titleInput = page.locator('.editor-post-title__input, [aria-label*="Add title"]');
    await titleInput.fill('Test SubtleForm Block Post');

    // Insert block
    await page.click('.block-editor-default-block-appender__content');
    await page.keyboard.type('/subtleform');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Select a form
    const formSelect = page.locator('select');
    await formSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1000);

    // Publish post
    const publishButton = page.locator('button:has-text("Publish")').first();
    await publishButton.click();
    await page.waitForTimeout(500);

    // Confirm publish
    const confirmButton = page.locator('.editor-post-publish-panel button:has-text("Publish")');
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
      await page.waitForTimeout(1000);
    }

    // Get post URL
    const viewLink = page.locator('a:has-text("View Post"), a:has-text("View Page")').first();
    const postUrl = await viewLink.getAttribute('href');

    // Visit frontend
    await page.goto(postUrl);
    await page.waitForTimeout(1000);

    // ASSERTION: Form should be visible
    const form = page.locator('.wp-block-subtleforms-form, [data-subtleforms-form]');
    await expect(form).toBeVisible();

    // Should have fields
    const fields = form.locator('input, textarea, select');
    const fieldCount = await fields.count();
    expect(fieldCount).toBeGreaterThan(0);

    // Should have submit button
    const submitButton = form.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test('[T18] Block handles schema fetch error gracefully', async ({ page }) => {
    // Intercept API and return error
    await page.route('**/wp-json/subtleforms/v1/forms/**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });

    await page.goto('/wp-admin/post-new.php');
    await page.waitForSelector('.block-editor', { timeout: 10000 });

    // Insert block
    await page.click('.block-editor-default-block-appender__content');
    await page.keyboard.type('/subtleform');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Select form (will fail to load schema)
    const formSelect = page.locator('select');
    await formSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1500);

    // Should show error message
    const errorMessage = page.locator(':has-text("Error"), :has-text("failed"), .notice-error');
    await expect(errorMessage).toBeVisible();
  });
});
