# SubtleForms REST API Reference

Comprehensive reference for the `subtleforms/v1` REST namespace.

---

## Base URL

| Mode | Base URL |
|------|----------|
| Pretty permalinks | `https://your-site.com/wp-json/subtleforms/v1` |
| Plain permalinks (fallback) | `https://your-site.com/index.php?rest_route=/subtleforms/v1` |

> **Note:** Pretty permalinks must be enabled in **Settings → Permalinks** for the standard `/wp-json/` URL to work. The admin UI will display a warning if plain permalinks are detected.

---

## Authentication

All admin endpoints require a WordPress nonce header.

```
X-WP-Nonce: <nonce>
```

The nonce is available in JavaScript at `window.subtleformsAdmin.restNonce` (created with `wp_create_nonce('wp_rest')`).

The public `POST /submit` endpoint requires no authentication.

---

## Standard Response Envelope

All responses are wrapped in one of three shapes.

### Success (single resource)

```json
{
  "data": { ... }
}
```
HTTP 200. Single-resource `GET` responses also include an `ETag` header for optimistic locking.

### Success (collection / paginated)

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 47,
    "total_pages": 3
  }
}
```
HTTP 200.

### Error

```json
{
  "error": {
    "code": "not_found",
    "message": "Form not found.",
    "meta": { }
  }
}
```

#### Error codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `not_found` | 404 | Resource does not exist |
| `forbidden` | 403 | Authenticated but insufficient permissions |
| `unauthorized` | 401 | No valid authentication |
| `validation_error` | 422 | Request params failed validation |
| `version_conflict` | 409 | `If-Match` ETag mismatch (optimistic locking) |
| `rate_limit_exceeded` | 429 | Too many requests. Includes `Retry-After` header (seconds) |
| `server_error` | 500 | Unexpected server error |

---

## JavaScript Client Usage

The admin SPA uses `@wordpress/api-fetch` via `src/data/apiClient.js`, which:
- Automatically injects the WP nonce
- Unwraps `{ data, meta }` from every response
- Uses the registered root URL from `window.wpApiSettings.root`

```js
import { apiClient } from '../data/apiClient';

// GET with query params
const { data, meta } = await apiClient.get('/forms?page=1&per_page=20&order=asc');

// POST
const form = await apiClient.post('/forms', { title: 'Contact Us' });

// PUT
const updated = await apiClient.put(`/forms/${id}`, { title: 'New Title' });

// DELETE
await apiClient.delete(`/forms/${id}`);
```

For raw `fetch()` calls outside `apiClient`, use `buildApiUrl(path)` from `utils/api.js` to handle both permalink modes correctly.

---

## Endpoints

### Forms

#### `GET /forms`

List forms with pagination and filtering.

**Auth:** Admin

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `per_page` | integer | `20` | Results per page |
| `status` | string | — | Filter by status (`draft`, `published`, `archived`) |
| `search` | string | — | Full-text search in title |
| `orderby` | string | `created_at` | Sort field (`id`, `created_at`, `updated_at`, `title`, `status`) |
| `order` | string | `DESC` | Sort direction. Case-insensitive: `asc`/`ASC` or `desc`/`DESC` |

**Response:** Paginated collection of form objects.

---

#### `POST /forms`

Create a new form.

**Auth:** Admin

**Body (JSON):**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `title` | string | required | Form title |
| `status` | string | `draft` | Initial status |

**Response:** Created form object. HTTP 201.

---

#### `GET /forms/{id}`

Get a single form by ID.

**Auth:** Admin

**Response:** Form object. Includes `ETag` header.

---

#### `PUT /forms/{id}`

Update a form.

**Auth:** Admin

**Headers:** `If-Match: <etag>` (optional, for optimistic locking — returns 409 on conflict)

**Body (JSON):** Any writable form fields.

**Response:** Updated form object.

---

#### `DELETE /forms/{id}`

Delete a form.

**Auth:** Admin

**Response:** `{ "data": { "deleted": true } }` HTTP 200.

---

#### `GET /forms/{id}/schema`

Get the field schema for a form.

**Auth:** Admin (or public with limited scope)

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `context` | string | Pass `builder` to include draft/unpublished schema |
| `version` | integer | Return a specific historical schema version |

**Response:** Schema object.

---

#### `POST /forms/{id}/schema`

Save/replace the field schema for a form.

**Auth:** Admin

**Body (JSON):** Full schema object.

**Response:** Saved schema.

---

### Submissions

#### `GET /forms/{form_id}/submissions`

List submissions for a specific form.

**Auth:** Admin

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `per_page` | integer | `20` | Results per page |
| `offset` | integer | `0` | Offset (not page-based) |
| `orderby` | string | `created_at` | Sort field (`id`, `created_at`, `updated_at`, `status`) |
| `order` | string | `DESC` | Sort direction. Case-insensitive |

**Response:** Paginated collection of submission objects.

---

#### `GET /submissions`

List all submissions across all forms, with filtering.

**Auth:** Admin

**Query params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `per_page` | integer | `20` | Results per page |
| `form_id` | integer | — | Filter by form ID |
| `status` | string | — | Filter by status |
| `search` | string | — | Full-text search |
| `orderby` | string | `created_at` | Sort field (`id`, `created_at`, `updated_at`, `status`) |
| `order` | string | `DESC` | Sort direction. Case-insensitive |

**Response:** Paginated collection of submission objects with embedded `form_title`.

---

#### `GET /submissions/{id}`

Get a single submission by ID. Automatically marks it as read.

**Auth:** Admin

**Response:** Submission object. Includes `ETag` header.

---

#### `PUT /submissions/{id}`

Update a submission (e.g. change status, add notes).

**Auth:** Admin

**Headers:** `If-Match: <etag>` (optional)

**Body (JSON):** Writable submission fields.

**Response:** Updated submission object.

---

#### `GET /submissions/{id}/adjacent`

Get the IDs of the previous and next submission for keyboard navigation.

**Auth:** Admin

**Response:**

```json
{
  "data": {
    "prev_id": 41,
    "next_id": 43
  }
}
```

---

#### `GET /submissions/{id}/logs`

Get execution logs for a submission (webhook deliveries, email sends, etc.).

**Auth:** Admin

**Response:** Array of log entries.

---

#### `GET /submissions/unread-count`

Get the total count of unread submissions.

**Auth:** Admin

**Response:**

```json
{
  "data": {
    "count": 7
  }
}
```

---

#### `POST /submissions/export`

Export submissions as a CSV file.

**Auth:** Admin

**Body (JSON):**

| Field | Type | Description |
|-------|------|-------------|
| `form_id` | integer | (optional) Export only this form's submissions |
| `status` | string | (optional) Filter by status |

**Response:** CSV file download (`Content-Type: text/csv`).

---

### Settings

#### `GET /settings`

Get all plugin settings.

**Auth:** Admin

**Response:** Settings object with all configurable keys.

---

#### `PUT /settings`

Update plugin settings.

**Auth:** Admin

**Body (JSON):** Partial or full settings object. Only supplied keys are updated.

**Response:** Full updated settings object.

---

#### `POST /settings/reset`

Reset all plugin settings to their factory defaults.

**Auth:** Admin

**Response:** Default settings object.

---

### Fields & Templates

#### `GET /fields`

Get all registered field type definitions.

**Auth:** Admin

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `grouped` | boolean | If `true`, returns fields grouped by category |

**Response:** Array (or grouped object) of field definitions.

---

#### `GET /templates`

Get all available form templates.

**Auth:** Admin

**Response:** Array of form template objects.

---

### Dashboard

#### `GET /dashboard`

Get dashboard stats, recent forms, and recent submissions.

**Auth:** Admin

**Response:**

```json
{
  "data": {
    "stats": {
      "total_forms": 12,
      "total_submissions": 340,
      "unread_submissions": 7
    },
    "recent_forms": [ ... ],
    "recent_submissions": [ ... ]
  }
}
```

---

### Onboarding & UI State

These endpoints persist lightweight UI state (dismissed modals, completed tours).

#### `GET /onboarding/status`
#### `POST /onboarding/send-test-email`
#### `POST /onboarding/dismiss`

```json
// POST /onboarding/dismiss — no body required
// Response
{ "data": { "dismissed": true } }
```

#### `GET /create-wizard/status`
#### `POST /create-wizard/dismiss`

#### `GET /tour/status`
#### `POST /tour/complete`

All status endpoints return `{ "data": { "dismissed": bool } }` or `{ "data": { "completed": bool } }`.

---

### Public Submission

#### `POST /submit`

Submit a form. This is the only public, unauthenticated endpoint.

**Auth:** None (rate-limited)

**Body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `form_id` | integer | ✓ | The ID of the form being submitted |
| `<field_key>` | any | varies | All form field values keyed by their field key |

**Response:** HTTP 200 on success with optional redirect/confirmation data.

**Errors:** Returns `validation_error` (422) for field-level failures. The `meta` key will contain per-field error messages.

---

## Notes

- `order` params are **case-insensitive** — both `asc` and `ASC` (or `desc`/`DESC`) are accepted.
- `orderby` values are validated against an allowlist (`id`, `created_at`, `updated_at`, `status`) and fall back to `created_at` if an unknown value is supplied.
- All admin endpoints call `current_user_can('manage_options')` — only WordPress administrators have access.
- POST/PUT request bodies must use `Content-Type: application/json`.
