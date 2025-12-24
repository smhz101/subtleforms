# SubtleForms – Architecture, Flow & Progress Report

Date: 2025-12-23

> Purpose: A concise, factual architecture, flow and readiness report for the SubtleForms WordPress plugin. This document describes current status, architecture, flows, gaps and recommended next-phase objectives for the product owner and technical leadership.

---

## 1. Executive Summary

- Current progress: Core form builder UI and submission persistence are implemented; the admin builder has a working React-based editor (drag/drop, inspector, autosave), REST endpoints, and defensive PHP compatibility layers. Recent work focused on PHP 7.2+ compatibility and a UI/UX refactor to a flat, full-width builder.
- Maturity level: Beta (Advanced Beta). Core features present and integrated, but polish, performance tuning, testing, and some UX/responsive behaviors remain.
- Core strengths:
  - Functional form builder with node-based schema model and drag/drop editing (dnd-kit).
  - Defensive server-side helpers addressing null-handling and cross-PHP compatibility (7.2–8.x).
  - REST API surface (`/wp-json/subtleforms/v1`) for schema and field definitions.
  - Scoped styling (Tailwind + plugin CSS) and iterative UI improvements (flat design applied).
- Critical gaps:
  - End-to-end test coverage and QA for responsive and accessibility edge cases.
  - Production-grade performance review and DB scaling strategy for high submission volumes.
  - Formal schema versioning & migrations strategy (mechanisms exist but need explicit policy/automation).
  - UX polish for mobile/editor collapse/restore behaviors and some toolbar interactions.

---

## 2. Directory & Code Structure Overview

Note: paths are workspace-relative to the plugin root.

- `resources/admin/` — Primary admin React source for the Form Builder and related admin screens.

  - `components/builder/` — Builder-specific components:
    - `FormBuilderPage.jsx` — top-level admin page wrapper, header, autosave orchestration, tabs (Build / Entries).
    - `FormEditor.jsx` — main three-column editor container (FieldDock, Canvas, FieldInspector); contains schema and selection state.
    - `FieldDock.jsx` — left field library / toolbox.
    - `FormBuilder.jsx` — in-place renderer integrating DnD (`dnd-kit`) and node rendering.
    - `FieldChrome.jsx`, `FieldToolbar.jsx`, `FieldRenderer.jsx`, `ContainerRenderer.jsx`, `ColumnDropZone.jsx` — field presentation, chrome and drag/drop glue.
    - `FieldInspector.jsx` — right-side inspector / settings for a selected field.
    - `FormBuilderHeader.jsx` (or header markup inside `FormBuilderPage.jsx`) — sticky header and actions.
  - `index.jsx` — entrypoint that bootstraps admin JS.

- `assets/css/` — plugin-specific CSS files

  - `admin-builder.css` — builder-specific styles (recently refactored to flat design, removed rounded corners & shadows).
  - `tailwind.css` — Tailwind input for the plugin build pipeline (scoped to plugin admin).

- `resources/frontend/` — frontend scripts/styles for form rendering (lightweight CSS included).

- PHP backend (plugin root):
  - Admin integration files registering menus/pages (e.g., `AdminMenu.php`), patched to avoid WordPress deprecation warnings.
  - `Support/Helpers.php` — defensive helpers for null normalization and safe JSON operations.
  - REST controllers / API endpoints (files vary) that expose `/subtleforms/v1/*` routes.
  - Repositories / persistence layer — code that reads/writes forms and submissions (may live under `includes/` or `wp-content/plugins/subtleforms/includes` depending on the repo layout).

Separation of concerns:

- Admin UI (React) is restricted to `resources/admin/*`, bundled with `wp-scripts` and Tailwind.
- Backend responsibilities (PHP) include registration of admin pages, REST endpoints, schema persistence, and submission storage.
- Frontend (visitor-facing) code is scoped separately under `resources/frontend` and `assets/css`.

---

## 3. Backend Architecture Flow

This section describes the standard backend flows and implementation notes.

### Form creation lifecycle (authoring)

- User opens the builder UI (admin page). `FormBuilderPage.jsx` requests schema for `GET /forms/{id}/schema`.
- Builder initializes with a draft schema object (fields array + `metadata`), normalized by JS to ensure structure consistency.
- Editing occurs in-memory in React state (`draftSchema`, `tree` internal representation). Edits update the schema via local state and `onChange` handlers; schema is denormalized from a tree representation when necessary.
- Save operation performed by `FormBuilderPage` calling REST API POST/PUT to `/forms` or `/forms/{id}` (via `apiPost` helper). Autosave triggers same flow with `auto` flag.
- Server-side: controller validates payload, stores schema (likely JSON in post meta or a dedicated table) and returns saved representation.

### Schema versioning flow

- Current state: schema stored as JSON (metadata + fields) with an implicit structure. There is a `metadata.name` and other minimal properties set on load.
- Recommended and observed practice: include `schema.version` or `metadata.schema_version` on write and bump when structural changes introduced.
- Migration responsibilities: backend must provide migration transformers when loading older schema versions — no automated migration tooling was found; this should be formalized.

### Submission lifecycle

- Frontend (site visitor) submits a form payload to a REST endpoint (e.g., `/subtleforms/v1/forms/{id}/submit` or similar).
- Backend validates input per field definitions in schema (required, types, validations), transforms into storage model, and inserts into persistence.
- Acknowledgement (200/201) returned to client. Errors return structured JSON with message and status codes.
- Submissions are then available to admin via the SubmissionsTable UI which fetches via REST and renders a paged table.

### Pipeline execution flow

- If the plugin supports post-submit pipelines (email, integrations, webhooks), these run after persistence:
  - Insert submission → enqueue pipeline jobs or execute synchronously (current codebase likely synchronous in small projects).
  - Errors in pipelines should be logged and surfaced to admin as deliverability issues.
- There is not an explicit job queue in the codebase; for scaling, introduce background job processing (WP Cron + custom workers or external queue).

### Error handling strategy

- Backend uses structured errors and sets HTTP codes; `Support/Helpers.php` adds defensive guards to prevent PHP warnings.
- Recent work addressed PHP deprecations (strpos/str_replace nulls) by normalizing null to '' when WordPress expects strings.
- Client-side parsing (`parseJsonResponse`) defensively handles empty responses and non-JSON payloads.

### PHP compatibility considerations (7.2+)

- Defensive normalizers were added to avoid null parameter deprecation warnings (important for PHP 7.2 → 8.x compatibility).
- Avoid use of typed signatures and strictly typed return types unless polyfilled; the codebase currently targets broad compatibility.
- Tests must include PHP 7.4 and 8.1+ runs to catch subtle differences (null handling, warnings, and exception behavior).

---

## 4. Frontend / Admin UI Architecture

### Form Builder UI structure

- Three main panes: Field Library (left), Canvas (center), Inspector (right).
- Top sticky header for global actions (title, shortcode, save status, close).
- `FormEditor.jsx` orchestrates layout and connects `FormBuilder` (canvas) with `FieldDock` and `FieldInspector`.

### Component hierarchy (key components)

- `FormBuilderPage.jsx` (page-level state, REST interactions, autosave)
  - `FormEditor.jsx` (layout + schema/tree state)
    - `FieldDock.jsx` (left library)
    - `FormBuilder.jsx` (canvas, drag/drop)
      - `ColumnDropZone.jsx`, `ContainerRenderer.jsx`, `FieldRenderer.jsx`
      - `FieldChrome.jsx` (per-field wrapper + toolbar)
    - `FieldInspector.jsx` (right-side settings)
  - `SubmissionsTable.jsx` (entries tab)

### State management strategy

- Local component state with React hooks (useState/useRef/useEffect/useMemo/useCallback).
- A `tree` structure is used internally to represent nodes (containers, columns, fields). Schema denormalization/normalization functions convert between JSON schema and internal tree shape.
- `FormBuilderPage` holds the authoritative `draftSchema` and `isDirty`/`saving`/`autoSaving` state. `FormEditor` maintains tree and selection; changes propagate up via `onChange`.
- Notices and global UI feedback use `@wordpress/data` dispatch to `noticesStore`.

### Auto-save flow

- `FormBuilderPage` tracks `isDirty` and sets a short debounce (`autoSaveTimeoutRef`) to call `performSave({ auto: true })` after inactivity (2s observed).
- `performSave` differentiates `auto` vs manual saves to control notices and error surfacing. Autosave sets `autoSaving` and handles `autoSaveError` without disruptive modal or blocking UI.

### Inspector / Canvas / Sidebar interaction

- Selecting a field in the canvas sets `selectedId` and the `FieldInspector` reads the field config from `tree`.
- Field insertion can be initiated from `FieldDock` or via insert controls in the canvas. Context (parentId/columnIndex/position) is passed to insertion handlers.
- Drag & Drop is implemented with `@dnd-kit/core` and `@dnd-kit/sortable` with pointer activation distance and sortable wrappers.

### Tailwind usage and scoping

- Tailwind is compiled into `build/admin/tailwind.css` and scoped to the plugin admin views; additional `admin-builder.css` provides component-specific styles.
- The build uses `wp-scripts` and a local `tailwind.css` input. CSS rules are intentionally constrained to builder classes (e.g., `.subtleforms-*`) to avoid bleeding into WP admin.

---

## 5. Data Flow Diagrams (Textual)

### Form creation → save → edit → reload

1. Admin opens builder → `FormBuilderPage` requests `GET /subtleforms/v1/forms/{id}/schema`.
2. Server returns schema JSON. Client normalizes into `draftSchema` and internal `tree` representation.
3. User edits (add/move/update). Local `tree` and `draftSchema` updated; `isDirty = true`.
4. Autosave debounce triggers `POST /subtleforms/v1/forms` (or `PUT /forms/{id}`). Server validates, persists, returns saved schema.
5. Client receives saved schema → update `draftSchema`, `status = saved`, `isDirty = false`.
6. Reload: `GET` returns persisted schema, used to hydrate the editor.

### Frontend submission → backend persistence → logs

1. Site visitor submits a form payload via front-end JS or standard form POST to REST endpoint.
2. Backend validates input against stored schema; if valid, inserts into submissions store.
3. Backend returns success JSON (or error with status + message). Optionally execute pipeline steps (email/webhook) synchronously or queue them.
4. Logging: errors or pipeline failures are recorded (plugin logs or WP error log).

### Admin viewing submissions → detail view

1. `SubmissionsTable.jsx` requests paged submissions via REST (`/subtleforms/v1/forms/{id}/submissions?page=N`).
2. Admin selects a row → component fetches details if not included in list or shows available payload/metadata.
3. Admin may export or filter; these actions call REST endpoints which return CSV/JSON or filtered paginated lists.

---

## 6. Performance Review

### Current performance characteristics

- Bundled admin JS is compact (build reported ~137 KiB for admin bundle); Tailwind compiled into a small admin CSS file.
- DnD implemented client-side with `dnd-kit` which is performant for moderate node counts.

### Known bottlenecks

- Large forms (many fields/nested containers) produce deeper tree traversal and more DOM nodes; this can slow rendering and DnD interactions.
- `FormBuilder` currently renders node components recursively; without virtualization, very large schemas will hit the browser.
- Synchronous pipeline tasks (email/webhooks) executed inline can increase save latency.
- Database write patterns for high-volume submissions are unknown; if using postmeta for each submission, that does not scale.

### Areas safe vs unsafe for scaling

- Safe to scale: admin bundle size (small), DnD library choice, modular componentization.
- Unsafe / needs attention: submission storage implementation (use custom table with indexes), synchronous pipeline execution, lack of background queue for heavy post-submit work.

### Frontend rendering performance considerations

- Avoid excessive re-renders: memoize components (useMemo/useCallback) for heavy node lists.
- Consider incremental rendering or virtualization for very large forms (e.g., lazy rendering of offscreen containers).
- Reduce expensive inline styles and prefer CSS classes for repeated style rules.

### Database query patterns (observed / inferred)

- REST endpoints perform read/write of JSON schema; exact query patterns depend on repository implementation (post_meta vs custom table).
- For submissions, prefer dedicated table (`subtleforms_submissions`) with indexes on `form_id`, `created_at` for efficient querying.

---

## 7. UI/UX Flow Analysis

### Admin navigation flow

- `wp-admin` menu → SubtleForms → Builder (tabs for Build / Entries) — logical and familiar for WordPress users.
- Sticky header with save status and close provides clear affordances.

### Editor usability flow

- Drag and drop with visible field chrome and toolbar works well for authoring.
- Autosave reduces fear of losing changes. Copyable shortcode in the header is convenient.

### Submission review flow

- Entries tab and `SubmissionsTable` allow basic review; paging and export functions exist in UI.

### UX friction points

- Mobile/smaller viewport: inspector and dock collapsing need more polish and predictable toggle behavior.
- Some inline style hover interactions use direct DOM style manipulation; unify to CSS classes for consistent behavior and easier theming.
- Lack of clear schema versioning in UI (no visible schema version or migration warnings when editing older schema versions).

### UI consistency

- Recent refactor removed rounded corners and shadows for a consistent flat visual language.
- Some older classes in CSS may still need auditing to ensure consistent spacing and typography.

---

## 8. Current Limitations & Technical Debt

- Missing features:

  - Explicit schema versioning + migration tooling.
  - Background job processing for pipelines and heavy post-submit tasks.
  - Full test coverage (E2E + unit tests) for critical flows (save, autosave, restore, submission validation).
  - Accessibility audit (keyboard DnD, aria attributes on dynamic lists).

- Fragile areas:

  - Large-schema rendering (no virtualization).
  - Inline style manipulations in multiple components (harder to maintain and theme).
  - Reliance on implicit storage format — migrations and compatibility risks for future structural changes.

- Deprecated warnings and root causes:

  - Previously observed PHP deprecation warnings (strpos/str_replace receiving null) were caused by null parent parameters in admin menu registration and other places; resolved by `Support/Helpers.php` normalizers and changing `null` to `''` for hidden submenu parents.

- Areas needing refactor vs safe to extend:
  - Refactor: persistence/submissions storage (move to custom table), pipeline execution model (add queue), schema migration tooling.
  - Safe to extend: UI features (additional field types), styling/theme adjustments, additional export formats.

---

## 9. Readiness Assessment

### What is production-ready

- Core authoring UX for modest-sized forms (dozens of fields) appears stable.
- REST endpoints for schema loading/saving and field definitions are functioning.
- Submission capture pipeline for low-to-moderate traffic is likely acceptable.

### What blocks public release

- Lack of robust performance & scalability plan for high-volume submissions.
- Missing automated tests and regression coverage (risk of regressions across WP and PHP versions).
- No formal schema migration/version management — risky when changing schema structure in future releases.
- Accessibility gaps and responsive behaviors need QA before shipping to a broad audience.

### What blocks premium positioning

- Advanced pipeline features (delayed/background jobs, retry, logging, webhooks management UI).
- Reporting & analytics for submissions (aggregations, trends) are absent.
- Multi-site / multisite-network considerations and import/export workflows for forms.

---

## 10. Recommended Next Phase (Objectives & Priorities)

Goal for next phase: Harden for Public Beta / Early Production usage with emphasis on reliability, scalability and polish.

Priority (High → Low):

1. Reliability & Data Integrity (Highest)

   - Objective: Implement robust persistence for submissions using a dedicated DB table with indexes and migration scripts.
   - Why: Ensures manageable growth and performant queries for admin listing and exports.
   - Acceptance criteria: New table in place with backfill script, REST endpoints supporting paged queries with acceptable latency under load.

2. Schema Versioning & Migrations

   - Objective: Add `schema_version` to saved schema and build migration helpers (server-side) to upgrade older schemas transparently.
   - Why: Enables safe product evolution without breaking existing forms.
   - Acceptance criteria: Migration tests pass; UI surfaces schema version and warns if migration needed.

3. Background Job / Pipeline System

   - Objective: Decouple pipelines (email/webhooks) from synchronous save using WP Cron or an external queue (preferred for scale).
   - Why: Reduces save latency and increases reliability for delivery tasks.
   - Acceptance criteria: Jobs enqueued and retriable; admin can view pipeline job status.

4. Testing & CI

   - Objective: Add unit tests for key PHP functions, Jest/react-testing for core React components, and E2E (Cypress/Playwright) for builder flows.
   - Why: Prevent regressions and enable safe refactors.
   - Acceptance criteria: CI runs on push with test suite and linting.

5. Performance Improvements & Large-form Handling

   - Objective: Implement rendering optimizations (memoization, virtualization for large lists/containers) and measure key interactions (drag/drop latency, save roundtrips).
   - Why: Ensure usable experience for power users with large forms.
   - Acceptance criteria: Maintain <100ms drag responsiveness and <1s perceived save for typical operations.

6. UX & Accessibility Polish

   - Objective: Complete mobile/responsive behaviors, keyboard DnD accessibility, and ARIA labeling.
   - Why: Improve usability and broaden audience.
   - Acceptance criteria: Accessibility audit passes WCAG AA core checks for builder screens.

7. Observability & Logging

   - Objective: Add structured logging for pipeline failures and submission errors; expose admin diagnostics page for recent failures and pipeline metrics.
   - Why: Improve debugging and reliability for production.
   - Acceptance criteria: Admin can view recent pipeline failures, with logs linked to submissions.

8. Feature additions for Premium (future)
   - Objective: Scoped improvements such as scheduled submissions export, advanced analytics, connectors market (Zapier/Make integrations).
   - Why: Differentiate premium offering.

---

## Appendix — Quick Actions for Next Week (Concrete Tasks)

- Add `schema_version` field and a migration loader in PHP; include unit tests for migration paths.
- Design and implement `subtleforms_submissions` table schema and migration script; add repository methods.
- Introduce a simple job queue abstraction (WP Cron-based or background worker) and move webhook/email sends into queued jobs.
- Add Jest unit tests for `FormBuilder` rendering of nested containers and a Cypress E2E for add/save/reopen flows.
- Run profiling on large forms (>200 fields) and identify top-3 render hotspots.

---

If you want, I can now:

- produce a prioritized implementation backlog with estimated effort per task, or
- open a follow-up document focusing on the submission storage migration design (DDL + backfill strategy).

---

Report saved to: `docs/SubtleForms - Architecture, Flow & Progress Report.md` inside the plugin folder.

Prepared by: Technical Lead (architect review)
