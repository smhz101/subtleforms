# Testing Documentation

## Overview

SubtleForms has comprehensive test coverage across three layers:

1. **Unit Tests** - Testing individual components and classes
2. **Integration Tests** - Testing API endpoints and database operations
3. **E2E Tests** - Testing complete user workflows

## Test Files

### Unit Tests (`tests/`)

#### `test-conversational-payment-forms.php`

Tests schema handling for conversational and payment form types.

**Test Methods:**

- `test_create_conversational_form()` - Validates conversational form metadata persistence
- `test_create_payment_form()` - Validates payment settings storage
- `test_create_conversational_payment_form()` - Tests hybrid conversational+payment forms
- `test_update_form_type_to_conversational()` - Tests form type conversion
- `test_payment_field_types()` - Validates payment field schema persistence
- `test_regular_form_no_payment()` - Ensures regular forms don't have payment metadata

**Usage:**

```bash
vendor/bin/phpunit tests/test-conversational-payment-forms.php
```

### Integration Tests (`tests/php/integration/`)

#### `test-api-endpoints.php`

Tests REST API endpoints for form creation, updates, and submissions.

**New Test Methods (for conversational/payment):**

- `test_create_conversational_form_via_api()` - POST `/subtleforms/v1/forms` with conversational type
- `test_create_payment_form_via_api()` - POST `/subtleforms/v1/forms` with payment metadata
- `test_update_form_to_conversational_via_api()` - PUT `/subtleforms/v1/forms/{id}/schema`
- `test_submit_payment_form_via_api()` - POST `/subtleforms/v1/submit` verifying payment metadata in submission.meta

**Usage:**

```bash
vendor/bin/phpunit tests/php/integration/test-api-endpoints.php
```

### E2E Tests (`tests/e2e/`)

#### `conversational-flow.spec.js`

Tests complete conversational form submission workflow from admin to frontend.

**Test Flow:**

1. Create conversational form via admin UI
2. Verify conversational badge displays
3. Add 3 fields (text, email, textarea)
4. Publish form and create test page with shortcode
5. Visit frontend and verify one-question-at-a-time display
6. Navigate through all questions (Next buttons)
7. Verify Review step shows all answers
8. Test Edit button (navigates back to specific question)
9. Submit form and verify success message
10. Check admin submissions page for new submission

**Usage:**

```bash
npm run test:e2e tests/e2e/conversational-flow.spec.js
```

#### `payment-flow.spec.js`

Tests payment form workflows including conversational+payment hybrid.

**Test Cases:**

1. **Regular Payment Form:**

   - Create payment form with payment settings
   - Add text, email, and payment_amount fields
   - Configure payment settings (enable, set field-based amount)
   - Publish and create test page
   - Fill form on frontend including amount
   - Verify currency display
   - Submit and verify success
   - Check admin for submission with payment metadata

2. **Conversational Payment Form:**
   - Create conversational form
   - Add fields including payment_amount
   - Configure payment settings in conversational context
   - Publish and create test page
   - Navigate through conversational questions
   - Verify Review step shows all answers
   - Proceed to Payment step
   - Verify payment summary and test mode notice
   - Complete submission
   - Verify success message

**Usage:**

```bash
npm run test:e2e tests/e2e/payment-flow.spec.js
```

## Running Tests

### Prerequisites

**For PHPUnit Tests:**

1. WordPress test environment must be installed
2. Run `bin/install-wp-tests.sh` if not already done
3. Database credentials in `wp-tests-config.php`

**For E2E Tests:**

1. Playwright installed: `npm install`
2. Browsers installed: `npx playwright install`
3. WordPress site running (default: `https://theme-wp.test`)
4. Admin user configured in `playwright.config.js`

### Run All Tests

```bash
# Run all PHPUnit tests
vendor/bin/phpunit

# Run all E2E tests
npm run test:e2e
```

### Run Specific Test Suites

```bash
# Unit tests for conversational/payment forms
vendor/bin/phpunit tests/test-conversational-payment-forms.php

# API integration tests
vendor/bin/phpunit tests/php/integration/test-api-endpoints.php

# Conversational form E2E
npm run test:e2e tests/e2e/conversational-flow.spec.js

# Payment form E2E
npm run test:e2e tests/e2e/payment-flow.spec.js
```

### Run with Verbose Output

```bash
# PHPUnit verbose
vendor/bin/phpunit --verbose

# Playwright with UI
npx playwright test --ui

# Playwright headed mode (see browser)
npx playwright test --headed
```

## Test Coverage

### Conversational Forms

- ✅ Schema persistence (unit)
- ✅ API create/update (integration)
- ✅ One-question-at-a-time display (E2E)
- ✅ Review step (E2E)
- ✅ Edit navigation (E2E)
- ✅ Submission flow (E2E)

### Payment Forms

- ✅ Payment settings storage (unit)
- ✅ Payment field validation (unit)
- ✅ API create with payment metadata (integration)
- ✅ Submission with payment data (integration)
- ✅ Payment form display (E2E)
- ✅ Currency formatting (E2E)
- ✅ Test mode notice (E2E)

### Conversational + Payment Hybrid

- ✅ Hybrid schema validation (unit)
- ✅ Questions → Review → Payment flow (E2E)
- ✅ Payment step after review (E2E)
- ✅ Payment metadata in submission (E2E)

## Continuous Integration

Tests are designed to run in CI environments:

```yaml
# Example GitHub Actions workflow
- name: Run PHPUnit Tests
  run: vendor/bin/phpunit

- name: Run E2E Tests
  run: npm run test:e2e
```

## Debugging Tests

### PHPUnit

```bash
# Print all debug output
vendor/bin/phpunit --debug

# Stop on first failure
vendor/bin/phpunit --stop-on-failure

# Filter specific test
vendor/bin/phpunit --filter test_create_conversational_form
```

### Playwright

```bash
# Run with trace
npx playwright test --trace on

# Open last test report
npx playwright show-report

# Debug specific test
npx playwright test --debug tests/e2e/conversational-flow.spec.js
```

## Writing New Tests

### Unit Test Template

```php
<?php
class My_New_Test extends WP_UnitTestCase {
    public function setUp(): void {
        parent::setUp();
        \SubtleForms\Activator::activate();
    }

    public function test_something() {
        // Arrange
        $data = ['key' => 'value'];

        // Act
        $result = do_something($data);

        // Assert
        $this->assertEquals('expected', $result);
    }
}
```

### E2E Test Template

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Feature Name', () => {
	test('can do something', async ({ page }) => {
		// Navigate and interact
		await page.goto('/wp-admin/...');

		// Make assertions
		await expect(page.locator('.element')).toBeVisible();
	});
});
```

## Test Data Cleanup

- **Unit/Integration Tests**: WordPress test framework automatically rolls back database changes after each test
- **E2E Tests**: Tests include `afterAll` cleanup hooks to delete created pages and forms
- **Manual Cleanup**: If tests fail, check admin for test forms/pages with "Test" in the name

## Known Issues

1. **PHPUnit hangs on "Installing..."**: Ensure WordPress test database is properly configured
2. **E2E tests fail to login**: Verify admin credentials in `playwright.config.js`
3. **Timeouts in E2E**: Increase timeout in test file or playwright config for slow environments

## Support

For test-related issues:

1. Check test output for specific error messages
2. Review test documentation above
3. Run tests in debug mode for more details
4. Check plugin logs in `wp-content/debug.log` (if WP_DEBUG enabled)
