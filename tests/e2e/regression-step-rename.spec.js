/**
 * Phase 6 QA Gate - Regression: Step Rename & Field Rename
 *
 * Critical bugs to test:
 * 1. Step rename must work (Step 1: Untitled → Step 1: Main)
 * 2. Renaming a field must NOT rename the step
 * 3. Fields must NOT duplicate across steps
 */

const { test, expect } = require('@playwright/test');
const { createMultiStepForm } = require('./helpers');

test.describe('Step Rename & Field Isolation', () => {
  let formId;

  test.beforeEach(async ({ page }) => {
    // Create a fresh form for each test
    formId = await createMultiStepForm(page, 'Step Rename Test');
  });

  test('should rename step title without affecting field labels', async ({ page }) => {
    // Builder page should already be loaded from createMultiStepForm
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // First step should already exist in multistep forms
    // Look for step in the step navigator
    const step1Tab = page.locator('button:has-text("Step 1")').first();
    await step1Tab.waitFor({ state: 'visible', timeout: 5000 });
    await step1Tab.click();
    await page.waitForTimeout(500);

    // Rename Step 1 to "Main"
    // Look for step title input/editable element
    const stepTitleInput = page
      .locator('input[placeholder*="Step"], input[value*="Step 1"]')
      .first();
    if (await stepTitleInput.isVisible()) {
      await stepTitleInput.fill('Main');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    } else {
      // Alternative: click on step title to edit inline
      const stepTitle = page.locator('.sf-step-title, .subtleforms-step-title').first();
      await stepTitle.click();
      await page.keyboard.type('Main');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }

    // Verify step tab shows "Step 1: Main"
    const updatedTab = page.locator('button:has-text("Step 1: Main"), button:has-text("Main")');
    await expect(updatedTab).toBeVisible({ timeout: 3000 });

    // Add a text field to Step 1
    const fieldsPanel = page.locator('.sf-fields-panel, .subtleforms-fields-sidebar').first();
    const textFieldButton = fieldsPanel
      .locator('button:has-text("Text"), [data-field-type="text"]')
      .first();
    await textFieldButton.click();
    await page.waitForTimeout(1000);

    // Rename the field to "First Name"
    const fieldLabel = page
      .locator('input[placeholder*="Label"], input[placeholder*="Field"]')
      .first();
    await fieldLabel.fill('First Name');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // CRITICAL: Verify step title is still "Main" (not "First Name")
    const stepTabAfterFieldRename = page.locator(
      'button:has-text("Step 1: Main"), button:has-text("Main")'
    );
    await expect(stepTabAfterFieldRename).toBeVisible();

    // Verify field shows "First Name"
    const fieldInCanvas = page.locator('.sf-field-chrome:has-text("First Name")');
    await expect(fieldInCanvas).toBeVisible();
  });

  test('should not duplicate fields across steps', async ({ page }) => {
    // Builder page should already be loaded from createMultiStepForm
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Select Step 1
    const step1Tab = page.locator('button:has-text("Step 1")').first();
    await step1Tab.click();
    await page.waitForTimeout(500);

    // Add "Last Name" field to Step 1
    const fieldsPanel = page.locator('.sf-fields-panel, .subtleforms-fields-sidebar').first();
    const textFieldButton = fieldsPanel
      .locator('button:has-text("Text"), [data-field-type="text"]')
      .first();
    await textFieldButton.click();
    await page.waitForTimeout(1000);

    const fieldLabel = page.locator('input[placeholder*="Label"]').first();
    await fieldLabel.fill('Last Name');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Count fields in Step 1
    const step1Fields = await page.locator('.sf-field-chrome, .subtleforms-field-chrome').count();
    console.log(`Step 1 has ${step1Fields} fields`);

    // Add Step 2
    const addStepButton = page.locator('button:has-text("Add Step")').first();
    await addStepButton.click();
    await page.waitForTimeout(1000);

    // Select Step 2
    const step2Tab = page.locator('button:has-text("Step 2")').first();
    await step2Tab.click();
    await page.waitForTimeout(500);

    // Add "Message" field to Step 2
    const textareaButton = fieldsPanel
      .locator('button:has-text("Textarea"), [data-field-type="textarea"]')
      .first();
    await textareaButton.click();
    await page.waitForTimeout(1000);

    const messageLabel = page.locator('input[placeholder*="Label"]').first();
    await messageLabel.fill('Message');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Count fields in Step 2 (should be 1)
    const step2Fields = await page.locator('.sf-field-chrome, .subtleforms-field-chrome').count();
    console.log(`Step 2 has ${step2Fields} fields`);

    // CRITICAL: Step 2 should have ONLY "Message", not Step 1's fields
    expect(step2Fields).toBe(1);

    // Go back to Step 1
    await step1Tab.click();
    await page.waitForTimeout(500);

    // CRITICAL: Step 1 should still have its original fields (not Message)
    const step1FieldsAfter = await page
      .locator('.sf-field-chrome, .subtleforms-field-chrome')
      .count();
    expect(step1FieldsAfter).toBe(step1Fields); // Should match original count

    // Verify "Message" field is NOT in Step 1
    const messageInStep1 = page.locator('.sf-field-chrome:has-text("Message")');
    await expect(messageInStep1).not.toBeVisible();
  });
});
