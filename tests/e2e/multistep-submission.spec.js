/**
 * Phase 6.7 E2E Tests: Multi-Step Submission Guard
 *
 * Tests that multi-step forms:
 * 1. Never auto-submit when clicking "Next"
 * 2. Only submit when clicking "Submit" button
 * 3. Maintain step integrity in the builder
 */

const { test, expect } = require('@playwright/test');

test.describe('Multi-Step Form Submission Safety', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/wp-admin');
    await page.fill('#user_login', process.env.WP_ADMIN_USER || 'admin');
    await page.fill('#user_pass', process.env.WP_ADMIN_PASS || 'password');
    await page.click('#wp-submit');
    await page.waitForURL('**/wp-admin/**');
  });

  test('Task 6.7.4 - Multi-step form does NOT auto-submit when clicking Next', async ({ page }) => {
    // Navigate to SubtleForms
    await page.goto('/wp-admin/admin.php?page=subtleforms');

    // Create a new multi-step form
    await page.click('text=New Form');
    await page.fill('input[name="formTitle"]', 'Multi-Step No Auto Submit Test');

    // Set form type to multi-step
    await page.selectOption('select[name="formType"]', 'multistep');
    await page.click('button:has-text("Create Form")');
    await page.waitForURL('**/admin.php?page=subtleforms&action=edit&id=**');

    // Add Step 1 with optional field
    await page.click('button:has-text("Add Step")');
    await page.dragAndDrop('[data-field-type="text"]', '.subtleforms-step-canvas');
    await page.fill('input[label="Field Label"]', 'Step 1 Field (Optional)');

    // Add Step 2 with optional field
    await page.click('button:has-text("Add Step")');
    await page.click('text=Step 2');
    await page.dragAndDrop('[data-field-type="text"]', '.subtleforms-step-canvas');
    await page.fill('input[label="Field Label"]', 'Step 2 Field (Optional)');

    // Publish the form
    await page.click('button:has-text("Publish")');
    await page.waitForSelector('text=Form published');

    // Get form ID from URL
    const url = page.url();
    const formId = url.match(/id=(\d+)/)[1];

    // Create a test page with the form
    await page.goto('/wp-admin/post-new.php?post_type=page');
    await page.fill('#post-title-0', 'Multi-Step Test Page');

    // Add SubtleForms block
    await page.click('[aria-label="Add block"]');
    await page.fill('[placeholder="Search"]', 'SubtleForms');
    await page.click('button:has-text("SubtleForms")');

    // Select the form
    await page.selectOption('select', formId);

    // Publish page
    await page.click('button:has-text("Publish")');
    await page.click('button:has-text("Publish")');
    await page.waitForSelector('text=Page published');

    // Visit the published page
    await page.click('a:has-text("View Page")');

    // Intercept API calls to detect submission
    let submitApiCalled = false;
    await page.route('**/wp-json/subtleforms/v1*/submit', (route) => {
      submitApiCalled = true;
      route.abort();
    });

    // Fill nothing and click Next on Step 1
    await page.click('button:has-text("Next")');

    // Should be on Step 2 now
    await expect(page.locator('text=Step 2')).toBeVisible();

    // Click Next on Step 2 (final step)
    await page.click('button:has-text("Next")');

    // Wait a moment for any potential API calls
    await page.waitForTimeout(500);

    // ASSERTION: No submit API call should have been made
    expect(submitApiCalled).toBe(false);

    // ASSERTION: Should still see the form, not thank you message
    await expect(page.locator('.subtleforms-success')).not.toBeVisible();

    // ASSERTION: Submit button should be visible on final step
    await expect(page.locator('button:has-text("Submit")')).toBeVisible();
  });

  test('Task 6.7.5 - Multi-step form submits when clicking Submit button', async ({ page }) => {
    // Use the same form from previous test or create a new one
    // For simplicity, we'll assume form exists from previous test

    // Navigate to the test page
    await page.goto('/multi-step-test-page/');

    // Intercept submit API call
    let submitApiCalled = false;
    let submitPayload = null;

    await page.route('**/wp-json/subtleforms/v1*/submit', async (route) => {
      submitApiCalled = true;
      submitPayload = route.request().postDataJSON();

      // Mock successful response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Form submitted successfully',
        }),
      });
    });

    // Navigate through steps
    await page.click('button:has-text("Next")'); // Step 1 -> Step 2

    // Now on final step, click Submit
    await page.click('button:has-text("Submit")');

    // Wait for submission
    await page.waitForTimeout(500);

    // ASSERTION: Submit API should have been called
    expect(submitApiCalled).toBe(true);

    // ASSERTION: Should show success message
    await expect(page.locator('.subtleforms-success')).toBeVisible();

    // ASSERTION: Thank you message should be visible
    await expect(page.locator('text=Thank you')).toBeVisible();
  });
});

test.describe('Builder Step Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wp-admin');
    await page.fill('#user_login', process.env.WP_ADMIN_USER || 'admin');
    await page.fill('#user_pass', process.env.WP_ADMIN_PASS || 'password');
    await page.click('#wp-submit');
    await page.waitForURL('**/wp-admin/**');
  });

  test('Task 6.7.6 - Field edits do not mutate step metadata', async ({ page }) => {
    // Navigate to SubtleForms
    await page.goto('/wp-admin/admin.php?page=subtleforms');

    // Create a new multi-step form
    await page.click('text=New Form');
    await page.fill('input[name="formTitle"]', 'Step Integrity Test');
    await page.selectOption('select[name="formType"]', 'multistep');
    await page.click('button:has-text("Create Form")');
    await page.waitForURL('**/admin.php?page=subtleforms&action=edit&id=**');

    // Add Step 1
    await page.click('button:has-text("Add Step")');

    // Set step title via inspector
    await page.click('.subtleforms-step-canvas'); // Select step
    await page.fill('input[label="Step Title"]', 'Personal Information');

    // Add a field to Step 1
    await page.dragAndDrop('[data-field-type="text"]', '.subtleforms-step-canvas');

    // Select the field
    await page.click('.subtleforms-field-chrome');

    // Change field label
    await page.fill('input[label="Field Label"]', 'Full Name');

    // Wait for autosave
    await page.waitForTimeout(1000);

    // Click on step tab to verify title
    const stepTab = page.locator('button:has-text("Step 1: Personal Information")');
    await expect(stepTab).toBeVisible();

    // ASSERTION: Step title should still be "Personal Information"
    // not changed to "Full Name"
    await expect(stepTab).toHaveText(/Personal Information/);
    await expect(stepTab).not.toHaveText(/Full Name/);

    // Add Step 2
    await page.click('button:has-text("Add Step")');
    await page.click('text=Step 2');
    await page.fill('input[label="Step Title"]', 'Contact Details');

    // Add field to Step 2
    await page.dragAndDrop('[data-field-type="email"]', '.subtleforms-step-canvas');
    await page.fill('input[label="Field Label"]', 'Email Address');

    // Verify both steps are intact
    await expect(page.locator('button:has-text("Step 1: Personal Information")')).toBeVisible();
    await expect(page.locator('button:has-text("Step 2: Contact Details")')).toBeVisible();
  });
});

test.describe('Frontend Styling Smoke Test', () => {
  test('Task 6.7.7 - Forms render without layout collapse', async ({ page }) => {
    // Test block editor preview
    await page.goto('/wp-admin');
    await page.fill('#user_login', process.env.WP_ADMIN_USER || 'admin');
    await page.fill('#user_pass', process.env.WP_ADMIN_PASS || 'password');
    await page.click('#wp-submit');

    await page.goto('/wp-admin/post-new.php?post_type=page');

    // Add SubtleForms block
    await page.click('[aria-label="Add block"]');
    await page.fill('[placeholder="Search"]', 'SubtleForms');
    await page.click('button:has-text("SubtleForms")');

    // Select any published form
    const formSelect = page.locator('select').first();
    await formSelect.selectOption({ index: 1 });

    // Wait for preview to load
    await page.waitForSelector('.subtleforms-form, .subtleforms');

    // ASSERTION: Form container should be visible
    const form = page.locator('.subtleforms-form, .subtleforms').first();
    await expect(form).toBeVisible();

    // ASSERTION: Form should have height (not collapsed)
    const boundingBox = await form.boundingBox();
    expect(boundingBox.height).toBeGreaterThan(50);

    // Publish and test frontend
    await page.click('button:has-text("Publish")');
    await page.click('button:has-text("Publish")');
    await page.click('a:has-text("View Page")');

    // ASSERTION: Inputs should be visible and usable
    const input = page.locator('input[type="text"], input[type="email"]').first();
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();

    // ASSERTION: Buttons should be clickable
    const button = page.locator('button.subtleforms-button').first();
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();

    // Take screenshot for visual verification
    await page.screenshot({ path: 'tests/e2e/screenshots/form-styling.png', fullPage: true });
  });
});
