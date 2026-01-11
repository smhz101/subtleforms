# DEBUG INSTRUCTIONS - Phase 6.9

## Testing Steps with Console Logging

### Test 1: Verify Step Selection

1. Hard refresh WordPress admin (Cmd+Shift+R / Ctrl+Shift+F5)
2. Open a multi-step form in the builder
3. Open browser console (F12)
4. Click between Step 1 and Step 2 tabs

**Expected Console Output:**

```
[SubtleForms] Step Selected: {
  stepId: "node_abc123",
  stepTitle: "Step 1",
  childrenCount: 2,
  childrenIds: ["node_field1", "node_field2"]
}
```

**What to check:**

- ✅ childrenCount matches fields you added
- ✅ childrenIds are different for each step
- ❌ If childrenIds are the same, steps are sharing fields

---

### Test 2: Add Field to Step 1

1. Select Step 1
2. Drag "Text" field from left panel
3. Watch console

**Expected Console Output:**

```
[SubtleForms] Dock Add: {
  fieldType: "text",
  selectedStepId: "node_step1",
  targetParentId: "node_step1",
  isStepSelected: true,
  rootId: "root"
}

[SubtleForms] Creating field: {
  fieldType: "text",
  fieldId: "node_field123",
  fieldLabel: "Text Field",
  targetParentId: "node_step1",  // <-- Should match step ID
  selectedStepId: "node_step1",
  columnIndex: null,
  position: null
}

[SubtleForms] StepCanvas render: {
  stepId: "node_step1",
  stepTitle: "Step 1",
  stepNumber: 1,
  childrenCount: 1,  // <-- Should increment
  childrenIds: ["node_field123"],
  stepNodeType: "step"
}
```

**What to check:**

- ✅ `targetParentId` matches `selectedStepId`
- ✅ `childrenCount` increases by 1
- ✅ New field ID appears in `childrenIds`
- ❌ If targetParentId is "root", step selection is broken

---

### Test 3: Switch to Step 2 and Add Field

1. Click Step 2 tab
2. Watch console for step selection
3. Drag "Email" field
4. Watch console

**Expected Console Output:**

```
[SubtleForms] Step Selected: {
  stepId: "node_step2",
  stepTitle: "Step 2",
  childrenCount: 0,  // <-- Should be 0 if empty
  childrenIds: []
}

[SubtleForms] Creating field: {
  fieldType: "email",
  targetParentId: "node_step2",  // <-- Different from Step 1
  ...
}

[SubtleForms] StepCanvas render: {
  stepId: "node_step2",
  childrenCount: 1,
  childrenIds: ["node_email456"],  // <-- Different from Step 1
  ...
}
```

**What to check:**

- ✅ `targetParentId` is Step 2's ID (different from Step 1)
- ✅ `childrenIds` contains ONLY the email field
- ❌ If childrenIds contains Step 1 fields, isolation is broken

---

### Test 4: Rename Step Title

1. Click Step 1 canvas area (or a field in Step 1)
2. In right panel, change "Step Title" from "Untitled" to "Personal Info"
3. Press Enter or Tab to save
4. Look at Step 1 tab at top

**Expected Behavior:**

- ✅ Tab updates to "Step 1: Personal Info" immediately
- ❌ If still says "Untitled", reactivity is broken

**Console Check:**
Look for any errors or warnings when changing title.

---

### Test 5: Field Duplication Check

1. Create new multi-step form
2. Add Step 1
3. Add 2 fields to Step 1: "First Name", "Last Name"
4. Check console for Step 1:

**Expected:**

```
childrenCount: 2
childrenIds: ["node_abc", "node_def"]
```

5. Switch to Step 2
6. Check console for Step 2:

**Expected:**

```
childrenCount: 0
childrenIds: []
```

**Visual Check:**

- ✅ Step 1 shows: First Name, Last Name
- ✅ Step 2 shows: Empty (or Add Field button)
- ❌ If Step 2 shows First Name, Last Name - FIELD LEAKING

---

## Common Issues and Solutions

### Issue: targetParentId is "root" instead of step ID

**Diagnosis:** selectedStepId is not set
**Solution:** Check handleSelectStep is called, verify useEffect sets initial step

### Issue: All steps show same childrenIds

**Diagnosis:** Steps sharing children array or wrong parent assignment
**Solution:** Verify addNodeToTree assigns correct parent, check tree structure

### Issue: childrenCount doubles (2 fields become 4)

**Diagnosis:** Fields being added twice OR rendered twice
**Solution:** Check if addNodeToTree is called multiple times, verify renderNode doesn't duplicate

### Issue: Step title doesn't update in tab

**Diagnosis:** React not re-rendering or reading wrong property
**Solution:** Verify tree.nodes[stepId].config.title is updated, check StepNavigator dependencies

---

## What to Report

After testing, please report:

1. **Console logs** - Copy/paste the output for each test
2. **Field counts** - What childrenCount shows vs what you see visually
3. **Parent IDs** - Are they matching step IDs or "root"?
4. **Title update** - Does tab update immediately or not at all?
5. **Field leaking** - Do fields appear in wrong steps?

Example report:

```
Test 1: ✅ Step selection shows correct IDs
Test 2: ❌ targetParentId is "root" not step ID
Test 3: ❌ Step 2 shows Step 1 fields
Test 4: ✅ Title updates immediately
Test 5: ❌ childrenCount is 4 but only added 2 fields
```

This will help pinpoint exactly where the issue is!
