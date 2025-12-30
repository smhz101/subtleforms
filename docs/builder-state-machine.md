# Builder State Machine (FSM)

**Version:** 1.0  
**Last Updated:** 2025-12-29  
**Purpose:** Single source of truth for SubtleForms Builder state management, UI behavior, and backend expectations.

---

## 1. Canonical Builder States

### INIT

**Description:** Builder is initializing, loading form data from backend.

**Characteristics:**

- Loading spinner visible
- No user interaction allowed
- Fetching form metadata and schema

---

### EMPTY_DRAFT

**Description:** A new draft form exists with no schema defined yet.

**Characteristics:**

- Form row exists in database with `status = 'draft'`
- No schema saved yet (draft or versioned)
- First-time builder open for new form
- User has not made any edits

---

### EDITING

**Description:** User is actively editing the form schema.

**Characteristics:**

- Schema is loaded in UI (tree representation)
- User can add/remove/reorder fields
- No pending save operation
- Form is NOT marked dirty yet (pre-edit state)

---

### DIRTY

**Description:** User has made unsaved changes to the schema.

**Characteristics:**

- `isDirty = true`
- Changes exist in memory only
- Autosave timer is running (will trigger soon)
- Backend does not reflect these changes yet

---

### AUTOSAVING

**Description:** System is automatically persisting draft changes to backend.

**Characteristics:**

- Network request in progress (POST/PUT)
- Spinner or "Saving..." indicator visible
- User can continue editing (optimistic UI)
- Changes are being saved to **draft schema only** (no versioning)

---

### SAVED

**Description:** All changes have been persisted to backend draft schema.

**Characteristics:**

- `isDirty = false`
- Backend draft schema matches UI state
- "Saved" indicator visible briefly
- No version created (still draft)

---

### PREVIEWING

**Description:** User is viewing live preview of current draft schema.

**Characteristics:**

- Preview modal open
- Schema rendered using public form renderer
- Backend serves draft schema for preview
- Edits blocked while preview open

---

### PUBLISHING

**Description:** User initiated publish action, backend is validating and creating version.

**Characteristics:**

- Network request in progress
- Validation running (SchemaValidator)
- Schema version being created
- Form status transitioning from `draft` → `published`

---

### PUBLISHED

**Description:** Form has at least one active schema version and is publicly accessible.

**Characteristics:**

- Form row has `status = 'published'`
- Active schema version exists
- Form renders on frontend
- Draft edits still possible (become new draft on top of published version)

---

### ERROR

**Description:** A critical operation failed (save, autosave, publish, validation).

**Characteristics:**

- Error message displayed
- Previous state preserved (e.g., DIRTY if autosave failed)
- User can retry or discard changes
- Specific error context provided (network, validation, permissions)

---

## 2. Allowed State Transitions

```
INIT → EMPTY_DRAFT          (New form created)
INIT → EDITING              (Existing draft loaded)
INIT → PUBLISHED            (Existing published form loaded)
INIT → ERROR                (Load failed)

EMPTY_DRAFT → DIRTY         (First edit made)
EMPTY_DRAFT → CLOSED        (Builder closed without edits → DELETE FORM)

EDITING → DIRTY             (Schema change detected)
EDITING → PREVIEWING        (Preview opened)
EDITING → CLOSED            (Exit without changes)

DIRTY → AUTOSAVING          (Autosave timer fired)
DIRTY → PUBLISHING          (User clicks Publish)
DIRTY → PREVIEWING          (User clicks Preview - saves first)
DIRTY → CLOSED              (Navigation guard → prompt user)

AUTOSAVING → SAVED          (Autosave succeeded)
AUTOSAVING → ERROR          (Autosave failed)
AUTOSAVING → DIRTY          (User edited during autosave)

SAVED → DIRTY               (New edit after save)
SAVED → EDITING             (Idle state)
SAVED → PREVIEWING          (Preview opened)
SAVED → PUBLISHING          (Publish initiated)
SAVED → CLOSED              (Exit safely)

PREVIEWING → EDITING        (Preview closed)
PREVIEWING → DIRTY          (Preview closed, edits made)

PUBLISHING → PUBLISHED      (Publish succeeded)
PUBLISHING → ERROR          (Validation or save failed)

PUBLISHED → EDITING         (User opens builder for edits)
PUBLISHED → DIRTY           (User edits published form)
PUBLISHED → PREVIEWING      (Preview current published version)
PUBLISHED → CLOSED          (Exit builder)

ERROR → EDITING             (User dismisses error, retains state)
ERROR → DIRTY               (Retry from dirty state)
ERROR → CLOSED              (User gives up, exit)
```

---

## 3. Illegal Transitions

### ❌ EMPTY_DRAFT → PUBLISHED

**Why:** Cannot publish without schema. Must pass through DIRTY → SAVED → PUBLISHING first.

### ❌ AUTOSAVING → PREVIEWING

**Why:** Preview requires stable saved state. Must wait for AUTOSAVING → SAVED first.

### ❌ AUTOSAVING → PUBLISHING

**Why:** Cannot publish while autosave in progress. Must wait for SAVED first.

### ❌ DIRTY → EDITING

**Why:** Cannot lose dirty flag without save/autosave. Must pass through AUTOSAVING → SAVED.

### ❌ INIT → PUBLISHED (without form row)

**Why:** Cannot mark as published if form doesn't exist in database.

### ❌ PUBLISHING → EDITING (without SUCCESS)

**Why:** If publish fails, must go to ERROR state, not back to EDITING directly.

### ❌ SAVED → AUTOSAVING

**Why:** No autosave needed if not dirty. Must transition SAVED → DIRTY first.

---

## 4. UI Expectations Per State

| State           | Header Label       | Save Button | Publish Button | Preview Button | Close Behavior      | Modals Allowed |
| --------------- | ------------------ | ----------- | -------------- | -------------- | ------------------- | -------------- |
| **INIT**        | "Loading..."       | Disabled    | Disabled       | Disabled       | Blocked             | None           |
| **EMPTY_DRAFT** | "New Form"         | Disabled    | Disabled       | Disabled       | Exit (deletes form) | None           |
| **EDITING**     | Form Title         | Disabled    | Enabled        | Enabled        | Exit safely         | All            |
| **DIRTY**       | "Unsaved Changes"  | Enabled     | Enabled        | Enabled        | Prompt user         | All            |
| **AUTOSAVING**  | "Saving..."        | Disabled    | Disabled       | Disabled       | Prompt user         | None           |
| **SAVED**       | "Saved" (briefly)  | Disabled    | Enabled        | Enabled        | Exit safely         | All            |
| **PREVIEWING**  | "Preview Mode"     | Disabled    | Disabled       | N/A (open)     | Close preview       | Preview only   |
| **PUBLISHING**  | "Publishing..."    | Disabled    | Disabled       | Disabled       | Blocked             | None           |
| **PUBLISHED**   | "Published"        | Disabled    | Enabled        | Enabled        | Exit safely         | All            |
| **ERROR**       | "Error: [message]" | Retry       | Retry          | Disabled       | Prompt user         | Error modal    |

---

## 5. Backend Expectations Per State

| State           | Form Row Exists             | Draft Schema Exists   | Active Schema Version                    | Frontend Rendering                          |
| --------------- | --------------------------- | --------------------- | ---------------------------------------- | ------------------------------------------- |
| **INIT**        | Unknown                     | Unknown               | Unknown                                  | N/A                                         |
| **EMPTY_DRAFT** | ✅ Yes (`status=draft`)     | ❌ No                 | ❌ No                                    | ❌ Blocked                                  |
| **EDITING**     | ✅ Yes                      | ✅ Yes (may be stale) | ❌ No (if draft) / ✅ Yes (if published) | ❌ Blocked (draft) / ✅ Allowed (published) |
| **DIRTY**       | ✅ Yes                      | ✅ Yes (stale)        | Same as above                            | Same as above                               |
| **AUTOSAVING**  | ✅ Yes                      | ⏳ Updating           | ❌ No (draft mode)                       | ❌ Blocked                                  |
| **SAVED**       | ✅ Yes                      | ✅ Yes (synced)       | ❌ No (draft mode)                       | ❌ Blocked                                  |
| **PREVIEWING**  | ✅ Yes                      | ✅ Yes                | ❌ No (preview uses draft)               | 🔒 Preview only                             |
| **PUBLISHING**  | ✅ Yes                      | ✅ Yes                | ⏳ Creating version                      | ⏳ Pending                                  |
| **PUBLISHED**   | ✅ Yes (`status=published`) | ✅ Yes                | ✅ Yes (active)                          | ✅ Allowed                                  |
| **ERROR**       | ✅ Yes                      | ❓ Depends on failure | ❓ Depends on failure                    | ❌ Blocked                                  |

### Critical Backend Rules:

1. **Draft Schema** = transient workspace, never versioned, never rendered publicly
2. **Active Schema Version** = immutable, versioned, publicly accessible
3. **Autosave** MUST set `activate: false` (never creates versions)
4. **Publish** MUST create new version + activate it
5. **Form Status** (`draft`/`published`) controls frontend visibility

---

## 6. Mapping Current Problems to FSM Violations

### Problem 1: Ghost Forms

**Current Behavior:**  
Ephemeral mode allows builder to open without creating form row. If user closes without saving, no form exists. If user makes one edit and autosave fires, form appears in "All Forms" unexpectedly.

**FSM Violation:**  
`INIT → EDITING` without passing through `EMPTY_DRAFT` (form row creation).

**Solution:**  
Always transition `INIT → EMPTY_DRAFT` (create draft immediately). Closing from `EMPTY_DRAFT` without edits → DELETE form row.

---

### Problem 2: Autosave Creates Versions

**Current Behavior:**  
Every autosave calls `saveSchemaVersion()` with `activate: true` by default, incrementing version count.

**FSM Violation:**  
`AUTOSAVING` state incorrectly triggers versioning logic (should only update draft).

**Solution:**  
Autosave must pass `activate: false`. Publishing is the ONLY action that creates versions.

---

### Problem 3: Published Forms Can Be Edited Without Clear Draft

**Current Behavior:**  
User opens published form, edits schema, autosave overwrites active schema draft without clear indication.

**FSM Violation:**  
Transition `PUBLISHED → DIRTY` is allowed but backend doesn't clearly separate draft edits from active version.

**Solution:**  
Enforce draft/active separation. Published forms have immutable active version + mutable draft layer.

---

### Problem 4: No Navigation Guard

**Current Behavior:**  
User can close browser tab in `DIRTY` state and lose all unsaved work.

**FSM Violation:**  
`DIRTY → CLOSED` transition allowed without user confirmation.

**Solution:**  
Add `beforeunload` listener in `DIRTY`, `AUTOSAVING`, `PUBLISHING` states. Prompt: Save / Discard / Cancel.

---

### Problem 5: Mixed Autosave + Publish Logic

**Current Behavior:**  
`performSave({ auto, targetStatus })` function handles both autosave and publishing with complex branching.

**FSM Violation:**  
Single function violates single responsibility. State transitions unclear.

**Solution:**  
Separate:

- `autosaveDraft()` → `DIRTY → AUTOSAVING → SAVED`
- `publishForm()` → `SAVED → PUBLISHING → PUBLISHED`

---

### Problem 6: Status Dropdown in EMPTY_DRAFT

**Current Behavior:**  
Status dropdown shows "Draft" / "Published" even when no schema exists.

**FSM Violation:**  
UI allows `EMPTY_DRAFT → PUBLISHED` transition (should be illegal).

**Solution:**  
Disable/hide status dropdown in `EMPTY_DRAFT`. Only show after first schema save.

---

### Problem 7: Ephemeral Mode Complexity

**Current Behavior:**  
`isEphemeral` + `hasUserMutation` flags create implicit state machine that conflicts with FSM.

**FSM Violation:**  
Parallel state system causes race conditions and unpredictable behavior.

**Solution:**  
Remove ephemeral mode entirely. Use FSM states: `INIT → EMPTY_DRAFT → DIRTY → ...`

---

## 7. Implementation Strategy

### Phase 1: State Consolidation

- Replace 22+ `useState` hooks with single `useReducer`
- Reducer enforces FSM transitions
- Actions: `EDIT_SCHEMA`, `START_AUTOSAVE`, `AUTOSAVE_SUCCESS`, `START_PUBLISH`, etc.

### Phase 2: Remove Ephemeral Mode

- Delete `isEphemeral`, `hasUserMutation` logic
- Always create form row on builder open
- Add cleanup logic: `EMPTY_DRAFT → CLOSED` deletes form

### Phase 3: Separate Autosave + Versioning

- Backend: Add `POST /forms/{id}/draft-schema` endpoint (no versioning)
- Backend: Enforce `activate: false` on autosave route
- Frontend: Call draft endpoint for autosave, version endpoint for publish

### Phase 4: Navigation Guards

- Add `beforeunload` listener based on FSM state
- Add "Save & Close" button (explicit transition)
- Reduce autosave delay to 500ms

### Phase 5: UI Sync

- Map FSM state → header label
- Enable/disable buttons based on FSM
- Block illegal transitions at UI layer

---

## 8. Success Metrics

- [ ] Zero ghost forms possible
- [ ] Autosave never increments version count
- [ ] Publishing always validates before version creation
- [ ] User cannot lose work through navigation
- [ ] Draft forms never render on frontend
- [ ] Published forms always have active schema
- [ ] State transitions are deterministic and auditable
- [ ] Reduced builder-related bugs by 80%

---

## 9. Testing Requirements

Each state transition must have:

1. Unit test (reducer logic)
2. Integration test (API calls)
3. E2E test (user flow)

Example test cases:

- `INIT → EMPTY_DRAFT → CLOSED` → form deleted
- `DIRTY → AUTOSAVING → SAVED` → draft updated, no version created
- `SAVED → PUBLISHING → PUBLISHED` → version created, form status updated
- `DIRTY → CLOSED` → navigation blocked, prompt shown

---

## 10. Migration Path

### For Existing Forms in Database:

- Forms with `status='draft'` but no schema → keep as `EMPTY_DRAFT`
- Forms with `status='draft'` + schema → mark draft schema clearly
- Forms with `status='published'` → ensure active version exists (migration check)

### For In-Progress Builders:

- On plugin update, force reload of builder page
- Warn users to save work before updating

---

## Appendix A: State Transition Diagram

```
                                    ┌──────────────┐
                                    │     INIT     │
                                    └──────┬───────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
            ┌───────────────┐      ┌─────────────┐      ┌─────────────┐
            │  EMPTY_DRAFT  │      │   EDITING   │      │  PUBLISHED  │
            └───────┬───────┘      └──────┬──────┘      └──────┬──────┘
                    │                     │                     │
                    │ (first edit)        │ (edit)              │ (edit)
                    └─────────┬───────────┼─────────────────────┘
                              │           │
                              ▼           ▼
                        ┌─────────────────────┐
                        │       DIRTY         │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              (timer)        (preview)       (publish)
                    │              │              │
                    ▼              ▼              ▼
            ┌─────────────┐  ┌───────────┐  ┌────────────┐
            │ AUTOSAVING  │  │ PREVIEWING│  │ PUBLISHING │
            └──────┬──────┘  └─────┬─────┘  └─────┬──────┘
                   │                │              │
              (success)        (close)        (success)
                   │                │              │
                   ▼                │              ▼
            ┌─────────────┐         │       ┌─────────────┐
            │    SAVED    │◄────────┘       │  PUBLISHED  │
            └─────────────┘                 └─────────────┘
                   │
              (new edit)
                   │
                   ▼
            ┌─────────────┐
            │    DIRTY    │
            └─────────────┘

                   (errors at any stage)
                           │
                           ▼
                    ┌─────────────┐
                    │    ERROR    │
                    └─────────────┘
```

---

## Appendix B: API Contract Per State

### AUTOSAVING → Backend

```
POST /wp-json/subtleforms/v1/forms/{id}/schema
{
  "schema": {...},
  "activate": false  // CRITICAL: never version on autosave
}
```

### PUBLISHING → Backend

```
POST /wp-json/subtleforms/v1/forms/{id}/schema
{
  "schema": {...},
  "activate": true  // Create version + activate
}

PUT /wp-json/subtleforms/v1/forms/{id}
{
  "status": "published"
}
```

### PREVIEWING → Backend

```
GET /wp-json/subtleforms/v1/forms/{id}/schema?version=draft
// Returns draft schema for preview render
```

---

**End of FSM Document**
