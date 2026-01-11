/**
 * Phase 6 QA Gate - Regression: Auto-Submit Prevention
 *
 * Critical bug: Next button must NOT auto-submit the form
 * Expected: Next button transitions to next step (client-side only)
 * Bug: Next button triggers form submission to server
 */

const { test, expect } = require('@playwright/test');
const { createMultiStepForm, createAndPublishPost, insertSubtleFormBlock } = require('./helpers');

test.describe('Auto-Submit Prevention', () => {
  let postUrl, formId;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'tests/e2e/storage.json' });
    const page = await context.newPage();

    // Create multistep form with fields
    formId = await createMultiStepForm(page, 'Auto Submit Test');

    // Publish the form
    await page.goto(`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${formId}`);
    await page.waitForLoadState('networkidle');
    const publishButton = page.locator('button:has-text("Publish")').first();
    if (await publishButton.isVisible()) {
      await publishButton.click();
      await page.waitForTimeout(2000);
    }

    // Create post with form block
    postUrl = await createAndPublishPost(page, 'Auto Submit Test');
    await insertSubtleFormBlock(page, formId);

    await context.close();
  });

  test('Next button should not submit form to server', async ({ page }) => {
    // Listen for network requests to submission endpoint
    const submissionRequests = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/wp-json/subtleforms/v1/submissions') && request.method() === 'POST') {
        submissionRequests.push({ url, method: request.method() });
        console.log('❌ SUBMISSION REQUEST DETECTED:', url);
      }
    });

    await page.goto(postUrl);
    await page.waitForSelector('.subtleforms-form, .sf-form', { timeout: 5000 });

    // Fill Step 1
    const nameInput = page.locator('input[name="name"], input[aria-label="Name"]').first();
    await nameInput.fill('John Doe');
    await page.waitForTimeout(500);

    // CRITICAL: Click Next button (not Submit)
    const nextButton = page.locator('button:has-text("Next")').first();
    await nextButton.click();
    await page.waitForTimeout(1000);

    // CRITICAL: Verify NO submission was sent
    expect(submissionRequests.length).toBe(0);

    // Verify Step 2 is now visible
    const step2 = page.locator('.sf-step[data-step="step2"], .subtleforms-step-2').first();
    await expect(step2).toBeVisible({ timeout: 2000 });

    // Verify Step 1 is hidden
    const step1 = page.locator('.sf-step[data-step="step1"], .subtleforms-step-1').first();
    await expect(step1).toBeHidden();

    // Fill Step 2 and Submit
    const emailInput = page.locator('input[name="email"], input[aria-label="Email"]').first();
    await emailInput.fill('john@example.com');
    await page.waitForTimeout(500);

    // NOW click Submit button
    const submitButton = page.locator('button:has-text("Submit"), button[type="submit"]').first();
    await submitButton.click();
    await page.waitForTimeout(2000);

    // NOW a submission should be sent
    expect(submissionRequests.length).toBe(1);

    // Verify success message
    const successMessage = page.locator(
      '.sf-success, .subtleforms-success, :has-text("Thank you")'
    );
    await expect(successMessage).toBeVisible({ timeout: 3000 });
  });

  test('Back button should not submit form to server', async ({ page }) => {
    const submissionRequests = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/wp-json/subtleforms/v1/submissions') && request.method() === 'POST') {
        submissionRequests.push({ url });
        console.log('❌ SUBMISSION REQUEST DETECTED on Back:', url);
      }
    });

    await page.goto(postUrl);
    await page.waitForSelector('.subtleforms-form, .sf-form', { timeout: 5000 });

    // Navigate to Step 2
    const nameInput = page.locator('input[name="name"]').first();
    await nameInput.fill('Jane Smith');
    const nextButton = page.locator('button:has-text("Next")').first();
    await nextButton.click();
    await page.waitForTimeout(1000);

    // CRITICAL: Click Back button
    const backButton = page.locator('button:has-text("Back"), button:has-text("Previous")').first();
    await backButton.click();
    await page.waitForTimeout(1000);

    // CRITICAL: Verify NO submission was sent
    expect(submissionRequests.length).toBe(0);

    // Verify Step 1 is visible again
    const step1 = page.locator('.sf-step[data-step="step1"]').first();
    await expect(step1).toBeVisible();

    // Verify field value persisted
    await expect(nameInput).toHaveValue('Jane Smith');
  });
});
