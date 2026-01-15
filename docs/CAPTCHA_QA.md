# CAPTCHA System QA Checklist

## Phase 1: Core Architecture ✅

### Provider System
- [x] CaptchaProviderInterface defined with all required methods
- [x] RecaptchaProvider supports v2 and v3
- [x] HCaptchaProvider implemented
- [x] TurnstileProvider implemented
- [x] CaptchaManager registered as singleton in Container
- [x] All providers self-contained and config-driven

### Extensibility
- [x] Custom providers can be registered via `subtleforms_captcha_providers` filter
- [x] Provider config can be modified via `subtleforms_captcha_provider_config` filter

---

## Phase 2: Admin Settings UI ✅

### Settings Structure
- [x] `captcha_enabled` boolean toggle
- [x] `captcha_provider` dropdown (recaptcha, hcaptcha, turnstile)
- [x] Provider-specific fields conditionally rendered
- [x] Site Key and Secret Key fields for each provider
- [x] reCAPTCHA version selector (v2/v3)
- [x] All settings validated and sanitized
- [x] Helper text with links to provider dashboards

### Settings Storage
- [x] Settings stored in `subtleforms_settings` option
- [x] Default values defined in `Settings::DEFAULTS`
- [x] Validation rules defined in `Settings::VALIDATION_RULES`
- [x] Boolean normalization in React for `captcha_enabled`

---

## Phase 3: Builder Integration ✅

### Field Type
- [x] CAPTCHA field registered in `CoreFields`
- [x] Category: `advanced`
- [x] Icon: `dashicons-shield`
- [x] Kind: `system`
- [x] Minimal inspector controls (info notice only)

### Field Availability
- [x] CAPTCHA field hidden if not enabled in settings
- [x] CAPTCHA field hidden if provider not configured
- [x] Settings fetched in `useBuilderBoot` to determine availability

### Duplicate Prevention
- [x] Only one CAPTCHA field allowed per form
- [x] Duplicate check in `handleDockAdd` (when adding from palette)
- [x] Duplicate check in `handleDuplicate` (when duplicating field)
- [x] Alert messages shown to user when duplicate attempted

---

## Phase 4: Frontend Rendering & Validation ✅

### Script Enqueuing
- [x] Provider script enqueued only if CAPTCHA enabled AND configured
- [x] Script URL retrieved from provider's `getScriptUrl()` method
- [x] No scripts loaded if CAPTCHA disabled

### Widget Rendering
- [x] CAPTCHA HTML injected into schema via `injectCaptchaHtml()`
- [x] HTML rendered in `FieldRenderer` via `dangerouslySetInnerHTML`
- [x] Recursive field processing for containers and columns
- [x] Widget only rendered for frontend (unauthenticated) requests

### Submission Validation
- [x] CAPTCHA verified in `submit_form` before processing
- [x] Verification happens after spam protection check
- [x] Response token extracted from request payload
- [x] Provider-specific field names handled (`g-recaptcha-response`, `h-captcha-response`, `cf-turnstile-response`)
- [x] Verification failures return WP_Error with user-friendly message
- [x] Verification skipped if CAPTCHA disabled

---

## Phase 5: Security & Fallbacks ✅

### Error Handling
- [x] No fatal errors if provider misconfigured
- [x] Empty HTML returned if provider not configured
- [x] Graceful degradation if verification API fails
- [x] Client IP retrieved safely with fallbacks

### Filters & Hooks
- [x] `subtleforms_captcha_enabled` - Enable/disable CAPTCHA programmatically
- [x] `subtleforms_captcha_provider` - Override active provider
- [x] `subtleforms_captcha_providers` - Register custom providers
- [x] `subtleforms_captcha_provider_config` - Modify provider configuration

### Best Practices
- [x] No external PHP libraries added
- [x] No Tailwind CSS used
- [x] Providers not hardcoded (extensible via filters)
- [x] WordPress coding standards followed
- [x] Existing settings/builder patterns used
- [x] One CAPTCHA field per form enforced

---

## Manual Testing Checklist

### Admin Configuration
- [ ] Navigate to SubtleForms → Settings
- [ ] Enable CAPTCHA toggle
- [ ] Select Google reCAPTCHA provider
- [ ] Enter valid Site Key and Secret Key
- [ ] Choose v2 or v3 version
- [ ] Save settings
- [ ] Verify settings persist after page reload

### Builder Integration
- [ ] Create new form
- [ ] Open Fields panel
- [ ] Verify CAPTCHA field visible in "Advanced" category
- [ ] Add CAPTCHA field to form
- [ ] Attempt to add second CAPTCHA field → should show alert
- [ ] Attempt to duplicate CAPTCHA field → should show alert
- [ ] Save form and publish

### Frontend Rendering
- [ ] View published form on frontend
- [ ] Verify CAPTCHA widget renders correctly
- [ ] Check browser console for script load errors
- [ ] Verify provider script (e.g., recaptcha/api.js) loaded

### Submission Validation
- [ ] Fill out form without completing CAPTCHA
- [ ] Submit → should show error
- [ ] Complete CAPTCHA challenge
- [ ] Submit → should succeed
- [ ] Check submissions list to verify entry created

### Provider Switching
- [ ] Change provider to hCaptcha in settings
- [ ] Enter hCaptcha keys
- [ ] Reload frontend form
- [ ] Verify hCaptcha widget renders
- [ ] Submit form → should validate with hCaptcha

### Disable Scenario
- [ ] Disable CAPTCHA in settings
- [ ] Reload frontend form
- [ ] Verify CAPTCHA widget NOT rendered
- [ ] Verify provider script NOT loaded
- [ ] Submit form → should succeed without CAPTCHA

### Misconfiguration Scenario
- [ ] Enable CAPTCHA but leave keys empty
- [ ] Reload builder
- [ ] Verify CAPTCHA field NOT visible in palette
- [ ] Reload frontend form
- [ ] Verify no CAPTCHA widget rendered
- [ ] Verify no JS errors in console

---

## Git Commits

1. ✅ `Core: introduce extensible CAPTCHA provider system` (e58df52)
2. ✅ `Admin: add CAPTCHA provider configuration settings` (39f5e26)
3. ✅ `Builder: integrate CAPTCHA field with provider awareness` (da63d51)
4. ✅ `Frontend: render and validate CAPTCHA on form submission` (9c778ac)

---

## WordPress.org Compliance

- [x] No external libraries added
- [x] All strings translatable with `__()` and text domain `subtleforms`
- [x] Settings stored in wp_options
- [x] REST API used for configuration
- [x] No security vulnerabilities introduced
- [x] Graceful fallbacks for all error states
- [x] Clean, documented code following WP standards

---

## Future Enhancements (Out of Scope)

- Custom CAPTCHA threshold for reCAPTCHA v3
- Per-form CAPTCHA override
- CAPTCHA skip for logged-in users (via filter)
- Analytics/reporting for CAPTCHA failures
- Additional providers (Friendly Captcha, etc.)
