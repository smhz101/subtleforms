/**
 * Browser tests take a few QA screenshots. Playwright does not create the
 * parent directory, and the old path lived outside the repo.
 */
const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
  for (const dir of ['free231', 'free232', 'free233']) {
    fs.mkdirSync(path.join(process.cwd(), 'test-results', 'shots', dir), { recursive: true });
  }
};
