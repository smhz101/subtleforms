# Phase 6.9 — Multi-Step Builder Polish & Bug Fixes

## Critical Issues Found

### Issue 1: Step Title Not Updating in Tabs ❌

**Problem**: When user edits step title in inspector (Step 1: Untitled → Step 1: Main), the tab doesn't update
**Root Cause**: FieldInspector updates `config.title` but StepNavigator doesn't re-render
**Impact**: HIGH - User confusion, appears broken

### Issue 2: Fields Appearing in Wrong Steps ❌

**Problem**: Fields created in Step 1 appear in Step 2, and vice versa
**Root Cause**: Field parent assignment incorrect or step isolation failing
**Impact**: CRITICAL - Data corruption risk, unusable multi-step forms

### Issue 3: Field Duplication ❌

**Problem**: Fields appear multiple times in same step
**Root Cause**: Rendering logic showing duplicates or fields being added twice
**Impact**: HIGH - Confusing UX, data integrity concerns

---

## Tasks

### Task 6.9.1 — Fix Step Title Reactivity ✅ PRIORITY 1

**Goal**: Make step tabs update immediately when title changes in inspector

**Actions**:

1. Verify FieldInspector updates `node.config.title` correctly
2. Ensure FormEditor tree updates propagate to StepNavigator
3. Add React key or dependency to force re-render
4. Test: Change "Untitled" to "Personal Info" → tab should update instantly

**Acceptance Criteria**:

- Edit step title in inspector → tab updates immediately
- No page refresh needed
- Works for all steps

---

### Task 6.9.2 — Debug Field Parent Assignment ✅ PRIORITY 1

**Goal**: Ensure fields are assigned to correct step parent

**Investigation Steps**:

1. Add console.log in `handleInsert` to show:
   - Field being added
   - Target parent ID (should be step ID)
   - Selected step ID
2. Check `handleDockAdd` logic - does it use correct parent?
3. Verify `addNodeToTree` assigns correct `node.parentId`

**Acceptance Criteria**:

- Field added to Step 1 has `parentId === step1.id`
- Field added to Step 2 has `parentId === step2.id`
- No cross-step contamination

---

### Task 6.9.3 — Fix Step Field Isolation ✅ PRIORITY 1

**Goal**: Each step shows ONLY its own children

**Actions**:

1. Verify StepCanvas reads `stepNode.children` correctly
2. Check if `renderNode` is filtering correctly
3. Ensure no global field list bleeding into steps
4. Add defensive check: if `node.parentId !== stepId`, don't render

**Acceptance Criteria**:

- Step 1 shows only Step 1 fields
- Step 2 shows only Step 2 fields
- Switching steps shows different fields
- No field duplication

---

### Task 6.9.4 — Add Step Selection Click Handler ✅ PRIORITY 2

**Goal**: Clicking step container should select the step (not just fields)

**Actions**:

1. Add onClick to StepCanvas root div
2. Call `onSelect(stepId)` when clicked
3. FieldInspector should show step settings when step selected
4. Visual indicator that step is selected

**Acceptance Criteria**:

- Click step canvas area → step selected
- Inspector shows "Step Title" and "Description" fields
- Step canvas has blue border when selected
- Can edit step metadata without selecting a field

---

### Task 6.9.5 — Improve Step Creation UX ✅ PRIORITY 2

**Goal**: New steps should have better default titles

**Actions**:

1. Change default from "Step 1" to descriptive names:
   - Step 1: "Getting Started"
   - Step 2: "Details"
   - Step 3: "Review"
2. Or prompt user for step name on creation
3. Focus step title input after creation

**Acceptance Criteria**:

- New steps have helpful default names
- Or user prompted to name step
- Easy to rename without hunting for inspector

---

### Task 6.9.6 — Add Visual Step Field Count ✅ PRIORITY 3

**Goal**: Show field count in step tabs for better overview

**Actions**:

1. In StepNavigator, count `step.children.length`
2. Display badge: "Step 1: Personal (3 fields)"
3. Update on field add/delete

**Acceptance Criteria**:

- Each step tab shows field count
- Updates in real-time
- Helps user understand form structure

---

### Task 6.9.7 — Add Step Validation State ✅ PRIORITY 3

**Goal**: Show which steps have required fields or validation errors

**Actions**:

1. Calculate if step has required fields
2. Show indicator in tab (⚠️ icon)
3. Calculate if step has validation errors
4. Show error indicator (❌ icon)

**Acceptance Criteria**:

- Steps with required fields show indicator
- Steps with errors show different indicator
- Helps user identify incomplete steps

---

### Task 6.9.8 — Debug Console Logging ✅ PRIORITY 1

**Goal**: Add temporary logging to diagnose field duplication

**Actions**:

1. Log when field is added: parent, position, field ID
2. Log when step is selected: step ID, children count
3. Log when StepCanvas renders: step ID, children IDs
4. Log when field is rendered: field ID, parent ID
5. Compare logs to understand duplication

**Acceptance Criteria**:

- Console shows clear field lifecycle
- Can identify where duplication occurs
- Logs can be removed after fix

---

## Implementation Priority

**Immediate (Do First)**:

1. Task 6.9.8 - Add debug logging to diagnose
2. Task 6.9.2 - Fix field parent assignment
3. Task 6.9.3 - Fix field isolation
4. Task 6.9.1 - Fix step title reactivity

**After Core Fixes**: 5. Task 6.9.4 - Step selection UX 6. Task 6.9.5 - Better default names 7. Task 6.9.6 - Field count badges 8. Task 6.9.7 - Validation indicators

---

## Testing Checklist

### Manual Test 1: Field Isolation

1. Create form with 2 steps
2. Add "First Name" to Step 1
3. Switch to Step 2
4. Should NOT see "First Name"
5. Add "Email" to Step 2
6. Switch back to Step 1
7. Should NOT see "Email"
8. ✅ Each step shows only its fields

### Manual Test 2: Step Renaming

1. Create form with 2 steps
2. Click Step 1 canvas
3. In inspector, change title to "Personal Information"
4. Tab should update immediately
5. Repeat for Step 2
6. ✅ All step tabs show custom names

### Manual Test 3: No Duplication

1. Create form with 1 step
2. Add "First Name" field
3. Should see it ONCE
4. Add "Last Name" field
5. Should see TWO fields total (not 4)
6. ✅ No field duplication

### Manual Test 4: Parent Assignment

1. Open browser console
2. Create multi-step form
3. Add field to Step 1
4. Check console: parentId should be step1.id
5. Switch to Step 2, add field
6. Check console: parentId should be step2.id
7. ✅ Correct parent assignment

---

## Root Cause Hypotheses

### Hypothesis 1: handleDockAdd uses wrong parent

```javascript
// Current code in FormEditor.jsx
const handleDockAdd = useCallback((type) => {
  const targetParentId = selectedStepId || rootId;
  // ^^^ Is selectedStepId actually set when step is active?
  handleInsert(type, {
    parentId: targetParentId,
    ...
  });
}, [selectedStepId, rootId]);
```

**Fix**: Ensure selectedStepId is always set when editing a step

### Hypothesis 2: StepCanvas renders wrong children

```javascript
// In StepCanvas.jsx
const children = stepNode.children || [];
// ^^^ Are these the RIGHT children or all children?
```

**Fix**: Verify tree structure, ensure children array is step-scoped

### Hypothesis 3: renderNode doesn't check parentId

```javascript
// In FormBuilder.jsx renderNode
// Missing check: if (node.parentId !== expectedParentId) return null;
```

**Fix**: Add defensive parent ID validation

---

## Expected Outcomes

After fixes:

- ✅ Step tabs update immediately when renamed
- ✅ Fields stay in their assigned step
- ✅ No field duplication
- ✅ Clear console logs for debugging
- ✅ Better UX for step editing
- ✅ Visual indicators for step state

---

## Notes

**Why fields might appear in wrong steps:**

1. Parent ID not set correctly during field creation
2. Field rendering not filtering by parent
3. Schema normalization/denormalization bug
4. Tree state not updating correctly

**Why titles might not update:**

1. React not detecting config.title change
2. StepNavigator not re-rendering on tree change
3. Cache/memo preventing update
4. Wrong property being read (title vs config.title)

**Next Phase (After 6.9)**:
Phase 6.10 — Multi-Step Frontend Styling
Phase 6.11 — Step Validation & Required Fields
Phase 7.0 — Form Type Styling System
