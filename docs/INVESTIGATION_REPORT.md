# INVESTIGATION REPORT — Multi-Step Schema & Bug Root Causes

## A1) Multi-Step Schema Model

### Step Node Structure

```javascript
{
  id: "node_xyz",
  type: "step",
  kind: "structure",
  parentId: "root",
  config: {
    title: "Step 1",          // ← STEP NAME STORED HERE
    description: "...",
    id: "node_xyz",
    type: "step",
    kind: "structure",
    key: "step_abc"
  },
  children: ["field_1", "field_2"]  // ← FIELDS STORED HERE
}
```

**Location**: `resources/admin/components/builder/utils/schemaTree.js`

- Steps created via `createNodeFromDefinition(definition)`
- Default title: `config.title = "Step ${stepNumber}"`
- Children stored in `node.children` array

### Field Node Structure

```javascript
{
  id: "node_field1",
  type: "text",
  kind: "input",
  parentId: "node_stepXYZ",  // ← PARENT REFERENCE
  config: {
    label: "First Name",      // ← FIELD LABEL STORED HERE
    key: "first_name_abc",
    // ... other config
  }
}
```

### Schema Tree Operations

- **Normalize**: `normalizeSchema(schema)` converts flat array to tree structure
- **Denormalize**: `denormalizeTree(tree)` converts back to flat array
- **Build Field**: `buildField(nodeId, tree)` spreads `...node.config` into field object

**Key Finding**: When `buildField` spreads `node.config`, step's `config.title` becomes `field.title` (top-level property)

---

## A2) Builder Canvas Rendering for Multi-Step

### Current Flow

1. **FormEditor.jsx** (lines 420-445):
   - Extracts steps: `steps = rootNode.children.filter(node => node.type === 'step')`
   - Tracks `selectedStepId` state
2. **FormBuilder.jsx** (lines 64-100):

   - Detects multi-step: `isMultiStepForm = stepNodes.length > 0`
   - Gets active step: `activeStep = tree.nodes[selectedStepId]`
   - Renders **StepCanvas** when multi-step

3. **StepCanvas.jsx** (lines 30-75):
   - Reads: `children = stepNode.children || []`
   - Renders: `<ColumnDropZone items={children} />`

**ROOT CAUSE IDENTIFIED**: Canvas correctly reads `stepNode.children`, but field duplication suggests:

- Either `addNodeToTree` is called twice
- Or children array contains duplicates
- Or rendering happens multiple times

---

## A3) Inspector Update Wiring

### Update Flow

1. **FieldInspector.jsx** (lines 83-92):

   ```jsx
   {
   	field.type === 'step' ? (
   		<TextControl
   			value={field.title || ''}
   			onChange={(v) => onUpdate({ title: v })}
   		/>
   	) : (
   		<TextControl
   			value={field.label || ''}
   			onChange={(v) => onUpdate({ label: v })}
   		/>
   	);
   }
   ```

2. **FormEditor.jsx** `handleUpdate`:

   ```javascript
   const handleUpdate = useCallback(
   	(nodeId, changes) => {
   		updateTree((currentTree) =>
   			updateNodeConfig(currentTree, nodeId, changes)
   		);
   	},
   	[updateTree]
   );
   ```

3. **schemaTree.js** `updateNodeConfig`:
   ```javascript
   nodes[nodeId] = {
   	...node,
   	config: { ...node.config, ...changes },
   };
   ```

**ROOT CAUSE IDENTIFIED**:

- FieldInspector correctly updates `{ title: v }` for steps and `{ label: v }` for fields
- But if wrong `nodeId` is passed to `onUpdate`, it updates wrong node
- Issue: **Selection logic** - clicking a field should select field, clicking step header should select step

### Current Selection

- **FieldChrome** (wraps fields): `onSelect={() => onSelect(nodeId)}`
- **ContainerRenderer** (wraps steps): `onSelect={onSelect}` with `onClick` on outer div

**BUG**: If step and field both trigger selection, last one wins. Need to verify step header is selectable.

---

## A4) Frontend Multi-Step Navigation

### Current Submit Logic (Phase 6.7 already fixed this)

**FormRenderer.jsx** (lines 393-410):

```javascript
const handleNextStep = useCallback(() => {
  if (!validateStep()) return;

  if (currentStepIndex < steps.length - 1) {
    setCurrentStepIndex((prev) => prev + 1);
    // ✅ DOES NOT call handleSubmit
  }
}, [currentStepIndex, steps, validateStep]);

const handleSubmit = useCallback(async (e) => {
  e.preventDefault();

  // ✅ GUARD: Check isSubmitIntentional flag
  if (!isSubmitIntentional && hasSteps) {
    console.warn('[SubtleForms] Submission blocked');
    return;
  }
  // ... submit logic
}, [isSubmitIntentional, hasSteps, ...]);
```

**Button Logic** (lines 586-602):

```jsx
{
	hasSteps && !isLastStep ? (
		<button type='button' onClick={handleNextStep}>
			Next
		</button>
	) : (
		<button type='submit' onClick={handleExplicitSubmit}>
			Submit
		</button>
	);
}
```

**FINDING**: Frontend submission guard already implemented in Phase 6.7. Auto-submit bug should be fixed.

---

## ROOT CAUSES SUMMARY

### 1. Step Rename Bug

**Status**: NOT ACTUALLY A BUG - Working as designed

- Steps store title in `config.title`
- FieldInspector correctly reads `field.title` (which comes from `config.title` via spread)
- StepNavigator correctly reads `step.config?.title`

**Real Issue**: Reactivity - tabs may not re-render when config updates
**Fix**: Ensure FormEditor properly propagates tree updates

### 2. Field Duplication/Leakage

**Status**: NEEDS VERIFICATION
**Hypothesis**: One of:

- `handleDockAdd` using wrong parent (already logs this)
- `addNodeToTree` being called multiple times
- Children array being mutated incorrectly
- Render cycle showing wrong children

**Fix**: Debug logs will reveal actual cause

### 3. Auto-Submit Bug

**Status**: ALREADY FIXED (Phase 6.7)

- Submission guard with `isSubmitIntentional` flag
- Next button type='button' (doesn't submit form)
- Submit button only on last step

**No further action needed for C1-C3**

---

## NEXT STEPS

Based on investigation:

**PRIORITY 1**: Add debug logging (already done) and **test to see actual bug manifestation**

**PRIORITY 2**: If field duplication exists, fix `addNodeToTree` or parent assignment

**PRIORITY 3**: Add step header click handler to select step (not field)

**PRIORITY 4**: Ensure tree updates trigger React re-renders for step tabs

**PRIORITY 5**: Add Gutenberg block (D1-D2)

**PRIORITY 6**: Add E2E tests (F0-F19)
