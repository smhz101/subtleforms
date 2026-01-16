# REST API Structure

## Endpoint overview

SubtleForms exposes REST API endpoints under `/wp-json/subtleforms/v1/` namespace.

## Controllers

### RestController

**Namespace:** `subtleforms/v1`  
**File:** `src/Api/RestController.php`

#### Forms endpoints

```
GET    /forms              List all forms (paginated)
GET    /forms/{id}         Get single form
POST   /forms              Create new form
PUT    /forms/{id}         Update form
DELETE /forms/{id}         Delete form
POST   /forms/{id}/publish Publish form (creates schema version)
POST   /forms/{id}/submit  Public submission endpoint
```

#### Permission requirements

| Endpoint | Permission | Nonce |
|----------|-----------|-------|
| GET /forms | `manage_options` | Required |
| POST /forms | `manage_options` | Required |
| PUT /forms/{id} | `manage_options` | Required |
| DELETE /forms/{id} | `manage_options` | Required |
| POST /forms/{id}/publish | `manage_options` | Required |
| POST /forms/{id}/submit | Public | Required |

### DashboardApi

**Namespace:** `subtleforms/v1`  
**File:** `src/Api/DashboardApi.php`

```
GET /dashboard/stats    Get dashboard statistics (cached 5 min)
```

**Permission:** `manage_options`

### SettingsApi

**Namespace:** `subtleforms/v1`  
**File:** `src/Api/SettingsApi.php`

```
GET  /settings          Get plugin settings
POST /settings          Update plugin settings
```

**Permission:** `manage_options`

## Authentication patterns

### Admin endpoints

```php
public function register_routes() {
    register_rest_route('subtleforms/v1', '/forms', [
        'methods' => 'GET',
        'callback' => [$this, 'get_forms'],
        'permission_callback' => function() {
            return current_user_can('manage_options');
        }
    ]);
}
```

### Public endpoints (with nonce)

```php
public function register_routes() {
    register_rest_route('subtleforms/v1', '/forms/(?P<id>\d+)/submit', [
        'methods' => 'POST',
        'callback' => [$this, 'submit_form'],
        'permission_callback' => function() {
            // Nonce verification happens in callback
            return true;
        }
    ]);
}

public function submit_form(WP_REST_Request $request) {
    // Verify nonce
    $nonce = $request->get_header('X-WP-Nonce');
    if (!wp_verify_nonce($nonce, 'wp_rest')) {
        return new WP_Error(
            'rest_cookie_invalid_nonce',
            'Invalid nonce',
            ['status' => 403]
        );
    }
    
    // Process submission...
}
```

## Request/Response patterns

### List endpoint (paginated)

**Request:**
```http
GET /wp-json/subtleforms/v1/forms?page=1&per_page=20&status=published
X-WP-Nonce: abc123xyz
```

**Response:**
```json
{
  "forms": [
    {
      "id": 1,
      "title": "Contact Form",
      "status": "published",
      "submission_count": 42,
      "created_at": "2026-01-15T10:30:00",
      "updated_at": "2026-01-16T14:20:00"
    }
  ],
  "total": 100,
  "page": 1,
  "per_page": 20,
  "total_pages": 5
}
```

### Single resource

**Request:**
```http
GET /wp-json/subtleforms/v1/forms/1
X-WP-Nonce: abc123xyz
```

**Response:**
```json
{
  "id": 1,
  "title": "Contact Form",
  "status": "published",
  "schema": {
    "fields": [
      {
        "id": "field_1",
        "type": "text",
        "label": "Name",
        "required": true
      }
    ]
  },
  "settings": {
    "notifications": true,
    "captcha_enabled": true,
    "captcha_provider": "recaptcha_v2"
  },
  "created_at": "2026-01-15T10:30:00",
  "updated_at": "2026-01-16T14:20:00"
}
```

### Create/Update

**Request:**
```http
POST /wp-json/subtleforms/v1/forms
Content-Type: application/json
X-WP-Nonce: abc123xyz

{
  "title": "New Form",
  "schema": {
    "fields": []
  },
  "settings": {}
}
```

**Response (success):**
```json
{
  "id": 5,
  "title": "New Form",
  "status": "draft",
  "created_at": "2026-01-17T08:15:00"
}
```

**Response (error):**
```json
{
  "code": "rest_invalid_param",
  "message": "Invalid parameter(s): title",
  "data": {
    "status": 400,
    "params": {
      "title": "Title is required"
    }
  }
}
```

### Public submission endpoint

**Request:**
```http
POST /wp-json/subtleforms/v1/forms/1/submit
Content-Type: application/json
X-WP-Nonce: abc123xyz

{
  "fields": {
    "field_1": "John Doe",
    "field_2": "john@example.com",
    "field_3": "Hello world"
  },
  "captcha_token": "03AGdBq...",
  "honeypot": "",
  "render_time": 1705488900
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Form submitted successfully",
  "submission_id": 123
}
```

**Response (spam detected):**
```json
{
  "code": "spam_detected",
  "message": "Submission failed spam check",
  "data": {
    "status": 403,
    "reason": "honeypot"
  }
}
```

**Response (rate limited):**
```json
{
  "code": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later.",
  "data": {
    "status": 429,
    "retry_after": 60
  }
}
```

## Error handling

### Standard error format

```php
return new WP_Error(
    'error_code',           // Machine-readable code
    'Human readable message', // User-facing message
    [
        'status' => 400,    // HTTP status code
        'additional_data' => 'value'
    ]
);
```

### Common error codes

| Code | Status | Meaning |
|------|--------|---------|
| `rest_forbidden` | 403 | Permission denied |
| `rest_cookie_invalid_nonce` | 403 | Invalid/missing nonce |
| `rest_invalid_param` | 400 | Invalid request parameters |
| `rest_not_found` | 404 | Resource not found |
| `spam_detected` | 403 | Submission failed spam check |
| `rate_limit_exceeded` | 429 | Too many requests |
| `captcha_verification_failed` | 400 | CAPTCHA token invalid |

## Rate limiting

Implemented in `submit_form()` endpoint:

```php
// Check rate limit (10 requests/min per IP)
$ip = $_SERVER['REMOTE_ADDR'];
$limit_key = "subtleforms_rate_limit_{$ip}";
$attempts = (int) get_transient($limit_key);

if ($attempts >= 10) {
    return new WP_Error(
        'rate_limit_exceeded',
        'Too many requests',
        ['status' => 429, 'retry_after' => 60]
    );
}

set_transient($limit_key, $attempts + 1, 60);
```

## Caching strategy

### Dashboard stats (5-minute transient)

```php
// In DashboardApi::getStats()
$cache_key = 'subtleforms_dashboard_stats';
$cached = get_transient($cache_key);

if ($cached !== false) {
    return rest_ensure_response($cached);
}

// Expensive queries...
$stats = [
    'total_forms' => $this->forms_repository->count(),
    'total_submissions' => $this->submissions_repository->count(),
    // ...
];

set_transient($cache_key, $stats, 5 * MINUTE_IN_SECONDS);
return rest_ensure_response($stats);
```

### Cache invalidation

```php
// Clear cache when data changes
public static function clearStatsCache() {
    delete_transient('subtleforms_dashboard_stats');
}

// Call after form/submission changes
add_action('subtleforms_after_submission', [DashboardApi::class, 'clearStatsCache']);
```

## Testing REST endpoints

```php
// In tests/Integration/Api/RestControllerTest.php
public function test_get_forms_requires_authentication() {
    $request = new WP_REST_Request('GET', '/subtleforms/v1/forms');
    $response = $this->server->dispatch($request);
    
    $this->assertEquals(403, $response->get_status());
}

public function test_submit_form_verifies_nonce() {
    $request = new WP_REST_Request('POST', '/subtleforms/v1/forms/1/submit');
    $request->set_header('X-WP-Nonce', 'invalid');
    $response = $this->server->dispatch($request);
    
    $this->assertEquals(403, $response->get_status());
}
```

## Common pitfalls

❌ **Missing permission callback:**
```php
register_rest_route('subtleforms/v1', '/forms', [
    'methods' => 'GET',
    'callback' => [$this, 'get_forms'],
    // Missing permission_callback!
]);
```

✅ **Always define permission callback:**
```php
register_rest_route('subtleforms/v1', '/forms', [
    'methods' => 'GET',
    'callback' => [$this, 'get_forms'],
    'permission_callback' => function() {
        return current_user_can('manage_options');
    }
]);
```

❌ **Not sanitizing input:**
```php
$title = $request->get_param('title'); // Direct use
```

✅ **Always sanitize:**
```php
$title = Helpers::safe_sanitize_text($request->get_param('title'));
```

❌ **Inconsistent error responses:**
```php
return ['error' => 'Something went wrong']; // Wrong format
```

✅ **Use WP_Error:**
```php
return new WP_Error('error_code', 'Error message', ['status' => 400]);
```
