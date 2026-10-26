=== SubtleForms ===
Contributors: subtleforms, smhz101
Tags: form builder, contact form, forms, multi-step form, file upload
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 2.7.2
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Build contact, multi-step and conversational forms on a visual canvas, then read every entry in a clean inbox. Spam protection built in.

== Description ==

SubtleForms is a form builder for WordPress. You build a form on a canvas that looks like the live form, publish it with a shortcode or the SubtleForms block, and read the entries in an inbox inside wp-admin. Everything listed here is in this plugin and works without an account.

= Building forms =

* Visual builder with a field library, a live canvas and a settings panel for each field (Settings, Validation, Logic, Style)
* Regular, multi-step and conversational (one question at a time) forms
* Ready-made templates, including contact, lead capture and newsletter forms, plus a blank form
* Field widths to place fields side by side, and an inline layout for email and button on one row
* Appearance presets, a custom mode for colours, fonts, fields and buttons, and an option to inherit the active theme
* Desktop, tablet and mobile preview

= Fields =

* Text, Paragraph, Email, Number, Phone, Website, Password, Name and Address
* Dropdown, Radio buttons, Checkboxes, Single checkbox, Toggle, Country, Consent and Dependent dropdowns (as menus, buttons or columns, typed in or loaded from CSV)
* Date, Time, Date and time, Rating, Opinion scale, NPS, Slider, Matrix, Colour picker and Rich text
* File and image uploads, one file per field, with allowed types and size limits, stored in a private folder and downloaded by admins only
* Hidden fields with merge values such as {user_email} and {get:param}, HTML blocks, section breaks, Repeater, Group and Columns

= Logic and after submit =

* Show or hide fields when all of their rules match, with these operators: equals, does not equal, contains, does not contain, is empty, is not empty, greater than and less than. Hidden fields are not validated or saved, in the browser and on the server
* Email notifications and webhooks after each entry, with merge tags such as {all_fields}, {field:email} and {entry_id}, plain text or HTML
* A confirmation message with answers merged in and clickable links, or a redirect
* Availability rules: logged-in visitors only, open and close dates, and an entry limit

= Entries =

* An inbox with tabs, search, filters and a reading pane
* Read and unread, star, flag, notes, resend notifications and a Trash, one entry at a time or in bulk
* CSV export of entries, JSON export and import of forms and entries, and import of Gravity Forms and Fluent Forms export files as draft forms
* Reports: submissions, unread entries and a chart of the last days
* Activity, webhook and API logs

= Spam protection and privacy =

* Honeypot, minimum time and rate limiting on every form
* Optional Google reCAPTCHA (v2 and v3), hCaptcha or Cloudflare Turnstile (see External services)
* Data retention settings and the WordPress personal data export and erase tools

SubtleForms Pro is a separate plugin that adds Signature, Calculation and Picture choice fields, several files per upload field, Stripe payments, WooCommerce checkout, marketing and CRM integrations, more conditional logic options, form analytics, entry PDFs and translation support. See [subtleforms.com](https://subtleforms.com/pro/).

== Installation ==

1. In wp-admin, go to Plugins, Add New, search for "SubtleForms", then click Install Now and Activate.
2. Go to SubtleForms, Add New, and start from a template or a blank form.
3. Publish the form and add it to a page with the SubtleForms block or the shortcode `[subtleforms id="123"]`.

== Frequently Asked Questions ==

= How do I add a form to a page? =

Publish the form, then add the SubtleForms block, or paste the shortcode shown in SubtleForms, All Forms, for example `[subtleforms id="123"]`.

= Does SubtleForms contact any outside server? =

Not by default. It only contacts a CAPTCHA provider if you turn one on, and the URLs you enter yourself for webhooks. It sends no usage data or telemetry. See External services.

= How do I stop spam? =

Every form has a honeypot, a minimum time check and rate limiting. You can also turn on one CAPTCHA provider under SubtleForms, Settings, Security and privacy.

= Can I export entries? =

Yes. Settings, Tools exports forms and entries as JSON, and the Submissions screen exports entries as CSV.

= Are uploaded files private on nginx? =

Files are saved under a folder with a random name, without file extensions, and are only served to admins through wp-admin. Apache and IIS also get rules that deny direct access. On nginx, you can add `location ~* /wp-content/uploads/subtleforms-uploads { deny all; }` to your server block.

= What data does SubtleForms store? =

The answers a visitor sends, the time, and the visitor's IP address and browser user agent for spam checks. You can set how long entries are kept, and the WordPress privacy tools can export or erase a person's entries.

= Where are the docs and support? =

Documentation is at [subtleforms.com/docs](https://subtleforms.com/docs/). Ask questions in the support forum on WordPress.org.

== External services ==

SubtleForms works without any external service and sends no usage data or telemetry. The services below are used only when a site administrator turns them on, and only for forms on that site.

= Google reCAPTCHA =

Used to check that a form is sent by a person. When reCAPTCHA is enabled under Settings, Security and privacy, the form page loads the reCAPTCHA script from google.com, which collects data about the visitor's browser and interaction. On submit, the site sends your secret key, the visitor's response token and IP address to https://www.google.com/recaptcha/api/siteverify. [Terms of Service](https://policies.google.com/terms), [Privacy Policy](https://policies.google.com/privacy).

= hCaptcha =

Used for the same purpose when hCaptcha is enabled. The form page loads the script from js.hcaptcha.com, and on submit the site sends your secret key, the response token and the visitor's IP address to https://hcaptcha.com/siteverify. [Terms of Service](https://www.hcaptcha.com/terms), [Privacy Policy](https://www.hcaptcha.com/privacy).

= Cloudflare Turnstile =

Used for the same purpose when Turnstile is enabled. The form page loads the script from challenges.cloudflare.com, and on submit the site sends your secret key, the response token and the visitor's IP address to https://challenges.cloudflare.com/turnstile/v0/siteverify. [Terms of Use](https://www.cloudflare.com/website-terms/), [Privacy Policy](https://www.cloudflare.com/privacypolicy/).

= Webhooks =

When you add a webhook action to a form, each new entry is sent as JSON to the URL you, the site owner, enter, after the entry is saved (and when you press Test). The data goes only to that URL: nothing is sent to SubtleForms or to any address you did not enter. What that service does with it is set by its own terms.

== Source code and build ==

The JavaScript and CSS in the build folder are compiled. The human-readable source, with the build tools, is public at https://github.com/smhz101/subtleforms (folder `resources`). To build: run `npm ci`, then `npm run build:all`. PHP dependencies: `composer install --no-dev`.

== Screenshots ==

1. The form builder with the field library, canvas and field settings.
2. Conditional logic for a field.
3. A multi-step form on the live site.
4. A conversational form on the live site.
5. The submissions inbox with an entry open in the reading pane.
6. The form preview with appearance presets.

== Changelog ==

= 2.7.2 - 2026-10-24 =
* Change: SubtleForms Pro builds older than 2.8.0 are not started by this version, to avoid errors. Update SubtleForms Pro to 2.8.0 or later.
* Change: Payment, pricing and coupon features are provided only by the add-on. This plugin no longer includes the order engine, and an entry's order is shown by the add-on.
* Change: A form that has a field no active plugin provides shows "This form is not available right now." and keeps its saved fields. Forms with only a leftover payments setting and no payment field keep working.
* New: On an empty site, SubtleForms offers to import forms from Contact Form 7, Gravity Forms, Fluent Forms and other detected form plugins.
* Change: Forms load without a loading flash, file uploads use a drop zone with a select button, repeater groups are labelled Entry N, and form settings let you choose the required-field mark and turn the validation summary on or off. Forms that have required fields show a short legend for the mark. Forms no longer paint a background by default, and inherit-from-theme keeps SubtleForms chrome for calendars and similar fields while using theme colours.
* Fix: The Preview tab uses one scrollbar for the canvas and styling controls.
* Change: Appearance presets no longer set form width; Layout / Form width stays a separate control so columns flex at full content width.
* Fix: The date picker trigger matches other fields, and the calendar panel is easier to read.

= 2.7.1 - 2026-10-23 =
* Change: Forms with payment fields show a not available message instead of taking orders.
* Change: Forms that inherit the theme load no SubtleForms stylesheet, and the stylesheet has an RTL version.
* Change: Choice groups use a fieldset with a legend, and error and success boxes use theme-neutral colours.
* Fix: The keep-data uninstall setting is now saved and honoured.
* Fix: The per-user entry limit works.
* Security: Form schemas need the manage_options capability, reCAPTCHA v3 checks the score and action, and time tokens expire after two hours and work once.
* Security: The client IP honours trusted proxies, and queued mail and webhook details stay out of the cron option.

= 2.7.0 - 2026-10-23 =
* New: Web addresses and links written as [text](https://example.com) in a form's confirmation message are now clickable; only http, https and site-relative links are allowed and anything else stays plain text.
* New: Add-ons can register their own panel in the form builder under Integrations.
* New: Extension points for add-ons: field type overrides, logic evaluators, Reports panel slots, form mount hooks and a form-deleted action, with placeholders in the builder and Reports.
* Change: Removed two settings that were saved but never used: the WooCommerce product and currency fields.

The full history is in changelog.txt in the plugin folder.

== Upgrade Notice ==

= 2.7.2 =
If you use the SubtleForms Pro add-on, update it to 2.8.0 or later: older builds are not started by this version, to avoid errors. Payment, pricing and coupon features are provided only by the add-on.

= 2.7.1 =
Forms with payment fields need the separate SubtleForms Pro plugin.

= 2.7.0 =
Links written as [text](https://example.com) in confirmation messages are now clickable.

= 2.6.1 =
Forms appear faster, and the SubtleForms block shows the form with its own style in the editor and on the site.

= 2.6.0 =
Spam protection (the hidden trap field and the too-fast check) is on for new forms only. Nothing changes for your existing forms unless you accept the offer on the SubtleForms dashboard to turn it on for all of them.

= 2.5.0 =
The Branding tab is gone from Settings.

= 2.4.1 =
Webhooks now send the documented body, with answers under "fields", and can be tested in Settings. If a receiver reads answers at the top level of the body, update it to read them from "fields". Field IDs can be edited.

= 2.4.0 =
Field options, CAPTCHA keys, dependent dropdowns and keyboard use of dropdowns, country, phone and date fields.

= 2.3.9 =
Requires WordPress 6.6.

= 2.3.8 =
Dependent dropdowns are edited as columns and can show as dropdowns, buttons or columns on the form.
