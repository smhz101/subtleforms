=== SubtleForms ===
Contributors: subtleforms, smhz101
Tags: form builder, contact form, forms, multi-step form, file upload
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 2.3.9
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Build contact, multi-step and conversational forms on a visual canvas, then read every entry in a clean inbox. Spam protection built in.

== Description ==

SubtleForms is a form builder for WordPress. You build a form on a canvas that looks like the live form, publish it with a shortcode or the SubtleForms block, and read the entries in an inbox inside wp-admin. Everything listed here is in this plugin and works without an account or a license.

= Building forms =

* Visual builder with a field library, a live canvas and a settings panel for each field (Settings, Validation, Logic, Style)
* Regular, multi-step and conversational (one question at a time) forms
* Ready-made templates, including contact, lead capture and newsletter forms, plus a blank form
* Field widths to place fields side by side, and an inline layout for email and button on one row
* Appearance presets, a custom mode for colours, fonts, fields and buttons, and an option to inherit the active theme
* Desktop, tablet and mobile preview

= Fields =

* Text, Paragraph, Email, Number, Phone, Website, Password, Name and Address
* Dropdown, Radio buttons, Checkboxes, Picture choice, Single checkbox, Toggle, Country, Consent and Dependent dropdowns (as menus, buttons or columns, typed in or loaded from CSV)
* Date, Time, Date and time, Rating, Opinion scale, NPS, Slider, Matrix, Colour picker and Rich text
* File and image uploads, one or several files per field, with allowed types and size limits, stored in a private folder and downloaded by admins only
* Payment fields: Product, Priced options, Custom amount, Fixed fee, Order summary and Coupon, with coupons managed under Payments. Entries are saved as "Payment pending" so you can collect payment yourself
* Hidden fields with merge values such as {user_email} and {get:param}, HTML blocks, section breaks, Repeater, Group and Columns

= Logic and after submit =

* Show or hide fields and steps when rules match: all or any rule, several groups of rules, and operators such as starts with, is one of, between and date rules. Hidden fields are not validated or saved, in the browser and on the server
* Send an email or webhook, or pick a confirmation, only when its rules match
* Email notifications and webhooks after each entry, with merge tags such as {all_fields}, {field:email} and {entry_id}, plain text or HTML
* A confirmation message with answers merged in, or a redirect
* Availability rules: logged-in visitors only, open and close dates, and an entry limit

= Entries =

* An inbox with tabs, search, filters and a reading pane
* Read and unread, star, flag, notes, resend notifications and a Trash, one entry at a time or in bulk
* CSV export of entries, JSON export and import of forms and entries, and import of Gravity Forms and Fluent Forms export files as draft forms
* Reports: views, submissions and conversion for each form, counted on your site without cookies (view counting can be turned off)
* Activity, webhook and API logs

= Spam protection and privacy =

* Honeypot, minimum time and rate limiting on every form
* Optional Google reCAPTCHA (v2 and v3), hCaptcha or Cloudflare Turnstile (see External services)
* Data retention settings and the WordPress personal data export and erase tools

= SubtleForms Pro =

SubtleForms Pro is a separate, paid add-on available at [subtleforms.com](https://subtleforms.com/pricing/). It adds Signature and Calculation fields, Stripe card checkout, WooCommerce checkout, Mailchimp, Brevo, Kit, HubSpot and Zapier integrations, entry PDFs, more templates, white label and WPML or Polylang support. This plugin does not need Pro, and nothing in this plugin is disabled without it.

== Installation ==

1. In wp-admin, go to Plugins, Add New, search for "SubtleForms", then click Install Now and Activate.
2. Go to SubtleForms, Add New, and start from a template or a blank form.
3. Publish the form and add it to a page with the SubtleForms block or the shortcode `[subtleforms id="123"]`.

== Frequently Asked Questions ==

= How do I add a form to a page? =

Publish the form, then add the SubtleForms block, or paste the shortcode shown in SubtleForms, All Forms, for example `[subtleforms id="123"]`.

= Does SubtleForms contact any outside server? =

Not by default. It only contacts a CAPTCHA provider if you turn one on, and the URLs you enter yourself for webhooks. See External services.

= How do I stop spam? =

Every form has a honeypot, a minimum time check and rate limiting. You can also turn on one CAPTCHA provider under SubtleForms, Settings, Security and privacy.

= Can I export entries? =

Yes. SubtleForms, Tools exports forms and entries as JSON, and the Submissions screen exports entries as CSV.

= Are uploaded files private on nginx? =

Files are saved under a folder with a random name, without file extensions, and are only served to admins through wp-admin. Apache and IIS also get rules that deny direct access. On nginx, you can add `location ~* /wp-content/uploads/subtleforms-uploads { deny all; }` to your server block.

= What data does SubtleForms store? =

The answers a visitor sends, the time, and the visitor's IP address and browser user agent for spam checks. It also counts form views per day, without storing who viewed. You can set how long entries are kept, and the WordPress privacy tools can export or erase a person's entries.

= Where are the docs and support? =

Documentation is at [subtleforms.com/docs](https://subtleforms.com/docs/). Ask questions in the support forum on WordPress.org.

== External services ==

SubtleForms works without any external service. The services below are used only when a site administrator turns them on.

= Google reCAPTCHA =

Used to check that a form is sent by a person. When reCAPTCHA is enabled under Settings, Security and privacy, the form page loads the reCAPTCHA script from google.com, which collects data about the visitor's browser and interaction. On submit, the site sends the visitor's response token and IP address to https://www.google.com/recaptcha/api/siteverify. [Terms of Service](https://policies.google.com/terms), [Privacy Policy](https://policies.google.com/privacy).

= hCaptcha =

Used for the same purpose when hCaptcha is enabled. The form page loads the script from js.hcaptcha.com, and on submit the site sends the response token and the visitor's IP address to https://hcaptcha.com/siteverify. [Terms of Service](https://www.hcaptcha.com/terms), [Privacy Policy](https://www.hcaptcha.com/privacy).

= Cloudflare Turnstile =

Used for the same purpose when Turnstile is enabled. The form page loads the script from challenges.cloudflare.com, and on submit the site sends the response token and the visitor's IP address to https://challenges.cloudflare.com/turnstile/v0/siteverify. [Terms of Use](https://www.cloudflare.com/website-terms/), [Privacy Policy](https://www.cloudflare.com/privacypolicy/).

= Webhooks =

When you add a webhook action to a form, each new entry is sent as JSON to the URL you enter. Nothing is sent to SubtleForms or any address you did not enter.

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

= 2.4.0 - 2026-10-20 =
<<<<<<< HEAD
* New: Each payment form can pick its own currency, and more currencies are available, including JPY, INR, PKR and AED.
* Fix: Forms follow the site currency unless you pick one, the Custom amount field shows the right symbol, and yen totals are whole yen.
* Fix: Coupons give the same total at payment and on submit, and coupon dates are checked.
* Fix: Draft forms are not priced for visitors, and small orders below the card minimum get a clear message.
* Fix: Product settings are under General, priced options are not shown selected on the canvas, and dropdown priced options use the standard picker.
* Fix: Failed payments show as Payment failed, payment messages can be translated, and Pro asks admins to connect Stripe when no gateway is set up.
* Fix: Tools export and import keep each entry's order and payment details.
=======
* Change: Entries refer to the form version they were sent with instead of keeping a full copy of the form. Older entries are cleaned up in the background and stay readable.
* Fix: Entries, emails, CSV exports, PDFs and integrations show option labels, Yes or No, matrix rows with their columns, dependent dropdown labels, dates and times in the field format, and product lines with prices.
* Fix: CSV exports list uploaded files by name with a download link.
* Fix: A very long field label is shortened in emails, exports, entries and the required message. The admin label is used when it is set.
* Fix: The submissions list names the sender by a name or email answer, or shows Anonymous, never a quantity or a choice.
>>>>>>> origin/pkg/F240-2

= 2.3.9 - 2026-10-19 =
* Change: Everything in SubtleForms works without a license: CSV export, reports, full conditional logic, Picture choice, several files per upload field, payment fields and coupons, and the Webhooks and Analytics settings.
* Change: Signature and Calculation fields and card payments are part of SubtleForms Pro 2.4.0. Forms that use them keep them; the live form leaves them out until Pro is active.
* Fix: Visitors can send a form from a cached page, their views are counted for Reports, and the spam time check uses the server clock.
* Fix: Entries show the label of the chosen option and Yes or No for consent, and the form preview stays centred beside the styling panel.
* Fix: HTML block markup is filtered when the form is saved and when it is shown.
* Fix: Answers the server refuses are not stored, and deleting a form deletes its entries, files and logs.
* Fix: The personal data tools match the exact email address, and imports are cleaned like a builder save.
* Fix: Name and Address parts, Notice, Section heading and Page break settings, Repeater uploads, dependent dropdowns and hidden priced fields work as set.
* Fix: Template emails go to the site owner, the builder header, preview, presets and load errors are easier to use, and Quick Start creates the form.
* Fix: Emails and integrations wait for a card payment to go through.
* Change: The AI assistant tab is removed, WordPress 6.6 is required, and deleting the plugin removes all its data on every site.

= 2.3.8 - 2026-10-19 =
* New: Dependent dropdowns open in a column editor. Each column is one dropdown, and choosing an item shows only what belongs to it.
* New: On the form, a dependent dropdown can show as dropdowns, buttons or columns.
* New: Dependent choices can be typed in or replaced from a CSV file, with an example file to download.

= 2.3.7 - 2026-10-18 =
* New: The submissions list can open an entry beside or below the inbox, with Previous and Next.
* New: List density can be comfortable, default or compact.
* New: Hidden is in the field library and accepts {user_email}, {user_name}, {date} and {get:param}.
* New: Repeater, Group and Columns use the same field toolbar as other fields.
* Fix: A field label can be up to 2,000 characters, so a long consent line saves.

The full history is in changelog.txt in the plugin folder.

== Upgrade Notice ==

= 2.3.9 =
Free plugin and SubtleForms Pro split cleanly: everything in this plugin works without a license. Requires WordPress 6.6. Update SubtleForms Pro to 2.4.0 at the same time.

= 2.3.8 =
Dependent dropdowns are edited as columns and can show as dropdowns, buttons or columns on the form.
