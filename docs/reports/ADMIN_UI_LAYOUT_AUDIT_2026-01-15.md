# SubtleForms Admin UI + Layout Audit Report

**Date:** 2026-01-15  
**Plugin:** SubtleForms  
**Plugin Version (declared):** 1.5.0 (`subtleforms.php`)  
**Audit Mode:** Read-only code inspection (no refactors performed)

---

## 1) Scope (What I audited)

This report focuses on:

- Admin layout system (React `AdminShell`) and scroll/overflow contract
- Admin React pages/components that render inside the WP admin
- CSS architecture consistency (SCSS modules vs “utility class” usage)
- REST endpoints + settings data flow that affect the admin UI
- Captcha/settings backend inventory relevant to UI configuration

Out of scope (not fully re-audited here):

- Full WordPress.org security review (there is already `docs/reports/SECURITY_AUDIT.md`)
- Full DB schema review across repositories (only settings-related pieces verified)

---

## 2) Repo facts (Observed, not assumed)

- Plugin bootstrap: `subtleforms.php` declares `Version: 1.5.0` and defines `SUBTLEFORMS_VERSION = 1.5.0`.
- JS build tooling: `package.json` uses `@wordpress/scripts` to build `resources/admin/index.jsx` into `build/admin/admin.js`.
  - In this workspace snapshot, the `build/` directory is not present (not verified whether it’s gitignored or simply not built here).
- Runtime asset enqueue (PHP): `src/Admin/AdminMenu.php` enqueues:
  - `assets/css/admin.css`
  - `build/admin/index.jsx.css` (styles emitted by `@wordpress/scripts`)
  - `assets/css/admin-builder.css` (builder-only)
  - `build/admin/admin.js` (main React bundle)
- Tailwind dependency status:
  - `package.json` contains no `tailwindcss` dependency.
  - No `tailwind.config.*` found under the plugin directory.
  - Multiple React components contain Tailwind-like utility class strings (details in Sections 8 and 11).

---

## 3) Admin entrypoints (WP → React)

Verified mount + routing flow:

- Templates under `templates/admin/*.php` mount React into `#subtleforms-admin-app` and pass route config via `data-*` attributes.
- React reads those values via `resources/admin/app/routes.js` (`getRouteConfig()` reads `mount.dataset.page`, `mount.dataset.formId`, `mount.dataset.submissionId`).
- Route → component mapping is implemented in `resources/admin/app/AdminApp.jsx`.

Template → route → React page mapping (verified):

- `templates/admin/dashboard.php` → `data-page="dashboard"` → `DashboardPage`
- `templates/admin/forms-list.php` → `data-page="forms-list"` → `FormsPage`
- `templates/admin/form-editor.php` → `data-page="form-editor"` → `BuilderPage`
- `templates/admin/submissions-list.php` → `data-page` is dynamic (`$page`) → `SubmissionsPage` (both `submissions-list` and `submissions` render this page)
- `templates/admin/submission-detail.php` → `data-page="submission-detail"` → `SubmissionDetailPage`
- `templates/admin/settings.php` → `data-page="settings"` → `SettingsPage`
- `templates/admin/extensions.php` → `data-page="extensions"` → `ExtensionsPage`

---

## 4) `AdminShell` (Layout + scroll contract)

Files:

- `resources/admin/components/AdminShell.jsx`
- `resources/admin/components/AdminShell.scss`

Observed intent (from SCSS + component structure):

- The shell is intended to own the viewport: it sets a container height using WP admin bar height:
  - `calc(100vh - var(--wp-admin--admin-bar--height, 32px))`
- Scroll is intended to happen inside the shell, not on the document:
  - `.sf-admin-shell__content-inner { overflow-y: auto; }`
- The stylesheet attempts to prevent document scrolling:
  - `html, body.admin-color-fresh { overflow: hidden !important; }`

Risk/notes:

- The `overflow: hidden !important` applied to `html` and a specific WP body class (`body.admin-color-fresh`) is fragile across WP admin color schemes.
  - If the admin body does not have `admin-color-fresh`, body scrolling may reappear.

---

## 5) Page coverage (Do pages use `AdminShell`?)

Observed `AdminShell` usage (verified in `resources/admin/pages/*.jsx`):

- `resources/admin/pages/DashboardPage.jsx`
- `resources/admin/pages/FormsPage.jsx`
- `resources/admin/pages/SubmissionsPage.jsx`
- `resources/admin/pages/SubmissionDetailPage.jsx`
- `resources/admin/pages/ExtensionsPage.jsx`
- `resources/admin/pages/SettingsPage.jsx`
- `resources/admin/pages/BuilderPage.jsx` (builder)

---

## 6) Scroll contract status (Builder vs non-builder)

Observed contract design:

- Non-builder pages should scroll within `.sf-admin-shell__content-inner`.
- Builder is a special multi-pane UI (dock/canvas/inspector) and should not be disturbed.

Known failure mode (from prior work context):

- Some non-builder pages previously passed `noScroll={true}` and effectively disabled the main scroll region.

Verified `noScroll` usage:

- Only `resources/admin/pages/BuilderPage.jsx` passes `noScroll={true}` to `AdminShell`.
- Non-builder pages do not pass `noScroll`, so they are expected to use the default scroll behavior (`.sf-admin-shell__content-inner`).

---

## 7) CSS naming and prefix rules (What the code actually does)

There are three naming “systems” in active use:

1. `subtleforms-*` classes (example: `.subtleforms-dashboard-list-item`)
2. `sf-*` prefixed BEM-ish classes (example: `.sf-admin-shell__content-inner`, `.sf-dashboard-page__content`)
3. Unprefixed classes (example: `.item-content`, `.item-title`, `.status-badge`, `.onboarding-wizard__...`)

This is not inherently wrong, but it _is_ inconsistent and causes real breakage when SCSS expects one naming system and JSX renders another.

---

## 8) “Utility class” usage (Tailwind-like strings without Tailwind)

Multiple JSX files contain Tailwind-like utility strings (prefixed with `sf-`, and also some unprefixed) such as:

- `sf-mb-2`, `sf-text-gray-600`, `sf-space-y-6`, `sf-border-gray-200`, `sf-bg-blue-50`
- Variant-like tokens such as `hover:sf-border-blue-500`, `hover:sf-shadow-md`
- Some **non-`sf-`** tokens exist as well (example: `bg-blue-600 text-white` in `OnboardingWizard.jsx`)

Concrete occurrences:

- `resources/admin/components/BuilderTour.jsx` uses `sf-mb-2 sf-text-gray-600 ...`
- `resources/admin/components/OnboardingWizard.jsx` uses many `sf-*` utilities and also `bg-blue-600 text-white`
- `resources/admin/components/builder/layout/BuilderHeaderBar.jsx` contains conditional class strings like:
  - `sf-text-gray-700 sf-bg-gray-50 sf-border ... hover:sf-border-blue-500`

What I verified:

- Searching SCSS/CSS under `resources/admin/**` for `.sf-mb-2` found **no definitions**.
- `package.json` has **no Tailwind dependency**, and no Tailwind config was found.

Conclusion (based on evidence above):

- These utility classes are very likely **dead / non-functional styling** unless there is an external stylesheet not present in this workspace snapshot.
- The presence of `hover:`-prefixed tokens strongly suggests these were authored for Tailwind (or a Tailwind-like compiler) at some point.

---

## 9) Inline styles (violations + risk)

Observed:

- Inline styles are not isolated to one component. A repo-wide search of `resources/admin/**/*.jsx` shows multiple `style={{ ... }}` usages across pages and components.
- Examples include inline layout in `resources/admin/pages/SubmissionsPage.jsx`, table formatting in `resources/admin/pages/SubmissionDetailPage.jsx`, overlay positioning in `resources/admin/components/BuilderTour.jsx`, and multiple builder components.

Additional note (frontend rendering, not admin UI but same style policy impact):

- `src/Engine/SpamProtection.php` generates honeypot HTML with an inline `style="position:absolute;left:-9999px;..."`.

Risk:

- Inline styles bypass the SCSS architecture and make global layout refactors harder.

---

## 10) Dashboard page: confirmed SCSS/JSX class mismatch

Files:

- `resources/admin/pages/DashboardPage.jsx`
- `resources/admin/pages/DashboardPage.scss`

Concrete mismatch examples (verified by direct inspection):

- JSX renders:
  - `className='item-content'`, `className='item-title'`, `className='item-meta'`, `className='status-badge ...'`
- SCSS defines styles for:
  - `.sf-item-content`, `.sf-item-title`, `.sf-item-meta`, `.sf-status-badge...`

Impact:

- Those SCSS rules will **not apply** to the rendered elements, so Dashboard list items/badges will not be styled as intended.

Additional inconsistency (within the SCSS file itself):

- The responsive section references `.item-meta` (unprefixed), while the main “List Items” section defines `.sf-item-meta`.

---

## 11) Onboarding wizard: confirmed SCSS/JSX class mismatch + utility strings

Files:

- `resources/admin/components/OnboardingWizard.jsx`
- `resources/admin/components/OnboardingWizard.scss`

Observed mismatch:

- JSX wrapper uses `className='onboarding-wizard'` and many `onboarding-wizard__*` BEM classes.
- SCSS defines `.sf-onboarding-wizard` and nested BEM selectors (e.g. `&__progress`, `&__option`).

Impact:

- The majority of SCSS rules in `OnboardingWizard.scss` will **not apply** to the JSX markup as written.

Additional issues:

- JSX contains many Tailwind-like utility strings (`sf-space-y-6`, etc.) with no verified CSS definitions in `resources/admin/**/*.scss`.
- JSX includes unprefixed utilities `bg-blue-600 text-white` which also have no verified CSS definitions.

---

## 12) Builder header bar: BEM SCSS exists, but JSX uses utility strings

File evidence:

- `resources/admin/components/builder/layout/BuilderHeaderBar.scss` defines `.sf-builder-header-bar__*` BEM styles.
- `resources/admin/components/builder/layout/BuilderHeaderBar.jsx` contains conditional class strings with many `sf-*` utility tokens (and `hover:` variants).

Risk:

- The builder may be relying on undefined utility styling in some states.
- Any “don’t touch builder” constraint becomes harder to satisfy if styling is split across BEM SCSS and non-existent utility classes.

---

## 13) REST API: Settings endpoints (verified)

Files:

- `src/Api/SettingsApi.php`
- `src/Api/RestController.php` (main API surface)

Settings routes (verified):

- `GET /wp-json/subtleforms/v1/settings`
- `PUT /wp-json/subtleforms/v1/settings` (with request args schema)
- `POST /wp-json/subtleforms/v1/settings/reset`

Settings permission model (verified):

- All settings routes use `permission_callback => checkPermissions()`
- `checkPermissions()` returns `current_user_can('manage_options')`

Main REST permission model (verified):

- `src/Api/RestController.php` uses `check_read_permission()` and `check_write_permission()` on most admin endpoints.
- Both permission checks require:
  - `is_user_logged_in()`
  - `current_user_can('manage_options')`
  - feature gate allow-list via `$this->gate->allows('api.read')` or `$this->gate->allows('api.write')`

Public REST endpoints (verified):

- `GET /wp-json/subtleforms/v1/forms/{id}/schema` uses `permission_callback => __return_true`.
  - The handler enforces policy internally: unauthenticated requests only receive active schema for **published** forms; otherwise it returns 404-style errors.
- `POST /wp-json/subtleforms/v1/submit` uses `permission_callback => __return_true`.
  - The handler performs spam checks (honeypot/time trap) and optionally CAPTCHA verification.

### Public endpoints threat model (focus: `POST /submit`)

Primary abuse risks:

- **High-volume spam / bot submissions**: drives DB growth, notification floods, and admin workload.
- **Resource exhaustion**: large payloads or high request rates can increase PHP/DB load and impact site availability.
- **Bypass attempts**: attackers will try to evade honeypots/time traps and, if enabled, CAPTCHA.
- **Malicious payload content**: submissions may include HTML/JS strings intended to cause stored XSS when rendered in WP admin (or in notification emails).

Observed mitigations already present in code:

- **Spam checks**: `src/Engine/SpamProtection.php` provides honeypot + minimum-time (“time trap”) style protection and is invoked in the submit flow.
- **CAPTCHA (optional)**: `src/Support/Captcha/CaptchaManager.php` verification is invoked by the submit endpoint when enabled/configured.
- **Schema-aware behavior**: schema is loaded for the form during submission handling, which is a natural place to constrain accepted fields to the schema (verify implementation details when hardening).

Mitigations recommended (no refactor performed; audit-only):

- **Rate limiting / throttling** (highest value): add per-IP and per-form throttling at one of these layers:
  - edge/proxy (Cloudflare/WAF),
  - server (nginx/Apache rate limiting), or
  - WordPress (transients/object cache keyed by IP + form_id).
- **Payload size + field limits**: enforce max request size and per-field size limits; reject oversized arrays/strings early to protect PHP memory and DB.
- **Strict schema validation**: reject unknown fields and unexpected types; normalize and validate inputs server-side even if the client validates.
- **Output escaping discipline**: ensure all submission values are escaped on render in WP admin and sanitized/escaped in outbound emails/logs to prevent stored XSS and HTML injection.

---

## 14) Settings data model (option + validation)

Files:

- `src/Support/Settings.php` (defaults + validation rules)

Verified storage:

- Settings appear to be stored in an option named `subtleforms_settings` (as used by the Settings support class).

Verified feature areas present in defaults/validation (partial list; based on prior file inspection context):

- Autosave enable/interval
- Submission limits
- Spam protection (honeypot + minimum submission time)
- Captcha provider configuration (keys/provider selection)

Verified settings usage (evidence of keys being read at runtime):

- `src/Engine/SpamProtection.php` reads `subtleforms_settings['enable_honeypot']`.
- `src/Engine/Actions/EmailAction.php` reads `subtleforms_settings['debug_mode']`.
- `src/Support/Captcha/CaptchaManager.php` reads settings via `Settings` getters (`captcha_enabled`, `captcha_provider`, provider keys).
- Provider classes (`src/Support/Captcha/*.php`) also directly read `subtleforms_settings` to detect presence of required keys.
- `src/Privacy/PrivacyManager.php` reads `data_retention_days` (via `Settings`) and runs retention cleanup on cron.

Other persistent plugin options / scheduled events (verified):

- Activation (`src/Activator.php`) creates custom DB tables (`{$wpdb->prefix}subtleforms_forms`, `{$wpdb->prefix}subtleforms_submissions`, `{$wpdb->prefix}subtleforms_form_schemas`, `{$wpdb->prefix}subtleforms_logs`) and writes options including `subtleforms_db_version` and `subtleforms_activated_at` (and `subtleforms_activation_error` when needed).
- Deactivation (`src/Deactivator.php`) writes `subtleforms_deactivated_at` and unschedules the daily cleanup event.
- Cron event: `subtleforms_daily_cleanup`.

---

## 15) Captcha system inventory (partial, verified by structure)

Observed structure and wiring (verified):

- Providers: `src/Support/Captcha/RecaptchaProvider.php`, `HCaptchaProvider.php`, `TurnstileProvider.php`.
- Manager: `src/Support/Captcha/CaptchaManager.php` selects provider based on `subtleforms_settings`.
- Frontend schema injection: `src/Api/RestController.php` injects provider HTML into schema fields of type `captcha` for public schema reads.
- Submission verification: `src/Api/RestController.php` verifies CAPTCHA on the public submit endpoint when enabled and configured.

---

## 16) WordPress.org readiness risks (Admin UI specific)

These are risks specifically from the admin UI/layout/code style perspective:

- **Broken styling due to SCSS/JSX class mismatches** (Dashboard, Onboarding Wizard). This is not a security issue, but it affects user perception and can be flagged as poor UX/quality.
- **Undefined utility classes**: numerous `sf-*` “utility” tokens exist without Tailwind/tooling to generate them.
- **Inline styles**: at least one inline style exists in `OnboardingWizard.jsx`.
- **Body class coupling**: scroll lock targets `body.admin-color-fresh`; other admin color schemes may behave differently.
- **Backup files present**: `.bak` files exist inside the plugin directory (examples include `src/Api/*.php.bak`, `src/Support/Settings.php.bak`, and `assets/css/*.css.bak`). These are typically not acceptable in production distributions and can increase reviewer scrutiny.
- **Asset build expectations vs workspace snapshot**: PHP enqueues `build/admin/index.jsx.css` and `build/admin/admin.js`, but `build/` was not present in this workspace snapshot; if missing in distribution/runtime, the admin UI will break.

---

## 17) Priority recommendations (Actionable, ordered)

P0 (likely user-visible breakage):

- Standardize class naming for Dashboard list items and badges: make JSX match SCSS (or vice versa).
- Standardize OnboardingWizard markup to match `OnboardingWizard.scss` BEM (`sf-onboarding-wizard__*`) OR refactor SCSS to match the existing `onboarding-wizard__*` markup.

P1 (architecture consistency):

- Decide whether “utility classes” are supported. If yes: add the missing generator/tooling + compiled CSS. If no: remove/replace utility strings with SCSS-backed classes.

P2 (scroll robustness):

- Replace `body.admin-color-fresh` coupling with a selector that applies across WP admin color schemes (verify compatibility carefully).

---

System understanding complete.
