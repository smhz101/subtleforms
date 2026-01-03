/**
 * Phase 6.3 E2E Tests - Multi-Step Builder Core
 *
 * Tests builder functionality for multi-step forms:
 * - Field isolation per step
 * - Step renaming
 * - Field label editing doesn't affect step name
 * - Selection behavior
 */

const { test, expect } = require('@playwright/test');

// Helper to login as admin
async function loginAsAdmin(page) {
  await page.goto('/wp-admin');

  // Check if already logged in
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

test.describe('[F1] Multi-Step Builder - Core Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('[T1] Create multistep form with no field duplication', async ({ page }) => {
    // Navigate to SubtleForms
    await page.goto('/wp-admin/admin.php?page=subtleforms');

    // Create new form
    await page.click('button:has-text("New Form"), a:has-text("New Form")');

    // Wait for form creator
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });

    // Enter form title
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill('E2E Test Multistep Form');

    // Select multistep type if dropdown exists
    const typeSelect = page.locator('select').first();
    if (await typeSelect.isVisible().catch(() => false)) {
      await typeSelect.selectOption('multistep');
    }

    // Click create/continue
    await page.click('button:has-text("Create"), button:has-text("Continue")');

    // Wait for builder to load
    await page.waitForURL('**/admin.php?page=subtleforms&action=edit**', { timeout: 10000 });

    // Add first step if not exists
    const addStepButton = page.locator(
      'button:has-text("Add Step"), button:has-text("Add First Step")'
    );
    if (await addStepButton.isVisible()) {
      await addStepButton.click();
      await page.waitForTimeout(500);
    }

    // Ensure Step 1 is selected
    const step1Tab = page.locator('button:has-text("Step 1")').first();
    await step1Tab.click();
    await page.waitForTimeout(300);

    // Add First Name field to Step 1
    await page
      .dragAndDrop(
        '[data-field-type="text"], .sf-field-item:has-text("Text")',
        '.subtleforms-step-canvas, .sf-canvas'
      )
      .catch(async () => {
        // Fallback: click to add
        await page.click('[data-field-type="text"], .sf-field-item:has-text("Text")');
      });
    await page.waitForTimeout(500);

    // Add Last Name field to Step 1
    await page
      .dragAndDrop(
        '[data-field-type="text"], .sf-field-item:has-text("Text")',
        '.subtleforms-step-canvas, .sf-canvas'
      )
      .catch(async () => {
        await page.click('[data-field-type="text"], .sf-field-item:has-text("Text")');
      });
    await page.waitForTimeout(500);

    // Count fields in Step 1 canvas
    const step1Fields = await page.locator('.subtleforms-field-chrome, .sf-field-chrome').count();

    // Add Step 2
    await page.click('button:has-text("Add Step")');
    await page.waitForTimeout(500);

    // Select Step 2
    const step2Tab = page.locator('button:has-text("Step 2")').first();
    await step2Tab.click();
    await page.waitForTimeout(300);

    // Add Message textarea to Step 2
    await page
      .dragAndDrop(
        '[data-field-type="textarea"], .sf-field-item:has-text("Textarea")',
        '.subtleforms-step-canvas, .sf-canvas'
      )
      .catch(async () => {
        await page.click('[data-field-type="textarea"], .sf-field-item:has-text("Textarea")');
      });
    await page.waitForTimeout(500);

    // Count fields in Step 2 canvas
    const step2Fields = await page.locator('.subtleforms-field-chrome, .sf-field-chrome').count();

    // ASSERTIONS
    expect(step1Fields).toBe(2); // Should have exactly 2 fields
    expect(step2Fields).toBe(1); // Should have exactly 1 field

    // Switch back to Step 1 and verify still only 2 fields
    await step1Tab.click();
    await page.waitForTimeout(300);
    const step1FieldsAfter = await page
      .locator('.subtleforms-field-chrome, .sf-field-chrome')
      .count();
    expect(step1FieldsAfter).toBe(2); // No duplication after switching

    // Switch to Step 2 and verify Message field is there
    await step2Tab.click();
    await page.waitForTimeout(300);
    const step2FieldsAfter = await page
      .locator('.subtleforms-field-chrome, .sf-field-chrome')
      .count();
    expect(step2FieldsAfter).toBe(1); // No First Name/Last Name leaked
  });

  test('[T2] Step rename updates tab and canvas header', async ({ page }) => {
    // Use existing form or create new one
    await page.goto('/wp-admin/admin.php?page=subtleforms');

    // Open first form in list
    await page.locator('a[href*="action=edit"]').first().click();
    await page.waitForURL('**/admin.php?page=subtleforms&action=edit**');

    // Ensure it's multistep with at least one step
    const step1Tab = page.locator('button:has-text("Step 1")').first();
    await step1Tab.click();
    await page.waitForTimeout(300);

    // Click step canvas header to select step (not a field)
    await page.click('.sf-bg-blue-50, .subtleforms-step-canvas > div:first-child');
    await page.waitForTimeout(300);

    // Look for Step Title field in inspector
    const stepTitleInput = page
      .locator('input[label*="Step Title"], .components-text-control__input')
      .filter({ hasText: /step/i })
      .first();

    if (await stepTitleInput.isVisible()) {
      await stepTitleInput.clear();
      await stepTitleInput.fill('Personal Information');
      await stepTitleInput.blur();
      await page.waitForTimeout(500);

      // ASSERTION: Tab should update
      await expect(step1Tab).toContainText('Personal Information');
    }
  });

  test('[T3] Field label edit does NOT rename step', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=subtleforms');
    await page.locator('a[href*="action=edit"]').first().click();
    await page.waitForURL('**/admin.php?page=subtleforms&action=edit**');

    const step1Tab = page.locator('button:has-text("Step 1")').first();
    const originalStepName = await step1Tab.textContent();

    // Select a field (not step)
    await page.click('.subtleforms-field-chrome, .sf-field-chrome').first();
    await page.waitForTimeout(300);

    // Change field label
    const fieldLabelInput = page
      .locator('input[label*="Field Label"], .components-text-control__input')
      .first();
    await fieldLabelInput.clear();
    await fieldLabelInput.fill('Modified Field Label');
    await fieldLabelInput.blur();
    await page.waitForTimeout(500);

    // ASSERTION: Step name should NOT change
    const newStepName = await step1Tab.textContent();
    expect(newStepName).toBe(originalStepName);
  });

  test('[T5] Insert field is step-scoped', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=subtleforms');
    await page.locator('a[href*="action=edit"]').first().click();
    await page.waitForURL('**/admin.php?page=subtleforms&action=edit**');

    // Go to Step 2
    const step2Tab = page.locator('button:has-text("Step 2")');
    if (await step2Tab.isVisible()) {
      await step2Tab.click();
      await page.waitForTimeout(300);

      const beforeCount = await page.locator('.subtleforms-field-chrome, .sf-field-chrome').count();

      // Add email field
      await page.click('[data-field-type="email"], .sf-field-item:has-text("Email")');
      await page.waitForTimeout(500);

      const afterCount = await page.locator('.subtleforms-field-chrome, .sf-field-chrome').count();
      expect(afterCount).toBe(beforeCount + 1);

      // Switch to Step 1 - should NOT have the email field
      await page.click('button:has-text("Step 1")').first();
      await page.waitForTimeout(300);

      const step1Count = await page.locator('.subtleforms-field-chrome, .sf-field-chrome').count();
      // Just verify it's different (exact count depends on existing fields)
      expect(step1Count).not.toBe(afterCount);
    }
  });

  test('[T15] Regression: No duplication after multiple step switches', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=subtleforms');
    await page.locator('a[href*="action=edit"]').first().click();
    await page.waitForURL('**/admin.php?page=subtleforms&action=edit**');

    const step1Tab = page.locator('button:has-text("Step 1")').first();
    const step2Tab = page.locator('button:has-text("Step 2")');

    if (await step2Tab.isVisible()) {
      // Get initial counts
      await step1Tab.click();
      await page.waitForTimeout(200);
      const initialStep1Count = await page
        .locator('.subtleforms-field-chrome, .sf-field-chrome')
        .count();

      await step2Tab.click();
      await page.waitForTimeout(200);
      const initialStep2Count = await page
        .locator('.subtleforms-field-chrome, .sf-field-chrome')
        .count();

      // Switch 10 times
      for (let i = 0; i < 10; i++) {
        await step1Tab.click();
        await page.waitForTimeout(100);
        await step2Tab.click();
        await page.waitForTimeout(100);
      }

      // Verify counts haven't changed
      await step1Tab.click();
      await page.waitForTimeout(200);
      const finalStep1Count = await page
        .locator('.subtleforms-field-chrome, .sf-field-chrome')
        .count();

      await step2Tab.click();
      await page.waitForTimeout(200);
      const finalStep2Count = await page
        .locator('.subtleforms-field-chrome, .sf-field-chrome')
        .count();

      expect(finalStep1Count).toBe(initialStep1Count);
      expect(finalStep2Count).toBe(initialStep2Count);
    }
  });
});
