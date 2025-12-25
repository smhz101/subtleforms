const { test, expect } = require('@wordpress/e2e-test-utils-playwright');

test.describe('Submission Flow', () => {
  test.slow();
  test('can submit a form on the frontend', async ({ admin, page }) => {
    // 1. Create and Publish a Form
    await admin.visitAdminPage('admin.php?page=subtleforms-new-form');

    // Handle Create Modal
    await expect(page.getByRole('heading', { name: 'Create New Form' })).toBeVisible({
      timeout: 30000,
    });
    await page.getByPlaceholder('e.g. Contact Form').fill('Submission Test Form');
    await page.getByRole('button', { name: 'Next Step' }).click();
    await page.getByRole('button', { name: 'Create Form' }).click();

    // Wait for builder
    await expect(page).toHaveURL(/form_id=\d+/);
    await expect(page.locator('.subtleforms-builder-tabs')).toBeVisible({ timeout: 30000 });

    // Add Text Field (Name)
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    // Add Email Field
    await page.getByRole('button', { name: 'Email', exact: true }).click();

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
    console.log('Shortcode:', shortcodeText);

    // 2. Create a Page with the Shortcode (via API)
    // We use the API to avoid flaky editor interactions

    // Get the nonce
    let apiNonce = await page.evaluate(() =>
      window.wpApiSettings ? window.wpApiSettings.nonce : null
    );
    if (!apiNonce) {
      await page.goto('/wp-admin/');
      apiNonce = await page.evaluate(() => window.wpApiSettings.nonce);
    }

    // Create page via API using page.evaluate (fetch)
    const pageData = await page.evaluate(
      async ({ apiNonce, shortcodeText }) => {
        const res = await fetch('/wp-json/wp/v2/pages', {
          method: 'POST',
          headers: {
            'X-WP-Nonce': apiNonce,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'Form Test Page',
            content: `<!-- wp:shortcode -->${shortcodeText}<!-- /wp:shortcode -->`,
            status: 'publish',
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API Error: ${res.status} ${text}`);
        }
        return res.json();
      },
      { apiNonce, shortcodeText }
    );

    const pageLink = pageData.link;
    console.log(`Created test page at: ${pageLink}`);

    // 3. Visit the Page (Frontend)
    await page.goto(pageLink);

    // Wait for form to load
    await expect(page.locator('form.subtleforms-form')).toBeVisible({ timeout: 10000 });

    // 4. Fill the Form
    // Use more flexible selectors for the fields
    const textInput = page.locator('input[type="text"]').first();
    const emailInput = page.locator('input[type="email"]').first();

    await textInput.fill('John Doe');
    await emailInput.fill('john@example.com');

    // 5. Submit
    await page.getByRole('button', { name: 'Submit' }).click();

    // 6. Verify Success Message
    await expect(page.getByText(/Form submitted successfully|Thank you/i)).toBeVisible({
      timeout: 10000,
    });

    // 7. Verify Submission in Admin
    await admin.visitAdminPage('admin.php?page=subtleforms-submissions');

    // Wait for submissions table to load
    await expect(page.locator('.subtleforms-submissions-table')).toBeVisible({ timeout: 10000 });

    // Verify the submission data appears
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('john@example.com')).toBeVisible();
  });
});
