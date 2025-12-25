const { test, expect } = require('@wordpress/e2e-test-utils-playwright');

test.describe('Form Lifecycle', () => {
  test('can create, edit, and publish a form', async ({ admin, page }) => {
    // 1. Navigate to the New Form page
    await admin.visitAdminPage('admin.php?page=subtleforms-new-form');

    // 2. Verify initial state (Create Form Modal)
    // Wait for the loading spinner to disappear if present
    await expect(page.locator('.components-spinner')).not.toBeVisible();

    // Expect the Create Form modal
    await expect(page.getByRole('heading', { name: 'Create New Form' })).toBeVisible();

    // 3. Create a new form
    await page.getByPlaceholder('e.g. Contact Form').fill('My E2E Form');
    await page.getByRole('button', { name: 'Next Step' }).click();
    await page.getByRole('button', { name: 'Create Form' }).click();

    // 4. Wait for the builder to load
    // The URL should change to include form_id
    await expect(page).toHaveURL(/form_id=\d+/);

    // Wait for the loading spinner to disappear (it might appear again after reload)
    await expect(page.locator('.components-spinner')).not.toBeVisible({ timeout: 20000 });

    // 5. Add a "Text" field from the sidebar
    // The sidebar has buttons for each field type.
    const textFieldBtn = page.getByRole('button', { name: 'Text', exact: true });
    await textFieldBtn.click();

    // 6. Verify the field was added to the canvas
    // We look for the field wrapper or input.
    await expect(page.locator('.subtleforms-field-chrome')).toHaveCount(1);

    // 7. Save as Draft
    const saveDraftBtn = page.getByRole('button', { name: 'Save Draft' });
    await saveDraftBtn.click();

    // 8. Verify "Draft" status badge
    const draftBadge = page.getByText('Draft', { exact: true });
    await expect(draftBadge).toBeVisible();

    // 9. Publish the form
    const publishBtn = page.getByRole('button', { name: 'Publish' });
    await publishBtn.click();

    // 10. Handle Publish Confirmation Modal
    // The modal has a "Publish" button.
    const confirmPublishBtn = page
      .locator('.components-modal__content')
      .getByRole('button', { name: 'Publish' });
    await confirmPublishBtn.click();

    // 11. Verify "Published" status badge
    const publishedBadge = page.getByText('Published', { exact: true });
    await expect(publishedBadge).toBeVisible();

    // 12. Verify Shortcode is generated and visible
    // The shortcode button usually contains [subtleforms id="..."]
    const shortcodeBtn = page.getByRole('button', { name: /\[subtleforms id="\d+"\]/ });
    await expect(shortcodeBtn).toBeVisible();
  });
});
