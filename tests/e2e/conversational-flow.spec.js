const { test, expect } = require('@playwright/test');

test.describe('Conversational Form Flow', () => {
  test.slow();

  let formId;
  let pageLink;

  test('can create and submit a conversational form', async ({ page }) => {
    // Login as admin
    await page.goto('/wp-login.php');
    await page.fill('#user_login', 'admin');
    await page.fill('#user_pass', 'password');
    await page.click('#wp-submit');
    await page.waitForURL('**/wp-admin/**');

    // 1. Create a conversational form
    await page.goto('/wp-admin/admin.php?page=subtleforms-new-form');

    // Handle Create Modal
    await expect(page.getByRole('heading', { name: 'Create New Form' })).toBeVisible({
      timeout: 30000,
    });

    await page.getByPlaceholder('e.g. Contact Form').fill('Conversational Test Form');
    await page.getByRole('button', { name: 'Next Step' }).click();

    // Select Conversational type
    await page.getByRole('button', { name: /Conversational/ }).click();
    await page.getByRole('button', { name: 'Create Form' }).click();

    // Wait for builder
    await expect(page).toHaveURL(/form_id=\d+/, { timeout: 30000 });

    // Extract form ID from URL
    const url = page.url();
    const match = url.match(/form_id=(\d+)/);
    formId = match ? match[1] : null;
    expect(formId).not.toBeNull();

    await expect(page.locator('.subtleforms-builder-tabs')).toBeVisible({ timeout: 30000 });

    // Verify conversational badge is shown
    await expect(page.getByText('Conversational', { exact: true })).toBeVisible();

    // Add fields
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.getByRole('button', { name: 'Email', exact: true }).click();
    await page.getByRole('button', { name: 'Textarea', exact: true }).click();

    // Publish
    await page.getByRole('button', { name: 'Publish' }).click();
    await page
      .locator('.components-modal__content')
      .getByRole('button', { name: 'Publish' })
      .click();
    await expect(page.getByText('Published', { exact: true })).toBeVisible();

    // Get Shortcode
    const shortcodeBtn = page.getByRole('button', { name: /\[subtleforms id="\d+"\]/ });
    const shortcodeText = await shortcodeBtn.innerText();

    // 2. Create a page with the shortcode
    const apiNonce = await page.evaluate(() => window.wpApiSettings.nonce);

    const pageData = await page.evaluate(
      async ({ apiNonce, shortcodeText }) => {
        const res = await fetch('/wp-json/wp/v2/pages', {
          method: 'POST',
          headers: {
            'X-WP-Nonce': apiNonce,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Conversational Form Test Page',
            content: `<!-- wp:shortcode -->${shortcodeText}<!-- /wp:shortcode -->`,
            status: 'publish',
          }),
        });
        return res.json();
      },
      { apiNonce, shortcodeText }
    );

    pageLink = pageData.link;

    // 3. Visit the page (Frontend)
    await page.goto(pageLink);

    // Wait for conversational form to load
    await expect(page.locator('.subtleforms-conversational')).toBeVisible({ timeout: 10000 });

    // 4. Verify one-question-at-a-time display
    await expect(page.locator('.subtleforms-question-card')).toBeVisible();
    await expect(page.locator('.subtleforms-question-number')).toContainText('1 / 3');

    // 5. Fill first question (Name)
    const firstInput = page.locator('.subtleforms-question-card input[type="text"]').first();
    await firstInput.fill('John Doe');

    // Click Next
    await page.getByRole('button', { name: 'Next' }).click();

    // 6. Verify we're on question 2
    await expect(page.locator('.subtleforms-question-number')).toContainText('2 / 3');

    // Fill email
    const emailInput = page.locator('.subtleforms-question-card input[type="email"]').first();
    await emailInput.fill('john@example.com');

    // Click Next
    await page.getByRole('button', { name: 'Next' }).click();

    // 7. Verify we're on question 3
    await expect(page.locator('.subtleforms-question-number')).toContainText('3 / 3');

    // Fill textarea
    const textareaInput = page.locator('.subtleforms-question-card textarea').first();
    await textareaInput.fill('This is my message from the conversational form.');

    // Click Review (last question)
    await page.getByRole('button', { name: 'Review' }).click();

    // 8. Verify Review Step
    await expect(page.locator('.subtleforms-review-card')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Please review your answers')).toBeVisible();

    // Verify all answers are shown
    await expect(page.locator('.subtleforms-review-item')).toHaveCount(3);
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('john@example.com')).toBeVisible();
    await expect(page.getByText('This is my message from the conversational form.')).toBeVisible();

    // 9. Test Edit functionality
    const editButtons = page.locator('.subtleforms-review-edit');
    await editButtons.first().click();

    // Should go back to question 1
    await expect(page.locator('.subtleforms-question-number')).toContainText('1 / 3');
    await expect(firstInput).toHaveValue('John Doe');

    // Navigate back to review
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Review' }).click();

    // 10. Submit
    await page.getByRole('button', { name: 'Submit' }).click();

    // 11. Verify Success Message
    await expect(page.getByText(/Thank you|submitted successfully/i)).toBeVisible({
      timeout: 10000,
    });

    // 12. Verify submission in admin
    await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${formId}`);

    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('John Doe')).toBeVisible();
  });

  test.afterAll(async ({ page }) => {
    // Cleanup: Delete the test page
    if (pageLink) {
      await page.goto('/wp-login.php');
      await page.fill('#user_login', 'admin');
      await page.fill('#user_pass', 'password');
      await page.click('#wp-submit');

      const apiNonce = await page.evaluate(() => window.wpApiSettings.nonce);
      const pageId = pageLink.match(/\?page_id=(\d+)|\/(\d+)\/?$/);
      if (pageId) {
        const id = pageId[1] || pageId[2];
        await page.evaluate(
          async ({ apiNonce, id }) => {
            await fetch(`/wp-json/wp/v2/pages/${id}`, {
              method: 'DELETE',
              headers: { 'X-WP-Nonce': apiNonce },
            });
          },
          { apiNonce, id }
        );
      }
    }
  });
});
