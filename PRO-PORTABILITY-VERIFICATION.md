# Pro Feature Portability & Schema Integrity - Verification Guide

**Commit**: `d39803f`  
**Date**: 2026-01-23  
**Implementation**: Pro feature portability across duplication, import/export, and template cloning

---

## 🎯 Implementation Overview

### What Was Built

**Objective**: Ensure Pro feature metadata survives all form operations (duplication, import/export, template cloning) to maintain read-only behavior and data integrity.

**Components Added**:
1. **schemaEnricher.js** (NEW - 114 lines)
   - `enrichSchemaWithProMarkers(schema)` - Adds `uses_pro` and `pro_features` metadata
   - `schemaHasProMarkers(schema)` - Validates presence of Pro markers
   - `validateProMarkers(schema)` - Debug utility for marker accuracy

**Integration Points**:
2. **BuilderPage.jsx** (Modified)
   - Enrich schema before save/autosave
   - Enrich schema when creating from wizard

3. **FormsList.jsx** (Modified)
   - Enrich schema during form duplication

4. **CreateFormModal.jsx** (Modified)
   - Enrich schema when applying templates

---

## 📋 Schema Metadata Structure

### Pro Markers Added

```javascript
{
  "schema_version": 1,
  "metadata": {
    "name": "form_schema",
    "title": "Advanced Contact Form",
    "type": "regular",
    "template": "advanced-contact",
    
    // NEW Pro Markers (added automatically)
    "uses_pro": true,
    "pro_features": [
      "Pro Template (advanced-contact)"
    ]
  },
  "fields": [...]
}
```

### Marker Rules

- **uses_pro**: Boolean indicating if form uses any Pro features
- **pro_features**: Array of human-readable feature names
- **Derived from**: Template ID and field types (file_upload, signature)
- **Applied when**: Schema is saved, duplicated, imported, or template applied
- **Backward compatible**: Older schemas without markers still work

---

## ✅ Verification Checklist

### Test Scenario 1: Save/Autosave Enrichment

**Setup**:
1. Activate VALID-PRO-KEY license
2. Create new form using Pro template (e.g., "Advanced Contact")
3. Add some fields
4. Save form

**Expected Behavior**:
- [ ] Save successful
- [ ] Open browser DevTools → Network tab
- [ ] Find POST request to `/forms/{id}/schema`
- [ ] Inspect request payload → `schema.metadata` should include:
  ```json
  {
    "uses_pro": true,
    "pro_features": ["Pro Template (advanced-contact)"]
  }
  ```

**Validation**:
- [ ] Schema stored with Pro markers
- [ ] No console errors
- [ ] Form opens normally after save

---

### Test Scenario 2: Form Duplication

**Setup**:
1. With active Pro license, create Pro form
2. Save form
3. Go to Forms list
4. Click "⋮" menu → "Duplicate"

**Expected Behavior**:
- [ ] Duplicated form created with "(Copy)" suffix
- [ ] Open duplicated form in builder
- [ ] Deactivate Pro license
- [ ] Reopen duplicated form

**Validation**:
- [ ] ProDowngradeBanner appears (Pro markers preserved)
- [ ] Form enters read-only mode
- [ ] Field library hidden
- [ ] Canvas dimmed and non-interactive
- [ ] Inspector shows "Read-only mode" notice

**Critical Check**: Pro markers must survive duplication

---

### Test Scenario 3: Template Application

**Setup**:
1. With active Pro license
2. Forms → Create New
3. Select Pro template
4. Save form

**Expected Behavior**:
- [ ] Form created successfully
- [ ] Schema enriched with Pro markers on first save
- [ ] Check DevTools Network → POST `/forms/{id}/schema`
- [ ] Verify `uses_pro: true` in request payload

**Validation**:
- [ ] Template application enriches schema
- [ ] No breaking changes to form structure
- [ ] Fields render correctly

---

### Test Scenario 4: Wizard Creation

**Setup**:
1. With active Pro license
2. Navigate to Forms → Create New (wizard flow)
3. Select Pro template in wizard
4. Complete wizard

**Expected Behavior**:
- [ ] Form created with Pro template
- [ ] Open form → verify fields present
- [ ] Save form
- [ ] Check Network tab for enrichment

**Validation**:
- [ ] Wizard creates enriched schemas
- [ ] Pro markers applied on creation
- [ ] Bootstrap schema includes markers

---

### Test Scenario 5: Import/Export Integrity (Manual Simulation)

**Setup**:
1. Create Pro form with active license
2. Save form
3. Export schema via API:
   ```bash
   curl -X GET "https://yoursite.local/wp-json/subtleforms/v1/forms/{id}/schema" \
     -H "X-WP-Nonce: {nonce}"
   ```
4. Save response to `exported-schema.json`
5. Verify JSON contains:
   ```json
   {
     "metadata": {
       "uses_pro": true,
       "pro_features": [...]
     }
   }
   ```

**Expected Behavior**:
- [ ] Exported schema includes Pro markers
- [ ] Markers match actual Pro features used
- [ ] JSON is valid and complete

**Validation**:
- [ ] Import schema to new form (via Postman or API)
- [ ] Deactivate Pro license
- [ ] Open imported form
- [ ] ProDowngradeBanner appears (markers detected)
- [ ] Read-only mode enforced

---

### Test Scenario 6: Cross-Operation Verification

**Complete Flow**:
1. Create Pro form (Template: "Payment Form")
2. Add signature field (Pro field)
3. Save → verify enrichment
4. Duplicate form → verify markers copied
5. Deactivate license
6. Open original → read-only enforced
7. Open duplicate → read-only enforced

**Expected Behavior**:
- [ ] Both forms have `uses_pro: true`
- [ ] Both forms have `pro_features: ["Pro Template", "Pro Fields (signature)"]`
- [ ] Both forms enter read-only mode
- [ ] Both banners show same Pro features list

**Critical Validation**:
- [ ] No feature stripping
- [ ] No data loss
- [ ] No crashes or errors
- [ ] Frontend forms still work

---

### Test Scenario 7: Backward Compatibility

**Setup**:
1. Manually create form schema WITHOUT Pro markers (simulate old form)
2. Use API to save schema:
   ```json
   {
     "schema_version": 1,
     "metadata": {
       "name": "form_schema",
       "title": "Legacy Pro Form",
       "template": "advanced-contact"
     },
     "fields": [...]
   }
   ```
3. Open form in builder

**Expected Behavior**:
- [ ] Form loads successfully
- [ ] Detection logic runs (`formUsesProFeatures()`)
- [ ] Pro features detected from template ID
- [ ] On next save, markers added automatically

**Validation**:
- [ ] Older schemas still work
- [ ] Enrichment happens on save
- [ ] No breaking changes
- [ ] No forced migration

---

## 🔍 Technical Details

### Enrichment Algorithm

```javascript
// Detection
const usesProFeatures = formUsesProFeatures(schema);
// Checks: template ID in PRO_TEMPLATE_IDS OR fields contain PRO_FIELD_TYPES

// Feature extraction
const proFeaturesUsed = getProFeaturesUsed(schema);
// Returns: ["Pro Template (id)", "Pro Fields (type1, type2)"]

// Enrichment
const enrichedSchema = {
  ...schema,
  metadata: {
    ...schema.metadata,
    uses_pro: usesProFeatures,
    pro_features: proFeaturesUsed,
  },
};
```

### Enrichment Points

| Operation | File | Function | Line |
|-----------|------|----------|------|
| Save/Autosave | BuilderPage.jsx | `performSave()` | ~212 |
| Duplication | FormsList.jsx | `handleDuplicate()` | ~487 |
| Template Application | CreateFormModal.jsx | `handleCreate()` | ~132 |
| Wizard Creation | BuilderPage.jsx | `createDraftFormWithSchema()` | ~1031 |

### Data Flow

```
┌─────────────────────┐
│  User Action        │
│  (Save/Duplicate)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  enrichSchemaWith   │
│  ProMarkers()       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  formUsesProFeatures│
│  (detection logic)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Add metadata:      │
│  - uses_pro         │
│  - pro_features     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  POST to backend    │
│  (save enriched)    │
└─────────────────────┘
```

---

## 🛡️ Safety Guarantees

### Non-Destructive Rules

✅ **DO**:
- Add metadata properties only
- Use existing detection logic
- Preserve all field definitions
- Support older schemas without markers
- Log warnings for marker mismatches

❌ **DO NOT**:
- Modify field definitions
- Strip Pro fields
- Auto-downgrade forms
- Force data migrations
- Break frontend rendering

### Edge Cases Handled

1. **Null/Missing Schema**: Returns input unchanged
2. **No Metadata Object**: Creates metadata with markers
3. **Legacy Schemas**: Detection runs on-demand, enrichment on next save
4. **Marker Mismatch**: Validation logs warning (non-blocking)
5. **Import Without Markers**: Detection triggers, markers added on save

---

## 🔧 Debugging Tools

### Browser Console Commands

```javascript
// Check if schema has Pro markers
const schema = window.yourSchemaObject;
console.log('Has markers:', schema.metadata?.uses_pro);
console.log('Features:', schema.metadata?.pro_features);

// Validate markers (requires schemaEnricher import in console)
// Note: Use DevTools Sources tab to add breakpoint in validateProMarkers()
```

### Network Tab Inspection

1. Open DevTools → Network tab
2. Filter: `schema`
3. Find POST request to `/forms/{id}/schema`
4. Click request → Payload tab
5. Expand `schema.metadata`
6. Verify `uses_pro` and `pro_features` present

### Backend Verification

```bash
# Query WordPress database
wp db query "SELECT post_content FROM wp_posts WHERE post_type='subtleform' AND ID={form_id}"

# Look for JSON with uses_pro marker
```

---

## 📊 Success Criteria

### Must Pass

- [x] Build successful (no errors)
- [x] All enrichment points integrated
- [ ] Save enriches schema ✅
- [ ] Duplicate preserves markers ✅
- [ ] Template application enriches ✅
- [ ] Wizard creation enriches ✅
- [ ] Import triggers detection ✅
- [ ] Read-only mode enforced after duplicate/import ✅
- [ ] No console errors
- [ ] No data loss
- [ ] Frontend forms still work
- [ ] Submissions still save

### Performance Check

- Bundle size increase: ~4 KiB (schemaEnricher.js)
- No runtime performance impact (enrichment at save time only)
- Detection logic reused (no new detection overhead)

---

## 🚀 Manual Testing Protocol

### Phase 1: Basic Enrichment (30 min)

1. Test save enrichment (Scenario 1) - 10 min
2. Test duplication (Scenario 2) - 10 min
3. Test template application (Scenario 3) - 10 min

### Phase 2: Advanced Flows (30 min)

4. Test wizard creation (Scenario 4) - 10 min
5. Test cross-operation (Scenario 6) - 15 min
6. Test backward compatibility (Scenario 7) - 5 min

### Phase 3: Edge Cases (20 min)

7. Test with corrupted capabilities object
8. Test rapid duplicate operations
9. Test export/import integrity
10. Test Pro → Free → Pro license transitions

### Total Testing Time: ~80 minutes

---

## 📝 Known Limitations

1. **No Automatic Migration**: Older forms without markers will be enriched on next save (lazy enrichment)
2. **No Import UI**: Import/export verification requires API testing (no UI import feature yet)
3. **Marker Validation**: `validateProMarkers()` only logs warnings (non-blocking)

---

## 🔗 Related Documentation

- **Previous Task**: Pro Downgrade Safety (commit a0f307c)
- **Detection Logic**: `proFeatureDetector.js`
- **Banner Component**: `ProDowngradeBanner.jsx`
- **Read-Only Mode**: `FormEditor.jsx` + `BuilderProvider.jsx`

---

## ✅ Final Checklist

Before considering this task complete:

- [x] schemaEnricher.js created
- [x] Enrichment integrated at all save points
- [x] Build successful
- [x] Git commit created (d39803f)
- [ ] Manual testing completed (all scenarios)
- [ ] No console errors during testing
- [ ] Frontend forms verified working
- [ ] Submissions verified working
- [ ] Documentation complete ✅

---

## 🎉 Implementation Complete

**Status**: ✅ Code Complete - Ready for Manual Testing

**Next Steps**:
1. Follow testing protocol above
2. Verify all scenarios pass
3. Test frontend form rendering
4. Test submission flow
5. Cross-browser testing
6. Report any issues found

**Commit Message**:
```
feat(pro): preserve pro feature integrity across duplication and import

- Add schemaEnricher utility with Pro marker functions
- Enrich schemas with uses_pro and pro_features metadata
- Apply enrichment at all save points
- Ensure Pro features survive import/export
- Read-only behavior preserved after duplication
```

---

**Implementation Date**: 2026-01-23  
**Build Status**: ✅ SUCCESS (506 KiB bundle)  
**Git Commit**: d39803f
