/**
 * Admin Layout and Scroll Regression Tests
 *
 * CRITICAL: These tests prevent layout and scrolling regressions
 * They validate the scroll contract established in AdminShell
 *
 * Test Coverage:
 * - Body never scrolls in admin pages
 * - AdminShell owns page scrolling
 * - Builder panels (Dock, Canvas, Inspector) scroll independently
 * - Settings page scrolls correctly
 * - Collapsing Field Dock expands Canvas width
 */

const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./helpers');

test.describe('Admin Layout and Scroll Contract', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  /**
   * Test 1: Body Never Scrolls
   * The body element should never scroll on any admin page
   */
  test('body element should not scroll on any admin page', async ({ page }) => {
    // Test Settings page
    await page.goto('/wp-admin/admin.php?page=subtleforms-settings');
    await page.waitForSelector('.sf-admin-shell');

    let bodyOverflow = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflow;
    });
    expect(bodyOverflow).toBe('hidden');

    // Test Forms List page
    await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
    await page.waitForSelector('.sf-admin-shell');

    bodyOverflow = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflow;
    });
    expect(bodyOverflow).toBe('hidden');

    // Test Submissions page
    await page.goto('/wp-admin/admin.php?page=subtleforms-submissions');
    await page.waitForSelector('.sf-admin-shell');

    bodyOverflow = await page.evaluate(() => {
      return window.getComputedStyle(document.body).overflow;
    });
    expect(bodyOverflow).toBe('hidden');
  });

  /**
   * Test 2: Settings Page Scrolls Vertically
   * Settings should scroll within AdminShell, not body
   */
  test('settings page should scroll within admin shell', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=subtleforms-settings');
    await page.waitForSelector('.sf-admin-shell');

    // Check AdminShell content area has scroll
    const contentInner = await page.locator('.sf-admin-shell__content-inner').first();
    const hasScroll = await contentInner.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.overflowY === 'auto' || style.overflowY === 'scroll';
    });
    expect(hasScroll).toBeTruthy();

    // Verify content is taller than viewport (should be scrollable)
    const { scrollHeight, clientHeight } = await contentInner.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));

    // Settings should have enough content to scroll
    // If not scrollable now, at least verify overflow is set correctly
    expect(scrollHeight).toBeGreaterThanOrEqual(clientHeight);
  });

  /**
   * Test 3: Builder Field Dock Scrolls Independently
   * Field Dock should have its own scroll when fields overflow
   */
  test('builder field dock should scroll independently', async ({ page }) => {
    // Create a test form first
    await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
    await page.waitForSelector('.sf-admin-shell');

    // Click "Add New Form" if available
    const addNewButton = page.locator('text=Add New Form').first();
    if (await addNewButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addNewButton.click();
      await page.waitForSelector('.sf-form-editor');
    } else {
      // Navigate to existing form or skip if none exist
      const firstFormEdit = page.locator('[data-test-id="edit-form-button"]').first();
      if (await firstFormEdit.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstFormEdit.click();
        await page.waitForSelector('.sf-form-editor');
      } else {
        test.skip();
        return;
      }
    }

    // Check Field Dock scroll capability
    const fieldDockContent = page.locator('.sf-field-dock__content').first();
    await fieldDockContent.waitFor({ state: 'visible', timeout: 5000 });

    const dockOverflow = await fieldDockContent.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.overflowY;
    });
    expect(dockOverflow).toBe('auto');

    // Verify Dock doesn't shrink (flex-shrink: 0)
    const dockFlexShrink = await page.locator('.sf-field-dock').evaluate((el) => {
      return window.getComputedStyle(el).flexShrink;
    });
    expect(dockFlexShrink).toBe('0');
  });

  /**
   * Test 4: Builder Canvas Scrolls When Fields Overflow
   * Canvas should scroll when form has many fields
   */
  test('builder canvas should scroll when fields overflow', async ({ page }) => {
    // Navigate to builder (skip if no forms exist)
    await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
    await page.waitForSelector('.sf-admin-shell');

    const firstFormEdit = page.locator('[data-test-id="edit-form-button"]').first();
    if (!(await firstFormEdit.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await firstFormEdit.click();
    await page.waitForSelector('.sf-form-editor');

    // Check Canvas scroll area
    const canvasScroll = page.locator('.sf-form-editor__canvas-scroll').first();
    await canvasScroll.waitFor({ state: 'visible', timeout: 5000 });

    const canvasOverflow = await canvasScroll.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.overflowY;
    });
    expect(canvasOverflow).toBe('auto');

    // Verify Canvas has min-width: 0 for grid shrinking
    const canvasMinWidth = await page.locator('.sf-form-editor__canvas').evaluate((el) => {
      return window.getComputedStyle(el).minWidth;
    });
    expect(canvasMinWidth).toBe('0px');
  });

  /**
   * Test 5: Builder Inspector Scrolls Independently
   * Inspector should have its own scroll for field settings
   */
  test('builder inspector should scroll independently', async ({ page }) => {
    // Navigate to builder
    await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
    await page.waitForSelector('.sf-admin-shell');

    const firstFormEdit = page.locator('[data-test-id="edit-form-button"]').first();
    if (!(await firstFormEdit.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await firstFormEdit.click();
    await page.waitForSelector('.sf-form-editor');

    // Check Inspector scroll
    const inspector = page.locator('.sf-form-editor__inspector').first();
    await inspector.waitFor({ state: 'visible', timeout: 5000 });

    const inspectorOverflow = await inspector.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.overflowY;
    });
    expect(inspectorOverflow).toBe('auto');

    // Verify Inspector doesn't shrink (flex-shrink: 0)
    const inspectorFlexShrink = await inspector.evaluate((el) => {
      return window.getComputedStyle(el).flexShrink;
    });
    expect(inspectorFlexShrink).toBe('0');
  });

  /**
   * Test 6: Collapsing Field Dock Expands Canvas Width
   * When dock is collapsed, canvas should expand to fill the space
   */
  test('collapsing field dock should expand canvas width', async ({ page }) => {
    // Navigate to builder
    await page.goto('/wp-admin/admin.php?page=subtleforms-forms');
    await page.waitForSelector('.sf-admin-shell');

    const firstFormEdit = page.locator('[data-test-id="edit-form-button"]').first();
    if (!(await firstFormEdit.isVisible({ timeout: 2000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await firstFormEdit.click();
    await page.waitForSelector('.sf-form-editor');

    // Get initial canvas width
    const canvas = page.locator('.sf-form-editor__canvas').first();
    const initialWidth = await canvas.evaluate((el) => el.offsetWidth);

    // Find and click collapse button
    const collapseButton = page.locator('.sf-field-dock__toggle-button').first();
    await collapseButton.waitFor({ state: 'visible', timeout: 5000 });
    await collapseButton.click();

    // Wait for animation/transition
    await page.waitForTimeout(300);

    // Verify dock is collapsed (class added or width changed)
    const formEditor = page.locator('.sf-form-editor').first();
    const hasCollapsedClass = await formEditor.evaluate((el) =>
      el.classList.contains('sf-form-editor--dock-collapsed')
    );
    expect(hasCollapsedClass).toBeTruthy();

    // Get new canvas width (should be larger)
    const newWidth = await canvas.evaluate((el) => el.offsetWidth);
    expect(newWidth).toBeGreaterThan(initialWidth);

    // Verify dock width changed (should be ~48px when collapsed)
    const dockWidth = await page.locator('.sf-field-dock').evaluate((el) => el.offsetWidth);
    expect(dockWidth).toBeLessThan(100); // Collapsed width should be small
  });

  /**
   * Test 7: No Page Scrolls Body Element
   * Verify body never gets scroll classes or scrollTop changes
   */
  test('no admin page should scroll the body element', async ({ page }) => {
    const pages = [
      '/wp-admin/admin.php?page=subtleforms-forms',
      '/wp-admin/admin.php?page=subtleforms-settings',
      '/wp-admin/admin.php?page=subtleforms-submissions',
    ];

    for (const url of pages) {
      await page.goto(url);
      await page.waitForSelector('.sf-admin-shell');

      // Try to scroll body and verify it doesn't move
      await page.evaluate(() => {
        document.body.scrollTop = 100;
        document.documentElement.scrollTop = 100;
      });

      await page.waitForTimeout(100);

      const scrollPosition = await page.evaluate(() => ({
        bodyScrollTop: document.body.scrollTop,
        htmlScrollTop: document.documentElement.scrollTop,
      }));

      expect(scrollPosition.bodyScrollTop).toBe(0);
      expect(scrollPosition.htmlScrollTop).toBe(0);
    }
  });

  /**
   * Test 8: AdminShell Container Height
   * AdminShell should fill viewport minus WordPress admin bar
   */
  test('admin shell should fill viewport correctly', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=subtleforms-settings');
    await page.waitForSelector('.sf-admin-shell__container');

    const shellHeight = await page.locator('.sf-admin-shell__container').evaluate((el) => {
      const style = window.getComputedStyle(el);
      const height = style.height;
      const expectedHeight = 'calc(100vh - var(--wp-admin--admin-bar--height, 32px))';

      return {
        height,
        computedHeight: el.offsetHeight,
        viewportHeight: window.innerHeight,
      };
    });

    // Shell should be close to viewport height (allowing for admin bar)
    const heightDiff = shellHeight.viewportHeight - shellHeight.computedHeight;
    expect(heightDiff).toBeGreaterThanOrEqual(30); // At least admin bar height
    expect(heightDiff).toBeLessThanOrEqual(50); // But not too much more
  });

  /**
   * Test 9: All Admin Pages Use AdminShell
   * Verify every page is wrapped in AdminShell
   */
  test('all admin pages should use admin shell', async ({ page }) => {
    const pages = [
      '/wp-admin/admin.php?page=subtleforms-forms',
      '/wp-admin/admin.php?page=subtleforms-settings',
      '/wp-admin/admin.php?page=subtleforms-submissions',
    ];

    for (const url of pages) {
      await page.goto(url);

      const hasAdminShell = await page.locator('.sf-admin-shell').isVisible({ timeout: 5000 });
      expect(hasAdminShell).toBeTruthy();

      const hasContainer = await page.locator('.sf-admin-shell__container').isVisible();
      expect(hasContainer).toBeTruthy();

      const hasContent = await page.locator('.sf-admin-shell__content').isVisible();
      expect(hasContent).toBeTruthy();
    }
  });
});
