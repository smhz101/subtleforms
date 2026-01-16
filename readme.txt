=== SubtleForms ===
Contributors: smhussain
Tags: forms, contact form, form builder, email, captcha, submissions
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.6.10
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

= Coming Soon =

* Payment gateway integrations (Stripe, PayPal)
* Advanced conditional logic
* Email notification templates
* Webhook integrations

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
