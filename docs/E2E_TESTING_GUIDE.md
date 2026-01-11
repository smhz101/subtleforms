# SubtleForms E2E Testing Guide

## Prerequisites

1. **WordPress Environment Running**

   - URL: https://theme-wp.test (or configure in playwright.config.js)
   - Admin credentials configured (default: admin/password)

2. **Test Page Created**

   - Create a new page titled "Test Multistep Form"
   - Slug: `test-multistep-form`
   - Add SubtleForm block with a multi-step form
   - Publish the page
   - This is required for frontend tests to work

3. **Assets Built**
   ```bash
   npm run build:all
   ```

## Running Tests

### Interactive UI Mode (Recommended for Development)

```bash
npm run test:e2e:ui
```

This opens Playwright's interactive UI where you can:

- See all tests in a list
- Run tests individually or in groups
- Watch tests execute in real browser
- Debug with time-travel and DOM snapshots
- Re-run failed tests easily

### Headless Mode (CI/CD)

```bash
npm run test:e2e
```

Runs all tests headlessly and generates HTML report.

### Run Specific Test File

```bash
# Builder tests only
npx playwright test tests/e2e/builder-multistep.spec.js

# Frontend tests only
npx playwright test tests/e2e/frontend-multistep.spec.js

# Block tests only
npx playwright test tests/e2e/gutenberg-block.spec.js
```

### Run Single Test

```bash
# By test name (grep pattern)
npx playwright test -g "Create multistep form with no field duplication"

# By line number
npx playwright test tests/e2e/builder-multistep.spec.js:25
```

### Debug Mode

```bash
# Opens browser in debug mode, pauses execution
npx playwright test --debug

# Debug specific test
npx playwright test --debug -g "Next button does NOT submit"
```

### Headed Mode (Watch Browser)

```bash
# Run with visible browser
npx playwright test --headed

# Slow down execution for observation
npx playwright test --headed --slow-mo=1000
```

## Test Organization

### Builder Tests (`builder-multistep.spec.js`)

Tests multi-step form builder functionality:

- **T1**: Field isolation (no duplication)
- **T2**: Step rename updates UI
- **T3**: Field label doesn't affect step name
- **T5**: Insert is step-scoped
- **T15**: Regression test for duplication

**Expected Duration**: ~60 seconds

### Frontend Tests (`frontend-multistep.spec.js`)

Tests form submission and navigation:

- **T8**: Next button doesn't submit
- **T9**: Submit button submits on last step
- **T10**: Back button navigation
- **T11**: Field validation

**Expected Duration**: ~30 seconds
**Requires**: Test page at `/test-multistep-form/`

### Block Tests (`gutenberg-block.spec.js`)

Tests Gutenberg block integration:

- **T12**: Block in inserter
- **T13**: Form selector and preview
- **T14**: Frontend rendering
- **T18**: Error handling

**Expected Duration**: ~45 seconds

## Configuration

### Environment Variables

Create `.env` file in plugin root:

```env
WP_BASE_URL=https://theme-wp.test
WP_ADMIN_USER=admin
WP_ADMIN_PASS=password
```

### Playwright Config

Edit `playwright.config.js` to adjust:

- `timeout`: Test timeout (default 60s)
- `workers`: Parallel test workers
- `retries`: Number of retries on failure
- `use.baseURL`: WordPress URL

## Troubleshooting

### Tests Timeout

1. Increase timeout in playwright.config.js:
   ```javascript
   timeout: 120000, // 2 minutes
   ```
2. Check WordPress is accessible at BASE_URL
3. Ensure no rate limiting or security plugins blocking

### Authentication Fails

1. Verify admin credentials in .env or playwright.config.js
2. Check WordPress login URL hasn't changed
3. Try logging in manually at /wp-admin

### Frontend Tests Fail

1. Create test page at `/test-multistep-form/`
2. Ensure page is published (not draft)
3. Add a multi-step form to the page
4. Check page is accessible without authentication

### Selectors Not Found

1. Elements may have different classes in your WP version
2. Update selectors in test files
3. Use Playwright Inspector to find correct selectors:
   ```bash
   npx playwright test --debug
   ```
4. Check data-testid attributes are in built assets

### Block Not Found

1. Run `npm run build:all`
2. Clear WordPress cache
3. Verify block registered in wp-admin → Plugins
4. Check browser console for JS errors

## Test Data Cleanup

Tests create forms and posts. To cleanup:

```bash
# Delete test posts
wp post delete $(wp post list --post_type=post --field=ID --s="E2E Test") --force

# Delete test forms (SubtleForms specific)
# Via WordPress admin or custom cleanup script
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
 test:
  runs-on: ubuntu-latest
  steps:
   - uses: actions/checkout@v3
   - uses: actions/setup-node@v3
     with:
      node-version: 18

   - name: Install dependencies
     run: npm ci

   - name: Build assets
     run: npm run build:all

   - name: Run E2E tests
     run: npm run test:e2e
     env:
      WP_BASE_URL: ${{ secrets.WP_BASE_URL }}
      WP_ADMIN_USER: ${{ secrets.WP_ADMIN_USER }}
      WP_ADMIN_PASS: ${{ secrets.WP_ADMIN_PASS }}

   - name: Upload test results
     if: always()
     uses: actions/upload-artifact@v3
     with:
      name: playwright-report
      path: playwright-report/
```

## Writing New Tests

### Using Test Helpers

```javascript
const { test, expect } = require('@playwright/test');
const {
	loginAsAdmin,
	createMultiStepForm,
	addFieldToStep,
	selectStep,
} = require('./helpers');

test('My new test', async ({ page }) => {
	await loginAsAdmin(page);
	await createMultiStepForm(page, 'Test Form');

	await selectStep(page, 1);
	await addFieldToStep(page, 'email');

	// Your assertions
	expect(await page.locator('input[type="email"]').count()).toBe(1);
});
```

### Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Add waits after actions** (500ms typical)
3. **Clean up test data** in afterEach hooks
4. **Use helpers** for common operations
5. **Assert network requests** for submission tests
6. **Take screenshots** on failure (automatic)

## Viewing Test Reports

After running tests, view HTML report:

```bash
npx playwright show-report
```

Opens browser with:

- Test results summary
- Failed test screenshots
- Network activity logs
- Console output
- Video recordings (if enabled)

## Performance

### Optimize Test Speed

1. **Use storage state** for authentication (already configured)
2. **Run tests in parallel** (configure workers in playwright.config.js)
3. **Skip unnecessary waits** (use waitForSelector instead of fixed timeouts)
4. **Reuse test data** when possible

### Current Performance

- **Builder tests**: ~60s total
- **Frontend tests**: ~30s total
- **Block tests**: ~45s total
- **Total suite**: ~2-3 minutes

## Support

For issues or questions:

1. Check test output and screenshots
2. Review `docs/PHASE_6_3_SUMMARY.md`
3. Run with `--debug` for step-by-step execution
4. Check Playwright docs: https://playwright.dev

## Quick Commands Reference

```bash
# Development
npm run test:e2e:ui                    # Interactive UI mode
npx playwright test --headed           # Watch browser
npx playwright test --debug            # Debug mode

# Specific tests
npx playwright test builder-multistep  # Builder tests
npx playwright test frontend-multistep # Frontend tests
npx playwright test gutenberg-block    # Block tests

# CI/CD
npm run test:e2e                       # Headless run
npx playwright test --reporter=github  # GitHub Actions format

# Maintenance
npx playwright install                 # Update browsers
npx playwright show-report             # View last report
npx playwright codegen                 # Generate test code
```
