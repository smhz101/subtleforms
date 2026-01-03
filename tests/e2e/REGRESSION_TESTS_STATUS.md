# Regression Tests - Status & Next Steps

## ✅ Accomplished

1. **Node 20 Setup**

   - Package.json updated with `"engines": { "node": ">=20.0.0" }`
   - Currently using Node v20.19.4 with npm v10.8.2
   - Added npm scripts: `test:regression` and `test:regression:headed`

2. **Test Infrastructure Created**

   - 4 regression test files created covering priority bugs
   - Shell script: `run-regression-tests.sh` with Node 20 check
   - HTML report generation configured

3. **Helper Functions Updated**
   - Fixed `createAndPublishPost()` with longer timeout (30s) and better editor detection
   - Attempted multiple iterations of `createMultiStepForm()` fix

## ❌ Current Issue

### Form Creation Flow

The `createMultiStepForm()` helper is failing because:

1. When clicking "New Form", a modal/wizard appears
2. The input field locator `input[placeholder*="name"], input[placeholder*="title"]` times out
3. This means the actual input has different attributes

### Error Pattern

```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('input[placeholder*="name"], input[placeholder*="title"]').first() to be visible
```

## 🔧 Required Fix

You need to inspect the actual "New Form" modal/wizard in the browser to determine:

1. **What is the actual placeholder text?** (or is there even a placeholder?)
2. **What is the input's ID, name, or class?**
3. **Is the form type selector a button, radio, or dropdown?**

### How to Inspect

Run this command to see the modal:

```bash
npx playwright test tests/e2e/regression-step-rename.spec.js --headed --debug
```

Then:

1. Watch the browser open
2. See what appears after clicking "New Form"
3. Right-click and inspect the form title input
4. Note its exact attributes (placeholder, id, name, class)

### Alternative: Use REST API

Since the UI is problematic, you could create forms via REST API instead:

```javascript
async function createMultiStepForm(page, title = 'E2E Test Form') {
	// Create form via REST API
	const response = await page.request.post('/wp-json/subtleforms/v1/forms', {
		data: {
			title: title,
			status: 'draft',
			form_type: 'multistep',
		},
	});
	const data = await response.json();
	const formId = data.id;

	// Navigate to builder
	await page.goto(
		`/wp-admin/admin.php?page=subtleforms-new-form&form_id=${formId}`
	);
	await page.waitForLoadState('networkidle');

	return formId;
}
```

## 📊 Test Results Summary

- **Passing**: 1/13 (auth.setup only)
- **Failing**: 12/13 (all regression tests failing on form creation)
- **Root Cause**: createMultiStepForm() helper cannot interact with form creation UI

## 🎯 Recommended Next Steps

### Option 1: Fix UI Helper (Requires Manual Inspection)

1. Run test in headed mode with --debug
2. Inspect the "New Form" modal/wizard
3. Update `helpers.js` with correct selectors
4. Re-run tests

### Option 2: Use REST API (Faster, More Reliable)

1. Replace `createMultiStepForm()` with REST API approach shown above
2. Update all test files to work with this approach
3. Re-run tests

### Option 3: Simplify Tests

Create forms manually once and reuse their IDs:

1. Manually create 4 test forms in the UI
2. Hard-code their IDs in tests
3. Tests just use existing forms

## 📝 Files Modified

1. `/package.json` - Added engines and test scripts
2. `/tests/e2e/helpers.js` - Updated `createMultiStepForm()` and `createAndPublishPost()`
3. `/tests/e2e/run-regression-tests.sh` - New shell script with Node 20 check
4. `/tests/e2e/regression-*.spec.js` - All 4 test files use helpers
5. `/tests/e2e/TEST_FIXES.md` - Documentation of changes

## ⚠️ Important Notes

- Node 20 is correctly installed and being used
- Playwright is configured correctly
- Authentication works (auth.setup passes)
- The only blocker is form creation in the helpers

Once the form creation issue is resolved, all tests should be able to run properly with Node 20.
