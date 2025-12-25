import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/e2e/storage.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/wp-login.php');

  await page.getByLabel('Username or Email Address').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Log In' }).click();

  // Wait for redirect to admin (with generous timeout)
  try {
    await page.waitForURL(/wp-admin/, { timeout: 30000 });
  } catch (error) {
    // If still on login page, check for error
    if (page.url().includes('wp-login')) {
      const errorMsg = await page
        .locator('#login_error')
        .textContent()
        .catch(() => 'Unknown error');
      throw new Error(`Login failed: ${errorMsg}`);
    }
    // Otherwise, might already be on dashboard
  }

  // Save cookies
  await page.context().storageState({ path: authFile });
});
