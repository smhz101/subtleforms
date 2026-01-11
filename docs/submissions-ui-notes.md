# SubtleForms Phase 6.4 - Submissions UX & Step Styling - Inventory

## 0) QUICK INVENTORY

### Current Files Involved

#### Frontend Steps UI

- `resources/frontend/components/StepNavigation.jsx` - Multi-step navigation component
- `resources/frontend/components/FormRenderer.jsx` - Main form rendering component
- `resources/frontend/frontend.css` - Frontend CSS with existing step styles

#### Block Preview / Editor

- Block uses FormRenderer in preview mode (same rendering path)
- Editor styles loaded via `enqueue_block_editor_assets`
- Preview container has `.subtleforms-block-preview` wrapper class

#### Admin Submissions UI

- `resources/admin/pages/SubmissionsPage.jsx` - Submissions list page
- `resources/admin/pages/SubmissionDetailPage.jsx` - Single submission view
- `resources/admin/components/SubmissionsTable.jsx` - Reusable table component
- `resources/admin/components/DataTable.jsx` - Generic table component

#### REST Endpoints

- `GET /wp-json/subtleforms/v1/submissions` - All submissions with filtering
- `GET /wp-json/subtleforms/v1/submissions/{id}` - Single submission (auto-marks as read)
- `PUT /wp-json/subtleforms/v1/submissions/{id}` - Update submission status
- `GET /wp-json/subtleforms/v1/submissions/{id}/adjacent` - Navigation
- `GET /wp-json/subtleforms/v1/submissions/{id}/logs` - Execution logs

### Current Submission Data Shape

**Database Table: `wp_subtleforms_submissions`**

```sql
id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
form_id bigint(20) unsigned NOT NULL,
schema_version int unsigned DEFAULT NULL,
payload longtext NOT NULL,          -- JSON: user's form data
meta longtext,                      -- JSON: system metadata
status varchar(20) NOT NULL DEFAULT 'pending',  -- 'unread'|'read'|'processing'|'completed'
ip_address varchar(45),
user_agent varchar(255),
created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
```

**API Response Shape:**

```json
{
  "id": 123,
  "form_id": 5,
  "form_title": "Contact Form",          -- Enhanced by API
  "schema_version": 1,
  "payload": {"name": "John", "email": "john@example.com"},
  "meta": {"source_url": "...", "user_id": null},
  "status": "unread",                    -- Used for read/unread logic
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2026-01-01 12:00:00",
  "schema": {...}                        -- Form schema for field labels (detail view only)
}
```

### Current Read/Unread Implementation

✅ **Already Implemented:**

- `status` field with 'unread'/'read' values
- Auto-mark as read when viewing single submission
- Unread count in admin menu badge
- Visual highlighting for unread rows
- REST endpoints for status updates

❌ **Missing Features:**

- No `read_at` timestamp field
- No `read_by` user tracking
- No real-time updates/polling
- No unread count endpoint (using generic count)

### Implementation Status

**Step Styling:**

- ✅ Frontend StepNavigation.jsx has modern styles
- ✅ CSS classes: `.sf-step-navigation`, `.sf-step-item`, etc.
- ❓ Block editor preview styling needs verification

**Admin Submissions UX:**

- ✅ Basic submission detail page with cards
- ✅ Field label resolution from schema
- ✅ Status badges and highlighting
- ✅ Admin menu badge with unread count
- ❓ "Show technical fields" toggle not implemented
- ❓ Real-time updates not implemented

**Missing Fields/Flags to Add:**

- `read_at DATETIME NULL` - Timestamp when marked as read
- `read_by BIGINT NULL` - User ID who marked as read
- Unread count API endpoint: `GET /submissions/unread-count`
- Live updates polling system

### Next Steps Priority

1. ✅ Step styling consistency (frontend + block)
2. ✅ Enhanced submission detail UI with technical toggle
3. ✅ Live updates with polling
4. ✅ Real-time badge updates
5. ❓ Enhanced field persistence (read_at, read_by)
