# SubtleForms — Full Production Audit & Launch Roadmap

**Date:** 9 January 2026  
**Version analyzed:** 1.5.0  
**Target:** WordPress.org plugins repository (free version) + Pro add-on strategy  
**Author:** GitHub Copilot

---

## 🚀 Executive Summary

SubtleForms is a modern, well-architected WordPress forms plugin with an excellent React-based builder and an extensible Pipeline engine for processing submissions. The codebase demonstrates good engineering practices (PSR-4, DI, repositories, tests). To reach WordPress.org production standards and compete with FluentForms, GravityForms and JotForm, the plugin needs focused work in these areas: security/hardening, i18n/accessibility, spam protection, documentation/packaging, and a clear freemium/premium feature split with first-party integrations.

**Overall progress estimate:** **35% complete** towards a competitive, production-ready plugin (rough breakdown below). Approximately **65% work remains** (integrations, payments, premium features, WP.org compliance and polish).

Quick breakdown:

- Core Engine: 95% ✓
- Admin Builder UI/UX: 90% ✓
- Field set & conditional logic (free): 75% ✓ (some fields missing/advanced validation needed)
- Submissions management & export: 80% ✓
- Security, i18n, accessibility, packaging: 20% ✕
- Integrations & payments (premium): 10% ✕
- Marketplace/extension ecosystem: 5% ✕

---

## 📁 What I inspected

- Plugin root: `subtleforms.php`, `readme.txt`, `assets/`, `dist/` and `resources/`
- Backend: `src/` (Activator, Deactivator, Container, Plugin bootstrap, Repositories, Engine, Extensions, Support)
- Admin UI: `resources/admin/` (React app, builder components, modals, pages)
- Tests: `phpunit.xml.dist`, `playwright` config, CI config (`.circleci/` exists)
- Docs: multiple markdown files (`ARCHITECTURE.md`, accessibility note, comprehensive reports)

---

## ✅ Strengths (what to keep & leverage)

- Modern architecture (Dependency Injection, Repository pattern, Service/FeatureGate).
- Robust pipeline engine (`src/Engine/Pipeline.php`) with error handling and step-level logs.
- React-based admin UI that follows WordPress UI patterns (`@wordpress/components`) and provides a polished builder UX.
- Good test setup: unit tests (PHPUnit) and E2E (Playwright) included.
- Extension-capable design (`Extensions/ExtensionManager.php` + `FeatureGate` capability system) enables a clean freemium/pro model.

---

## ⚠️ Risks & Critical Gaps (must fix before WP.org submission)

1. **Spam Protection:** No explicit Honeypot/reCAPTCHA/Akismet integration found. WP.org reviewers expect basic anti-spam measures on contact forms.
2. **Security / Sanitization / Escaping:** Need full audit for escaped outputs (admin & frontend), input sanitization, $wpdb->prepare usage and REST endpoint nonce checks.
3. **Internationalization:** Audit React and PHP strings to ensure everything is translatable (`__()`, `wp.i18n.__`, text domains, POT file generation).
4. **Accessibility (a11y):** Builder controls, modals and forms must meet ARIA & keyboard navigation standards (WCAG AA). There's an `accessibility-audit.md` file—implement missing fixes.
5. **Packaging & Assets:** Add plugin banner and icons required by WordPress.org; ensure readme.txt sections (FAQ, Changelog, Screenshots) conform to WP.org format.
6. **Data Privacy & GDPR:** Add clear privacy controls (data retention, export, deletion), including an option to purge submissions and a privacy page note.
7. **Extensions & Business Model:** `src/Extensions/` is present but no real premium extensions are included; we need a sample premium extension to demonstrate the model.

---

## 🎯 Free vs Premium: Recommended Feature Split

Principles: Make the free version fully useful and delightful; reserve workflow-driving features and integrations for Premium.

### Free (must-have in repository)

- Unlimited forms & submissions (do NOT artificially cap) ✅
- Basic fields: Text, Email, Textarea, Number, Select, Radio, Checkbox, Hidden, HTML/Content ✅
- Multi-step forms (basic) — optional depending on complexity ⚠️
- Basic conditional logic (show/hide rules) ✅
- Email notifications (admin & user) ✅
- Submission management (view, search, delete) ✅
- Export CSV ✅
- Basic Spam protection: Honeypot field (mandatory for WP.org) ❌
- Basic templates (Contact Form, Lead Capture) ❌
- Import/Export forms (JSON) ✅

Current status: most free basics already implemented but Honeypot, contact template & improved validation and sanitization should be added before release.

### Premium (Pro add-on plugin or set of extensions)

- Payment integrations: Stripe (with secure tokenization), PayPal, Razorpay
- Integrations: Zapier / Webhooks, MailChimp, ActiveCampaign, ConvertKit
- Advanced fields: File Uploads (with virus scanning advice/size/type limits), Signature, Repeater/Nested Fields, Calculated fields, Date/Time range
- Advanced conditional logic: conditional routing, calculations, multi-conditional branching
- Advanced submissions: scheduled exports, deeper filters, role-based access control, multiple inboxes
- Form Layouts & Styling: multi-column, pre-built templates, custom CSS editor, form skinning
- Frontend features: post submission -> create WP post, user registration/login forms
- Priority support & updates for paying customers

Recommended model: One `subtleforms-pro` plugin that registers capabilities (filters into `subtleforms/capabilities`), or the Pro plugin can hook and enable features. This aligns with WP.org rules (free plugin in repo, paid plugin sold elsewhere).

---

## 🧩 Integration & Extension Strategy

- Provide a small official set of extensions initially: `payments/stripe`, `integrations/webhooks`, `fields/file-upload` as separate plugins/packages.
- Implement a `License`/`Updater` class in `subtleforms-pro` that can check license validity but keep the free plugin decoupled and fully functional offline.
- Use the `FeatureGate` and `Capabilities` service to gate premium features consistently.

---

## 🛡 Security & Hardening Checklist

- [ ] Run WP Coding Standards (`phpcs --standard=WordPress`) and fix all warnings/errors
- [ ] Audit all REST endpoints for permission checks & nonces
- [ ] Ensure all output is escaped (`esc_html`, `esc_attr`, `wp_kses_post` where needed)
- [ ] Sanitize input with `sanitize_text_field`, `sanitize_email`, `wp_kses_post` etc.
- [ ] Ensure DB queries use `$wpdb->prepare()` or WPDB API properly
- [ ] Add server-side validation for file uploads and avoid direct file uploads to public directories

---

## ♿ Accessibility (a11y) Checklist

- [ ] Ensure keyboard focus management in modals (trap focus) and in builder panels
- [ ] Use semantic HTML in rendered forms (labels, fieldsets, legend)
- [ ] Provide appropriate ARIA attributes for complex controls
- [ ] Ensure color contrast ratio >= 4.5:1 for text
- [ ] Add screen-reader only notices for dynamic message updates

---

## 🌍 Internationalization & Localization

- [ ] Ensure PHP strings use `__()`, `_e()`, `_n()` and textdomain is consistent
- [ ] Ensure React/JS strings use `@wordpress/i18n` and are build-extractable to POT
- [ ] Add `languages/` with POT file and CI task to update translations

---

## 🔁 Data & Privacy (GDPR/Privacy-ready)

- [ ] Add admin setting for data retention policies (auto-delete submissions older than X days)
- [ ] Add tools to export or delete a single user's data (`privacy` export endpoints)
- [ ] Add privacy policy guidance snippet and implement `privacy` exporter

---

## 🧪 Testing & CI

- Unit tests: Use PHPUnit and Yoast polyfills (present). Increase coverage for Repositories and Pipeline error paths. ✅
- E2E: Playwright tests exist—add tests for builder flows, conditional logic, and key submissions. ✅
- CI: Add GitHub Actions in addition to CircleCI (optional) for faster PR workflows. ✅

---

## 📦 Packaging & WordPress.org Submission Checklist

- [ ] `readme.txt` must follow WordPress.org readme standards (Description, Installation, FAQ, Screenshots, Changelog, Tested up to)
- [ ] Create plugin assets: `assets/banner-772x250.png`, `assets/icon-256x256.png`, `assets/icon-128x128.png`
- [ ] Add screenshots showing builder, form, and submissions screen
- [ ] Ensure version & 'Stable tag' are correctly set in `readme.txt` and plugin header
- [ ] Avoid embedded promotional banners in admin that break WP.org rules
- [ ] Confirm plugin is GPL-compatible and all bundled libs are licensed correctly

---

## UX & Builder Polishing Suggestions

- Add a simple onboarding modal/wizard (create first contact form template)
- Add inline help & hover tips in the builder inspector
- Autosave draft management & conflict merge indicators are good—ensure robust undo/redo history (already partially implemented)
- Improve preview responsiveness for mobile/tablet views

---

## Competitor Comparison & Prioritization (FluentForms / GravityForms / JotForm)

High-level: SubtleForms wins on modern UI/architecture and conditional logic engine. Competitors win on sheer number of integrations, payment add-ons, and market maturity.

Priority (short-term to medium-term):

1. Implement **Spam protection** (Honeypot + optional reCAPTCHA) — required for WP.org and immediate trust
2. Implement **Webhooks** (very low complexity, huge value) — opens Zapier-like workflows and 3rd party integration
3. Implement **Stripe payments** (popular & monetizable)
4. Create **Pro add-on** + license system + one premium extension (file upload or Mail integration)

---

## Milestone Roadmap (8-10 day MVP launch plan)

Phase 0 — Prep (Day 0)

- Finalize versioning, update readme, assets placeholder

Phase 1 — Hardening & WP.org compliance (Day 1-2)

- Run PHPCS fixes, add Honeypot, verify nonce usage, add privacy text
- Add basic onboarding/template

Phase 2 — Vital features (Day 3-5)

- Add Webhooks endpoint and UI
- Add contact form template
- Add CSV export improvements

Phase 3 — Pro scaffold & 1st extension (Day 6-10)

- Create `subtleforms-pro` repo scaffold
- Implement Stripe/Payment extension (free trial / pro-gated)
- Implement license check and capability gating via `Capabilities`

Phase 4 — Submission prep (Day 11-14)

- Create assets, screenshots, finalize readme, add changelog, run final tests
- Submit to WordPress.org and iterate with reviewer feedback

---

## Concrete Quick Wins (I can implement for you)

- Add Honeypot protection and UI setting to toggle it on/off
- Add Webhooks action step in Pipeline with UI for URL and headers
- Add CSV export enhancements and scheduled export
- Add one small premium extension scaffold (file upload) and `subtleforms-pro` license filter

Tell me which of these you want me to implement first and I will start with a PR and tests.

---

## Final: Overall Progress Estimate

- **Overall readiness:** **35%**
- **Remaining:** 65% (primarily integrations, premium features, security/a11y/i18n & WP.org packaging)

---

> If you'd like, I can: add the Honeypot protection now (single PR + tests), scaffold `subtleforms-pro` with capability gating, or produce the required WP.org assets and `readme.txt` changelog. Which should I start with?
