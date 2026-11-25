=== SubtleForms ===
Contributors: subtleforms, smhz101
Tags: form builder, contact form, multi-step form, conversational form, forms
Requires at least: 6.6
Tested up to: 7.2
Requires PHP: 8.1
Stable tag: 2.10.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Build contact, multi-step and conversational forms on a visual canvas, then read every entry in a clean inbox. No account needed.

== Description ==

SubtleForms is a form builder for WordPress. You build on a canvas that looks like the live form, publish with a shortcode or the SubtleForms block, and read every entry in an inbox inside wp-admin. One builder makes regular, multi-step and conversational forms, and everything described here is in this plugin and works without an account or a licence.

https://www.youtube.com/watch?v=NBc4yT3h7NQ

More tutorials on the [SubtleForms YouTube channel](https://www.youtube.com/@subtleforms).

= Everything in the free plugin =

* Visual drag and drop builder with a live canvas and undo
* Regular, multi-step and conversational (one question at a time) forms
* 40 field types, including file and image uploads, tabs and accordions
* 12 ready-made templates, plus a blank form
* Field widths to place fields side by side
* Conditional logic: show or hide a field based on other answers
* Appearance presets, or custom colours and fonts that start from your theme
* Desktop, tablet and mobile preview
* The SubtleForms block and a shortcode
* Entries inbox with search, filters, stars, flags, notes and a Trash
* Reports with a chart of recent submissions
* Email notifications with merge tags, plain text or HTML
* Confirmation message or redirect after submit
* Open and close dates, entry limits and logged-in-only forms
* CSV export of entries, JSON export and import of forms and entries
* Honeypot, minimum time and rate limiting on every form
* Optional Google reCAPTCHA, hCaptcha or Cloudflare Turnstile
* Full integration support for Mailchimp, Brevo, Kit, MailPoet, HubSpot and webhooks
* Import forms from Contact Form 7, Gravity Forms, Fluent Forms, WPForms and Ninja Forms
* Data retention settings and WordPress personal data export and erase support
* Translation ready, with an RTL stylesheet

= Three form types, one builder =

Start with a regular form that shows every field on one page. Add a Page Break and the same form becomes multi-step, with progress shown to the visitor. Switch to conversational and visitors answer one question at a time, full screen, then review their answers before they send. You change the type in the form settings and keep your fields.

= Drag and drop builder =

The field library is on the left, the canvas in the middle and the settings for the selected field on the right. The canvas shows the form as visitors see it, so there is no separate preview step to trust. Drag a field from the library, click it to add it after the current one, or press the slash key to search the library. Undo is in the header, and the Preview tab shows the form at desktop, tablet and mobile widths.

= Fields included =

* **Basic:** Text, Paragraph, Email, Number, Phone, Website, Name, Address and Password
* **Choices:** Dropdown, Radio buttons, Checkboxes, Single checkbox, Toggle, Country, Chained select and Consent
* **Date and time, and more:** Date, Time, Date and time, Rating, Opinion scale, NPS, Slider, Matrix, Colour picker, Rich text and Hidden
* **Uploads:** File and image uploads, with allowed types and size limits, kept private and downloaded by admins only
* **Layout:** Section heading, Custom HTML, Notice, Page Break, Repeater, Tabs and Accordion
* **Spam protection:** reCAPTCHA, hCaptcha and Turnstile fields

= Ready-made templates =

Start from a template and change what you need: Contact Form, Simple Contact, Contact + Attachment, Lead Capture, Newsletter, Newsletter Sign-Up, Free Resource Download, Product Feedback, Website Feedback, Customer Satisfaction (CSAT), RSVP and Bug Report. Or start with a blank form.

= Conditional logic =

Show or hide a field when other answers match. Hidden fields are not validated or saved, in the browser and on the server, so a hidden required field never blocks a submission.

= Entries inbox and reports =

Entries arrive in an inbox with tabs, search, filters and a reading pane. Mark entries read or unread, star or flag them, add notes, resend notifications, and move them to the Trash, one at a time or in bulk. The SubtleForms menu shows how many entries are unread, and Reports show a chart of recent submissions. Export entries as CSV whenever you need them.

= Notifications and integrations =

Send an email after each entry to the people you choose, with merge tags such as {all_fields} and {field:email}, in plain text or HTML. After submit, show a confirmation message or send visitors to another page. SubtleForms has full integration support for Mailchimp, Brevo, Kit, MailPoet, HubSpot and webhooks, set up under Settings, Integrations and switched on per form.

= Looks like your site =

Pick an appearance preset, or switch to custom mode and set colours, fonts, fields and buttons with controls that start from your theme. Or let the form inherit the look of your active theme. You get a warning when text and background colours do not have enough contrast.

= Fast and light =

SubtleForms adds its scripts and styles only to pages that contain a form, and loads the code for bigger fields such as date pickers, uploads and conversational forms only when a form uses them. For a simple contact form, the plugin's own JavaScript is about 35 KB and its stylesheet about 11 KB, both gzip-compressed.

= Spam protection and privacy =

Every form has a honeypot, a minimum time check and rate limiting, with no setup. You can add Google reCAPTCHA, hCaptcha or Cloudflare Turnstile under Settings, Security and privacy. Choose how long entries are kept, and use the WordPress personal data export and erase tools for a person's entries. SubtleForms sends no usage data or telemetry.

= Move from another form plugin =

Under Settings, Tools, Migrate, copy forms you made with Contact Form 7, Gravity Forms, Fluent Forms, WPForms or Ninja Forms. Forms arrive as drafts with their fields, rules, choices, notifications and thank-you message, and your original forms are not changed.

= Accessible and translation ready =

Fields have labels, errors are announced and tied to their fields, and dropdown, country, phone and date fields work with the keyboard. The plugin loads an RTL stylesheet for right-to-left sites and includes a translation template.

= SubtleForms Pro =

SubtleForms Pro is a separate plugin sold at [subtleforms.com/pro](https://subtleforms.com/pro/). It adds more fields, advanced conditional logic, form analytics, payments, more integrations, entry PDFs and more templates.

= Documentation, tutorials and support =

* Documentation: [subtleforms.com/docs](https://subtleforms.com/docs/)
* Video tutorials: [youtube.com/@subtleforms](https://www.youtube.com/@subtleforms)
* Support forum: [wordpress.org/support/plugin/subtleforms](https://wordpress.org/support/plugin/subtleforms/)

== Installation ==

1. In wp-admin, go to Plugins, Add New, search for "SubtleForms", then click Install Now and Activate.
2. Go to SubtleForms, Add New, and start from a template or a blank form.
3. Build the form on the canvas, set where notifications go, and click Publish.
4. Add the form to a page with the SubtleForms block, or paste the shortcode `[subtleforms id="123"]` where you want it.

The video at the top of this page shows these steps.

== Frequently Asked Questions ==

= Do I need to know how to code? =

No. You build forms by dragging fields onto a canvas and setting options in panels.

= Will SubtleForms slow down my site? =

No. It loads its scripts and styles only on pages that contain a form, and the code for bigger fields only when a form uses them.

= How do I add a form to a page? =

Publish the form, then add the SubtleForms block in the block editor, or paste the shortcode shown in SubtleForms, All Forms, for example `[subtleforms id="123"]`.

= Does it work with my theme and page builders? =

The block works in the block editor, and the shortcode works anywhere WordPress runs shortcodes. A form can follow its own appearance preset or inherit your theme's colours and fonts.

= Can I build multi-step or conversational forms? =

Yes. Add a Page Break between fields for a multi-step form, or choose Conversational as the form type to ask one question at a time.

= Can I connect my email marketing or CRM tool? =

Yes. Mailchimp, Brevo, Kit, MailPoet and HubSpot are supported, and webhooks send entries to any other service. Connect them under SubtleForms, Settings, Integrations.

= Can I import my forms from another plugin? =

Yes, from Contact Form 7, Gravity Forms, Fluent Forms, WPForms and Ninja Forms, under SubtleForms, Settings, Tools, Migrate.

= How do I stop spam? =

Every form has a honeypot, a minimum time check and rate limiting. You can also turn on one CAPTCHA provider under SubtleForms, Settings, Security and privacy.

= Does SubtleForms contact any outside server? =

Not by default. It only contacts the services you turn on yourself, listed under External services. It sends no usage data or telemetry.

= Are uploaded files private on nginx? =

Files are saved under a folder with a random name and served to admins only. Apache and IIS also get rules that deny direct access. On nginx, add `location ~* /wp-content/uploads/subtleforms-uploads { deny all; }` to your server block.

= Where can I get help? =

Watch the tutorials on [YouTube](https://www.youtube.com/@subtleforms), read the [documentation](https://subtleforms.com/docs/), or ask in the [support forum](https://wordpress.org/support/plugin/subtleforms/).

== External services ==

SubtleForms works without any external service. Each service below is used only after a site administrator turns it on, and only for that site's forms.

= Google reCAPTCHA =

Spam check. The form page loads the script from google.com, and on submit the site sends the response token and the visitor's IP address to https://www.google.com/recaptcha/api/siteverify. [Terms of Service](https://policies.google.com/terms), [Privacy Policy](https://policies.google.com/privacy).

= hCaptcha =

Spam check. The form page loads the script from js.hcaptcha.com, and on submit the site sends the response token and the visitor's IP address to https://hcaptcha.com/siteverify. [Terms of Service](https://www.hcaptcha.com/terms), [Privacy Policy](https://www.hcaptcha.com/privacy).

= Cloudflare Turnstile =

Spam check. The form page loads the script from challenges.cloudflare.com, and on submit the site sends the response token and the visitor's IP address to https://challenges.cloudflare.com/turnstile/v0/siteverify. [Terms of Use](https://www.cloudflare.com/website-terms/), [Privacy Policy](https://www.cloudflare.com/privacypolicy/).

= Mailchimp, Brevo and Kit =

After an entry is saved, the site sends the email address, the answers the administrator mapped, tags and subscription status to the connected service: https://<data center>.api.mailchimp.com, https://api.brevo.com or https://api.kit.com. Mailchimp [Terms of Use](https://mailchimp.com/legal/terms/), [Privacy Policy](https://www.intuit.com/privacy/statement/); Brevo [Terms of Use](https://www.brevo.com/legal/termsofuse/), [Privacy Policy](https://www.brevo.com/legal/privacypolicy/); Kit [Terms of Service](https://kit.com/terms), [Privacy Policy](https://kit.com/privacy).

= HubSpot =

After an entry is saved, the site sends the email address and the answers the administrator mapped to https://api.hubapi.com to create or update a contact. [Terms of Service](https://legal.hubspot.com/terms-of-service), [Privacy Policy](https://legal.hubspot.com/privacy-policy).

= Webhooks =

Each entry is sent as JSON only to the URL the administrator enters.

== Screenshots ==

1. The form builder with the field library, canvas and field settings.
2. Conditional logic for a field.
3. A multi-step form on the live site.
4. A conversational form on the live site.
5. The submissions inbox with an entry open in the reading pane.
6. The form preview with appearance presets.

== Changelog ==

= 2.10.0 - 2026-11-25 =
* New: Text fields such as Name and Company now tell browsers what they ask for, so autofill and password managers can fill them, and each field has an Autofill setting to choose or turn it off.
* New: Dropdowns jump to the option you type, and lists with more than 15 options have a search box.
* New: Site admins now see a short note where a form embed points to a missing or unpublished form, and visitors with JavaScript turned off see a message instead of an empty space.
* New: Multi-step and conversational forms keep a visitor's answers and step if the page is reloaded, until the form is sent.
* New: Bulk actions on Submissions can apply to every entry that matches the current view, not only the visible page.
* Change: The builder warns when a Repeat container has no fields, since it shows nothing on the form.
* Change: New sites now keep their forms and entries if SubtleForms is deleted (Settings, Advanced), and the Plugins screen says whether deleting will remove them. Existing sites keep their current choice.
* Change: Spam entries no longer appear in All, Read and Unread or count toward the unread badge. They stay in the Spam tab, where Not spam moves them back.
* Change: The builder warns about fields that are not shown on the form yet, such as Post Selection, and the Password field says the password is not saved.
* Fix: A condition sent on a notification through the API is no longer dropped, and the entry log now says when a notification was sent without its conditions being checked because SubtleForms Pro is not active.
* Fix: The Form filter on the Submissions screen now lists every form, not only the newest 20, and can be searched.
* Fix: The SubtleForms block's form picker lists every published form, with search, and shows each form's id.
* Fix: In the form builder, Cmd/Ctrl+Shift+Z and Ctrl+Y now redo the last undone change.
* Fix: The Build, Settings, Entries and Preview tabs in the form builder keep their names for screen readers and show a tooltip when the window is too narrow for their text.
* Fix: Conversational forms keep the Next button on screen on shorter windows, and after Enter the cursor is ready in the next question.
* Fix: The entry panel shows the country name for a Country answer instead of its code.
* Fix: Conditional logic rules that compare a date or time with greater than or less than now work; they used to never match.
* Fix: The email step in the submission log now shows From, Reply-To, format and a readable text preview instead of cut-off HTML.
* Fix: HTML notification emails now include a plain text version, which helps them stay out of spam folders.
* Fix: The sender domain warning no longer fires on www sites, {admin_email} follows the admin email set in plugin settings, and the email notification editor shows who mail is sent from.
* Fix: Exporting the entries of all forms now uses each field's label as the column heading instead of its internal key.
* Fix: Export CSV now works on the Starred, Unread and Read tabs, and says so when there is nothing to export.
* Fix: Forms set to inherit the theme style get comfortable padding and height on text boxes when the theme does not set any.
* Fix: The Star button in the entry panel now shows when the entry is starred, and stays in step with the star in the list.
* Fix: Phone answers are saved as the visitor typed them, with spaces kept, and a number typed with dots, such as 415.555.0100, is saved with spaces and passes validation.
* Fix: Rich text toolbar buttons are named for screen readers by their labels alone, Checkboxes created through the API render as checkboxes, and the builder flags a Chained Select that has no options yet.
* Fix: Entry dates in the list, the entry panel and its activity log now follow the time zone in Settings, General, so everyone sees the same time.
* Fix: Export selected from the Spam tab now exports those entries, and importing a package twice no longer duplicates its spam entries.
* Fix: Saving a form from a tab that was opened before someone else's save no longer overwrites their changes; the builder asks whether to reload or replace.
* Fix: An auto-reply that is not sent because submitter emails are off is now logged as Skipped with the reason, and the notification editor warns about it; new sites start with submitter emails on.
* Fix: A visitor who sends a form within the first seconds, for example after browser autofill, is no longer silently dropped by the spam time trap; the form waits a moment and sends.
* Fix: A CAPTCHA field without keys no longer blocks every visitor; it is skipped until keys are added, and only site admins see the setup message.
* Fix: Searching entries now finds answers written in Arabic, Urdu, Chinese, Cyrillic and other non-Latin scripts, including entries saved before this update.
* Fix: A form placed twice on one page now gives each copy its own field ids, so labels and error links point at the right copy.
* Fix: Opening an unread entry now lowers the Unread count straight away, and the entry leaves the Unread list when you close it.
* Security: SubtleForms checks whether uploaded files can be opened from the web, for example on nginx, and shows the server rule to block them in Site Health and on SubtleForms screens.

= 2.9.1 - 2026-11-16 =
* Change: The Upgrade to Pro item in the admin menu and in the admin bar is a lime button that opens the Pro page on subtleforms.com in a new tab, and the separate Upgrade to Pro page is gone.
* Fix: The SubtleForms block icon in the editor is the same size as the other block icons.

= 2.9.0 - 2026-11-16 =
* New: Tabs and Accordion layout containers let you group fields into tabs or collapsible sections, with errors in a closed tab or section opened and focused on submit.
* New: Add-ons can show country flags in the Address field: Free draws the flags when an add-on declares the address_flags feature and the field has showFlags on, and loads flag images only for forms that use it.
* New: Add-ons can draw under each answer on the entry screen, and email and confirmation text can use parts of an address or name answer, such as {field:address:city}.
* Change: Add-ons can add parts to the Address field and draw it around the built-in one, the Address field now stores only its own parts, and the validate_value filter now runs for the Name and Address fields.
* Change: The Appearance panel in Preview now looks like the field settings panel, with Presets and Custom tabs and ten new themes (Clean, Soft, Bordered, Editorial, Compact, Rounded, Classic, Dark and High contrast beside Inherit from theme), the preview loads what your theme loads so Inherit from theme looks like your site, and a Light and Dark switch changes the page around the form.
* Change: The Date, Time and Date & time fields now use a typed input with an icon button instead of a button, so a theme styles them like any other field. The calendar has month and year views and skips days that cannot be picked, the time list steps by a minute step you choose, and the formats are presets with an example instead of free text. New options: first day of the week, earliest and latest date (a date or a relative date such as +7 days), no past dates, unavailable weekdays, earliest and latest time, and a default of today or now. The limits are checked on the server and in the browser with the same messages. Saved values do not change: dates stay Y-m-d, times H:i and date and times Y-m-dTH:i. A saved relative minimum such as today is now enforced on the server too.
* Change: The field settings panel in the form builder is one scrolling sheet of property rows instead of four tabs, with Required, Width and Visibility at the top.
* Fix: The field settings panel now shows a control's default until it is saved, shows placeholders on number settings, and disables a setting that an add-on marks as disabled.
* Fix: The pickers on a form that uses the theme look (dropdown, country, address, date and time) now load their own small stylesheet, picker.css, so they no longer show up unstyled or twice next to the theme's own select. The stylesheet is only loaded for forms that have a picker. (#109)

The full history is in changelog.txt in the plugin folder.

== Upgrade Notice ==

= 2.10.0 =
Spam no longer counts in All, Read and Unread, bulk actions can cover every matching entry, answers survive a page reload, and a Site Health check flags uploaded files that can be opened from the web, for example on nginx. Recommended for everyone.

= 2.9.0 =
Adds Tabs and Accordion layout fields, new appearance themes and a typed date and time picker.

= 2.8.1 =
Fixes lost or cut-off answers (a "<" in an answer, very long browser user agents), emails that could be dropped when WP-Cron ran late, duplicate entries from double clicks and large CSV exports, and includes a security fix for the Rich Text field. Recommended for everyone.
