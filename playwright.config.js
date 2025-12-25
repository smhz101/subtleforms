const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const BASE_URL = process.env.WP_BASE_URL || 'https://theme-wp.test';
const ADMIN_USER = process.env.WP_ADMIN_USER || 'e2e_test';
const ADMIN_PASSWORD = process.env.WP_ADMIN_PASSWORD || 'password';

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.js/,
      timeout: 60000,
      use: {
        storageState: undefined,
      },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/storage.json',
      },
      dependencies: ['setup'],
    },
  ],
});
