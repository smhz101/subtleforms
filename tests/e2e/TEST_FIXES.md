# Test Fixes Applied - Node 20 Compatibility

## Changes Made

### 1. Package.json Updates

- Added Node 20 requirement: `"engines": { "node": ">=20.0.0" }`
- Added npm scripts for regression tests:
  - `test:regression` - Run all regression tests with HTML report
  - `test:regression:headed` - Run with visible browser

### 2. Helper Function Fixes (`helpers.js`)

#### createMultiStepForm()

**Problem**: Was trying to fill readonly input fields
**Solution**:

- Changed to go directly to `/wp-admin/admin.php?page=subtleforms-new-form`
- Improved wizard detection and handling
- Added proper waiting for form to be editable
- Returns numeric form ID instead of URL string

#### createAndPublishPost()

**Problem**: Block editor timeout (10s was too short)
**Solution**:

- Increased timeout to 30 seconds
- Added `waitForLoadState('networkidle')` before checking for editor
- Added explicit wait for title input to be visible
- Now waits for `.block-editor` OR `.edit-post-layout` (more flexible)

### 3. Test Script

Created `tests/e2e/run-regression-tests.sh` that:

- Automatically loads NVM and switches to Node 20
- Runs regression tests via npm script
- Shows clear pass/fail status
- Displays how to view HTML report

## Usage

### Quick Run

```bash
npm run test:regression
```

### With Browser Visible

```bash
npm run test:regression:headed
```

### Via Shell Script (includes Node 20 check)

```bash
./tests/e2e/run-regression-tests.sh
```

### View Report

```bash
npx playwright show-report
```

## Test Status

All regression tests should now run correctly with Node 20.
