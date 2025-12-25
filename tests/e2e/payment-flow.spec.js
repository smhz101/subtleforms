const { test, expect } = require('@playwright/test');

test.describe('Payment Form Flow', () => {
  test.slow();

  let formId;
  let pageLink;

  test('can create and submit a payment form with mocked payment', async ({ page }) => {
    // Login as admin
    await page.goto('/wp-login.php');
    await page.fill('#user_login', 'admin');
    await page.fill('#user_pass', 'password');
    await page.click('#wp-submit');
    await page.waitForURL('**/wp-admin/**');

    // 1. Create a payment form
    await page.goto('/wp-admin/admin.php?page=subtleforms-new-form');

    // Handle Create Modal
    await expect(page.getByRole('heading', { name: 'Create New Form' })).toBeVisible({
      timeout: 30000,
    });

    await page.getByPlaceholder('e.g. Contact Form').fill('Payment Test Form');
    await page.getByRole('button', { name: 'Next Step' }).click();

    // Select Payment type
    await page.getByRole('button', { name: /Payment/ }).click();
    await page.getByRole('button', { name: 'Create Form' }).click();

    // Wait for builder
    await expect(page).toHaveURL(/form_id=\d+/, { timeout: 30000 });

    // Extract form ID from URL
    const url = page.url();
    const match = url.match(/form_id=(\d+)/);
    formId = match ? match[1] : null;
    expect(formId).not.toBeNull();

    await expect(page.locator('.subtleforms-builder-tabs')).toBeVisible({ timeout: 30000 });

    // Verify payment badge is shown
    await expect(page.getByText('Payment', { exact: true })).toBeVisible();

    // Add fields
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.getByRole('button', { name: 'Email', exact: true }).click();

    // Add payment amount field - scroll to payment category
    await page.locator('.subtleforms-field-picker').scrollIntoViewIfNeeded();
    const paymentButton = page.getByRole('button', { name: 'Amount', exact: true });
    await paymentButton.scrollIntoViewIfNeeded();
    await paymentButton.click();

    // 2. Configure payment settings
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByText('Payment Settings')).toBeVisible();

    // Enable payment
    const paymentToggle = page.locator('input[type="checkbox"]').first();
    const isChecked = await paymentToggle.isChecked();
    if (!isChecked) {
      await paymentToggle.check();
    }

    // Set amount type to field
    await page.getByLabel('From Field').check();

    // Select amount field
    await page
      .locator('select')
      .last()
      .selectOption({ label: /Amount|amount/ });

    // Go back to Build tab
    await page.getByRole('tab', { name: 'Build' }).click();

    // 3. Publish
    await page.getByRole('button', { name: 'Publish' }).click();
    await page
      .locator('.components-modal__content')
      .getByRole('button', { name: 'Publish' })
      .click();
    await expect(page.getByText('Published', { exact: true })).toBeVisible();

    // Get Shortcode
    const shortcodeBtn = page.getByRole('button', { name: /\[subtleforms id="\d+"\]/ });
    const shortcodeText = await shortcodeBtn.innerText();

    // 4. Create a page with the shortcode
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
            title: 'Payment Form Test Page',
            content: `<!-- wp:shortcode -->${shortcodeText}<!-- /wp:shortcode -->`,
            status: 'publish',
          }),
        });
        return res.json();
      },
      { apiNonce, shortcodeText }
    );

    pageLink = pageData.link;

    // 5. Visit the page (Frontend)
    await page.goto(pageLink);

    // Wait for form to load
    await expect(page.locator('form.subtleforms-form')).toBeVisible({ timeout: 10000 });

    // 6. Fill the form
    const textInput = page.locator('input[type="text"]').first();
    await textInput.fill('John Doe');

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('john@example.com');

    // Fill payment amount
    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('50.00');

    // Verify currency symbol is displayed
    await expect(page.locator('.subtleforms-payment-amount')).toBeVisible();

    // 7. Submit
    await page.getByRole('button', { name: 'Submit' }).click();

    // 8. Verify Success Message
    await expect(page.getByText(/Form submitted successfully|Thank you/i)).toBeVisible({
      timeout: 10000,
    });

    // 9. Verify submission in admin with payment metadata
    await page.goto(`/wp-admin/admin.php?page=subtleforms-submissions&form_id=${formId}`);

    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('John Doe')).toBeVisible();

    // Click to view submission details
    await page.locator('table tbody tr').first().click();

    // Wait for submission detail page
    await expect(page).toHaveURL(/submission-detail/, { timeout: 5000 });

    // Verify payment metadata is shown
    await expect(page.getByText(/Payment|payment/)).toBeVisible();
    await expect(page.getByText('50.00')).toBeVisible();
  });

  test('can create and submit a conversational payment form', async ({ page }) => {
    // Login as admin
    await page.goto('/wp-login.php');
    await page.fill('#user_login', 'admin');
    await page.fill('#user_pass', 'password');
    await page.click('#wp-submit');
    await page.waitForURL('**/wp-admin/**');

    // 1. Create a conversational form with payment
    await page.goto('/wp-admin/admin.php?page=subtleforms-new-form');

    await expect(page.getByRole('heading', { name: 'Create New Form' })).toBeVisible({
      timeout: 30000,
    });

    await page.getByPlaceholder('e.g. Contact Form').fill('Conversational Payment Form');
    await page.getByRole('button', { name: 'Next Step' }).click();

    // Select Conversational type
    await page.getByRole('button', { name: /Conversational/ }).click();
    await page.getByRole('button', { name: 'Create Form' }).click();

    // Wait for builder
    await expect(page).toHaveURL(/form_id=\d+/, { timeout: 30000 });

    // Add fields
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await page.getByRole('button', { name: 'Email', exact: true }).click();

    // Add payment amount field
    await page.locator('.subtleforms-field-picker').scrollIntoViewIfNeeded();
    const paymentButton = page.getByRole('button', { name: 'Amount', exact: true });
    await paymentButton.scrollIntoViewIfNeeded();
    await paymentButton.click();

    // 2. Configure payment settings in conversational form
    await page.getByRole('tab', { name: 'Settings' }).click();

    // Verify conversational payment info is shown
    await expect(page.getByText('Conversational Payment')).toBeVisible();

    // Enable payment
    const paymentToggle = page.locator('input[type="checkbox"]').first();
    await paymentToggle.check();

    // Set amount type to field
    await page.getByLabel('From Field').check();
    await page
      .locator('select')
      .last()
      .selectOption({ label: /Amount|amount/ });

    // Go back to Build tab
    await page.getByRole('tab', { name: 'Build' }).click();

    // 3. Publish
    await page.getByRole('button', { name: 'Publish' }).click();
    await page
      .locator('.components-modal__content')
      .getByRole('button', { name: 'Publish' })
      .click();
    await expect(page.getByText('Published', { exact: true })).toBeVisible();

    // Get Shortcode
    const shortcodeBtn = page.getByRole('button', { name: /\[subtleforms id="\d+"\]/ });
    const shortcodeText = await shortcodeBtn.innerText();

    // 4. Create a page with the shortcode
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
            title: 'Conversational Payment Test Page',
            content: `<!-- wp:shortcode -->${shortcodeText}<!-- /wp:shortcode -->`,
            status: 'publish',
          }),
        });
        return res.json();
      },
      { apiNonce, shortcodeText }
    );

    const convPageLink = pageData.link;

    // 5. Visit the page and go through conversational flow
    await page.goto(convPageLink);

    // Wait for conversational form
    await expect(page.locator('.subtleforms-conversational')).toBeVisible({ timeout: 10000 });

    // Question 1: Name
    await page.locator('.subtleforms-question-card input[type="text"]').fill('Jane Doe');
    await page.getByRole('button', { name: 'Next' }).click();

    // Question 2: Email
    await page.locator('.subtleforms-question-card input[type="email"]').fill('jane@example.com');
    await page.getByRole('button', { name: 'Next' }).click();

    // Question 3: Amount
    await page.locator('.subtleforms-question-card input[type="number"]').fill('75.00');
    await page.getByRole('button', { name: 'Review' }).click();

    // 6. Verify Review Step
    await expect(page.locator('.subtleforms-review-card')).toBeVisible();
    await expect(page.getByText('Jane Doe')).toBeVisible();
    await expect(page.getByText('jane@example.com')).toBeVisible();

    // Click to proceed to payment
    await page.getByRole('button', { name: /Continue to Payment|Payment/ }).click();

    // 7. Verify Payment Step
    await expect(page.locator('.subtleforms-payment-card')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Amount Due|Total/)).toBeVisible();
    await expect(page.getByText('75.00')).toBeVisible();

    // Verify test mode notice
    await expect(page.getByText(/Test Mode/i)).toBeVisible();

    // 8. Complete submission
    await page.getByRole('button', { name: /Complete Submission|Submit/ }).click();

    // 9. Verify Success
    await expect(page.getByText(/Thank you|submitted successfully/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test.afterAll(async ({ page }) => {
    // Cleanup: Delete the test pages
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
