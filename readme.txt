=== SubtleForms ===
Contributors: subtleforms
Tags: forms, contact-form, submissions, webhooks
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.5.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Lightweight form building and submission handling for WordPress. SubtleForms focuses on accessible, fast, and extensible forms with an emphasis on privacy and developer-friendly integrations.

== Description ==

SubtleForms lets you build forms using a flexible schema-driven approach and includes features for submission management, CSV export, GDPR-compliant data handling, and developer-oriented integrations.

Key features:

* Drag-and-drop form builder (admin interface)
* Flexible field types (text, email, textarea, checkbox, radio, select, etc.)
* Server-side validation and sanitization
* Honeypot and time-based spam protection
* Submissions list with search, filters, and CSV export
* Privacy tools (data export and erasure) and data retention controls
* REST API for integration and extensibility

== Installation ==

1. Upload the `subtleforms` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to SubtleForms in the admin menu to create and manage forms

== Screenshots ==

1. `assets/screenshot-builder.png` — Form builder interface
2. `assets/screenshot-form-preview.png` — Frontend form preview example
3. `assets/screenshot-submissions.png` — Submissions list and export

== Frequently Asked Questions ==

= Do I need an account or license to use this plugin? =
No. SubtleForms is fully functional as a free plugin. A separate commercial addon is available for advanced integrations, but it is not required.

= How is spam handled? =
SubtleForms includes a honeypot and time-based trap. You can enable/disable honeypot checks in Settings.

= How do I export submissions? =
From the Submissions screen you can export data as a CSV file for further processing.

== Changelog ==

= 1.5.0 =
* Hardened input sanitization and output escaping
* Added honeypot configuration and privacy features
* Accessibility and i18n improvements

== Upgrade Notice ==

= 1.5.0 =
This release includes security and privacy improvements; ensure you test in a staging environment before upgrading on production sites.
