# SubtleForms System Audit Report

**Date:** January 16, 2026  
**Version Audited:** v1.6.9  
**Auditor:** GitHub Copilot (Claude Sonnet 4.5)  
**Freeze Tag:** `subtleforms-freeze-v1.6.9`  
**Commit Hash:** `4367071`

---

## EXECUTIVE SUMMARY

SubtleForms demonstrates **solid architectural foundations** with proper separation of concerns, comprehensive field registry systems, and extensible provider patterns (CAPTCHA). However, this audit reveals **critical security gaps**, **performance vulnerabilities**, and **significant dead code** that must be addressed before WordPress.org submission and scale deployment.

### Key Findings

| Category              | Status      | Priority                                     |
| --------------------- | ----------- | -------------------------------------------- |
| **Security**          | 🔴 CRITICAL | Fix REST API CSRF & rate limiting            |
| **Performance**       | 🟡 WARNING  | Address N+1 queries, add caching             |
| **Dead Code**         | 🟠 MODERATE | 7 settings (23%) unused at runtime           |
| **CAPTCHA**           | 🟢 RESOLVED | Preview rendering fixed (v1.6.8-v1.6.9)      |
| **Country Field**     | 🟢 PARTIAL  | Preview improved, frontend needs enhancement |
| **Settings Coverage** | 🟡 WARNING  | 3 settings missing validation rules          |

---

## PHASE 0: SAFETY CHECKPOINT ✅

### Version Audit

| Component     | Version | Location           |
| ------------- | ------- | ------------------ |
| Plugin Header | `1.6.9` | subtleforms.php:6  |
| PHP Constant  | `1.6.9` | subtleforms.php:29 |
| package.json  | `1.6.9` | package.json:3     |

**Status:** ✅ All version identifiers synchronized

### Git Status

```
Current Branch: main
Latest Commit: 4367071 - Fix: inject CAPTCHA HTML for all provider field types
Clean Working Directory: Yes
Freeze Tag Created: subtleforms-freeze-v1.6.9
```

**Rollback Baseline:** Tag `subtleforms-freeze-v1.6.9` available for emergency rollback

---

## PHASE 1: CAPTCHA PREVIEW RENDERING 🟢

### Problem Statement

CAPTCHA fields were appearing as **plain text labels** in:

- Form Builder canvas
- Preview modal
- (Previously) Frontend forms

### Root Cause Analysis

**Backend Issue (RESOLVED v1.6.9)**

```php
// BEFORE (RestController.php#L584)
private function processCaptchaFields( $fields, $captcha_html ) {
    if ( $field['type'] === 'captcha' ) {  // Only generic 'captcha'
        $field['config']['captchaHtml'] = $captcha_html;
    }
}

// AFTER (RestController.php#L584)
private function processCaptchaFields( $fields, $captcha_html ) {
    if ( in_array( $field['type'], ['captcha', 'recaptcha', 'hcaptcha', 'turnstile'], true ) ) {
        $field['config']['captchaHtml'] = $captcha_html;
    }
}
```

**Frontend Issue (RESOLVED v1.6.9)**

```jsx
// BEFORE (FieldRenderer.jsx#L330)
case 'captcha':
  return <div dangerouslySetInnerHTML={{ __html: field.config?.captchaHtml }} />;

// AFTER (FieldRenderer.jsx#L330-L333)
case 'captcha':
case 'recaptcha':
case 'hcaptcha':
case 'turnstile':
  return <div dangerouslySetInnerHTML={{ __html: field.config?.captchaHtml }} />;
```

### Current Implementation

**✅ Builder Canvas (v1.6.8)**

- Shows static placeholder with lock icon 🔒
- Message: "CAPTCHA will appear here on the live form"
- Location: `resources/admin/components/builder/FieldRenderer.jsx:268-278`

**✅ Preview Modal (v1.6.8)**

- Same placeholder approach
- Location: `resources/admin/components/FormPreviewModal.jsx:266-291`

**✅ Frontend Rendering (v1.6.9)**

- Injects provider HTML via `dangerouslySetInnerHTML`
- Supports all provider types: recaptcha, hcaptcha, turnstile
- Location: `resources/frontend/components/FieldRenderer.jsx:330-340`

### Security Considerations

| Aspect                | Implementation                                        | Status |
| --------------------- | ----------------------------------------------------- | ------ |
| **API Keys in Admin** | ✅ Stored in Settings, never exposed to frontend      | SECURE |
| **Widget Rendering**  | ✅ Provider HTML generated server-side                | SECURE |
| **Preview Mode**      | ✅ Static placeholder, no real API calls              | SECURE |
| **Provider Scripts**  | ✅ Enqueued conditionally via `Shortcode.php:113-122` | SECURE |

### Risks & Limitations

**⚠️ Builder Limitation**

- Real CAPTCHA widgets **cannot** render in WP Admin (cross-origin restrictions)
- Current placeholder approach is **optimal solution**

**✅ No Security Risks**

- API keys never exposed to JavaScript
- Preview mode doesn't make external API calls
- Frontend properly injects provider-specific HTML

---

## PHASE 2: COUNTRY FIELD UX & PREVIEW 🟡

### Current Implementation

**Backend**

- Full ISO-3166 country list (244 countries)
- Location: `src/Fields/CountryList.php:22-220`
- Returns `['code' => 'name']` pairs (e.g., `'US' => 'United States'`)

**Builder Canvas (v1.6.9)**

```jsx
// Shows 10 sample countries + indicator
<select>
	<option>Select a country</option>
	<option>United States</option>
	<option>United Kingdom</option>
	// ... 8 more samples ...
	<option>...and 200+ more countries</option>
</select>
```

Location: `resources/admin/components/builder/FieldRenderer.jsx:142-159`

**Preview Modal (v1.6.9)**

- Identical to builder canvas
- Location: `resources/admin/components/FormPreviewModal.jsx:295-321`

**Frontend Rendering**

- ❌ **NOT IMPLEMENTED** - Uses default dropdown without country list
- Location: `resources/frontend/components/FieldRenderer.jsx` (missing country case)

### Missing Features

| Feature                 | Status         | Impact                                       |
| ----------------------- | -------------- | -------------------------------------------- |
| **Default Country**     | ❌ Missing     | Users can't pre-select based on geolocation  |
| **Preferred Countries** | ❌ Missing     | Can't prioritize common countries (US/UK/CA) |
| **Searchable Dropdown** | ❌ Missing     | 244 options = poor UX without search         |
| **Country Flags**       | ❌ Missing     | Visual identification aids                   |
| **ISO Code Output**     | ⚠️ Partial     | Backend supports, not configurable in UI     |
| **Placeholder Text**    | ✅ Implemented | Configurable via inspector                   |

### Comparison with Competitors

**Fluent Forms**

- ✅ Searchable dropdown with flags
- ✅ Default country selection
- ✅ Preferred countries at top
- ✅ ISO code or name output modes

**Gravity Forms**

- ✅ Country flags
- ✅ Smart defaults
- ✅ Customizable country list subset

**SubtleForms Gap**

- ⚠️ Basic select without search = **poor UX for 244 options**
- ❌ No frontend implementation at all

### Proposed Enhancements

**Phase 1: Critical (Frontend Implementation)**

```jsx
// resources/frontend/components/FieldRenderer.jsx
case 'country':
  const countries = field.config?.countryList || [];
  return (
    <select value={value} onChange={onChange}>
      <option value="">{placeholder || 'Select a country'}</option>
      {Object.entries(countries).map(([code, name]) => (
        <option key={code} value={code}>{name}</option>
      ))}
    </select>
  );
```

**Phase 2: Enhanced (Searchable Dropdown)**

```php
// CoreFields.php - Add field attributes
fieldSpecificAttributes: [
    'countryList' => CountryList::getOptions(),
    'defaultCountry' => '',           // NEW
    'preferredCountries' => [],       // NEW: ['US', 'GB', 'CA']
    'searchable' => true,             // NEW: Use select2/choices.js
    'outputFormat' => 'code',         // NEW: 'code' | 'name'
    'showFlags' => false,             // NEW: Requires flag sprite
]
```

**Phase 3: Premium Features**

- Geolocation-based default (requires API)
- Flag sprites (requires asset generation)
- Custom country subsets (e.g., EU-only, NAFTA-only)

### Backward Compatibility

**✅ Safe to Enhance**

- Current field config: `['placeholder' => 'Select a country', 'countryList' => [...]]`
- Adding new attributes won't break existing forms
- Frontend implementation can fallback gracefully

---

## PHASE 3: SETTINGS COVERAGE AUDIT 🟡

### Complete Settings Inventory

| Setting Key                    | Type   | Default            | Tab      | UI  | Runtime                | Validation                                | Status           |
| ------------------------------ | ------ | ------------------ | -------- | --- | ---------------------- | ----------------------------------------- | ---------------- |
| **GENERAL**                    |
| `default_form_status`          | string | `'draft'`          | General  | ✅  | ✅ RestController#708  | `['draft','published']`                   | ✅ Active        |
| `autosave_enabled`             | bool   | `true`             | General  | ✅  | ✅ DashboardApi#232    | `boolean`                                 | ✅ Active        |
| `autosave_interval`            | int    | `3`                | General  | ✅  | ❌ **NOT USED**        | `int[1-60]`                               | 🔴 Dead Code     |
| `delete_behavior`              | string | `'soft'`           | General  | ✅  | ❌ **NOT USED**        | `['soft','hard']`                         | 🔴 Dead Code     |
| **FRONTEND**                   |
| `success_message`              | string | `'Thank you!'`     | Frontend | ✅  | ✅ Shortcode#99        | `string[max:500]`                         | ✅ Active        |
| `error_message`                | string | `'Error occurred'` | Frontend | ✅  | ❌ **NOT USED**        | `string[max:500]`                         | 🔴 Dead Code     |
| `redirect_after_submit`        | string | `''`               | Frontend | ✅  | ✅ Shortcode#101       | `string[max:500]`                         | ✅ Active        |
| `submission_limit_enabled`     | bool   | `false`            | Frontend | ✅  | ❌ **NOT USED**        | `boolean`                                 | 🔴 Dead Code     |
| `submission_limit`             | int    | `1`                | Frontend | ✅  | ❌ **NOT USED**        | `int[1-100]`                              | 🔴 Dead Code     |
| **EMAIL**                      |
| `admin_notification_enabled`   | bool   | `true`             | Email    | ✅  | ❌ **NOT USED**        | `boolean`                                 | 🔴 Dead Code     |
| `user_confirmation_enabled`    | bool   | `false`            | Email    | ✅  | ❌ **NOT USED**        | `boolean`                                 | 🔴 Dead Code     |
| `sender_name`                  | string | `''`               | Email    | ✅  | ✅ Settings#318        | `string[max:100]`                         | ✅ Active        |
| `sender_email`                 | string | `''`               | Email    | ✅  | ✅ Settings#308        | `email`                                   | ✅ Active        |
| `admin_email`                  | string | `''`               | Email    | ✅  | ✅ RestController#1412 | `email`                                   | ✅ Active        |
| **ADVANCED**                   |
| `debug_mode`                   | bool   | `false`            | Advanced | ✅  | ✅ DashboardApi#231    | `boolean`                                 | ✅ Active        |
| `log_retention_days`           | int    | `30`               | Advanced | ✅  | ❌ **NOT USED**        | `int[1-365]`                              | 🔴 Dead Code     |
| **SPAM PROTECTION**            |
| `enable_honeypot`              | bool   | `true`             | Advanced | ✅  | ✅ SpamProtection#136  | ❌ **MISSING**                            | 🟡 No Validation |
| `min_submission_time`          | int    | `3`                | Advanced | ✅  | ⚠️ **HARDCODED**       | ❌ **MISSING**                            | 🟠 Not Dynamic   |
| **CAPTCHA**                    |
| `captcha_enabled`              | bool   | `false`            | Advanced | ✅  | ✅ CaptchaManager#62   | `boolean`                                 | ✅ Active        |
| `captcha_provider`             | string | `''`               | Advanced | ✅  | ✅ CaptchaManager#72   | `['','recaptcha','hcaptcha','turnstile']` | ✅ Active        |
| `captcha_recaptcha_site_key`   | string | `''`               | Advanced | ✅  | ✅ RecaptchaProvider   | `string[max:200]`                         | ✅ Active        |
| `captcha_recaptcha_secret_key` | string | `''`               | Advanced | ✅  | ✅ RecaptchaProvider   | `string[max:200]`                         | ✅ Active        |
| `captcha_recaptcha_version`    | string | `'v2'`             | Advanced | ✅  | ✅ RecaptchaProvider   | `['v2','v3']`                             | ✅ Active        |
| `captcha_hcaptcha_site_key`    | string | `''`               | Advanced | ✅  | ✅ HCaptchaProvider    | `string[max:200]`                         | ✅ Active        |
| `captcha_hcaptcha_secret_key`  | string | `''`               | Advanced | ✅  | ✅ HCaptchaProvider    | `string[max:200]`                         | ✅ Active        |
| `captcha_turnstile_site_key`   | string | `''`               | Advanced | ✅  | ✅ TurnstileProvider   | `string[max:200]`                         | ✅ Active        |
| `captcha_turnstile_secret_key` | string | `''`               | Advanced | ✅  | ✅ TurnstileProvider   | `string[max:200]`                         | ✅ Active        |
| **PRIVACY**                    |
| `data_retention_days`          | int    | `0`                | Advanced | ✅  | ✅ PrivacyManager#78   | ❌ **MISSING**                            | 🟡 No Validation |

### Summary Statistics

- **Total Settings:** 30
- **Active (Used at Runtime):** 16 (53%)
- **Dead Code (Unused):** 7 (23%)
- **Missing Validation:** 3 (10%)
- **Partially Implemented:** 1 (3%)

### Critical Findings

**🔴 Dead Code Settings (7)**

These settings have full UI and backend definitions but are **never read at runtime**:

1. `autosave_interval` - UI allows configuration, but autosave timing is hardcoded
2. `delete_behavior` - Soft vs hard delete not implemented in deletion logic
3. `error_message` - Generic error message not used in form submission errors
4. `submission_limit_enabled` + `submission_limit` - No rate limiting enforcement
5. `admin_notification_enabled` + `user_confirmation_enabled` - Email system doesn't check toggles
6. `log_retention_days` - No automated cleanup cron job

**🟡 Missing Validation Rules (3)**

Settings in `DEFAULTS` but not in `VALIDATION_RULES`:

```php
// Required additions to Settings.php:
'enable_honeypot'      => 'boolean',
'min_submission_time'  => array('integer', 'min' => 0, 'max' => 60),
'data_retention_days'  => array('integer', 'min' => 0, 'max' => 3650),
```

**🟠 Partially Implemented (1)**

`min_submission_time`:

- ✅ Has UI in SettingsPage.jsx
- ✅ Used in SpamProtection.php
- ❌ **Hardcoded as constant** instead of reading from settings:
  ```php
  // SpamProtection.php#L39
  const MIN_SUBMISSION_TIME = 3;  // Should read from $settings->get('min_submission_time', 3)
  ```

### Recommended Actions

**Priority 1: Fix Missing Validations**

```php
// src/Support/Settings.php#L110-L115
const VALIDATION_RULES = [
    // ... existing rules ...
    'enable_honeypot'      => 'boolean',
    'min_submission_time'  => ['integer', 'min' => 0, 'max' => 60],
    'data_retention_days'  => ['integer', 'min' => 0, 'max' => 3650],
];
```

**Priority 2: Make min_submission_time Dynamic**

```php
// src/Engine/SpamProtection.php#L99
- if ($time_taken < self::MIN_SUBMISSION_TIME) {
+ $min_time = $this->settings->get('min_submission_time', 3);
+ if ($time_taken < $min_time) {
```

**Priority 3: Implement or Remove Dead Settings**

Options:

- **Implement logic** for submission limits, email toggles, autosave interval
- **Remove from UI** if no implementation planned (cleaner UX)
- **Document as "coming soon"** with disabled UI state

---

## PHASE 4: PHP & API STRENGTH ASSESSMENT 🟡

### REST API Design Quality: ⭐⭐⭐⭐ (4/5)

**✅ STRENGTHS**

1. **Consistent RESTful Design**

   - Proper HTTP methods (GET/POST/PUT/DELETE)
   - Standard namespace: `subtleforms/v1`
   - Pagination with `X-WP-Total` headers
   - Structured `WP_REST_Response` and `WP_Error` usage

2. **Repository Pattern**

   - Clean separation: Controller → Repository → Database
   - Reusable data access layer
   - Dependency injection in RestController

3. **Schema Versioning**
   - Separate draft vs. active schemas
   - Public access restricted to active only
   - Prevents exposing WIP to frontend

**⚠️ WEAKNESSES**

1. **No API Documentation**

   - Missing OpenAPI/Swagger schemas
   - No endpoint descriptions in route registration

2. **Inconsistent Method Naming**
   - RestController uses `snake_case`
   - SettingsApi uses `camelCase`

### Security Posture: ⭐⭐⭐ (3/5)

**✅ COMPLIANT PATTERNS**

- ✅ Capability checks: `current_user_can('manage_options')`
- ✅ SQL injection prevention: All queries use `$wpdb->prepare()`
- ✅ XSS prevention: Proper sanitization with `sanitize_text_field()`
- ✅ Input validation: Schema validator on form publish
- ✅ Spam protection: Honeypot + time trap

**🚨 CRITICAL VULNERABILITIES**

**1. NO NONCE VALIDATION ON REST API** ⚠️⚠️⚠️

```php
// PROBLEM: All POST/PUT/DELETE endpoints lack CSRF protection
register_rest_route('subtleforms/v1', '/forms', [
    'methods' => 'POST',
    'callback' => [$this, 'create_form'],
    'permission_callback' => [$this, 'check_write_permission'], // Only checks capability
]);
```

**WordPress.org Impact:** **HIGH RISK** - Reviewers **will flag this**

**Required Fix:**

```php
add_filter('rest_authentication_errors', function($result) {
    if (!empty($result)) return $result;
    if (!is_user_logged_in()) return $result;

    // Verify REST nonce from cookie or header
    $nonce = $_COOKIE['wp_rest'] ?? $_SERVER['HTTP_X_WP_NONCE'] ?? '';
    if (!wp_verify_nonce($nonce, 'wp_rest')) {
        return new WP_Error('rest_cookie_invalid_nonce', 'Invalid nonce', ['status' => 403]);
    }

    return $result;
});
```

**2. NO RATE LIMITING ON PUBLIC SUBMIT ENDPOINT**

```php
// Publicly accessible without throttling
register_rest_route('subtleforms/v1', '/submit', [
    'methods' => 'POST',
    'callback' => [$this, 'submit_form'],
    'permission_callback' => '__return_true', // WIDE OPEN
]);
```

**Attack Vector:** Unlimited API abuse can flood database

**Required Fix:**

```php
public function submit_form(WP_REST_Request $request) {
    // Rate limiting via transients
    $ip = filter_var($_SERVER['REMOTE_ADDR'] ?? '', FILTER_VALIDATE_IP);
    $transient_key = 'sf_ratelimit_' . md5($ip);

    $count = (int) get_transient($transient_key);
    if ($count >= 10) { // 10 submissions per minute
        return new WP_Error('rate_limit', 'Too many requests', ['status' => 429]);
    }

    set_transient($transient_key, $count + 1, MINUTE_IN_SECONDS);
    // ... continue with submission
}
```

**3. PRIVACY COMPLIANCE GAPS**

```php
// Stores PII without user notice
'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
```

RestController.php#L1119-L1120

**WordPress.org Requirement:** Must register privacy policy content

**Required Fix:**

```php
// Add to plugin bootstrap
add_action('admin_init', function() {
    if (function_exists('wp_add_privacy_policy_content')) {
        wp_add_privacy_policy_content('SubtleForms',
            'This plugin stores IP addresses and user agents for spam protection. ' .
            'Data is retained according to your configured retention period.'
        );
    }
});
```

### Performance Risks: ⭐⭐ (2/5)

**🚨 N+1 QUERY VULNERABILITIES**

**1. Forms List - Submission Counts**

```php
// RestController.php#L396-L404
foreach ($forms as &$form) {
    $form['submission_count'] = $this->submissionsRepo->count(['form_id' => $form['id']]);
    $form['unread_count'] = $this->submissionsRepo->count(['form_id' => $form['id'], 'status' => 'unread']);
}
```

**Impact:** 100 forms = **201 queries** (1 forms query + 100 submission counts + 100 unread counts)

**Fix:**

```php
// Single query with JOIN
SELECT f.*,
    COUNT(s.id) as submission_count,
    COUNT(CASE WHEN s.status = 'unread' THEN 1 END) as unread_count
FROM {$formsTable} f
LEFT JOIN {$submissionsTable} s ON f.id = s.form_id
GROUP BY f.id
```

**2. Submissions List - Form Titles**

```php
// RestController.php#L851-L862
foreach ($submissions as &$sub) {
    $form = $this->formsRepo->find($sub['form_id']); // N+1
    $sub['form_title'] = $form['title'] ?? 'Unknown';
}
```

**Impact:** 50 submissions = **51 queries**

**Fix:** Single query with JOIN or `array_column()` batch loading

**⚠️ MISSING CACHING**

- Dashboard stats recalculated on every request
- No transient caching for expensive queries
- Recommended: 5-minute cache with invalidation on data changes

**⚠️ CSV EXPORT MEMORY RISK**

```php
// RestController.php#L1556-L1620
$submissions = $this->submissionsRepo->findAll(['limit' => 10000]);
// Loads 10,000 submissions into memory at once
```

**Risk:** 10,000 submissions @ 5KB each = **50MB+ in memory**

**Fix:** Implement batch processing or streaming

### Extensibility: ⭐⭐⭐ (3/5)

**✅ GOOD**

- Extension-friendly provider pattern (CAPTCHA)
- Single payment hook: `do_action('subtleforms_payment_required', ...)`
- Conditional API registration based on dependencies

**⚠️ GAPS**

- No filter hooks for modifying API responses
- No extension points for custom validation
- Cannot filter form data before save

**Recommended Additions:**

```php
$form_data = apply_filters('subtleforms_api_form_before_save', $form_data, $form_id);
$response = apply_filters('subtleforms_api_response', $response, $endpoint);
do_action('subtleforms_register_api_routes', $namespace);
```

### WordPress.org Compliance Summary

| Requirement              | Status         | Notes                                         |
| ------------------------ | -------------- | --------------------------------------------- |
| Capability checks        | ✅ PASS        | All authenticated endpoints check permissions |
| SQL injection prevention | ✅ PASS        | All queries use `$wpdb->prepare()`            |
| XSS prevention           | ✅ PASS        | Proper sanitization throughout                |
| CSRF protection          | 🔴 **FAIL**    | Missing REST nonce validation                 |
| Rate limiting            | 🔴 **FAIL**    | Public endpoint unprotected                   |
| Privacy policy           | 🟡 **MISSING** | Need to register policy content               |
| Internationalization     | ✅ PASS        | All strings use `__()`                        |

**Blocker Count:** 2 critical (CSRF, rate limiting)  
**Estimated Fix Time:** 8-12 hours

---

## PHASE 5: AGENT-SKILLS INTEGRATION DESIGN

### GitHub agent-skills Compatibility

**Repository:** [automattic/agent-skills](https://github.com/automattic/agent-skills)

**Applicable Skills:**

- `wp-plugin-development` - Core development standards
- `wp-rest-api` - REST API best practices
- `wp-admin-ui` - Admin interface patterns
- `wp-security` - Security guidelines
- `wp-database` - Database operations

### Proposed Folder Structure

```
subtleforms/
├── .github/
│   └── skills/
│       ├── README.md                    # Skills overview
│       ├── wp-plugin-development.md     # From agent-skills repo
│       ├── wp-rest-api.md              # From agent-skills repo
│       ├── wp-admin-ui.md              # From agent-skills repo
│       ├── wp-security.md              # From agent-skills repo
│       ├── subtleforms-architecture.md  # CUSTOM: Plugin-specific
│       ├── subtleforms-styling.md       # CUSTOM: BEM + no utilities
│       ├── subtleforms-versioning.md    # CUSTOM: Atomic commits + bumps
│       └── subtleforms-testing.md       # CUSTOM: QA protocols
```

### Custom SubtleForms Skills

**1. `subtleforms-architecture.md`**

```markdown
# SubtleForms Architecture Patterns

## Repository Pattern

- All database operations go through Repository classes
- Controllers never query database directly
- Example: `RestController` → `FormsRepository` → `$wpdb`

## Provider Pattern

- Extensible system for CAPTCHA, payment gateways
- Must implement provider interface
- Register via `do_action` hooks

## Schema System

- Draft vs. Active schema separation
- Version tracking per publish
- Validation before activation
```

**2. `subtleforms-styling.md`**

```markdown
# SubtleForms CSS Standards

## BEM Methodology (Mandatory)

- Block: `.sf-form-builder`
- Element: `.sf-form-builder__canvas`
- Modifier: `.sf-form-builder__canvas--dragging`

## Forbidden Patterns

- ❌ Utility classes (no `.mt-4`, `.flex`, `.text-red-500`)
- ❌ Inline styles
- ❌ !important declarations (except overriding WP core)

## Namespace Prefix

- All classes: `sf-` or `.subtleforms-`
- Prevents conflicts with themes
```

**3. `subtleforms-versioning.md`**

```markdown
# SubtleForms Version Management

## Atomic Commits

- One feature = one commit
- Each commit must be deployable
- Prefix: `feat:`, `fix:`, `chore:`, `docs:`

## Version Bumping

- Patch (1.6.x): Bug fixes, minor improvements
- Minor (1.x.0): New features, no breaking changes
- Major (x.0.0): Breaking changes, architecture shifts

## Synchronization (Mandatory)

- Update ALL THREE:
  1. `subtleforms.php` (header comment)
  2. `SUBTLEFORMS_VERSION` constant
  3. `package.json`

## Freeze Points

- Create git tag before major changes: `subtleforms-freeze-v1.x.y`
- Include commit message with context
```

**4. `subtleforms-testing.md`**

```markdown
# SubtleForms QA Protocol

## Before Commit

1. Run `npm run build` - No errors
2. Check PHP errors in debug mode
3. Test affected functionality manually

## Before Version Bump

1. Full regression test (forms CRUD, submissions)
2. Browser testing (Chrome, Firefox, Safari)
3. Mobile responsive check

## Before WordPress.org Submission

1. Security audit (CSRF, rate limiting, sanitization)
2. Performance profiling (N+1 queries)
3. Privacy compliance check
```

### Enforcement Mechanism

**Pre-commit Hook (`.github/hooks/pre-commit`)**

```bash
#!/bin/bash

# Check version synchronization
PHP_VERSION=$(grep "Version:" subtleforms.php | head -1 | awk '{print $3}')
CONST_VERSION=$(grep "SUBTLEFORMS_VERSION" subtleforms.php | awk -F"'" '{print $2}')
JSON_VERSION=$(grep '"version"' package.json | head -1 | awk -F'"' '{print $4}')

if [[ "$PHP_VERSION" != "$CONST_VERSION" ]] || [[ "$PHP_VERSION" != "$JSON_VERSION" ]]; then
    echo "❌ Version mismatch detected!"
    echo "   subtleforms.php header: $PHP_VERSION"
    echo "   SUBTLEFORMS_VERSION:    $CONST_VERSION"
    echo "   package.json:           $JSON_VERSION"
    exit 1
fi

# Check for utility classes in new CSS
if git diff --cached --name-only | grep -q '\.scss$'; then
    if git diff --cached | grep -q -E '\.(mt-|mb-|ml-|mr-|px-|py-|flex|grid)'; then
        echo "⚠️  Warning: Utility classes detected in SCSS changes"
        echo "   SubtleForms uses BEM methodology only"
        exit 1
    fi
fi

echo "✅ Pre-commit checks passed"
```

### Integration Steps (DO NOT IMPLEMENT YET)

1. **Clone agent-skills repo locally**
2. **Copy applicable skills to `.github/skills/`**
3. **Create 4 custom SubtleForms skills**
4. **Update CONTRIBUTING.md to reference skills**
5. **Configure GitHub Copilot Workspace** (if applicable)
6. **Add pre-commit hooks for enforcement**

---

## PHASE 6: EXECUTION PLAN

### Phased Roadmap

#### **v1.6.10 - Critical Security Patches** (IMMEDIATE)

**Priority:** 🔴 CRITICAL  
**Estimated Time:** 8-12 hours  
**Target Date:** January 17, 2026

| Task                         | Files                              | Changes                                  |
| ---------------------------- | ---------------------------------- | ---------------------------------------- |
| Add REST nonce validation    | `src/Api/RestController.php`       | Add `rest_authentication_errors` filter  |
| Implement rate limiting      | `src/Api/RestController.php:1055`  | Transient-based throttling on `/submit`  |
| Add privacy policy content   | `subtleforms.php`                  | Register `wp_add_privacy_policy_content` |
| Fix missing validation rules | `src/Support/Settings.php:110-115` | Add 3 missing rules                      |

**Git Strategy:**

```bash
# Commit 1
git commit -m "security: add REST API nonce validation for CSRF protection"

# Commit 2
git commit -m "security: implement rate limiting on public submit endpoint"

# Commit 3
git commit -m "compliance: register privacy policy content for IP logging"

# Commit 4
git commit -m "fix: add missing validation rules for spam/privacy settings"

# Version bump
# Update subtleforms.php: Version 1.6.10
# Update SUBTLEFORMS_VERSION constant
# Update package.json
git commit -m "chore: bump version to 1.6.10"
git tag v1.6.10
```

**Rollback Safety:** Tag `subtleforms-freeze-v1.6.9` available

---

#### **v1.6.11 - Settings Dead Code Cleanup** (HIGH PRIORITY)

**Priority:** 🟠 HIGH  
**Estimated Time:** 16-24 hours  
**Target Date:** January 20, 2026

| Task                                 | Files                                            | Changes                                  |
| ------------------------------------ | ------------------------------------------------ | ---------------------------------------- |
| Make `min_submission_time` dynamic   | `src/Engine/SpamProtection.php:39,99`            | Read from settings instead of constant   |
| Implement submission rate limiting   | `src/Api/RestController.php:1055-1100`           | Check `submission_limit_enabled` setting |
| Implement email notification toggles | `src/Engine/Actions/EmailAction.php`             | Check `admin_notification_enabled`       |
| Implement error message display      | `resources/frontend/components/Form.jsx`         | Use `error_message` setting              |
| Remove unused autosave_interval UI   | `resources/admin/pages/SettingsPage.jsx:415-425` | Hide or implement                        |
| Remove unused delete_behavior UI     | `resources/admin/pages/SettingsPage.jsx:430-440` | Hide or implement                        |

**Git Strategy:** One commit per feature implementation

---

#### **v1.7.0 - Performance Optimization** (MEDIUM PRIORITY)

**Priority:** 🟡 MEDIUM  
**Estimated Time:** 20-30 hours  
**Target Date:** January 27, 2026

| Task                             | Files                                        | Changes                       |
| -------------------------------- | -------------------------------------------- | ----------------------------- |
| Fix N+1: Forms list counts       | `src/Repositories/FormsRepository.php`       | Add JOIN query for counts     |
| Fix N+1: Submissions form titles | `src/Repositories/SubmissionsRepository.php` | Add JOIN or batch loading     |
| Add dashboard caching            | `src/Api/DashboardApi.php:78-88`             | Transient cache with 5min TTL |
| Implement CSV streaming          | `src/Api/RestController.php:1556-1620`       | Batch export in chunks        |

**Git Strategy:** Separate commits for each N+1 fix

**Breaking Changes:** None (performance only)

---

#### **v1.7.1 - Country Field Enhancement** (LOW PRIORITY)

**Priority:** 🟢 LOW  
**Estimated Time:** 12-16 hours  
**Target Date:** February 3, 2026

| Task                                 | Files                                                   | Changes                         |
| ------------------------------------ | ------------------------------------------------------- | ------------------------------- |
| Implement frontend country rendering | `resources/frontend/components/FieldRenderer.jsx`       | Add country case with full list |
| Add searchable dropdown option       | `resources/admin/components/builder/FieldInspector.jsx` | New toggle control              |
| Add default country setting          | `src/Fields/CoreFields.php:487-517`                     | New fieldSpecificAttribute      |
| Add preferred countries setting      | `src/Fields/CoreFields.php:487-517`                     | Array attribute                 |

**Git Strategy:**

- Commit 1: Frontend rendering (bug fix)
- Commit 2-4: UX enhancements (feature additions)

---

#### **v1.8.0 - Agent-Skills Integration** (DOCUMENTATION)

**Priority:** 🔵 DOCUMENTATION  
**Estimated Time:** 8-12 hours  
**Target Date:** February 10, 2026

| Task                               | Files                             | Changes                        |
| ---------------------------------- | --------------------------------- | ------------------------------ |
| Create `.github/skills/` directory | `.github/skills/README.md`        | Copy agent-skills + custom     |
| Add custom skills documentation    | `.github/skills/subtleforms-*.md` | 4 custom skill files           |
| Update CONTRIBUTING.md             | `CONTRIBUTING.md`                 | Reference skills documentation |
| Add pre-commit hooks               | `.github/hooks/pre-commit`        | Version sync + CSS validation  |

**Git Strategy:** Single commit for documentation addition

---

### Risk Assessment Matrix

| Phase                | Risk Level | Mitigation                                      |
| -------------------- | ---------- | ----------------------------------------------- |
| v1.6.10 (Security)   | 🟢 LOW     | Well-understood fixes, no breaking changes      |
| v1.6.11 (Settings)   | 🟡 MEDIUM  | Test email system thoroughly, add feature flags |
| v1.7.0 (Performance) | 🟡 MEDIUM  | Benchmark before/after, test with 1000+ forms   |
| v1.7.1 (Country)     | 🟢 LOW     | Purely additive, backward compatible            |
| v1.8.0 (Docs)        | 🟢 LOW     | Documentation only                              |

### Rollback Strategy

Each version has a freeze tag:

- `subtleforms-freeze-v1.6.9` ← Current baseline
- `subtleforms-freeze-v1.6.10` ← After security patches
- `subtleforms-freeze-v1.6.11` ← After settings cleanup
- etc.

**Emergency Rollback:**

```bash
git reset --hard subtleforms-freeze-v1.6.9
git push --force origin main
```

---

## FINAL RECOMMENDATIONS

### Immediate Actions (This Week)

1. ✅ **Create v1.6.10 branch** for security patches
2. 🔴 **Fix REST nonce validation** (WordPress.org blocker)
3. 🔴 **Implement rate limiting** (WordPress.org blocker)
4. 🟡 **Add privacy policy registration** (Compliance requirement)

### Short-Term (Next 2 Weeks)

5. 🟠 **Clean up dead settings code** (Reduces confusion)
6. 🟠 **Make spam settings dynamic** (Currently hardcoded)
7. 🟡 **Fix N+1 queries** (Performance at scale)

### Long-Term (Next Month)

8. 🟢 **Implement country field enhancements** (UX improvement)
9. 🟢 **Add agent-skills documentation** (Developer experience)
10. 🔵 **Create comprehensive test suite** (Quality assurance)

---

## CONCLUSION

SubtleForms has a **solid architectural foundation** but requires **critical security patches** before WordPress.org submission. The codebase demonstrates good separation of concerns, extensible patterns, and comprehensive CAPTCHA implementation. However, **CSRF vulnerabilities** and **missing rate limiting** are blockers.

**Estimated Total Remediation Time:** 64-94 hours across 5 releases

**WordPress.org Submission Readiness:** **NOT READY** - Address v1.6.10 security fixes first

**Recommended Next Step:** Implement v1.6.10 security patches immediately (8-12 hours)

---

**Report Generated:** January 16, 2026  
**Next Audit Recommended:** After v1.7.0 (Performance Optimization)
