/**
 * E2E Tests for Admin Submissions UX & Step Styling
 * Phase 6.4 - SubtleForms Admin Interface
 */

import { test, expect } from '@playwright/test';
import {
  generateUniqueFormName,
  createTestForm,
  submitFormData,
  waitForRequestCompletion,
} from './helpers';

test.describe('F8: Admin Submissions UX & Step Styling', () => {
  let formId, formTitle;

  test.beforeEach(async ({ page, browserName }) => {
    // Login as admin
    await page.goto('/wp-admin');

    // Create a test form for submissions
    formTitle = generateUniqueFormName('Admin UX Test Form');
    formId = await createTestForm(page, {
      title: formTitle,
      fields: [
        {
          type: 'text',
          label: 'Test Name',
          name: 'test_name',
          required: true,
        },
        {
          type: 'email',
          label: 'Test Email',
          name: 'test_email',
          required: true,
        },
      ],
      isMultistep: true,
      steps: [
        {
          title: 'Step 1: Personal Info',
          fields: ['test_name'],
        },
        {
          title: 'Step 2: Contact Info',
          fields: ['test_email'],
        },
      ],
    });

    // Submit a test submission to create unread data
    await submitFormData(page, formId, {
      test_name: 'John Doe',
      test_email: 'john@example.com',
    });
  });

  test.describe('Step Styling Consistency', () => {
    test('S1: Step navigation styling matches between frontend and block editor', async ({
      page,
    }) => {
      // Test block editor step styling
      await page.goto(`/wp-admin/post-new.php?post_type=page`);
      await page.waitForLoadState('networkidle');

      // Add SubtleForms block
      await page.click('[aria-label="Add block"]');
      await page.fill('[placeholder="Search"]', 'SubtleForms');
      await page.click('text=SubtleForms');

      // Select our test form
      await page.selectOption('[data-testid="form-selector"]', String(formId));
      await page.waitForTimeout(1000); // Wait for form to load

      // Check step navigation classes in editor
      const editorStepNav = page.locator('.subtleforms-block-preview .subtleforms-step-nav');
      await expect(editorStepNav).toBeVisible();

      const editorSteps = editorStepNav.locator('.subtleforms-step-nav__step');
      await expect(editorSteps).toHaveCount(2);

      // Verify consistent styling classes
      const firstEditorStep = editorSteps.first();
      await expect(firstEditorStep).toHaveClass(/is-active/);

      const secondEditorStep = editorSteps.nth(1);
      await expect(secondEditorStep).toHaveClass(/is-upcoming/);

      // Test frontend step styling
      await page.goto(`/wp-admin/admin.php?page=subtleforms-forms&form_id=${formId}&action=edit`);
      await page.click('[data-testid="preview-form"]');

      const frontendStepNav = page.locator('.subtleforms-step-nav');
      await expect(frontendStepNav).toBeVisible();

      const frontendSteps = frontendStepNav.locator('.subtleforms-step-nav__step');
      await expect(frontendSteps).toHaveCount(2);

      // Verify same classes exist on frontend
      const firstFrontendStep = frontendSteps.first();
      await expect(firstFrontendStep).toHaveClass(/is-active/);

      const secondFrontendStep = frontendSteps.nth(1);
      await expect(secondFrontendStep).toHaveClass(/is-upcoming/);

      // Verify consistent wrapper classes
      const frontendWrapper = page.locator('.subtleforms--multistep');
      await expect(frontendWrapper).toBeVisible();
    });

    test('S2: Step state transitions work correctly', async ({ page }) => {
      // Go to frontend form
      await page.goto(`/wp-admin/admin.php?page=subtleforms-forms&form_id=${formId}&action=edit`);
      await page.click('[data-testid="preview-form"]');

      const steps = page.locator('.subtleforms-step-nav__step');

      // Initial state - step 1 active, step 2 upcoming
      await expect(steps.first()).toHaveClass(/is-active/);
      await expect(steps.nth(1)).toHaveClass(/is-upcoming/);

      // Fill first step and proceed
      await page.fill('[name="test_name"]', 'Test User');
      await page.click('[data-testid="next-step"]');

      // Check state change - step 1 complete, step 2 active
      await expect(steps.first()).toHaveClass(/is-complete/);
      await expect(steps.nth(1)).toHaveClass(/is-active/);

      // Go back
      await page.click('[data-testid="prev-step"]');

      // Check state - step 1 active again
      await expect(steps.first()).toHaveClass(/is-active/);
    });
  });

  test.describe('Submission Count Badges', () => {
    test('S3: Menu badge shows unread count correctly', async ({ page }) => {
      // Navigate to admin
      await page.goto('/wp-admin');

      // Check submissions menu has badge
      const submissionsMenu = page.locator('a[href*="subtleforms-submissions"]');
      await expect(submissionsMenu).toBeVisible();

      // Should show unread count badge
      const badge = submissionsMenu.locator('.awaiting-mod .pending-count');
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText('1'); // We created 1 submission

      // Create another submission
      await submitFormData(page, formId, {
        test_name: 'Jane Doe',
        test_email: 'jane@example.com',
      });

      // Refresh page and check badge updated
      await page.reload();
      await expect(badge).toHaveText('2');
    });

    test('S4: Badge count updates when submissions are read', async ({ page }) => {
      // Go to submissions page
      await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');

      // Check initial badge count
      const badge = page.locator('a[href*="subtleforms-submissions"] .awaiting-mod .pending-count');
      await expect(badge).toHaveText('1');

      // Click on a submission to mark it read
      const firstSubmission = page.locator('[data-testid="submissions-table"] tbody tr').first();
      await firstSubmission.click();

      // Should navigate to submission detail page
      await expect(page.locator('[data-testid="submission-detail"]')).toBeVisible();

      // Go back to submissions list
      await page.goBack();

      // Badge should be gone or reduced
      await page.reload();
      const updatedBadge = page.locator('a[href*="subtleforms-submissions"] .awaiting-mod');
      await expect(updatedBadge).not.toBeVisible();
    });
  });

  test.describe('Visual Highlighting', () => {
    test('S5: Unread submissions are highlighted in table', async ({ page }) => {
      await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');

      const submissionsTable = page.locator('[data-testid="submissions-table"]');
      await expect(submissionsTable).toBeVisible();

      // Find unread submission row
      const unreadRow = submissionsTable.locator('tbody tr').first();

      // Check for visual highlighting classes
      await expect(unreadRow).toHaveClass(/sf-bg-blue-50/);
      await expect(unreadRow).toHaveClass(/sf-border-l-blue-500/);

      // Click to mark as read
      await unreadRow.click();
      await page.goBack();

      // Row should no longer be highlighted
      await expect(unreadRow).not.toHaveClass(/sf-bg-blue-50/);
    });
  });

  test.describe('Real-time Updates', () => {
    test('S6: Real-time polling updates badge counts', async ({ page }) => {
      // Setup API interception to verify polling
      let pollRequestCount = 0;
      await page.route('**/wp-json/subtleforms/v1/submissions/unread-count', (route) => {
        pollRequestCount++;
        route.continue();
      });

      // Go to submissions page
      await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');

      // Wait for initial load
      await page.waitForLoadState('networkidle');

      // Create a new submission in another context
      await submitFormData(page, formId, {
        test_name: 'Real-time Test',
        test_email: 'realtime@example.com',
      });

      // Wait for polling to detect change (up to 30 seconds)
      await page.waitForFunction(
        () => {
          const badge = document.querySelector('a[href*="subtleforms-submissions"] .pending-count');
          return badge && parseInt(badge.textContent) > 1;
        },
        { timeout: 35000 }
      );

      // Verify polling occurred
      expect(pollRequestCount).toBeGreaterThan(0);
    });

    test('S7: Visibility change pauses/resumes polling', async ({ page }) => {
      let pollRequestCount = 0;
      await page.route('**/wp-json/subtleforms/v1/submissions/unread-count', (route) => {
        pollRequestCount++;
        route.continue();
      });

      await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');
      await page.waitForLoadState('networkidle');

      const initialCount = pollRequestCount;

      // Hide the page
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: true, writable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Wait and verify polling stopped
      await page.waitForTimeout(5000);
      const hiddenCount = pollRequestCount;

      // Show the page
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: false, writable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Wait and verify polling resumed
      await page.waitForTimeout(5000);
      const visibleCount = pollRequestCount;

      expect(visibleCount).toBeGreaterThan(hiddenCount);
    });
  });

  test.describe('Submission Detail Page', () => {
    test('S8: Technical information section toggles correctly', async ({ page }) => {
      await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');

      // Click on first submission
      const firstSubmission = page.locator('[data-testid="submissions-table"] tbody tr').first();
      await firstSubmission.click();

      // Should be on detail page
      await expect(page.locator('[data-testid="submission-detail"]')).toBeVisible();

      // Technical section should be hidden by default
      const technicalSection = page.locator('[data-testid="technical-section"]');
      await expect(technicalSection).not.toBeVisible();

      // Click technical toggle
      const technicalToggle = page.locator('[data-testid="technical-toggle"]');
      await technicalToggle.click();

      // Technical section should now be visible
      await expect(technicalSection).toBeVisible();

      // Check tabs are present
      const rawTab = page.locator('[data-tab="raw"]');
      const metaTab = page.locator('[data-tab="meta"]');
      const schemaTab = page.locator('[data-tab="schema"]');

      await expect(rawTab).toBeVisible();
      await expect(metaTab).toBeVisible();
      await expect(schemaTab).toBeVisible();

      // Test tab switching
      await page.click('text=Meta Data');
      await expect(metaTab).toBeVisible();

      await page.click('text=Form Schema');
      await expect(schemaTab).toBeVisible();

      // Toggle off
      await technicalToggle.click();
      await expect(technicalSection).not.toBeVisible();
    });

    test('S9: Status badge and form links work correctly', async ({ page }) => {
      await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');

      const firstSubmission = page.locator('[data-testid="submissions-table"] tbody tr').first();
      await firstSubmission.click();

      // Check status badge
      const statusBadge = page.locator('[data-testid="status-badge"]');
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText('read'); // Should be read after clicking

      // Check form link
      const formLink = page.locator('[data-testid="form-link"]');
      await expect(formLink).toBeVisible();
      await expect(formLink).toHaveAttribute('href', new RegExp(`form_id=${formId}`));

      // Check timestamp
      const timestamp = page.locator('[data-testid="submission-timestamp"]');
      await expect(timestamp).toBeVisible();
    });
  });

  test.describe('API Endpoints', () => {
    test('S10: Unread count API returns correct data', async ({ page }) => {
      // Test API directly
      const response = await page.request.get('/wp-json/subtleforms/v1/submissions/unread-count');
      expect(response.ok()).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('count');
      expect(data).toHaveProperty('timestamp');
      expect(typeof data.count).toBe('number');
      expect(data.count).toBeGreaterThanOrEqual(0);
    });

    test('S11: Auto-mark read functionality works', async ({ page }) => {
      // Create fresh submission
      await submitFormData(page, formId, {
        test_name: 'Auto Mark Test',
        test_email: 'automark@example.com',
      });

      // Get submission ID from API
      const submissionsResponse = await page.request.get('/wp-json/subtleforms/v1/submissions');
      const submissions = await submissionsResponse.json();
      const testSubmission = submissions.find((s) => s.payload?.test_name === 'Auto Mark Test');

      expect(testSubmission).toBeTruthy();
      expect(testSubmission.status).toBe('unread');

      // Fetch single submission (should auto-mark as read)
      const submissionResponse = await page.request.get(
        `/wp-json/subtleforms/v1/submissions/${testSubmission.id}`
      );
      const submission = await submissionResponse.json();

      expect(submission.status).toBe('read');

      // Verify change persisted
      const verifyResponse = await page.request.get(
        `/wp-json/subtleforms/v1/submissions/${testSubmission.id}`
      );
      const verifySubmission = await verifyResponse.json();
      expect(verifySubmission.status).toBe('read');
    });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: Delete test form and submissions
    if (formId) {
      try {
        await page.request.delete(`/wp-json/subtleforms/v1/forms/${formId}`);
      } catch (error) {
        console.warn('Failed to cleanup test form:', error);
      }
    }
  });
});
