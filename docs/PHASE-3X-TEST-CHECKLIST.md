# Phase 3.x Testing Checklist

## Build Verification ✓

- [x] Build completes with Node 20 without errors
- [x] Tailwind CSS compiles successfully
- [x] No console errors in build output
- [x] Build artifacts generated correctly

## Integration Verification ✓

### Component Integrations

- [x] OnboardingWizard imported in FormsPage.jsx
- [x] BuilderTour imported in BuilderPage.jsx
- [x] FormPreviewModal imported in BuilderPage.jsx
- [x] HelpMenu imported in both FormsPage.jsx and BuilderPage.jsx

### State Management

- [x] Wizard state tracked with showWizard useState
- [x] Tour state tracked with showTour useState
- [x] Preview state tracked with showPreview useState
- [x] All state handlers properly connected

### Data Attributes

- [x] data-tour='header' in BuilderPage header
- [x] data-tour='fields-panel' in FormEditor
- [x] data-tour='canvas' in FormEditor
- [x] data-tour='field-toolbar' in FieldToolbar
- [x] data-tour='field-inspector' in FormEditor
- [x] All tour selectors matching data-tour attributes

### API Endpoints

- [x] POST /onboarding/dismiss registered
- [x] GET /onboarding/status registered
- [x] POST /tour/complete registered
- [x] GET /tour/status registered
- [x] All endpoints have proper callbacks
- [x] All endpoints use current_user_can checks

## Browser Testing (Manual)

### Task 1: Onboarding Wizard

- [ ] Navigate to /wp-admin/admin.php?page=subtleforms-forms
- [ ] Verify wizard appears automatically if no forms exist
- [ ] Step through all 5 wizard steps
- [ ] Test "Don't show again" checkbox
- [ ] Test "Skip for now" button
- [ ] Verify form creation after wizard completion
- [ ] Test wizard dismissal persists across page reloads
- [ ] Test Help Menu > "Quick Start Wizard" reopens it

### Task 2: Builder Tour

- [ ] Create a new form (click "Add New")
- [ ] Verify tour launches automatically after 1 second
- [ ] Test all 7 tour steps:
  - [ ] Header area spotlight
  - [ ] Fields panel spotlight
  - [ ] Canvas area spotlight
  - [ ] Field toolbar spotlight (add a field first if needed)
  - [ ] Field inspector spotlight
  - [ ] Settings tab spotlight
  - [ ] Publish button spotlight
- [ ] Verify spotlight positioning is accurate
- [ ] Test "Skip Tour" button
- [ ] Test "Next" button progression
- [ ] Verify tour completion persists
- [ ] Test Help Menu > "Start Tour" restarts it

### Task 3: Live Preview

- [ ] Open form builder with fields added
- [ ] Click "Preview" button in header
- [ ] Verify modal opens
- [ ] Test preview rendering for field types:
  - [ ] Text field
  - [ ] Email field
  - [ ] Textarea field
  - [ ] Select dropdown
  - [ ] Radio buttons
  - [ ] Checkboxes
  - [ ] Date picker
  - [ ] File upload
- [ ] Verify conversational form shows notice
- [ ] Verify multi-step form shows "Multi-step preview coming soon"
- [ ] Close modal with X button
- [ ] Close modal with "Close" button
- [ ] Verify no autosave triggered during preview
- [ ] Check console for errors

### Task 4: Help Menu

- [ ] On Forms page, verify help icon appears
- [ ] Click help icon, verify dropdown opens
- [ ] Test "Quick Start Wizard" link
- [ ] Test "View Documentation" link
- [ ] On Builder page, verify help icon appears
- [ ] Click help icon, verify dropdown opens
- [ ] Test "Start Tour" link
- [ ] Test "View Documentation" link

### Task 5: State Persistence

- [ ] Complete wizard, reload page → verify not shown
- [ ] Complete tour, reload page → verify not shown
- [ ] Open preview, close, check DB → verify no autosave
- [ ] Check browser console → verify no localStorage usage
- [ ] Check browser DevTools Application tab → verify no session storage
- [ ] Verify user meta keys exist in DB:
  - `subtleforms_onboarding_dismissed`
  - `subtleforms_tour_completed`

## Cross-Browser Testing

- [ ] Test wizard flow in Chrome
- [ ] Test tour positioning in Firefox
- [ ] Test preview rendering in Safari
- [ ] Verify no console errors in any browser

## Performance Checks

- [ ] Wizard loads within 500ms
- [ ] Tour spotlight positioning < 100ms
- [ ] Preview modal renders within 300ms
- [ ] No memory leaks after multiple wizard/tour/preview cycles
- [ ] Bundle size warnings acceptable (404 KiB)

## Regression Testing

- [ ] Existing form creation still works
- [ ] Existing form editing still works
- [ ] Field drag-and-drop still works
- [ ] Field settings still save
- [ ] Publish/Update still works
- [ ] No breaking changes to existing workflows

## Documentation Verification

- [x] STATE-PERSISTENCE-AUDIT.md complete
- [x] All features documented
- [x] API endpoints documented
- [x] User meta keys documented

## Git Commit History

- [x] fix(tests): correct method name from updateSchema to saveSchemaVersion
- [x] feat(onboarding): add first-time user wizard
- [x] feat(builder): add guided tour for editor UI
- [x] feat(builder): add live preview mode
- [x] feat(ux): add contextual help entry points
- [x] chore(state): stabilize onboarding persistence
- [ ] test(phase3): complete Phase 3.x testing & verification

## Version History

- 1.1.36 → 1.1.37 (Wizard)
- 1.1.37 → 1.1.38 (Tour)
- 1.1.38 → 1.1.39 (Preview)
- 1.1.39 → 1.1.40 (Help)
- 1.1.40 → 1.1.41 (Audit)
- 1.1.41 → 1.1.42 (Testing) ← next

## Sign-Off

- [ ] All automated tests pass
- [ ] All browser tests pass
- [ ] No console errors
- [ ] No breaking changes
- [ ] Documentation complete
- [ ] Ready for production
