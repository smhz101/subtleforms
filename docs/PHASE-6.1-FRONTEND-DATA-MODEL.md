# Phase 6.1 — Frontend Data Model Correctness (Nested Field Serialization)

## Task 6.1.1 — Audit: Current Frontend State Shape (As Implemented)

### Current `values` shape

- In the public renderer, form state is held as a plain object in React state:
  - `const [values, setValues] = useState({});`
- Updates are applied as a shallow merge:
  - `setValues((prev) => ({ ...prev, [fieldKey]: value }))`
- Submission payload uses this object directly:
  - `POST /subtleforms/v1/submit` with `{ form_id, data: values }`

### How keys are derived

- In the regular/step renderer, the key used for state is computed as:
  - `fieldKey = field.config?.key || field.key`
- Conditional logic also reads values by key:
  - `values[condition.sourceField]`

### How `onChange` currently flows (bug source)

- `FormRenderer` renders `FieldRenderer` like:
  - `onChange={(value) => handleChange(fieldKey, value)}`
  - This binds `onChange` to the _current_ `fieldKey` at the callsite.
- Inside `FieldRenderer`, container fields recurse into children and pass the _same_ `onChange` down:
  - `FieldRenderer(field=container)` → `FieldRenderer(field=child, onChange={onChange})`

### Why this causes silent data corruption

- For nested fields under containers/columns/steps:
  - Child inputs call the parent-bound `onChange(value)`
  - The update writes into `values[parentFieldKey]` instead of `values[childFieldKey]`
- This manifests as:
  - Nested fields overwriting the container’s key
  - Missing payload keys for required nested fields
  - Backend `SaveAction` validation failing with "Field \"{childKey}\" is required" even though the user filled it out

### Primary impacted files

- Frontend renderer / state binding:
  - `resources/frontend/components/FormRenderer.jsx`
- Container recursion that forwards bound `onChange`:
  - `resources/frontend/components/FieldRenderer.jsx`
- Conversational renderer has similar risk if a container is treated as a “question”:
  - `resources/frontend/components/ConversationalFormRenderer.jsx`

## Task 6.1.7 — Manual Verification Checklist (To run after implementation)

- Single-level form (no containers)
- Group container with multiple inputs
- Column layout with inputs in each column
- Step-based form with nested fields
- Required nested fields submit correctly
- Backend validation passes for nested required fields

Notes while testing:

- Verify the network request payload includes only leaf input keys.
- Verify container keys do not appear as payload entries.
