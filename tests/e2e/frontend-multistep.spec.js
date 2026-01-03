/**
 * Phase 6.3 E2E Tests - Multi-Step Frontend Flow
 *
 * Tests frontend submission behavior:
 * - No auto-submit on Next button
 * - Explicit submit only on last step
 * - Back button navigation
 * - Multi-step navigation flow
 */

const { test, expect } = require('@playwright/test');

test.describe('[F2] Multi-Step Frontend - Flow + No Auto Submit', () => {
  test('[T8] Next button does NOT submit form', async ({ page }) => {
    // Listen for form submissions
    let submitIntercepted = false;
    await page.route('**/wp-json/subtleforms/v1/submissions**', (route) => {
      submitIntercepted = true;
      route.continue();
    });

    // Navigate to a page with multi-step form embedded
    // NOTE: You'll need to create a test page with the form first
    await page.goto('/test-multistep-form/');

    // Wait for form to load
    await page.waitForSelector('.subtleforms-form, [data-subtleforms-form]', { timeout: 5000 });

    // Fill first field
    const firstField = page.locator('input[type="text"]').first();
    await firstField.fill('John');

    // Click Next button (should NOT submit)
    const nextButton = page.locator('button:has-text("Next")');
    await nextButton.click();

    // Wait a bit
    await page.waitForTimeout(1000);

    // ASSERTION: No submission should have occurred
    expect(submitIntercepted).toBe(false);

    // Verify we moved to step 2
    const step2Indicator = page.locator('[data-step="2"], .subtleforms-step[data-active="true"]');
    await expect(step2Indicator).toBeVisible();
  });

  test('[T9] Submit button DOES submit on last step', async ({ page }) => {
    let submitIntercepted = false;
    await page.route('**/wp-json/subtleforms/v1/submissions**', (route) => {
      submitIntercepted = true;
      route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true, message: 'Form submitted' }),
      });
    });

    await page.goto('/test-multistep-form/');
    await page.waitForSelector('.subtleforms-form, [data-subtleforms-form]');

    // Navigate through all steps
    const nextButton = page.locator('button:has-text("Next")');

    // Fill and click Next until last step
    while (await nextButton.isVisible()) {
      // Fill any visible required fields
      const textInputs = page.locator('input[type="text"]:visible');
      for (let i = 0; i < (await textInputs.count()); i++) {
        await textInputs.nth(i).fill(`Test ${i}`);
      }

      await nextButton.click();
      await page.waitForTimeout(500);
    }

    // Now on last step - find Submit button
    const submitButton = page.locator('button[type="submit"]:has-text("Submit")');
    await submitButton.click();

    // Wait for submission
    await page.waitForTimeout(1000);

    // ASSERTION: Submit should have been intercepted
    expect(submitIntercepted).toBe(true);
  });

  test('[T10] Back button navigates to previous step', async ({ page }) => {
    await page.goto('/test-multistep-form/');
    await page.waitForSelector('.subtleforms-form, [data-subtleforms-form]');

    // Click Next to go to step 2
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Verify on step 2
    const step2 = page.locator('[data-step="2"]');
    await expect(step2).toBeVisible();

    // Click Back
    await page.click('button:has-text("Back"), button:has-text("Previous")');
    await page.waitForTimeout(500);

    // ASSERTION: Should be back on step 1
    const step1 = page.locator('[data-step="1"]');
    await expect(step1).toBeVisible();
  });

  test('[T11] Multi-step flow with field validation', async ({ page }) => {
    await page.goto('/test-multistep-form/');
    await page.waitForSelector('.subtleforms-form, [data-subtleforms-form]');

    // Try to click Next without filling required fields
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Should see validation error
    const error = page.locator('.subtleforms-error, .error, [role="alert"]');
    await expect(error).toBeVisible();

    // Fill required field
    await page.fill('input[required]', 'Valid Input');

    // Now Next should work
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(500);

    // Should be on step 2
    const step2 = page.locator('[data-step="2"]');
    await expect(step2).toBeVisible();
  });
});
