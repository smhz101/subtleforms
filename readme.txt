=== SubtleForms ===
Contributors: smhussain
Tags: forms, contact form, form builder, submissions
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 2.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Logic-first, workflow-driven form platform with visual builder, CAPTCHA support, spam protection, and extensible architecture.

== Description ==

SubtleForms is a powerful WordPress form plugin built for developers and site administrators who need flexible, secure form management with a modern interface.

= Key Features =

* **Visual Form Builder** - Drag-and-drop interface with real-time preview
* **Multiple Form Types** - Regular, multi-step, sectioned, and conversational forms
* **Rich Field Library** - Text, email, number, select, radio, checkbox, file upload, date/time, country selector, and more
* **Spam Protection** - Honeypot fields, time-based validation, and configurable rate limiting
* **CAPTCHA Support** - Google reCAPTCHA (v2/v3), hCaptcha, and Cloudflare Turnstile
* **Submissions Management** - View, search, filter, and export form submissions
* **REST API** - Complete REST API for programmatic access
* **Privacy Compliant** - GDPR tools, data retention controls, and privacy policy integration
* **Extension Ready** - Clean architecture for payment gateways and custom field types

= Form Types =

* **Regular Forms** - Standard single-page forms
* **Multi-Step Forms** - Break long forms into manageable steps with progress tracking
* **Sectioned Forms** - Organize fields into collapsible sections
* **Conversational Forms** - Chat-like experience with one question at a time

= Security & Spam Protection =

* Built-in honeypot fields
* Minimum submission time validation
* Rate limiting (10 submissions per minute per IP)
* REST API CSRF protection with WordPress nonces
* Multiple CAPTCHA provider support

= Developer Features =

* Clean, object-oriented PHP architecture
* Repository pattern for data access
* Extensible field registry system
* Provider-based CAPTCHA integration
* Filter and action hooks throughout
* Full REST API with proper authentication

= Privacy & Compliance =

* Data retention controls
* IP address and user agent logging (for spam prevention)
* Privacy policy content registration
* GDPR-compliant data export and erasure tools

= Conditional logic and uploads =

* Show or hide fields when all of their rules match (equals, not equals, contains, empty, not empty, greater or less than)
* Hidden fields are not validated or saved, in the browser and on the server
* File and image uploads with allowed types and size limits, stored privately and downloaded by admins only

= SubtleForms Pro (separate add-on) =

* Advanced conditional logic: match any rule, rule groups, more operators, skipped steps, conditional emails and confirmations
* Several files per upload field with drag and drop
* Stripe card payments, webhooks with retries, CRM and email marketing, analytics, PDFs and exports
* Agency plan: white label and WPML or Polylang translation

== Installation ==

= Automatic Installation =

1. Log in to your WordPress admin panel
2. Navigate to Plugins > Add New
3. Search for "SubtleForms"
4. Click "Install Now" and then "Activate"

= Manual Installation =

1. Download the plugin ZIP file
2. Log in to your WordPress admin panel
3. Navigate to Plugins > Add New > Upload Plugin
4. Choose the ZIP file and click "Install Now"
5. Activate the plugin

= Getting Started =

1. Navigate to SubtleForms in your WordPress admin menu
2. Click "Add New Form"
3. Use the form builder to add fields
4. Configure form settings (type, notifications, etc.)
5. Publish your form
6. Use the shortcode [subtleforms id="123"] to embed the form

== Frequently Asked Questions ==

= How do I add a form to my page? =

After creating and publishing a form, use the shortcode [subtleforms id="YOUR_FORM_ID"] in any page or post. You can find the form ID in the SubtleForms admin list.

= Can I use multiple CAPTCHA providers? =

You can configure one CAPTCHA provider globally in SubtleForms > Settings > Advanced. Supported providers are Google reCAPTCHA (v2 and v3), hCaptcha, and Cloudflare Turnstile. Only one provider can be active at a time.

= How do I prevent spam submissions? =

SubtleForms includes multiple spam prevention layers:
* Honeypot fields (enabled by default)
* Minimum submission time validation
* Rate limiting (10 submissions per minute per IP)
* Optional CAPTCHA verification (configure in Settings)

= Can I export submissions? =

Yes. Navigate to SubtleForms > Submissions, select the submissions you want to export, and click "Export CSV" from the bulk actions dropdown.

= Is this plugin GDPR compliant? =

Yes. SubtleForms includes:
* Data retention controls (configure in Settings)
* Privacy policy content registration (automatically added to WordPress privacy policy page)
* Clear disclosure of data collection (IP addresses and user agents for spam prevention)
* Data export and erasure tools via WordPress built-in privacy tools

= What data does this plugin collect? =

When users submit a form, SubtleForms stores:
* Form field data (as entered by the user)
* IP address (for spam prevention)
* User agent (for spam prevention)
* Submission timestamp

Data retention is controlled via the settings page. Contact your site administrator for information about your sites specific data retention policy.

= Does this work with block themes? =

Yes. SubtleForms is compatible with both classic and block themes. Use the shortcode block to embed forms in the block editor.

= Can developers extend this plugin? =

Absolutely. SubtleForms is built with extensibility in mind:
* Custom field types via field registry
* Custom CAPTCHA providers via provider interface
* Filter and action hooks throughout
* Clean, documented REST API
* Payment gateway integration points

= Where can I get support? =

For support, please visit the plugins support forum on WordPress.org or GitHub repository issues page.

== Screenshots ==

1. Visual form builder with drag-and-drop interface
2. Field inspector for configuring field properties
3. Submissions management with search and filters
4. Form settings panel with type selection
5. CAPTCHA configuration in settings
6. Multi-step form preview
7. Conversational form on frontend

== Changelog ==

= 2.2.0 - 2026-10-11 =
* New: File and image uploads work end to end: files upload as soon as they are picked, are checked for type and size, stored under random names in a protected folder, downloaded by admins through a secure link, and deleted with the entry or by data retention
* New: Conditional logic rebuilt with one rule engine shared by the browser and the server. Hidden fields are no longer validated or stored
* New: Form analytics: views, submissions and conversion rate per form (reports with Pro)
* New: Integrations, PDF, WooCommerce and white label settings for SubtleForms Pro
* Fix: Conditional logic rules saved in the builder were not applied on the live form
* Fix: Visitors who were not logged in did not get a form's custom confirmation
* Fix: Integration settings never loaded because extensions booted too late
* Fix: CSV export used the newest entry's columns only, broke nested values and accented characters, and could carry spreadsheet formulas; all fixed
* Developer: `subtleforms/submission/completed`, `subtleforms/submit/response`, `subtleforms/public_schema`, `subtleforms/payments/external`, `subtleforms/payments/line_items`, `subtleforms/email/attachments` and `window.SubtleFormsExtend` for add-on field types

= 2.1.0 - 2026-10-11 =
* New: Payments that add up on the server. Product (price and quantity), Priced Options (radio, cards, dropdown or checkboxes with a price per option), Custom Amount and Fixed Fee fields feed one live order
* New: Order Summary lists every item with subtotal, discount, tax and total as visitors fill the form, with a coupon box right under the total
* New: Coupons. SubtleForms › Payments manages percentage or fixed discounts with minimum order, usage limits, start and end dates and per-form rules. Codes are checked when applied and again on submit, and a use is counted only when the order goes through
* New: Card Payment field for gateways (Stripe in SubtleForms Pro). Entries keep the full order and payment status, shown in an Order panel on the entry
* New: Calculation fields can be charged ("Charge this amount")
* New: Payments screen with gateway status, setup guide and the coupon manager
* New: The builder canvas is now what you see is what you get: form and field styling (colours, radius, input style, label position, spacing) shows on the canvas as you change it
* New: Field widths (Full, 3/4, 2/3, 1/2, 1/3, 1/4) from the field toolbar place fields side by side, replacing column containers in the field library. Forms that already use columns keep working
* Developer: `subtleforms/payments/quote`, `subtleforms/payments/validate_coupon`, `subtleforms/payment/verify`, `subtleforms/payment/capture`, `subtleforms/payment/void`, `subtleforms/payments/gateways` and `subtleforms/frontend/enqueued`
* Fix: Plugin Check findings (escaped exception message, sanitising kept field settings with wp_kses_post, annotated counts query)

= 2.0.0 - 2026-10-11 =
* Redesign: New admin built on the WordPress 7.1 admin look: dark frame, white stage, top navigation, admin colour scheme accent and WordPress components throughout
* Redesign: Dashboard with KPI strip, 14-day submissions chart, quick actions and system status
* Redesign: Forms and Submissions lists rebuilt as data views with tabs, column picker, filters and row actions; submissions lead with the sender, not an ID
* Redesign: Submission detail as a reading pane with answers, activity tabs, previous/next, read/unread, flag and delete
* Redesign: New form screen is now a template library with wireframe previews and a one-step naming dialog
* Redesign: Settings use grouped navigation, setting cards and a floating save bar (Ctrl/Cmd+S saves)
* Redesign: Extensions page is now a Pro hub grouped by job, with clear locked, off, needs-setup and active states
* Builder: Gutenberg-style three-panel editor with field library, canvas and tabbed inspector (Settings, Validation, Logic, Style)
* Builder: Choices editor with drag to reorder, default selection, value column, bulk edit and image options
* Builder: Form settings gain After submit (message with merge tags or redirect, submit button text) and Availability (logged-in only, open and close dates, entry limit)
* Fields: New Toggle and Opinion Scale fields; Pro adds Picture Choice, Signature and Calculation (formula builder, recalculated on the server)
* Fields: New settings on existing fields: help text, default value tokens, prefix and suffix, min and max length, pattern, choice limits, option layouts, custom required message, admin label, read-only and CSS class
* Fields: Field library reorganised and renamed; rarely used and duplicate field types hidden from the library (existing forms keep working)
* Fix: Field settings not declared in the validator (conditions, min/max, formulas and more) were dropped on save; they are now kept and sanitised
* Fix: Publishing could replace the latest changes with an older autosave draft
* Fix: Unread counts used a status value that submissions never have; counts now use the read flag
* Fix: Marking a submission unread overwrote its processing status
* Fix: Field library never showed Pro lock badges
* Pro: Locked features now explain themselves in one consistent dialog and light up in place once a license is active
* Appearance: Nine style presets drawn as live mini previews, plus a Custom mode for every colour, font, field, button and layout setting
* Appearance: New tokens for label colour, input text, focus ring, button text and button radius
* Appearance: Field Style tab with a live sample, visual width picker and colour chips that show the inherited value
* Fix: The builder preview did not update when appearance or fields changed
* Fix: Admin hover colours leaked into the WordPress menu and button labels
* Fix: Modal titles were invisible when the computer used dark mode
* Fix: Dates are stored in UTC so relative times are correct in every timezone

= 1.9.2 - 2026-09-29 =
* Design: Adopted the WordPress Design System — accent now follows the site's admin colour scheme via --wp-admin-theme-color
* Design: Switched to the WordPress system font stack; removed DM Sans, Satoshi and JetBrains Mono webfont enqueues
* Design: Neutrals retinted to the WordPress admin grey ramp; flatter radii (4px) and minimal shadows
* Design: Borders, text and surfaces aligned to native WordPress admin values

= 1.9.1 - 2026-09-29 =
* Block: New inspector options — show title/description toggles, Form Theme dropdown with live preview, Reset to defaults, Advanced (AJAX, Tab Index, Field Values)
* Block: Editor preview now matches the frontend (removed divergent editor-only styling; frontend stylesheet drives both)
* Block: Theme, title/description, AJAX, tab index and prefilled field values now flow through to the frontend render
* Fix: "Last updated" on the forms list showed ~5h off because naive UTC datetimes were parsed as local time
* Fix: Search and other admin inputs no longer render in JetBrains Mono (regression from 1.9.0)
* Fix: Loading spinner re-skinned to the indigo brand and uses the sans font
* Builder: Appearance sidebar in the Preview tab now uses native Gutenberg PanelBody panels
* Field: New dedicated Disclaimer field (info/warning/success/neutral variants) with its own icon

= 1.9.0 - 2026-09-29 =
* UI: New indigo design system (#4F46E5 brand, #A5B4FC accent, #1E1B4B text)
* UI: DM Sans for headings, Satoshi for body text, JetBrains Mono for code areas
* UI: Enqueued webfonts (Google Fonts + Fontshare) the WordPress-standard way
* UI: Re-skinned primary buttons, toggles, focus rings, and card hovers to indigo
* UX: Every field type now has a unique icon — no repeated icons across fields
* Compliance: Aligned Stable tag with plugin version (1.9.0)

= 1.8.1 =
Releases between 1.6.10 and 1.8.1 were not tagged individually, so the changes
below are recorded as one entry rather than split across versions that cannot
now be reconstructed accurately.

* Submissions: unread badges, spam and flagged statuses, column visibility, relative timestamps, per-field filtering and date-range export
* Submissions: chunked prefetch pagination for large lists
* Submission detail: two-column layout, actions timeline, and pipeline logs enriched with action data
* Builder: structured group fields as container nodes, with a hierarchy system for nested fields
* Builder: configurable composite fields, field identity icons, and a rebuilt field picker with search
* Builder: live preview mode
* Templates: free templates expanded from 2 to 11 across 5 categories; 13 categories in total with Pro stubs
* Licensing: capability-based gating replaces the previous LicenseApi and SubscriptionManager
* Settings: tab routing via URL hash
* Database: is_read migration for the submissions table
* Accessibility and onboarding persistence fixes throughout

= 1.6.10 - 2026-01-16 =
* Security: Added REST API nonce verification for CSRF protection
* Security: Implemented rate limiting on public submit endpoint (10 req/min per IP)
* Compliance: Registered privacy policy content for data collection disclosure
* Fix: Added missing validation rules for spam and privacy settings

= 1.6.9 - 2026-01-15 =
* UX: Improved country field preview rendering with sample countries
* Fix: Extended CAPTCHA HTML injection for all provider field types (recaptcha, hcaptcha, turnstile)
* Fix: Frontend CAPTCHA renderer now supports all provider types

= 1.6.8 - 2026-01-15 =
* UX: Added CAPTCHA preview placeholder in form builder and preview modal
* UI: Shows "CAPTCHA will appear here" message instead of empty field

= 1.6.7 - 2026-01-14 =
* Chore: Stable architecture freeze point
* Admin: UI and styling baseline established

= 1.6.6 =
* Feature: Added country field with full ISO-3166 country list
* Feature: CAPTCHA system with support for reCAPTCHA, hCaptcha, and Turnstile
* Enhancement: Improved spam protection with honeypot and time validation

= 1.6.5 =
* Enhancement: Improved form builder responsiveness
* Fix: Field validation errors now display correctly
* Fix: Submission export CSV format improvements

= 1.6.0 =
* Feature: Multi-step form support
* Feature: Conversational form type
* Feature: Sectioned form layout
* Enhancement: Redesigned form builder interface

= 1.5.0 =
* Initial public release
* Feature: Visual form builder
* Feature: Submissions management
* Feature: REST API endpoints
* Feature: Basic spam protection

== Upgrade Notice ==

= 2.2.0 =
Fixes conditional logic on live forms and makes file uploads work. Update SubtleForms Pro to 2.2.0 as well.

= 2.1.0 =
Payments with a live order summary and coupons, a builder canvas that shows your styling, and side-by-side field widths. Update SubtleForms Pro to 2.1.0 as well.

= 2.0.0 =
A complete redesign of the admin and builder, new fields and form settings, and a fix that keeps all field settings on save. If you use SubtleForms Pro, update it to 2.0.0 as well.

= 1.6.10 =
Critical security update. Adds CSRF protection and rate limiting. Update immediately.

= 1.6.9 =
Important bug fix for CAPTCHA rendering on frontend. Update recommended if using CAPTCHA.

= 1.6.0 =
Major update with new form types. Test thoroughly before updating production sites.

== Privacy Policy ==

SubtleForms collects and stores the following information when users submit forms:

* Form field data (as entered by the user)
* IP address (for spam prevention)
* Browser user agent (for spam prevention)

This data is stored in your WordPress database according to the configured data retention policy (Settings > Advanced > Data Retention Days). Set to 0 to keep data indefinitely.

Site administrators can configure how long submission data is retained and can manually delete submissions at any time via the SubtleForms > Submissions page.

== Technical Requirements ==

* WordPress 6.0 or higher
* PHP 7.4 or higher
* MySQL 5.7 or higher / MariaDB 10.2 or higher
* Modern browser with JavaScript enabled (for admin interface)

== Support & Documentation ==

* GitHub: https://github.com/smhz101/subtleforms
* Support Forum: https://wordpress.org/support/plugin/subtleforms/
* Documentation: Available in plugins /docs directory

== Credits ==

Developed by Muzammil Hussain

== License ==

SubtleForms is licensed under the GNU General Public License v2.0 or later.

This program is free software; you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
