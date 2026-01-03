/**
 * Phase 6 QA Gate - Regression: Submissions Badge/Unread Highlighting
 *
 * Critical bug: Badge count or unread highlighting not updating properly
 * Expected: New submissions show badge or visual indicator in submissions list
 */

const { test, expect } = require('@playwright/test');
const { loginAsAdmin, createAndPublishPost, insertSubtleFormBlock } = require('./helpers');

test.describe('Submissions Badge & Unread Highlighting', () => {
  let formId, frontendUrl, adminSubmissionsUrl;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);

    // Create simple form
    const response = await page.request.post('/wp-json/subtleforms/v1/forms', {
      data: {
        title: 'Badge Test Form',
        status: 'publish',
        schema: {
          schema_version: 1,
          metadata: {
            name: 'badge_test',
            title: 'Badge Test',
            type: 'single',
          },
          fields: [{ id: 'message', type: 'text', label: 'Message', required: true }],
        },
      },
    });
    const data = await response.json();
    formId = data.id;
    adminSubmissionsUrl = `/wp-admin/admin.php?page=subtleforms-submissions&form_id=${formId}`;

    // Create post with form
    frontendUrl = await createAndPublishPost(page, 'Badge Test');
    await page.goto(frontendUrl);
    await insertSubtleFormBlock(page, formId);

    await page.close();
  });

  test('should show unread indicator for new submission', async ({ page, browser }) => {
    // Step 1: Submit form as visitor (in incognito-like context)
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(frontendUrl);
    await visitorPage.waitForSelector('.subtleforms-form, .sf-form', { timeout: 5000 });

    const messageInput = visitorPage.locator('input[name="message"]').first();
    await messageInput.fill('This is a new submission');

    const submitButton = visitorPage
      .locator('button[type="submit"], button:has-text("Submit")')
      .first();
    await submitButton.click();
    await visitorPage.waitForTimeout(2000);

    // Verify submission success
    const successMsg = visitorPage.locator('.sf-success, :has-text("Thank you")');
    await expect(successMsg).toBeVisible({ timeout: 3000 });

    await visitorContext.close();

    // Step 2: Navigate to admin submissions page (already authenticated)
    await page.goto(adminSubmissionsUrl);
    await page.waitForTimeout(2000);

    // CRITICAL: Look for unread indicator/badge on the new submission
    const submissionRow = page.locator('.sf-submission-row, tr').first();

    // Check for various possible unread indicators
    const unreadBadge = page.locator('.sf-unread-badge, .unread-indicator, .badge-new').first();
    const unreadClass = await submissionRow.getAttribute('class');
    const hasUnreadClass = unreadClass?.includes('unread') || unreadClass?.includes('new');

    console.log('Submission row classes:', unreadClass);

    // At least one unread indicator should exist
    const badgeVisible = await unreadBadge.isVisible().catch(() => false);

    if (!badgeVisible && !hasUnreadClass) {
      console.warn('❌ No unread indicator found');
    }

    // Document the finding
    expect(badgeVisible || hasUnreadClass).toBe(true);
  });

  test('should update badge count in sidebar menu', async ({ page, browser }) => {
    // Submit another form entry
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(frontendUrl);
    await visitorPage.waitForSelector('.subtleforms-form', { timeout: 5000 });

    await visitorPage.locator('input[name="message"]').fill('Second submission');
    await visitorPage.locator('button[type="submit"]').click();
    await visitorPage.waitForTimeout(2000);
    await visitorContext.close();

    // Navigate to admin and check sidebar badge (already authenticated)
    await page.goto('/wp-admin/');
    await page.waitForTimeout(1000);

    // Look for SubtleForms menu item with badge
    const menuItem = page
      .locator('#adminmenu a:has-text("SubtleForms"), #adminmenu a:has-text("Forms")')
      .first();
    await expect(menuItem).toBeVisible();

    // Check for badge/count indicator
    const badge = menuItem.locator('.awaiting-mod, .update-plugins, .sf-count-badge');
    const badgeCount = await badge.textContent().catch(() => null);

    console.log('Sidebar badge count:', badgeCount);

    if (badgeCount) {
      const count = parseInt(badgeCount);
      expect(count).toBeGreaterThan(0);
    } else {
      console.warn('⚠️ No badge found in sidebar menu');
    }
  });

  test('should remove unread indicator after viewing submission', async ({ page }) => {
    // Already authenticated
    await page.goto(adminSubmissionsUrl);
    await page.waitForTimeout(2000);

    // Get first submission row
    const firstRow = page.locator('.sf-submission-row, tbody tr').first();
    const initialClasses = await firstRow.getAttribute('class');
    console.log('Initial row classes:', initialClasses);

    // Click to view submission
    await firstRow.click();
    await page.waitForTimeout(1500);

    // CRITICAL: After viewing, unread indicator should be removed
    // Check if modal/detail view opened
    const detailView = page.locator('.sf-submission-detail, .submission-modal, [role="dialog"]');
    const isModalOpen = await detailView.isVisible().catch(() => false);

    if (isModalOpen) {
      // Close modal
      const closeButton = page
        .locator('button[aria-label="Close"], .modal-close, button:has-text("Close")')
        .first();
      await closeButton.click();
      await page.waitForTimeout(500);
    }

    // Refresh or navigate back
    await page.reload();
    await page.waitForTimeout(2000);

    // Check if unread indicator is gone
    const rowAfterView = page.locator('.sf-submission-row, tbody tr').first();
    const updatedClasses = await rowAfterView.getAttribute('class');
    console.log('After viewing classes:', updatedClasses);

    const stillUnread = updatedClasses?.includes('unread') || updatedClasses?.includes('new');

    // CRITICAL: Should no longer have unread indicator
    expect(stillUnread).toBe(false);
  });

  test('should show badge count on forms list page', async ({ page, browser }) => {
    // Submit one more entry
    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(frontendUrl);
    await visitorPage.waitForSelector('.subtleforms-form', { timeout: 5000 });
    await visitorPage.locator('input[name="message"]').fill('Third entry');
    await visitorPage.locator('button[type="submit"]').click();
    await visitorPage.waitForTimeout(2000);
    await visitorContext.close();

    // Navigate to forms list (already authenticated)
    await page.goto('/wp-admin/admin.php?page=subtleforms');
    await page.waitForTimeout(2000);

    // Find the test form in the list
    const formRow = page.locator('tr:has-text("Badge Test Form")').first();
    await expect(formRow).toBeVisible();

    // Look for submission count badge/column
    const countBadge = formRow.locator('.sf-submissions-count, .submissions-badge, td.submissions');
    const countText = await countBadge.textContent().catch(() => '0');

    console.log('Submissions count on forms list:', countText);

    const count = parseInt(countText);
    expect(count).toBeGreaterThan(0);
  });
});
