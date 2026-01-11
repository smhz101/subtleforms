/**
 * E2E Test Helpers for SubtleForms
 */

/**
 * Login as WordPress admin
 * @param {import('@playwright/test').Page} page
 */
async function loginAsAdmin(page) {
  await page.goto('/wp-admin');

  // Check if already logged in
  const isLoggedIn = await page
    .locator('#wpadminbar')
    .isVisible()
    .catch(() => false);
  if (isLoggedIn) return;

  await page.fill('#user_login', process.env.WP_ADMIN_USER || 'admin');
  await page.fill('#user_pass', process.env.WP_ADMIN_PASS || 'password');
  await page.click('#wp-submit');
  await page.waitForURL('**/wp-admin/**');
}

/**
 * Create a new multi-step form via UI
 * @param {import('@playwright/test').Page} page
 * @param {string} title - Form title
 * @returns {Promise<number>} Form ID
 */
async function createMultiStepForm(page, title = 'E2E Test Form') {
  // Go to forms list page first
  await page.goto('/wp-admin/admin.php?page=subtleforms');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Click "New Form" button
  const newFormBtn = page
    .locator('button:has-text("New Form"), a:has-text("New Form"), a:has-text("Add New")')
    .first();
  await newFormBtn.waitFor({ state: 'visible', timeout: 5000 });
  await newFormBtn.click();
  await page.waitForTimeout(2000);

  // Check if we're in a modal/wizard
  const hasModal = await page
    .locator('.sf-modal, .subtleforms-modal, [role="dialog"]')
    .isVisible()
    .catch(() => false);

  if (hasModal) {
    // Fill the modal form
    const titleInput = page
      .locator('input[placeholder*="name"], input[placeholder*="title"]')
      .first();
    await titleInput.waitFor({ state: 'visible', timeout: 5000 });
    await titleInput.fill(title);

    // Select multistep type
    const multistepBtn = page.locator('button:has-text("Multi-step"), [value="multistep"]').first();
    if (await multistepBtn.isVisible().catch(() => false)) {
      await multistepBtn.click();
      await page.waitForTimeout(500);
    }

    // Click create/next button
    const createBtn = page
      .locator('button:has-text("Create"), button:has-text("Next"), button:has-text("Continue")')
      .first();
    await createBtn.click();
    await page.waitForTimeout(2000);
  }

  // Wait for builder to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Extract form ID from URL or from page content
  const url = page.url();
  let match = url.match(/[?&]form_id=(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Try alternative URL patterns
  match = url.match(/[?&]id=(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Try to get from page data attribute or hidden input
  const formIdFromPage = await page
    .locator('[data-form-id]')
    .first()
    .getAttribute('data-form-id')
    .catch(() => null);
  if (formIdFromPage) {
    return parseInt(formIdFromPage, 10);
  }

  // Try to extract from any input with name="form_id"
  const formIdInput = await page
    .locator('input[name="form_id"]')
    .first()
    .inputValue()
    .catch(() => null);
  if (formIdInput) {
    return parseInt(formIdInput, 10);
  }

  throw new Error('Could not extract form ID from URL or page: ' + url);
}

/**
 * Add a field to the current step
 * @param {import('@playwright/test').Page} page
 * @param {string} fieldType - 'text', 'email', 'textarea', etc.
 */
async function addFieldToStep(page, fieldType) {
  // Try drag and drop first
  try {
    await page.dragAndDrop(
      `[data-field-type="${fieldType}"], .sf-field-item:has-text("${fieldType}")`,
      '.subtleforms-step-canvas, .sf-canvas',
      { timeout: 2000 }
    );
  } catch (error) {
    // Fallback: click to add
    await page.click(`[data-field-type="${fieldType}"], .sf-field-item:has-text("${fieldType}")`);
  }

  await page.waitForTimeout(500);
}

/**
 * Select a step by number
 * @param {import('@playwright/test').Page} page
 * @param {number} stepNumber - Step number (1-indexed)
 */
async function selectStep(page, stepNumber) {
  const stepTab = page.locator(`button:has-text("Step ${stepNumber}")`).first();
  await stepTab.click();
  await page.waitForTimeout(300);
}

/**
 * Add a new step
 * @param {import('@playwright/test').Page} page
 */
async function addStep(page) {
  await page.click('button:has-text("Add Step")');
  await page.waitForTimeout(500);
}

/**
 * Count fields in current step canvas
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
async function countFieldsInCanvas(page) {
  return await page.locator('.subtleforms-field-chrome, .sf-field-chrome').count();
}

/**
 * Insert SubtleForm block in Gutenberg editor
 * @param {import('@playwright/test').Page} page
 * @param {number} formIndex - Form index in select dropdown (1 = first form)
 */
async function insertSubtleFormBlock(page, formIndex = 1) {
  // Open block inserter
  const inserterButton = page.locator(
    'button[aria-label*="Add block"], .edit-post-header-toolbar__inserter-toggle'
  );
  await inserterButton.click();
  await page.waitForTimeout(500);

  // Search for SubtleForm block
  const searchInput = page.locator(
    'input[placeholder*="Search"], .block-editor-inserter__search input'
  );
  await searchInput.fill('SubtleForm');
  await page.waitForTimeout(500);

  // Click block
  const blockItem = page.locator('.block-editor-block-types-list__item:has-text("SubtleForm")');
  await blockItem.click();
  await page.waitForTimeout(1000);

  // Select form
  const formSelect = page.locator('select').first();
  await formSelect.selectOption({ index: formIndex });
  await page.waitForTimeout(1500);
}

/**
 * Create and publish a post with content
 * @param {import('@playwright/test').Page} page
 * @param {string} title - Post title
 * @param {Function} contentCallback - Async function to add content
 * @returns {Promise<string>} Published post URL
 */
async function createAndPublishPost(page, title, contentCallback) {
  await page.goto('/wp-admin/post-new.php');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.block-editor, .edit-post-layout', { timeout: 30000 });
  await page.waitForTimeout(2000);

  // Add title
  const titleInput = page.locator('.editor-post-title__input, [aria-label*="Add title"]');
  await titleInput.waitFor({ state: 'visible', timeout: 5000 });
  await titleInput.fill(title);

  // Add content via callback
  if (contentCallback) {
    await contentCallback(page);
  }

  // Publish
  const publishButton = page.locator('button:has-text("Publish")').first();
  await publishButton.click();
  await page.waitForTimeout(500);

  // Confirm publish if needed
  const confirmButton = page.locator('.editor-post-publish-panel button:has-text("Publish")');
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click();
    await page.waitForTimeout(1000);
  }

  // Get post URL
  const viewLink = page.locator('a:has-text("View Post"), a:has-text("View Page")').first();
  return await viewLink.getAttribute('href');
}

/**
 * Wait for form to load on frontend
 * @param {import('@playwright/test').Page} page
 */
async function waitForFormRender(page) {
  await page.waitForSelector('.subtleforms-form, [data-subtleforms-form]', { timeout: 5000 });
  await page.waitForTimeout(500); // Let React finish rendering
}

/**
 * Fill all visible text inputs in a form
 * @param {import('@playwright/test').Page} page
 * @param {string} valuePrefix - Prefix for test values
 */
async function fillVisibleTextInputs(page, valuePrefix = 'Test') {
  const textInputs = page.locator('input[type="text"]:visible, input[type="email"]:visible');
  const count = await textInputs.count();

  for (let i = 0; i < count; i++) {
    await textInputs.nth(i).fill(`${valuePrefix} ${i + 1}`);
  }
}

module.exports = {
  loginAsAdmin,
  createMultiStepForm,
  addFieldToStep,
  selectStep,
  addStep,
  countFieldsInCanvas,
  insertSubtleFormBlock,
  createAndPublishPost,
  waitForFormRender,
  fillVisibleTextInputs,
};
