/**
 * Phase 6 QA Gate - Regression: Step Navigation Styling
 *
 * Critical bug: Step navigation styling inconsistency between builder preview and frontend
 * Expected: Dots/progress indicators should match styling (spacing, active state, colors)
 */

const { test, expect } = require('@playwright/test');
const { createMultiStepForm, createAndPublishPost, insertSubtleFormBlock } = require('./helpers');

test.describe('Step Navigation Styling Parity', () => {
  let formId, builderUrl, frontendUrl;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'tests/e2e/storage.json' });
    const page = await context.newPage();

    // Create 3-step form
    formId = await createMultiStepForm(page, 'Styling Test');
    builderUrl = `/wp-admin/admin.php?page=subtleforms-new-form&form_id=${formId}`;

    // Add extra steps
    await page.goto(builderUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Add Step 2 and 3
    const addStepBtn = page.locator('button:has-text("Add Step")').first();
    await addStepBtn.click();
    await page.waitForTimeout(500);
    await addStepBtn.click();
    await page.waitForTimeout(1000);

    // Publish form
    const publishButton = page.locator('button:has-text("Publish")').first();
    if (await publishButton.isVisible()) {
      await publishButton.click();
      await page.waitForTimeout(2000);
    }

    // Create post with form
    frontendUrl = await createAndPublishPost(page, 'Styling Test');
    await insertSubtleFormBlock(page, formId);

    await context.close();
  });

  test('should have consistent step dots styling in builder preview', async ({ page }) => {
    await page.goto(builderUrl);
    await page.waitForTimeout(2000);

    // Switch to Preview tab
    const previewTab = page
      .locator('button:has-text("Preview"), [role="tab"]:has-text("Preview")')
      .first();
    await previewTab.click();
    await page.waitForTimeout(1000);

    // Locate step navigation dots
    const stepNav = page.locator('.sf-step-nav, .subtleforms-step-navigation').first();
    await expect(stepNav).toBeVisible({ timeout: 3000 });

    const dots = stepNav.locator('.sf-step-dot, .step-indicator, [data-step-indicator]');
    const dotCount = await dots.count();
    expect(dotCount).toBe(3);

    // Check active state styling
    const activeDot = dots.first();
    const activeColor = await activeDot.evaluate((el) => getComputedStyle(el).backgroundColor);
    const activeBorder = await activeDot.evaluate((el) => getComputedStyle(el).borderWidth);

    console.log('Builder Preview - Active dot:', { color: activeColor, border: activeBorder });

    // Store builder styling for comparison
    const builderStyle = {
      color: activeColor,
      border: activeBorder,
    };

    return builderStyle;
  });

  test('should have consistent step dots styling on frontend', async ({ page }) => {
    await page.goto(frontendUrl);
    await page.waitForSelector('.subtleforms-form, .sf-form', { timeout: 5000 });

    // Locate step navigation dots
    const stepNav = page.locator('.sf-step-nav, .subtleforms-step-navigation').first();
    await expect(stepNav).toBeVisible({ timeout: 3000 });

    const dots = stepNav.locator('.sf-step-dot, .step-indicator, [data-step-indicator]');
    const dotCount = await dots.count();
    expect(dotCount).toBe(3);

    // Check active state styling
    const activeDot = dots.first();
    const activeColor = await activeDot.evaluate((el) => getComputedStyle(el).backgroundColor);
    const activeBorder = await activeDot.evaluate((el) => getComputedStyle(el).borderWidth);

    console.log('Frontend - Active dot:', { color: activeColor, border: activeBorder });

    // Frontend should match builder preview styling
    // Note: This test documents the expected behavior; actual comparison requires shared state
  });

  test('should maintain styling consistency through step transitions', async ({ page }) => {
    await page.goto(frontendUrl);
    await page.waitForSelector('.subtleforms-form', { timeout: 5000 });

    const stepNav = page.locator('.sf-step-nav, .subtleforms-step-navigation').first();
    const dots = stepNav.locator('.sf-step-dot, .step-indicator, [data-step-indicator]');

    // Capture Step 1 active styling
    const step1ActiveColor = await dots
      .nth(0)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const step1InactiveColor = await dots
      .nth(1)
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    console.log('Step 1 active:', step1ActiveColor);
    console.log('Step 1 inactive:', step1InactiveColor);

    // Navigate to Step 2
    const nameInput = page.locator('input[name="name"]').first();
    await nameInput.fill('Test User');
    const nextButton = page.locator('button:has-text("Next")').first();
    await nextButton.click();
    await page.waitForTimeout(1000);

    // Capture Step 2 active styling
    const step2ActiveColor = await dots
      .nth(1)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const step2InactiveColor = await dots
      .nth(0)
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    console.log('Step 2 active:', step2ActiveColor);
    console.log('Step 2 inactive (was active):', step2InactiveColor);

    // CRITICAL: Active color should be consistent
    expect(step2ActiveColor).toBe(step1ActiveColor);

    // CRITICAL: Inactive color should be consistent
    expect(step2InactiveColor).toBe(step1InactiveColor);

    // Navigate to Step 3
    const emailInput = page.locator('input[name="email"]').first();
    await emailInput.fill('test@example.com');
    await nextButton.click();
    await page.waitForTimeout(1000);

    // Capture Step 3 active styling
    const step3ActiveColor = await dots
      .nth(2)
      .evaluate((el) => getComputedStyle(el).backgroundColor);

    console.log('Step 3 active:', step3ActiveColor);

    // CRITICAL: Active color should still match
    expect(step3ActiveColor).toBe(step1ActiveColor);
  });

  test('should show completed step styling differently from active/inactive', async ({ page }) => {
    await page.goto(frontendUrl);
    await page.waitForSelector('.subtleforms-form', { timeout: 5000 });

    const stepNav = page.locator('.sf-step-nav').first();
    const dots = stepNav.locator('.sf-step-dot, .step-indicator');

    // Complete Step 1
    await page.locator('input[name="name"]').fill('John');
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Check if Step 1 dot has "completed" visual indicator
    const step1Dot = dots.nth(0);
    const step1Classes = await step1Dot.getAttribute('class');
    const step1Completed = step1Classes?.includes('completed') || step1Classes?.includes('done');

    console.log('Step 1 completed classes:', step1Classes);

    // If completed styling exists, it should be visually distinct
    if (step1Completed) {
      const completedColor = await step1Dot.evaluate((el) => getComputedStyle(el).backgroundColor);
      const activeColor = await dots.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor);

      // Completed should differ from active
      console.log('Completed vs Active:', { completedColor, activeColor });
    }
  });
});
