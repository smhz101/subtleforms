# SubtleForms Status Report (Current State)

## 0. Environment & Build
**Current Behavior**
- Plugin version 1.5.0 declared in [subtleforms.php](subtleforms.php) and [package.json](package.json); PHP requirement 7.4+ and WordPress 5.0+ enforced on activation in [src/Activator.php](src/Activator.php).
- Admin build uses Tailwind 4.1.18 and `@wordpress/scripts`; primary bundles built to `build/admin/admin.js` and CSS outputs `build/admin/tailwind.css`, `build/admin/index.jsx.css` (from scripts in [package.json](package.json)).

**Data Flow / Call Flow**
- `npm run build` compiles Tailwind then `wp-scripts` for admin; `npm run build:frontend` builds frontend renderer; block builds via `npm run build:block` and `npm run build:subtleforms-block`.
- PHP autoload via Composer PSR-4 `SubtleForms\` mapped to `src/` in [composer.json](composer.json).

**State & Storage**
- Build artifacts emitted to `build/admin`, `build/frontend`, `build/blocks/form`, `build/blocks/subtleforms-form`.
- Plugin constants `SUBTLEFORMS_VERSION`, paths/URLs set in [subtleforms.php](subtleforms.php).

**Endpoints / Contracts**
- REST base namespace `subtleforms/v1` defined in [src/Api/RestController.php](src/Api/RestController.php#L1-L280).

**UI/UX Notes**
- Admin assets enqueued only on SubtleForms pages; Tailwind-scoped styles plus component CSS in [src/Admin/AdminMenu.php](src/Admin/AdminMenu.php#L86-L214).

**Known Issues / Observed Bugs**
- None observed in build scripts or versioning.

## 1. Plugin Overview
**Current Behavior**
- Logic-first form builder with admin SPA bundles and frontend React renderer; shortcode `[subtleforms id="…"]` and Gutenberg blocks to embed published forms.
- Admin menu pages: Dashboard, All Forms, Add New Form (builder), Submissions, Extensions, Settings defined in [src/Admin/AdminMenu.php](src/Admin/AdminMenu.php#L52-L144).

**Data Flow / Call Flow**
- Plugin bootstrap in [subtleforms.php](subtleforms.php) loads [src/load.php](src/load.php) which requires core classes, registers shortcode and REST controller, and hooks activation/deactivation.
- Admin routes serve React pages rendered inside `AdminShell` components (e.g., [resources/admin/pages/FormsPage.jsx](resources/admin/pages/FormsPage.jsx) and [BuilderPage.jsx](resources/admin/pages/BuilderPage.jsx)).

**State & Storage**
- Builder state managed by FSM reducer [resources/admin/hooks/useBuilderReducer.js](resources/admin/hooks/useBuilderReducer.js) with states INIT→PUBLISHED.
- Settings stored in `subtleforms_settings` option via [src/Support/Settings.php](src/Support/Settings.php) (autoloaded in load.php).

**Endpoints / Contracts**
- REST endpoints registered in [src/Api/RestController.php](src/Api/RestController.php#L93-L247) plus settings/dashboard routes in [src/Api/SettingsApi.php](src/Api/SettingsApi.php#L23-L75) and [src/Api/DashboardApi.php](src/Api/DashboardApi.php#L31-L63).

**UI/UX Notes**
- Admin UI uses Tailwind utility classes and `@wordpress/components`; builder uses editable title, autosave, undo/redo, preview/publish flows.

**Known Issues / Observed Bugs**
- None noted at overview level.

## 2. Data Model & Database
**Current Behavior**
- Tables created in [src/Activator.php](src/Activator.php#L40-L145):
  - `subtleforms_forms(id, title, config JSON, draft_schema JSON, active_version, status, created_at, updated_at)`
  - `subtleforms_submissions(id, form_id, schema_version, payload JSON, meta JSON, status, ip_address, user_agent, created_at)`
  - `subtleforms_form_schemas(id, form_id, version, schema_data JSON, active, created_at)`
  - `subtleforms_logs(id, submission_id, level, message, context JSON, created_at)`

**Data Flow / Call Flow**
- Form lifecycle: forms stored in `subtleforms_forms`; schema versions in `subtleforms_form_schemas`; draft schema kept in `forms.draft_schema`; active_version points to current published schema.
- Submissions reference `form_id` and `schema_version`; logs reference `submission_id`.

**State & Storage**
- Repositories decode JSON fields on read: [FormsRepository::find](src/Repositories/FormsRepository.php#L40-L75) and [SubmissionsRepository::find](src/Repositories/SubmissionsRepository.php#L28-L63).
- Default options persisted in activation ([src/Activator.php](src/Activator.php#L150-L185)).

**Endpoints / Contracts**
- Schema persistence via REST `POST /forms/{id}/schema` saving to draft or version ([src/Api/RestController.php](src/Api/RestController.php#L332-L410)).

**UI/UX Notes**
- Admin tables show submission counts/unread counts fetched via REST (see [src/Api/RestController.php](src/Api/RestController.php#L292-L318)).

**Known Issues / Observed Bugs**
- None observed in schema/table definitions.

### Code Excerpt: Table Creation (20 lines)
```
// src/Activator.php
$forms_sql = "CREATE TABLE {$forms_table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  title varchar(255) NOT NULL,
  config longtext NOT NULL,
  draft_schema longtext DEFAULT NULL,
  active_version int unsigned DEFAULT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY  (id),
  KEY status (status)
) {$charset_collate};";
```

## 3. REST API Inventory
**Current Behavior**
- Namespace `subtleforms/v1`; routes registered in [src/Api/RestController.php](src/Api/RestController.php#L93-L247).

**Data Flow / Call Flow**
- Forms CRUD: `GET/POST /forms`, `GET/PUT/DELETE /forms/{id}`.
- Schema: `GET/POST /forms/{id}/schema` with public GET for published active schemas; authenticated builder can request draft via `context=builder`.
- Submissions: `GET /forms/{id}/submissions`, global `GET /submissions`, `GET/PUT /submissions/{id}`, `GET /submissions/{id}/adjacent`, `GET /submissions/{id}/logs`, `GET /submissions/unread-count`.
- Public submit: `POST /submit` stores submission, compiles schema, runs pipeline, sets status (processing→saved→completed or payment_pending).
- Fields catalog: `GET /fields` returns registry definitions (grouped when `grouped=true`).
- Onboarding/Create-wizard/Tour per-user flags: POST/GET endpoints under `/onboarding/*`, `/create-wizard/*`, `/tour/*`.
- Settings: `GET/PUT /settings`, `POST /settings/reset` in [src/Api/SettingsApi.php](src/Api/SettingsApi.php#L23-L75).
- Dashboard: `GET /dashboard` aggregates stats in [src/Api/DashboardApi.php](src/Api/DashboardApi.php#L31-L95).

**State & Storage**
- Permissions via `check_read_permission`/`check_write_permission` requiring logged-in user with `manage_options` and feature gate checks ([src/Api/RestController.php](src/Api/RestController.php#L1070-L1112)).
- Submission statuses transition via pipeline; unread auto-marked read on detail fetch ([src/Api/RestController.php](src/Api/RestController.php#L740-L775)).

**Endpoints / Contracts**
- Schema save contract: JSON `{schema, activate}`; activate triggers validation via SchemaValidator ([src/Api/RestController.php](src/Api/RestController.php#L362-L410)).
- Submit payload: JSON `{form_id, data}`; response `{success, submission_id}` or WP_Error with codes `validation_failed`, `pipeline_failed`, etc. ([src/Api/RestController.php](src/Api/RestController.php#L840-L990)).

**UI/UX Notes**
- Public GET schema allows frontend render without auth; unpublished forms return 404.

**Known Issues / Observed Bugs**
- None observed in route wiring.

### Code Excerpt: REST Route Registration (23 lines)
```
// src/Api/RestController.php
register_rest_route(self::NAMESPACE, '/forms', [
    ['methods' => 'GET','callback' => [$this, 'get_forms'],'permission_callback' => [$this, 'check_read_permission']],
    ['methods' => 'POST','callback' => [$this, 'create_form'],'permission_callback' => [$this, 'check_write_permission']],
]);
register_rest_route(self::NAMESPACE, '/forms/(?P<id>\d+)', [
    ['methods' => 'GET','callback' => [$this, 'get_form'],'permission_callback' => [$this, 'check_read_permission']],
    ['methods' => 'PUT','callback' => [$this, 'update_form'],'permission_callback' => [$this, 'check_write_permission']],
    ['methods' => 'DELETE','callback' => [$this, 'delete_form'],'permission_callback' => [$this, 'check_write_permission']],
]);
register_rest_route(self::NAMESPACE, '/forms/(?P<id>\d+)/schema', [
    ['methods' => 'GET','callback' => [$this, 'get_form_schema'],'permission_callback' => '__return_true'],
    ['methods' => 'POST','callback' => [$this, 'save_form_schema'],'permission_callback' => [$this, 'check_write_permission']],
]);
```

## 4. Admin UI
### 4.1 Builder
**Current Behavior**
- Entry screen `admin.php?page=subtleforms-new-form` loads [resources/admin/pages/BuilderPage.jsx](resources/admin/pages/BuilderPage.jsx); editable title, schema editing, preview/publish actions.
- FSM-driven state via [useBuilderReducer](resources/admin/hooks/useBuilderReducer.js) with autosave hook [useDraftAutosave](resources/admin/hooks/useDraftAutosave.js) (debounce 500ms, max 3 retries, force autosave available).
- Draft schema saved via REST `POST /forms/{id}/schema` activate=false; publish promotes draft to active (server-side promotion in [update_form](src/Api/RestController.php#L412-L520)).

**Data Flow / Call Flow**
- Load: INIT_BUILDER → fetch form + draft schema via `GET /forms/{id}/schema?context=builder` → LOAD_SUCCESS sets state and `formTitle` ([useBuilderReducer](resources/admin/hooks/useBuilderReducer.js#L55-L110)).
- Edits dispatch `EDIT_SCHEMA` storing draft and pushing undo/redo history; autosave transitions DIRTY→AUTOSAVING→SAVED in reducer.
- Title edits call `persistTitle` updating schema metadata and API `PUT /forms/{id}` for top-level title, then force autosave (in [BuilderPage.jsx](resources/admin/pages/BuilderPage.jsx#L440-L480)).
- Publish triggers `PUT /forms/{id}` status=published; server validates active schema and promotes draft if present ([src/Api/RestController.php](src/Api/RestController.php#L412-L520)).

**State & Storage**
- Local state: `builderState` (schema, formTitle, history, validationErrors, flags). Draft schema persisted to `forms.draft_schema`; active versions stored in `subtleforms_form_schemas`.

**Endpoints / Contracts**
- Autosave: `POST /forms/{id}/schema` with `{schema, activate:false}`.
- Publish/manual save: `POST /forms/{id}/schema` with `{activate:true}` plus `PUT /forms/{id}` for status updates.

**UI/UX Notes**
- Undo/redo supported (schemaHistoryPast/Future). Title input in header supports Enter/Escape and blur save. Validation errors surfaced via reducer `validationErrors` list.

**Known Issues / Observed Bugs**
- None observed in builder logic; payment validation delegated to backend during publish.

### 4.2 Forms List / Management
**Current Behavior**
- [resources/admin/pages/FormsPage.jsx](resources/admin/pages/FormsPage.jsx) loads onboarding wizard if no forms; displays tabs (All/Published/Draft) with search.
- [resources/admin/components/FormsList.jsx](resources/admin/components/FormsList.jsx) renders table with sort, pagination, bulk selection, status update modal, delete modal, shortcode copy, submission counts/unread badges, form type/status chips.

**Data Flow / Call Flow**
- Fetch forms via `GET /forms` with query params; submission counts and unread counts are included server-side ([src/Api/RestController.php](src/Api/RestController.php#L292-L318)).
- Actions: delete via `DELETE /forms/{id}`, status change via `PUT /forms/{id}`, duplicate handled in AdminMenu actions (render path not in FormsList).

**State & Storage**
- Client-side pagination state (`currentPage`, `perPage`), sorting, filters; server responds with total counts via REST headers.

**Endpoints / Contracts**
- Uses REST `forms` endpoints with nonce headers.

**UI/UX Notes**
- Copy shortcode button uses clipboard API; new form button links to builder. Status badges color-coded.

**Known Issues / Observed Bugs**
- None observed in list behavior.

### 4.3 Submissions Admin
**Current Behavior**
- List view [resources/admin/pages/SubmissionsPage.jsx](resources/admin/pages/SubmissionsPage.jsx) with tabs (All/Unread/Read), search, optional filters (form, date range), and real-time polling badge.
- Detail view [resources/admin/pages/SubmissionDetailPage.jsx](resources/admin/pages/SubmissionDetailPage.jsx) shows payload, meta, logs, adjacent navigation, status toggle (unread/read), options to show empty/technical fields.

**Data Flow / Call Flow**
- Polling hook [useRealTimeUpdates](resources/admin/hooks/useRealTimeUpdates.js) refreshes unread count and table via REST `submissions/unread-count` and triggers refetch callbacks.
- Detail fetch uses `GET /submissions/{id}`, `GET /submissions/{id}/logs`, and `GET /submissions/{id}/adjacent` (with optional form_id filter). Status updates via `PUT /submissions/{id}`.
- List fetch uses `GET /submissions` with filters for status, search, form_id.

**State & Storage**
- Client state holds filters and selection; unread count stored per repository in backend table `subtleforms_submissions.status`.

**Endpoints / Contracts**
- All submission endpoints require authenticated admin (`manage_options` capability) as enforced in permission callbacks.

**UI/UX Notes**
- Badge updates document title with unread counts; detail page auto-marks unread submissions as read server-side on fetch ([src/Api/RestController.php](src/Api/RestController.php#L740-L775)).

**Known Issues / Observed Bugs**
- None observed; unread-to-read side effect on viewing is intentional.

## 5. Frontend Rendering
### 5.1 Shortcode Rendering
**Current Behavior**
- Shortcode `[subtleforms id="X"]` registered in [src/Frontend/Shortcode.php](src/Frontend/Shortcode.php); renders container `<div data-form-id>` and enqueues frontend JS/CSS.

**Data Flow / Call Flow**
- Fetches form by ID via [FormsRepository::find](src/Repositories/FormsRepository.php#L40-L75); blocks unpublished forms with message.
- Frontend JS auto-mounts React renderer targeting containers ([resources/frontend/index.jsx](resources/frontend/index.jsx)).

**State & Storage**
- No cookies/session; renderer fetches schema via REST `GET /forms/{id}/schema` (public, active only) in [FormRenderer](resources/frontend/components/FormRenderer.jsx#L15-L74).

**Endpoints / Contracts**
- Public GET for active schema; errors show "Form not found" or "not published" messages.

**UI/UX Notes**
- Container-only markup; hydration handled client-side.

**Known Issues / Observed Bugs**
- None observed.

### 5.2 Block Rendering (Gutenberg)
**Current Behavior**
- Blocks registered server-side in [src/Blocks/SubtleFormsBlock.php](src/Blocks/SubtleFormsBlock.php) (subtleforms/form) and [src/Blocks/SubtleFormsFormBlock.php](src/Blocks/SubtleFormsFormBlock.php).
- Render callback outputs minimal container with data-form-id; ensures published status before rendering.

**Data Flow / Call Flow**
- Editor assets enqueue frontend renderer for live preview ([src/Blocks/SubtleFormsBlock.php](src/Blocks/SubtleFormsBlock.php#L82-L130)).

**State & Storage**
- Block attributes include `formId`; no additional state.

**Endpoints / Contracts**
- Frontend renderer uses same schema fetch as shortcode; localized REST config provided in enqueue methods.

**UI/UX Notes**
- Editor shows warning box if form unavailable/unpublished; frontend silent fail.

**Known Issues / Observed Bugs**
- None observed.

### 5.3 React Renderer Details
**Current Behavior**
- Main renderer [resources/frontend/components/FormRenderer.jsx](resources/frontend/components/FormRenderer.jsx) loads schema, detects form type (regular/multistep/conversational/payment), and renders steps or conversational flow.
- Conversational mode handled by [resources/frontend/components/ConversationalFormRenderer.jsx](resources/frontend/components/ConversationalFormRenderer.jsx) showing one field at a time with review/payment steps.
- Field rendering in [resources/frontend/components/FieldRenderer.jsx](resources/frontend/components/FieldRenderer.jsx) covers text/email/url/number/phone, textarea, checkbox, radio/multiple_choice, select/dropdown, hidden, payment_amount/summary/coupon, column and group containers.

**Data Flow / Call Flow**
- Schema fetch: `GET /forms/{id}/schema` then set `schema` state; submission via `POST /submit` with flattened payload paths.
- Multistep: steps determined by explicit `step` fields or groups; navigation via [StepNavigation](resources/frontend/components/StepNavigation.jsx).
- Conditional logic: both FormRenderer and Conversational evaluate `field.config.conditions` to hide/show fields.

**State & Storage**
- Local state tracks `values`, `validationErrors`, `currentStepIndex`, `submitting/submitted`; no persistent storage.

**Endpoints / Contracts**
- Submit uses public REST without nonce; expects `{success:true, submission_id}` or WP_Error codes handled by client.

**UI/UX Notes**
- Conversational Enter key advances unless textarea; progress percentage computed from visible fields; payment forms expose placeholder payment steps but gateway handled server-side via hook.

**Known Issues / Observed Bugs**
- None observed; payment processing depends on external extension via `subtleforms_payment_required` hook.

### Code Excerpt: Auto-mount (18 lines)
```
// resources/frontend/index.jsx
const shortcodeContainers = document.querySelectorAll('.subtleforms-form-container');
shortcodeContainers.forEach((container) => {
  const formId = parseInt(container.dataset.formId, 10);
  if (formId) {
    mount(container, { formId });
  }
});
const blockContainers = document.querySelectorAll('.subtleforms-block');
blockContainers.forEach((container) => {
  const formId = parseInt(container.dataset.formId, 10);
  if (formId) {
    mount(container, { formId });
  }
});
```

## 6. Submission Pipeline (Backend)
**Current Behavior**
- Public submission handled in [src/Api/RestController.php](src/Api/RestController.php#L840-L990): loads active schema, inserts submission with status `processing`, compiles schema via `SchemaCompiler`, runs `Pipeline`, updates status to `completed` or `payment_pending` (payment forms), stores payment metadata when applicable, triggers `subtleforms_payment_required` action.
- SubmissionsRepository manages CRUD and status updates ([src/Repositories/SubmissionsRepository.php](src/Repositories/SubmissionsRepository.php)).
- LogsRepository records pipeline logs ([src/Repositories/LogsRepository.php](src/Repositories/LogsRepository.php)).

**Data Flow / Call Flow**
- Pipeline steps produced by `SchemaCompiler`; `SubmissionContext` carries payload/meta; errors set submission status `failed` and return WP_Error with `validation_failed` when context holds validation_errors.
- Adjacent submission navigation computed via `SubmissionsRepository::getAdjacentIds` (not shown in excerpt but referenced in detail endpoint).

**State & Storage**
- Submission status progression: processing → saved → completed (or payment_pending for payment forms). Schema version stored on creation.

**Endpoints / Contracts**
- Submit endpoint returns `{success, submission_id}` on success; errors include `schema_load_failed`, `pipeline_failed`, `validation_failed` with `errors` array.

**UI/UX Notes**
- Frontend shows success or error messages; payment flows rely on extension hook for completion.

**Known Issues / Observed Bugs**
- None observed in pipeline code; payment gateway handling intentionally external.

## 7. Styling & CSS
**Current Behavior**
- Admin styles: base CSS `assets/css/admin.css`, builder-specific `assets/css/admin-builder.css`, Tailwind build `build/admin/tailwind.css`, and component CSS `build/admin/index.jsx.css` enqueued per page in [src/Admin/AdminMenu.php](src/Admin/AdminMenu.php#L178-L214).
- Frontend styles: `build/frontend/index.jsx.css` enqueued by shortcode/block in [src/Frontend/Shortcode.php](src/Frontend/Shortcode.php#L60-L95) and blocks.

**Data Flow / Call Flow**
- Tailwind build from `assets/css/tailwind.css` via `npm run build:tailwind`.

**State & Storage**
- No runtime style state; CSS files versioned with plugin version or asset manifest.

**Endpoints / Contracts**
- Not applicable.

**UI/UX Notes**
- Multistep nav uses `.subtleforms-step-nav`; conversational renderer applies `getFormClassNames` from utils for type-aware classes.

**Known Issues / Observed Bugs**
- None observed; build warnings for bundle size present but not breaking.

## 8. Testing Status
**Current Behavior**
- JavaScript tests configured via `npm test` using `@wordpress/scripts` (Jest) per [package.json](package.json).
- Playwright e2e configured (`npm run test:e2e`) with config [playwright.config.js](playwright.config.js); reports in `playwright-report/` and `test-results/`.
- PHP unit tests configured via [phpunit.xml.dist](phpunit.xml.dist) and Composer dev dependencies; script `composer test` runs phpunit.

**Data Flow / Call Flow**
- E2E and unit tests are manual triggers; no CI details in this report.

**State & Storage**
- Tests directories: `tests/php`, `tests/e2e`, `tests/manual`; sample specs include `test-forms-repository.php`, `test-submissions-repository.php`, `test-conversational-payment-forms.php`.

**Endpoints / Contracts**
- Not applicable.

**UI/UX Notes**
- Not applicable.

**Known Issues / Observed Bugs**
- None recorded in test configs; coverage breadth not quantified in codebase.

## 9. Known Issues Index (Factual)
1. None observed in code review; no tracked defects documented in inspected files.

## 10. Appendix
**Full File Inventory Summary (major files only)**
- Core: [subtleforms.php](subtleforms.php), [src/load.php](src/load.php), [src/Plugin.php](src/Plugin.php), [src/Activator.php](src/Activator.php), [src/Deactivator.php](src/Deactivator.php).
- API: [src/Api/RestController.php](src/Api/RestController.php), [src/Api/SettingsApi.php](src/Api/SettingsApi.php), [src/Api/DashboardApi.php](src/Api/DashboardApi.php).
- Repositories: [src/Repositories/FormsRepository.php](src/Repositories/FormsRepository.php), [src/Repositories/SubmissionsRepository.php](src/Repositories/SubmissionsRepository.php), [src/Repositories/LogsRepository.php](src/Repositories/LogsRepository.php).
- Admin UI: [resources/admin/pages/*.jsx](resources/admin/pages), [resources/admin/components/*.jsx](resources/admin/components), [resources/admin/hooks/*.js](resources/admin/hooks).
- Frontend: [resources/frontend/index.jsx](resources/frontend/index.jsx), [resources/frontend/components/*.jsx](resources/frontend/components), [resources/frontend/utils/*](resources/frontend/utils).
- Blocks: [src/Blocks/SubtleFormsBlock.php](src/Blocks/SubtleFormsBlock.php), [src/Blocks/SubtleFormsFormBlock.php](src/Blocks/SubtleFormsFormBlock.php), block builds under `build/blocks/*`.
- Styles: `assets/css/*`, `build/admin/*.css`, `build/frontend/index.jsx.css`.
- Tests: `tests/php`, `tests/e2e`, `tests/manual`, Playwright config `playwright.config.js`, PHPUnit config `phpunit.xml.dist`.

**Search Queries Used**
- `register_rest_route` across `src/**/*.php`
- `subtleforms_` across `src/**/*.php`
- Builder state hooks and autosave in `resources/admin/hooks`
- Frontend renderer components under `resources/frontend/components`

**Glossary**
- `draft_schema`: JSON stored on `subtleforms_forms.draft_schema` for autosave/edits in progress (not public).
- `active_version`: integer pointer to active schema version in `subtleforms_form_schemas` used for published/public rendering.
- `schema_version`: version stored with submissions to align payload with schema used at submission time.
- `pipeline`: server-side execution chain produced by `SchemaCompiler` to process submissions.
