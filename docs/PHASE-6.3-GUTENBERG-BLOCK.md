# Phase 6.3 — Gutenberg Block Compatibility

## Overview

SubtleForms provides a native Gutenberg block (`subtleforms/form`) for embedding published forms in WordPress posts and pages.

## Block Specification

### Block Identity

- **Name**: `subtleforms/form`
- **Namespace**: `subtleforms`
- **Category**: `widgets`
- **Title**: "SubtleForms"
- **Icon**: Form/feedback icon

### Attributes

```js
{
  formId: {
    type: 'number',
    default: 0
  },
  align: {
    type: 'string'
  },
  className: {
    type: 'string'
  }
}
```

### Block Behavior

#### In Editor (Edit Mode)

1. Shows **inspector control** with dropdown of published forms
2. Renders **live preview** of selected form using existing frontend renderer
3. Preview is **read-only** (no submissions possible)
4. Fetches form schema via REST (published forms only)
5. Shows safe fallback if form is unpublished/deleted

#### On Frontend (Save Output)

1. Outputs **minimal placeholder markup**:
   ```html
   <div class="subtleforms-block" data-form-id="123"></div>
   ```
2. Frontend JS bootstraps same renderer as shortcode
3. No schema stored in post content (dynamic rendering only)

## Security Constraints

### Published Forms Only

- Block inspector **only shows published forms**
- Draft/archived forms are never accessible via block
- Respects Phase 6.2 REST security rules

### Safe Degradation

- If form becomes unpublished: shows warning in editor, renders nothing on frontend
- If form is deleted: block shows safe fallback message
- No error states exposed to public users

## Implementation Architecture

### File Structure

```
resources/
  blocks/
    form/
      index.js          # Block registration
      edit.jsx          # Editor component
      save.js           # Save function
      block.json        # Block metadata

src/
  Blocks/
    SubtleFormsBlock.php  # Server-side registration
```

### Asset Loading Strategy

- **Editor bundle**: Enqueued only in block editor context
- **Frontend bundle**: Reuses existing `frontend.js` bundle
- **No global enqueue**: Assets load only when block is present on page

### Rendering Flow

#### Editor Preview

```
Block Edit Component
  ↓
Fetch published forms (REST: ?context=view)
  ↓
Mount frontend renderer with formId + preview=true
  ↓
Renderer displays form (no submission handlers)
```

#### Frontend Rendering

```
Block save() outputs: <div data-form-id="123">
  ↓
Frontend JS scans for .subtleforms-block elements
  ↓
Mounts renderer for each (same as shortcode)
  ↓
Form fully interactive
```

## Backward Compatibility

### No Breaking Changes

- Existing shortcodes continue working exactly as before
- REST API behavior unchanged
- Frontend renderer unchanged
- No duplicate mounts if block + shortcode coexist

### Mixed Embed Support

- Multiple blocks on same page: ✅
- Block + shortcode on same page: ✅
- Shortcode inside block content: ✅

## Testing Checklist

- [ ] Block appears in inserter
- [ ] Inspector shows published forms only
- [ ] Draft forms not accessible
- [ ] Editor preview renders correctly
- [ ] Frontend matches editor preview
- [ ] Unpublished form shows fallback
- [ ] Deleted form fails safely
- [ ] Multiple blocks render correctly
- [ ] Block + shortcode coexist without conflicts
- [ ] No console errors
- [ ] Assets load only when needed
- [ ] Builds successfully

## Version History

- **v1.5.0** - Added Gutenberg block support (Phase 6.3)
