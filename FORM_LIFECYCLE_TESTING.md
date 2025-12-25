# Form Lifecycle Testing Checklist

## Test Environment Setup

- [ ] WordPress installation accessible
- [ ] SubtleForms plugin activated and up-to-date
- [ ] User logged in with admin/editor role
- [ ] Browser developer tools open (Console + Network tabs)
- [ ] Forms list accessible at `/wp-admin/admin.php?page=subtleforms-forms`

---

## Test Suite 1: Ephemeral Forms (In-Memory Only)

### Test 1.1: Open and Close Without Changes

**Objective**: Verify no database record created

**Steps**:

1. Navigate to Forms list
2. Count existing forms (note the number)
3. Click "Create Form" button
4. Wait for builder to load
5. DO NOT make any changes
6. Click Close (X) button
7. Return to Forms list

**Expected Results**:

- ✅ No confirmation modal appears
- ✅ Forms count remains the same
- ✅ No new entry in Forms list
- ✅ Status indicator shows "No changes yet" (gray dot)
- ✅ No database INSERT in debug.log

**Database Verification**:

```sql
-- Run before and after test
SELECT COUNT(*) FROM wp_subtleforms_forms;
-- Should be identical
```

---

### Test 1.2: Open and Navigate Tabs Without Changes

**Objective**: Verify navigating tabs doesn't trigger save

**Steps**:

1. Click "Create Form"
2. Click "Submissions" tab
3. Click "Settings" tab
4. Click "Build" tab (return to builder)
5. DO NOT add any fields
6. Click Close (X) button

**Expected Results**:

- ✅ No confirmation modal
- ✅ No form created
- ✅ Status remains "No changes yet"

---

### Test 1.3: Open, Click Around, Close

**Objective**: Verify clicking in empty areas doesn't create form

**Steps**:

1. Click "Create Form"
2. Click in empty form canvas area
3. Click in sidebar area
4. Click form title (but don't change it)
5. Press Escape
6. Click Close (X)

**Expected Results**:

- ✅ No confirmation modal
- ✅ No form created
- ✅ Clean exit

---

## Test Suite 2: Draft Form Creation

### Test 2.1: Add Field Triggers Draft

**Objective**: Verify first field addition creates draft

**Steps**:

1. Click "Create Form"
2. Note status shows "No changes yet"
3. Click "Add Field" button
4. Select "Text Input"
5. Wait 2-3 seconds
6. Observe status indicator

**Expected Results**:

- ✅ Status changes to "Not saved" immediately after adding field
- ✅ After 2 seconds, status shows "Saving..." (blue dot)
- ✅ After save completes, status shows "Saved" (green dot)
- ✅ Form appears in Forms list with "Draft" badge
- ✅ Network tab shows POST request to `/forms` endpoint
- ✅ Form ID appears in URL query parameter

**Database Verification**:

```sql
SELECT id, title, status, created_at
FROM wp_subtleforms_forms
ORDER BY created_at DESC
LIMIT 1;
-- Should show new form with status='draft'
```

---

### Test 2.2: Edit Field Triggers Draft

**Objective**: Verify field property changes create draft

**Steps**:

1. Click "Create Form"
2. Add a Text Input field
3. Click the field to select it
4. Change the "Label" to "Your Name"
5. Wait 2 seconds

**Expected Results**:

- ✅ Status changes to "Saving..."
- ✅ Form saved as draft
- ✅ Field label persisted

---

### Test 2.3: Delete Field Triggers Draft

**Objective**: Verify field deletion is tracked as mutation

**Steps**:

1. Click "Create Form"
2. Add a Text Input field
3. Hover over field
4. Click delete icon (trash)
5. Wait 2 seconds

**Expected Results**:

- ✅ Form created as draft
- ✅ Field removed from schema
- ✅ Autosave triggered

---

### Test 2.4: Rapid Field Additions

**Objective**: Verify efficient autosave during rapid changes

**Steps**:

1. Click "Create Form"
2. Add 5 fields quickly (within 5 seconds)
3. Observe status indicator

**Expected Results**:

- ✅ Status shows "Not saved" during additions
- ✅ Timer resets with each addition
- ✅ Only ONE autosave triggered (2 seconds after last addition)
- ✅ Network tab shows only 1 POST request to create form

---

## Test Suite 3: Autosave Behavior

### Test 3.1: Autosave Never Publishes

**Objective**: Verify autosave always saves as draft

**Steps**:

1. Create a draft form with 1 field
2. Wait for autosave to complete
3. Verify form status = "Draft"
4. Edit field label
5. Wait for autosave (see "Saving..." → "Saved")
6. Check form status

**Expected Results**:

- ✅ Status badge remains "DRAFT" (yellow)
- ✅ Never changes to "PUBLISHED"
- ✅ Database status column = 'draft'

**Database Verification**:

```sql
SELECT id, status
FROM wp_subtleforms_forms
WHERE id = [YOUR_FORM_ID];
-- Should be 'draft', NOT 'published'
```

---

### Test 3.2: Autosave Debouncing

**Objective**: Verify 2-second debounce works

**Steps**:

1. Create a draft form
2. Open Network tab in DevTools
3. Clear Network log
4. Edit field label
5. Wait exactly 1 second
6. Edit field label again
7. Wait 3 seconds
8. Check Network tab

**Expected Results**:

- ✅ Only 1 POST request to `/schema` endpoint
- ✅ Request sent 2 seconds after last change
- ✅ No duplicate save requests

---

### Test 3.3: Manual Save Overrides Autosave

**Objective**: Verify manual save cancels pending autosave

**Steps**:

1. Create a draft form
2. Edit a field
3. Wait 1 second (before autosave triggers)
4. Click "Save" button manually
5. Check Network tab

**Expected Results**:

- ✅ Manual save completes immediately
- ✅ Autosave timer cancelled
- ✅ Only 1 save request in Network tab
- ✅ Success notice shows "Form saved"

---

### Test 3.4: Autosave During Tab Switch

**Objective**: Verify autosave continues when switching tabs

**Steps**:

1. Create a draft form
2. Add a field
3. Wait 1 second
4. Switch to "Submissions" tab
5. Wait 3 seconds
6. Switch back to "Build" tab

**Expected Results**:

- ✅ Autosave completes even when on different tab
- ✅ Field persisted when returning to Build tab

---

## Test Suite 4: Discard Changes Logic

### Test 4.1: Discard Ephemeral Form With Changes

**Objective**: Verify confirmation shown for unsaved changes

**Steps**:

1. Click "Create Form"
2. Add a Text Input field
3. DO NOT wait for autosave
4. Immediately click Close (X)

**Expected Results**:

- ✅ Confirmation modal appears: "Discard unsaved changes?"
- ✅ Modal shows "Discard" and "Cancel" buttons
- ✅ Clicking "Discard" returns to Forms list
- ✅ No form created in database
- ✅ Clicking "Cancel" returns to builder

---

### Test 4.2: Discard Saved Form With Changes

**Objective**: Verify confirmation for modified saved form

**Steps**:

1. Create a draft form and wait for autosave
2. Edit a field label
3. DO NOT wait for autosave
4. Click Close (X)

**Expected Results**:

- ✅ Confirmation modal appears
- ✅ Clicking "Discard" returns to Forms list
- ✅ Changes lost (not saved)
- ✅ Form reverts to previous saved state

---

### Test 4.3: Close Saved Form Without Changes

**Objective**: Verify no confirmation for unchanged form

**Steps**:

1. Open an existing draft form
2. DO NOT make any changes
3. Click Close (X)

**Expected Results**:

- ✅ No confirmation modal
- ✅ Returns to Forms list immediately

---

### Test 4.4: Close After Autosave Completes

**Objective**: Verify clean close after autosave

**Steps**:

1. Create a draft form
2. Add a field
3. Wait for "Saved" indicator (green dot)
4. Click Close (X)

**Expected Results**:

- ✅ No confirmation modal
- ✅ Clean exit to Forms list
- ✅ Form appears in list as Draft

---

## Test Suite 5: Publish Workflow

### Test 5.1: Publish Draft Form

**Objective**: Verify explicit publish action

**Steps**:

1. Create a draft form with at least 1 field
2. Wait for autosave to complete
3. Click "Publish" button
4. Confirm in modal
5. Check status badge

**Expected Results**:

- ✅ Confirmation modal appears: "Publish this form?"
- ✅ After confirming, success notice: "Form published"
- ✅ Status badge changes to "PUBLISHED" (green)
- ✅ Database status = 'published'
- ✅ Form shortcode becomes functional

**Database Verification**:

```sql
SELECT status FROM wp_subtleforms_forms WHERE id = [YOUR_FORM_ID];
-- Should be 'published'
```

---

### Test 5.2: Publish Ephemeral Form

**Objective**: Verify publish creates and publishes in one step

**Steps**:

1. Click "Create Form"
2. Add a field
3. DO NOT wait for autosave
4. Click "Publish" button
5. Confirm in modal

**Expected Results**:

- ✅ Form created with status='published'
- ✅ Badge shows "PUBLISHED"
- ✅ No intermediate draft state

---

### Test 5.3: Autosave After Publishing

**Objective**: Verify autosave doesn't change published status

**Steps**:

1. Publish a form (from Test 5.1)
2. Edit a field
3. Wait for autosave

**Expected Results**:

- ✅ Changes saved successfully
- ✅ Status remains "PUBLISHED" (not reverted to draft)
- ✅ Badge stays green

---

### Test 5.4: Unpublish (Draft) Published Form

**Objective**: Verify ability to unpublish

**Steps**:

1. Open a published form
2. Click status dropdown/badge
3. Select "Draft"
4. Confirm

**Expected Results**:

- ✅ Status changes to "DRAFT"
- ✅ Badge turns yellow
- ✅ Form removed from frontend
- ✅ Shortcode shows "not published" message

---

## Test Suite 6: Frontend Rendering

### Test 6.1: Draft Form Doesn't Render

**Objective**: Verify draft forms blocked on frontend

**Steps**:

1. Create a draft form (ID: 123)
2. Copy shortcode: `[subtleforms id="123"]`
3. Create a new WordPress page
4. Add shortcode to page content
5. Publish page
6. View page on frontend (logged out)

**Expected Results**:

- ✅ Page loads successfully
- ✅ Error message displayed: "This form is not published yet."
- ✅ No form fields visible
- ✅ No JavaScript errors in console

---

### Test 6.2: Published Form Renders

**Objective**: Verify published forms work on frontend

**Steps**:

1. Publish a form from Test 6.1 (same ID: 123)
2. Refresh the page with shortcode
3. Verify form renders

**Expected Results**:

- ✅ Form fields visible
- ✅ Submit button present
- ✅ Form is functional (can type in fields)
- ✅ Styling applied correctly

---

### Test 6.3: Invalid Form ID

**Objective**: Verify graceful handling of non-existent forms

**Steps**:

1. Add shortcode with fake ID: `[subtleforms id="99999"]`
2. View page

**Expected Results**:

- ✅ Error message: "Form not found" or similar
- ✅ No PHP errors
- ✅ Page continues to load

---

## Test Suite 7: Edge Cases

### Test 7.1: Network Error During Save

**Objective**: Verify graceful error handling

**Steps**:

1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Create a form and add a field
4. Wait 2 seconds for autosave
5. Observe error handling

**Expected Results**:

- ✅ Error notice appears: "Failed to save form"
- ✅ Status indicator shows error state
- ✅ Changes remain in browser (not lost)
- ✅ Can retry by going online and clicking "Save"

---

### Test 7.2: Browser Refresh During Edit

**Objective**: Verify unsaved changes warning

**Steps**:

1. Create a draft form
2. Add a field
3. DO NOT wait for autosave
4. Press F5 (or Cmd+R) to refresh page

**Expected Results**:

- ✅ Browser shows native "Leave site?" warning
- ✅ Changes lost if user confirms
- ✅ This is expected behavior (no localStorage backup)

---

### Test 7.3: Concurrent Editing

**Objective**: Test behavior with multiple editors

**Steps**:

1. User A opens form ID 123
2. User B opens same form ID 123
3. User A adds a field, waits for autosave
4. User B adds a different field, waits for autosave

**Expected Results**:

- ✅ Both saves succeed
- ✅ Last save wins (User B's change overwrites User A's)
- ⚠️ No conflict resolution (future enhancement)
- ✅ No data corruption

---

### Test 7.4: Form Title Special Characters

**Objective**: Verify proper sanitization

**Steps**:

1. Create a form
2. Edit title to: `Test <script>alert('XSS')</script> Form`
3. Save form
4. Check Forms list

**Expected Results**:

- ✅ Script tags stripped
- ✅ Title displays: "Test alert('XSS') Form"
- ✅ No XSS vulnerability
- ✅ No JavaScript executed

---

### Test 7.5: Form With 100+ Fields

**Objective**: Verify performance with large forms

**Steps**:

1. Create a form
2. Add 100 text input fields (use a script if needed)
3. Wait for autosave
4. Edit one field
5. Wait for autosave

**Expected Results**:

- ✅ All fields saved successfully
- ✅ Autosave completes in < 5 seconds
- ✅ No browser lag or freezing
- ✅ Form loads without issues when reopened

---

## Test Suite 8: Status Indicators

### Test 8.1: Visual Status Dot Colors

**Objective**: Verify correct dot colors for each state

**Steps**:

1. Open ephemeral form (no changes)
   - ✅ Gray dot + "No changes yet"
2. Add field (before autosave)
   - ✅ Yellow dot + "Not saved"
3. Wait for autosave
   - ✅ Blue dot + "Saving..."
4. After autosave completes
   - ✅ Green dot + "Saved"
5. Edit field (before autosave)
   - ✅ Yellow dot + "Unsaved changes"

---

### Test 8.2: Status Badge Visibility

**Objective**: Verify badge only shows for saved forms

**Steps**:

1. Open ephemeral form
   - ✅ No status badge visible
2. Add field, wait for autosave
   - ✅ "DRAFT" badge appears (yellow)
3. Publish form
   - ✅ "PUBLISHED" badge appears (green)

---

### Test 8.3: Shortcode Visibility

**Objective**: Verify shortcode only shows for saved forms

**Steps**:

1. Open ephemeral form
   - ✅ No shortcode pill visible
2. Add field, wait for autosave
   - ✅ Shortcode pill appears: `[subtleforms id="123"]`
3. Click shortcode pill
   - ✅ Copies to clipboard
   - ✅ Shows "Copied!" feedback

---

## Test Suite 9: Database Integrity

### Test 9.1: Forms Table Structure

**Objective**: Verify status column exists

```sql
DESCRIBE wp_subtleforms_forms;
-- Should include: status VARCHAR(20) NOT NULL DEFAULT 'draft'
```

**Expected Results**:

- ✅ `status` column present
- ✅ Default value = 'draft'
- ✅ NOT NULL constraint

---

### Test 9.2: Status Values

**Objective**: Verify only valid status values

```sql
SELECT DISTINCT status FROM wp_subtleforms_forms;
-- Should return: 'draft', 'published', or 'archived'
```

**Expected Results**:

- ✅ No invalid status values
- ✅ No empty/NULL statuses

---

### Test 9.3: Orphaned Records

**Objective**: Verify no forms without schemas

```sql
SELECT f.id, f.title
FROM wp_subtleforms_forms f
LEFT JOIN wp_subtleforms_form_schemas s ON f.id = s.form_id
WHERE s.form_id IS NULL;
-- Should return 0 rows (or only brand new drafts)
```

**Expected Results**:

- ✅ All forms have at least one schema version
- ✅ Or forms are brand new (< 1 minute old)

---

## Test Suite 10: Regression Testing

### Test 10.1: Existing Forms Still Work

**Objective**: Verify backward compatibility

**Steps**:

1. Open an existing form (created before this update)
2. Verify it loads correctly
3. Make a change
4. Save

**Expected Results**:

- ✅ Form loads without errors
- ✅ All fields present
- ✅ Save works normally
- ✅ No data loss

---

### Test 10.2: Submissions Still Work

**Objective**: Verify form submissions unaffected

**Steps**:

1. Publish a form
2. Submit it on frontend
3. Check Submissions tab

**Expected Results**:

- ✅ Submission saved
- ✅ Data captured correctly
- ✅ No errors in submission flow

---

### Test 10.3: Settings Page Works

**Objective**: Verify other features unaffected

**Steps**:

1. Navigate to Settings page
2. Change a setting
3. Save

**Expected Results**:

- ✅ Settings save successfully
- ✅ No JavaScript errors
- ✅ Page functions normally

---

## Testing Summary Template

After completing all tests, fill out this summary:

```
Date Tested: ___________
Tester Name: ___________
Environment: ___________
WordPress Version: ___________
PHP Version: ___________

Test Results:
✅ Passed: ___ / 50
❌ Failed: ___ / 50
⚠️  Warnings: ___

Critical Issues Found:
1.
2.
3.

Minor Issues Found:
1.
2.
3.

Notes:


Sign-off: ___________
```

---

## Automated Testing (Future)

To run automated tests:

```bash
# Install WordPress testing framework
./bin/install-wp-tests.sh wordpress_test root '' localhost latest

# Run PHPUnit tests
composer test

# Run JavaScript tests
npm test
```

**Test Files to Create**:

- `tests/php/FormLifecycleTest.php`
- `tests/js/FormBuilderPage.test.jsx`

---

## Performance Benchmarks

Record these metrics during testing:

| Metric                             | Target  | Actual |
| ---------------------------------- | ------- | ------ |
| Form creation time                 | < 100ms | \_\_\_ |
| Autosave response time             | < 500ms | \_\_\_ |
| Builder load time                  | < 2s    | \_\_\_ |
| Frontend render time               | < 100ms | \_\_\_ |
| Database query count (single form) | < 5     | \_\_\_ |

---

## Approval Checklist

Before deploying to production:

- [ ] All Test Suites 1-10 completed
- [ ] No critical issues found
- [ ] All minor issues documented
- [ ] Performance benchmarks met
- [ ] Database migrations tested (if any)
- [ ] Backward compatibility verified
- [ ] Documentation reviewed and accurate
- [ ] Code review completed
- [ ] QA sign-off obtained
- [ ] Staging environment tested
- [ ] Production backup created
- [ ] Rollback plan prepared

---

## Contact

If you discover issues during testing:

- **GitHub Issues**: [Submit Bug Report]
- **Email**: support@subtleforms.com
- **Slack**: #subtleforms-dev

---

**Last Updated**: 2024-12-25
**Document Version**: 1.0.0
