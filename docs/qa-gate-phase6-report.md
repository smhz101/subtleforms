# Phase 6 QA Gate Report

## SubtleForms Plugin - Regression Testing & Bug Fixes

**Date**: January 2025  
**Scope**: Priority regression bugs (Option 1)  
**Status**: Test Suite Created | Pending Execution

---

## Executive Summary

Phase 6 QA Gate focuses on comprehensive regression testing for 5 critical known bugs in the SubtleForms plugin. This report documents the test-first approach: creating targeted E2E tests, identifying root causes, applying minimal fixes, and verifying resolution.

**Prioritized Bugs:**

1. Step rename behavior not persisting correctly
2. Field rename accidentally changing step titles
3. Field duplication across steps
4. Next button triggering form submission (auto-submit)
5. Step navigation styling inconsistency between builder/frontend

---

## Test Infrastructure

### Technology Stack

- **Framework**: Playwright 1.57.0
- **Browser**: Chromium (headed/headless modes)
- **Authentication**: Persistent sessions via `storage.json`
- **Base URL**: `https://theme-wp.test`
- **Test Location**: `tests/e2e/`

### Existing Helpers (`helpers.js`)

```javascript
-loginAsAdmin() - // Admin authentication
	createMultiStepForm() - // Form creation via UI
	addFieldToStep() - // Field manipulation
	selectStep() - // Step navigation
	addStep() - // Add new step
	insertSubtleFormBlock() - // Gutenberg block integration
	createAndPublishPost() - // Frontend test setup
	waitForFormRender(); // Frontend readiness
```

### New Regression Test Specs Created

#### 1. **regression-step-rename.spec.js**

**Target Bugs**: Step rename, field-to-step isolation, field duplication

**Test Coverage**:

- ✅ `should rename step title without affecting field labels`
  - Rename Step 1 → "Main"
  - Add text field, rename to "First Name"
  - **Assert**: Step title stays "Main" (not "First Name")
- ✅ `should not duplicate fields across steps`
  - Add "Last Name" field to Step 1
  - Create Step 2, add "Message" field
  - **Assert**: Step 1 doesn't show "Message"
  - **Assert**: Step 2 doesn't show "Last Name"

**Expected Failures**: Tests will expose if field rename affects step title, or if fields leak across steps.

---

#### 2. **regression-autosubmit.spec.js**

**Target Bug**: Next/Back buttons triggering server submission

**Test Coverage**:

- ✅ `Next button should not submit form to server`
  - Monitor network requests to `/wp-json/subtleforms/v1/submissions`
  - Fill Step 1, click Next
  - **Assert**: Zero submission requests
  - **Assert**: Step 2 becomes visible
- ✅ `Back button should not submit form to server`
  - Navigate to Step 2, click Back
  - **Assert**: Zero submission requests
  - **Assert**: Step 1 visible, field values persist

**Expected Failures**: If Next/Back buttons have `type="submit"` or trigger form submit handlers, network requests will be detected.

---

#### 3. **regression-styling.spec.js**

**Target Bug**: Step navigation dots inconsistency (builder preview vs frontend)

**Test Coverage**:

- ✅ `should have consistent step dots styling in builder preview`
  - Capture active dot: `backgroundColor`, `borderWidth`
  - Document builder preview styling
- ✅ `should have consistent step dots styling on frontend`
  - Capture active dot styling on published form
  - **Compare**: Builder preview vs frontend
- ✅ `should maintain styling consistency through step transitions`
  - Navigate Step 1 → Step 2 → Step 3
  - **Assert**: Active color remains consistent
  - **Assert**: Inactive color remains consistent
- ✅ `should show completed step styling differently from active/inactive`
  - Complete Step 1, verify "completed" class/styling exists
  - **Assert**: Completed ≠ Active ≠ Inactive

**Expected Failures**: CSS class mismatches, color/spacing differences between environments.

---

#### 4. **regression-submissions-badge.spec.js**

**Target Bug**: Unread indicators and badge counts not updating

**Test Coverage**:

- ✅ `should show unread indicator for new submission`
  - Submit form as visitor
  - Navigate to admin submissions page
  - **Assert**: Unread badge/class visible on new submission row
- ✅ `should update badge count in sidebar menu`
  - Submit second entry
  - Check SubtleForms admin menu item
  - **Assert**: Badge count > 0
- ✅ `should remove unread indicator after viewing submission`
  - Click submission row to open detail view
  - Close and reload page
  - **Assert**: Unread class removed
- ✅ `should show badge count on forms list page`
  - Navigate to forms list
  - **Assert**: Submission count column shows correct number

**Expected Failures**: Missing unread state tracking, badge count caching issues, UI not updating after viewing.

---

## Test Execution Plan

### Phase 1: Initial Test Run (Current Status: Pending)

```bash
cd /Users/muzammil/Sites/themes/1/wp/wp-content/plugins/subtleforms
npm run test:e2e -- regression-step-rename.spec.js --reporter=list
npm run test:e2e -- regression-autosubmit.spec.js --reporter=list
npm run test:e2e -- regression-styling.spec.js --reporter=list
npm run test:e2e -- regression-submissions-badge.spec.js --reporter=list
```

**Automated Script**: `tests/e2e/run-regressions.sh`

- Executes all 4 regression specs sequentially
- Captures HTML reports + text output
- Saves results to `tests/e2e/results/`

### Phase 2: Root Cause Analysis

For each failing test:

1. Review Playwright screenshots/videos (`test-results/`)
2. Inspect HTML report (`npx playwright show-report`)
3. Identify specific code location causing failure
4. Document root cause in this report

### Phase 3: Apply Minimal Fixes

Target files likely needing fixes:

**Step Rename Bug**:

- `resources/admin/components/builder/StepNavigator.jsx` (lines 66-75)

  - Currently displays: `Step ${index + 1}: ${step.title}`
  - Issue: `step.title` may be reading from field config instead of step config

- `resources/admin/components/builder/FieldInspector.jsx` (lines 82-91)
  - Step title editor updates `field.title` directly
  - Should update `field.config.title` to match schema structure

**Auto-Submit Bug**:

- `resources/frontend/components/FormRenderer.jsx` (navigation button handlers)
  - Likely missing `e.preventDefault()` on Next/Back buttons
  - Or buttons incorrectly typed as `type="submit"`

**Styling Parity Bug**:

- `resources/frontend/frontend.css` (lines 213+)
  - Frontend step navigation CSS
- `assets/css/admin-builder.css` (lines 348+)
  - Builder preview step navigation CSS
  - Need class/style alignment

**Submissions Badge Bug**:

- `resources/admin/components/SubmissionsTable.jsx`
  - Missing unread state tracking
  - Badge count not updating after view
- `src/REST/SubmissionsController.php`
  - May need "viewed_at" field in submissions table
  - Update endpoint to mark as read

### Phase 4: Verification Run

Re-execute all tests:

```bash
./tests/e2e/run-regressions.sh
```

**Success Criteria**: All tests pass (green status)

---

## Known Technical Details

### Step Field Structure (from `STEPS.md`)

```javascript
{
  type: 'step',
  id: 'step_abc123',
  config: {
    title: 'Step 1',        // ← This is what StepNavigator should read
    description: 'Optional'
  },
  children: [/* field nodes */]
}
```

**Current Issue**: StepNavigator reads `step.title` instead of `step.config.title`, causing confusion with field labels.

### Frontend Step Navigation (from `StepNavigation.jsx`)

```jsx
<div className='subtleforms-step-nav'>
	<div className='subtleforms-step-nav-item is-active'>
		<div className='subtleforms-step-nav-number'>1</div>
		<div className='subtleforms-step-nav-label'>{step.config?.title}</div>
	</div>
</div>
```

Classes: `.is-active`, `.is-completed`, `.is-clickable`

### Builder Preview Step Navigation (from `StepNavigator.jsx`)

```jsx
<button
	style={{
		background: step.selected ? '#2271b1' : '#fff',
		color: step.selected ? '#fff' : '#1e1e1e',
	}}>
	{sprintf('Step %d', index + 1)}: {step.title || 'Untitled'}
</button>
```

**Discrepancy**: Builder uses inline styles, frontend uses CSS classes. Likely cause of styling parity issues.

---

## Risk Assessment

### High Priority Fixes

1. **Auto-Submit Bug** (Severity: Critical)

   - Impact: Breaks multistep forms completely
   - User Experience: Form submits prematurely, data loss
   - Business Impact: Contact forms, surveys unusable

2. **Step Rename Bug** (Severity: High)
   - Impact: Confusing UX, step titles revert unexpectedly
   - User Experience: Users lose trust in admin interface
   - Workaround: Manual JSON editing required

### Medium Priority Fixes

3. **Field Duplication** (Severity: Medium)

   - Impact: Step isolation broken, data schema corruption
   - User Experience: Fields appear in wrong steps
   - Workaround: Delete and recreate steps

4. **Submissions Badge** (Severity: Medium)
   - Impact: Admin notification system broken
   - User Experience: Missed submissions, poor workflow
   - Workaround: Manually check submissions list

### Low Priority Fixes

5. **Styling Parity** (Severity: Low)
   - Impact: Visual inconsistency, no functional breakage
   - User Experience: Builder preview doesn't match live form
   - Workaround: Publish and check live form

---

## Next Steps

### Immediate Actions (User Decision Required)

1. **Execute test suite**: Run `./tests/e2e/run-regressions.sh` to identify actual failures
2. **Review failures**: Analyze Playwright reports and screenshots
3. **Prioritize fixes**: Confirm which bugs to fix first based on test results

### Post-Execution Actions

4. **Apply fixes**: Update identified files with minimal code changes
5. **Re-run tests**: Verify all tests pass
6. **Update documentation**: Document fixes in changelog
7. **Generate final report**: Include before/after comparisons, fixed bugs list

---

## Test Execution Commands

### Individual Test Runs

```bash
# Step rename & field isolation
npx playwright test regression-step-rename.spec.js --headed

# Auto-submit prevention
npx playwright test regression-autosubmit.spec.js --headed

# Styling parity
npx playwright test regression-styling.spec.js --headed

# Submissions badge
npx playwright test regression-submissions-badge.spec.js --headed
```

### Full Suite (Automated)

```bash
cd /Users/muzammil/Sites/themes/1/wp/wp-content/plugins/subtleforms
chmod +x tests/e2e/run-regressions.sh
./tests/e2e/run-regressions.sh
```

### View HTML Reports

```bash
npx playwright show-report
```

---

## Success Metrics

### Test Coverage

- ✅ 4 regression test specs created
- ✅ 11 individual test cases written
- ⏳ 0 tests executed (awaiting user initiation)
- ⏳ 0 bugs fixed
- ⏳ 0 tests passing

### Quality Gates

- [ ] All 11 test cases pass
- [ ] No regressions introduced by fixes
- [ ] Code changes minimal and focused
- [ ] Documentation updated

---

## Appendix

### File Locations

- **Test Specs**: `tests/e2e/regression-*.spec.js`
- **Test Helpers**: `tests/e2e/helpers.js`
- **Execution Script**: `tests/e2e/run-regressions.sh`
- **Results Directory**: `tests/e2e/results/` (created on first run)
- **HTML Reports**: `playwright-report/index.html`

### Related Documentation

- `STEPS.md` - Step/multistep form implementation guide
- `docs/status-report.md` - Comprehensive plugin status
- `playwright.config.js` - Test configuration

---

**Report Status**: Draft (Awaiting Test Execution)  
**Next Update**: After initial test run with failure analysis
