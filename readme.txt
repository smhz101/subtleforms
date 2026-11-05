=== SubtleForms ===
Contributors: subtleforms, smhz101
Tags: form builder, contact form, multi-step form, conversational form, forms
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 2.7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Build contact, multi-step and conversational forms on a visual canvas, then read every entry in a clean inbox. No account needed.

== Description ==

SubtleForms is a form builder for WordPress. You build on a canvas that looks like the live form, publish with a shortcode or the SubtleForms block, and read every entry in an inbox inside wp-admin. One builder makes regular, multi-step and conversational forms, and everything described here is in this plugin and works without an account or a licence.

= Everything in the free plugin =

* Visual drag and drop builder with a live canvas and undo
* Regular, multi-step and conversational (one question at a time) forms
* 38 field types, including file and image uploads
* 12 ready-made templates, plus a blank form
* Field widths to place fields side by side
* Conditional logic: show or hide a field based on other answers
* Per-field settings for validation, logic and style
* Appearance presets, or custom colours and fonts that start from your theme
* Desktop, tablet and mobile preview
* The SubtleForms block and a shortcode
* Entries inbox with search, filters, stars, flags, notes and a Trash
* Unread entries counted in the admin menu
* Reports with a chart of recent submissions
* Email notifications with merge tags, plain text or HTML
* Webhooks after each entry, with a test button
* Confirmation message or redirect after submit
* Open and close dates, entry limits and logged-in-only forms
* CSV export of entries, JSON export and import of forms and entries
* Honeypot, minimum time and rate limiting on every form
* Optional Google reCAPTCHA, hCaptcha or Cloudflare Turnstile
* Data retention settings and WordPress personal data export and erase support
* Import forms from Contact Form 7, Gravity Forms and Fluent Forms
* Translation ready, with an RTL stylesheet

= Three form types, one builder =

Start with a regular form that shows every field on one page. Add a Page Break and the same form becomes multi-step, with progress shown to the visitor. Switch to conversational and visitors answer one question at a time, full screen, then review their answers before they send. You change the type in the form settings and keep your fields.

= Drag and drop builder =

The field library is on the left, the canvas in the middle and the settings for the selected field on the right. The canvas shows the form as visitors see it, so there is no separate preview step to trust. Each field has tabs for Settings, Validation, Logic and Style. Drag a field from the library, click it to add it after the current one, or press the slash key to search the library. Undo is in the header, and the Preview tab shows the form at desktop, tablet and mobile widths.

= Fields included =

* **Basic:** Text, Paragraph, Email, Number, Phone, Website, Name, Address and Password
* **Choices:** Dropdown, Radio buttons, Checkboxes, Single checkbox, Toggle, Country, Chained select (dependent dropdowns, typed in or loaded from CSV) and Consent
* **Date and time, and more:** Date, Time, Date and time, Rating, Opinion scale, NPS, Slider, Matrix, Colour picker, Rich text and Hidden (with merge values such as {user_email} and {get:param})
* **Uploads:** File and image uploads, one file per field, with allowed types and size limits, kept in a private folder and downloaded by admins only
* **Layout:** Section heading, Custom HTML, Notice, Page Break and Repeater
* **Spam protection:** reCAPTCHA, hCaptcha and Turnstile fields

= Ready-made templates =

Start from a template and change what you need: Contact Form, Simple Contact, Contact + Attachment, Lead Capture, Newsletter, Newsletter Sign-Up, Free Resource Download, Product Feedback, Website Feedback, Customer Satisfaction (CSAT), RSVP and Bug Report. Or start with a blank form.

= Conditional logic =

Show or hide a field when other answers match. Rules can use equals, does not equal, contains, does not contain, is empty, is not empty, greater than and less than, and a field is shown only when all of its rules match. Hidden fields are not validated or saved, in the browser and on the server, so a hidden required field never blocks a submission.

= Entries inbox and reports =

Entries arrive in an inbox with tabs, search, filters and a reading pane. Mark entries read or unread, star or flag them, add notes, resend notifications, and move them to the Trash, one at a time or in bulk. The SubtleForms menu shows how many entries are unread. Reports show submissions, unread entries and a chart of the last days. Activity, webhook and API logs show what happened and when. Export entries as CSV whenever you need them.

= Email notifications and webhooks =

Send an email after each entry to the people you choose, with merge tags such as {all_fields}, {field:email} and {entry_id}, in plain text or HTML. Set the reply-to address from a field. Add a webhook to send each entry as JSON to a URL you enter, and test it from the settings. After submit, show a confirmation message with the visitor's answers merged in and clickable links, or send them to another page.

= Looks like your site =

Pick an appearance preset, or switch to custom mode and set colours, fonts, fields and buttons with grouped controls that start from your theme colours and fonts. Choose a compact or comfortable density, and get a warning when text and background colours do not have enough contrast. Or let the form inherit the look of your active theme. There is no freeform custom CSS box: styling is done with structured settings.

= Fast and light =

SubtleForms adds its scripts and styles only to pages that contain a form. Code for date pickers, phone and country fields, uploads, repeaters, rich text and conversational forms is loaded only when the form uses that field or type. For a simple contact form, the plugin's own JavaScript is about 35 KB and its stylesheet about 11 KB, both gzip-compressed. It uses the copy of React that WordPress already ships.

= Spam protection and privacy =

Every form has a honeypot, a minimum time check and rate limiting, with no setup. You can add Google reCAPTCHA (v2 or v3), hCaptcha or Cloudflare Turnstile under Settings, Security and privacy; these are the only outside services the plugin can contact besides webhook URLs you enter (see External services). Choose how long entries are kept, and use the WordPress personal data export and erase tools for a person's entries. Uploaded files are stored under random names and served to admins only. SubtleForms sends no usage data or telemetry.

= Move from another form plugin =

Under Settings, Tools, Migrate, copy forms you made with Contact Form 7, Gravity Forms or Fluent Forms. The other plugin does not need to be active. Forms arrive as drafts with their fields, required rules, choices, email notifications and thank-you message, and a report names anything that was not copied. Entries and payment settings are not imported, no emails are sent, and your original forms are not changed. On a site with no forms yet, SubtleForms offers to import any it finds. You can also import a Gravity Forms or Fluent Forms export file.

= Accessible and translation ready =

Fields have labels, errors are announced and tied to their fields, choice groups use a fieldset with a legend, and dropdown, country, phone and date fields work with the keyboard. The plugin loads an RTL stylesheet for right-to-left sites and all text uses the `subtleforms` text domain with a translation template included.

= SubtleForms Pro =

SubtleForms Pro is a separate plugin sold at [subtleforms.com/pro](https://subtleforms.com/pro/). It adds Signature, Calculation and Picture choice fields, several files per upload field, advanced conditional logic, form analytics, Stripe payments with coupons, WooCommerce checkout, Mailchimp, Brevo, Kit, HubSpot, Salesforce, Pipedrive and Close connections, Zapier, Make and n8n, entry PDFs and more templates.

= Documentation and support =

* Documentation: [subtleforms.com/docs](https://subtleforms.com/docs/)
* Support forum: [wordpress.org/support/plugin/subtleforms](https://wordpress.org/support/plugin/subtleforms/)
* Bug reports and source code: [github.com/smhz101/subtleforms](https://github.com/smhz101/subtleforms)

== Installation ==

1. In wp-admin, go to Plugins, Add New, search for "SubtleForms", then click Install Now and Activate. Or upload the plugin ZIP under Plugins, Add New, Upload Plugin.
2. Go to SubtleForms, Add New, and start from a template or a blank form.
3. Build the form on the canvas, set where notifications go, and click Publish.
4. Add the form to a page with the SubtleForms block, or paste the shortcode `[subtleforms id="123"]` where you want it.

== Frequently Asked Questions ==

= Do I need to know how to code? =

No. You build forms by dragging fields onto a canvas and setting options in panels. Writing code is never required.

= Will SubtleForms slow down my site? =

The plugin loads its scripts and styles only on pages that contain a form, and the code for a date picker, uploads or other bigger fields only when a form uses it. See "Fast and light" in the description for measured sizes.

= How do I add a form to a page? =

Publish the form, then add the SubtleForms block in the block editor, or paste the shortcode shown in SubtleForms, All Forms, for example `[subtleforms id="123"]`.

= Does it work with my theme and page builders? =

The block works in the block editor, and the shortcode works anywhere WordPress runs shortcodes, such as a Shortcode or Text widget in a page builder. By default the form follows its own appearance preset, and you can set it to inherit your theme's colours and fonts.

= Can I build multi-step forms? =

Yes. Add a Page Break between fields and the form becomes multi-step. Visitors move through one step at a time and see their progress.

= What is a conversational form? =

A form that asks one question at a time, full screen, and lets the visitor review their answers before sending. Choose Conversational as the form type in the form settings.

= Can I use conditional logic? =

Yes. Open a field, go to its Logic tab and choose to show or hide it when other answers match. A hidden field is not validated or saved.

= Can I put fields side by side? =

Yes. Give fields a width such as 50% or 33% and they sit in one row. The inline layout puts an email field and a button on one row.

= Can I export entries? =

Yes. The Submissions screen exports entries as CSV, and SubtleForms, Settings, Tools exports forms and entries as JSON.

= Can I import my forms from another plugin? =

Yes, from Contact Form 7, Gravity Forms and Fluent Forms. Open SubtleForms, Settings, Tools, Migrate, pick the forms and import them as drafts. Entries are not imported.

= Is SubtleForms translation ready? =

Yes. All text uses the `subtleforms` text domain and a translation template is included, so it can be translated on translate.wordpress.org or with a translation plugin. Forms also have an RTL stylesheet.

= How do I stop spam? =

Every form has a honeypot, a minimum time check and rate limiting. You can also turn on one CAPTCHA provider under SubtleForms, Settings, Security and privacy.

= Does SubtleForms contact any outside server? =

Not by default. It only contacts a CAPTCHA provider if you turn one on, and the URLs you enter yourself for webhooks. It sends no usage data or telemetry. See External services.

= Are uploaded files private on nginx? =

Files are saved under a folder with a random name, without file extensions, and are only served to admins through wp-admin. Apache and IIS also get rules that deny direct access. On nginx, you can add `location ~* /wp-content/uploads/subtleforms-uploads { deny all; }` to your server block.

= What data does SubtleForms store? =

The answers a visitor sends, the time, and the visitor's IP address and browser user agent for spam checks. You can set how long entries are kept, and the WordPress privacy tools can export or erase a person's entries.

= Where do I report a bug or get help? =

Ask in the [support forum](https://wordpress.org/support/plugin/subtleforms/) on WordPress.org, or open an issue on [GitHub](https://github.com/smhz101/subtleforms/issues). Documentation is at [subtleforms.com/docs](https://subtleforms.com/docs/).

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

= 2.7.4 - 2026-11-04 =
* New: The SubtleForms menu and its Submissions item show the number of unread entries in a bubble, like the Comments menu, with counts above 9 shown as 9+.
* Change: SubtleForms has a new logo: the admin menu icon, the header mark and the block icon now use it.
* Change: Notices from WordPress and other plugins now appear under the SubtleForms header instead of above it.
* Change: SubtleForms screens have a footer with the version, documentation and support links and the list pagination, while the page content scrolls between the header and the footer.

= 2.7.3 - 2026-10-29 =
* New: Custom styling now has grouped, resettable controls that start from your theme colours and fonts, a compact or comfortable density, contrast warnings, and the builder preview shows the theme exactly as your site does.
* New: The Phone and Country fields have a new "Show country flags" setting that draws a small flag next to each country, loading the flag image only for forms that use it.
* Change: Removed freeform Custom CSS from the form builder for WordPress.org compliance. Structured appearance settings still work.
* Security: Classic form result storage, admin action nonces and every REST nonce check now sanitize request input before use, and public REST route detection normalizes REQUEST_URI before parsing.
* Security: The onboarding test email and the onboarding, tour and card dismiss routes now require the manage_options capability, the same as every SubtleForms screen.

= 2.7.2 - 2026-10-24 =
* Change: SubtleForms Pro builds older than 2.8.0 are not started by this version, to avoid errors. Update SubtleForms Pro to 2.8.0 or later.
* Change: Payment, pricing and coupon features are provided only by the add-on. This plugin no longer includes the order engine, and an entry's order is shown by the add-on.
* Change: A form that has a field no active plugin provides shows "This form is not available right now." and keeps its saved fields. Forms with only a leftover payments setting and no payment field keep working.
* New: On an empty site, SubtleForms offers to import forms from Contact Form 7, Gravity Forms, Fluent Forms and other detected form plugins.
* Change: Forms load without a loading flash, file uploads use a drop zone with a select button, repeater groups are labelled Entry N, and form settings let you choose the required-field mark and turn the validation summary on or off. Forms that have required fields show a short legend for the mark. Forms no longer paint a background by default, and inherit-from-theme keeps SubtleForms chrome for calendars and similar fields while using theme colours.
* Fix: The Preview tab uses one scrollbar for the canvas and styling controls.
* Change: Appearance presets no longer set form width; Layout / Form width stays a separate control so columns flex at full content width.
* Fix: The date picker trigger matches other fields, and the calendar panel is easier to read.

The full history is in changelog.txt in the plugin folder.

== Upgrade Notice ==

= 2.7.4 =
SubtleForms has a new logo, and the admin menu shows how many entries are unread.

= 2.7.3 =
If you use the SubtleForms Pro add-on, update it to 2.8.0 or later. Freeform Custom CSS is removed; structured appearance settings are kept.

= 2.7.2 =
If you use the SubtleForms Pro add-on, update it to 2.8.0 or later: older builds are not started by this version, to avoid errors. Payment, pricing and coupon features are provided only by the add-on.
