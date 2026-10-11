/**
 * Browser tests that run against a real WordPress site with SubtleForms
 * active (local test site, or wp-env in CI).
 *
 *   SF_BASE_URL=http://localhost:8899 SF_ADMIN_USER=admin SF_ADMIN_PASS=admin \
 *     npx playwright test -c playwright.browser.config.js
 *
 * Each spec seeds its own forms through the REST API, so no fixtures need to
 * exist beforehand.
 */
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 120000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/browser' }]] : 'list',
  use: {
    baseURL: process.env.SF_BASE_URL || 'http://localhost:8899',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Use a preinstalled Chromium when the bundled one is not downloaded.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
