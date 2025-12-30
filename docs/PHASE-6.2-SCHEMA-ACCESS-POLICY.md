# Phase 6.2 — Draft Schema Access Policy

## Schema Visibility Rules (Server-Side Enforcement)

### 1. Public Access (Unauthenticated / Frontend Rendering)

**Allowed:**

- Active schema versions ONLY
- Published forms ONLY
- Never draft schema

**Rules:**

- `is_user_logged_in() === false`
- `form['status'] === 'published'`
- Active schema must exist
- Draft schema is NEVER returned

**Returns:**

- 404 if form is draft
- 404 if form is unpublished
- 404 if no active schema exists
- Active schema otherwise

---

### 2. Authenticated Access (Admin / Editor Context)

**Allowed:**

- Draft schema when `context=builder`
- Active schema
- Works for draft AND published forms

**Rules:**

- `is_user_logged_in() === true`
- `current_user_can('edit_posts')`
- Requires explicit `context=builder` query param for draft access

**Returns:**

- Draft schema when `context=builder` is present
- Active schema otherwise
- Falls back gracefully if requested schema type doesn't exist

---

### 3. Builder / Preview Context

**Purpose:**

- Hydrate form builder with draft schema
- Preview unpublished forms in admin

**Rules:**

- MUST be authenticated
- MUST include `?context=builder` query parameter
- Draft schema takes precedence over active

**Security:**

- Context flag is ignored for unauthenticated requests
- Public renderer NEVER includes this flag

---

## Implementation Checklist

- [x] Policy documented (this file)
- [ ] `RestController::get_form_schema()` enforces policy
- [ ] Builder hydration requests include `context=builder`
- [ ] Preview requests include `context=builder`
- [ ] Public frontend renderer does NOT include context flag
- [ ] Error messages are non-revealing
- [ ] All scenarios manually tested

---

## Test Matrix

| Scenario                    | Expected Result                     |
| --------------------------- | ----------------------------------- |
| Public + published form     | Active schema returned              |
| Public + draft form         | 404 "Form not available"            |
| Public + unpublished form   | 404 "Form not available"            |
| Public + `?context=builder` | Ignored (no draft access)           |
| Admin + `?context=builder`  | Draft schema if exists              |
| Admin + no context          | Active schema only                  |
| Admin + published + context | Draft schema if exists, else active |

---

## Migration Notes

**Before Phase 6.2:**

- Draft schemas were publicly accessible
- No authentication check on draft access
- Shortcode blocked rendering but REST did not

**After Phase 6.2:**

- Draft schemas require authentication + explicit flag
- Public requests get 404 for unpublished forms
- Builder + preview explicitly request draft context
- Zero information leakage through errors
