=== SubtleForms ===
Contributors: subtleforms, smhz101
Tags: form builder, contact form, forms, multi-step form, file upload
Requires at least: 6.6
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 2.6.1
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

SubtleForms Pro is a separate, paid add-on available at [subtleforms.com](https://subtleforms.com/pricing/). It adds Signature and Calculation fields, Stripe card checkout, WooCommerce checkout, Mailchimp, Brevo, Kit, HubSpot and Zapier integrations, entry PDFs, more templates, white label branding (Agency licences set it in the licence portal on subtleforms.com) and WPML or Polylang support. This plugin does not need Pro, and nothing in this plugin is disabled without it.

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

Yes. Settings, Tools exports forms and entries as JSON, and the Submissions screen exports entries as CSV.

= Are uploaded files private on nginx? =

Files are saved under a folder with a random name, without file extensions, and are only served to admins through wp-admin. Apache and IIS also get rules that deny direct access. On nginx, you can add `location ~* /wp-content/uploads/subtleforms-uploads { deny all; }` to your server block.

= What data does SubtleForms store? =

The answers a visitor sends, the time, and the visitor's IP address and browser user agent for spam checks. It also counts form views per day, without storing who viewed. You can set how long entries are kept, and the WordPress privacy tools can export or erase a person's entries.

= Does the form funnel track visitors? =

No. It keeps daily totals per form of how many people saw, started and left a form and the last field touched. It sets no cookies and stores no answers, IP addresses or other personal data.

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

= 2.6.1 - 2026-10-23 =
* Change: A form on your site now appears sooner and without a gap: its fields and labels are printed in the page and drawn from there instead of being fetched after the page loads, and a plain outline of the form is shown until the form is ready.
* Fix: The SubtleForms block now keeps the form's own styling (colours, theme and layout) both on your site and in the editor preview, the preview is marked and cannot be used, and a theme chosen in the block still overrides it.
* Fix: The "Rows per page" label in the list footers now sits on one line with its select instead of above it.

= 2.6.0 - 2026-10-22 =
* New: A form funnel on the Reports screen shows how many people saw, started and sent each form and the last field people touched before leaving without sending it, with a plain suggestion for each field; it keeps only daily totals per form, sets no cookies, stores no answers or IP addresses, skips robots and people who manage SubtleForms, and follows the Count form views switch. Form views are no longer counted for people who manage SubtleForms either, so Seen and Started count the same visitors.
* New: Settings, Tools, Migrate finds the forms you made with Contact Form 7, Gravity Forms or Fluent Forms on this site and imports the ones you tick as drafts, with their fields, required rules, choices, email notifications and thank-you message, and a report of anything that could not be copied; entries and payment settings are not imported and the original forms are not changed. Email notifications have a Reply-To setting that takes one address or a field tag such as {field:email}, and imported forms keep their Reply-To.
* New: New forms now stop spam robots quietly without a CAPTCHA, because the hidden trap field and the too-fast check are on by default for every form you create, the dashboard shows how many spam messages were blocked in the last 30 days and why, each form shows its own count under Spam protection, and sites that update get a one-time offer to turn both on for all their forms with Undo.
* Change: Forms load faster: every page with a form now downloads 22 percent less SubtleForms code (46 KB instead of 59 KB compressed), the date picker, phone and country lists, uploads, payments and the conversational layout are only downloaded by forms that use them, pages without a form still load nothing, and on a slow mobile connection a form is ready about a quarter of a second sooner.
* Change: The SubtleForms screens no longer pin the WordPress admin menu in its own scrolling column on short windows; the menu behaves as in WordPress.
* Change: The Submissions screen no longer has a New tab, because All already lists unread entries; an old link to the New tab opens All.
* Change: Tools is now a tab in Settings, with an MCP tab right after it (Pro adds its screen; without Pro it explains MCP and links to the upgrade page). The old Tools address opens the Tools tab.
* Change: Report panels no longer scroll inside their own boxes: long lists in Form funnel and Each form show the top rows with a Show all button, and every panel fits from phone to wide screens.
* Fix: The Submissions footer (result count, previous and next, rows per page) stays at the bottom edge of the list pane with no entries, a few or many.
* Fix: Submissions lists past the first 100 entries when 50 or 100 rows per page are chosen, and an empty page after the last row was removed keeps its real page count so Previous works.
* Fix: Choosing 50 or 100 rows per page on the Submissions screen lists the entries instead of showing "Entries could not be loaded".

= 2.5.0 - 2026-10-21 =
* Change: The Branding tab is gone from Settings. White label branding for Agency licences is set once in the licence portal on subtleforms.com and applied by SubtleForms Pro on every site that uses the licence.
* Fix: The date, time and date and time pickers work from the keyboard. Focus moves into the dialog when it opens, the hour and minute columns take the arrow keys, Home, End and Enter, and Escape returns focus to the field.
* Fix: The Country and phone country search is announced as a combobox with the active country, Escape returns focus to the field instead of the page, and required dropdown, country, date and time fields are marked required for screen readers.
* Fix: The small grey text in the Columns layout headers, prefix and suffix text and country codes is darker so it reaches the 4.5 to 1 contrast WCAG asks for.
* Fix: On the builder canvas, Radio and Checkboxes fields show their default choices selected, like Dropdown and Toggle already did.
* Fix: A logic rule on a Country field matches whether the field stores the country code or the country name, in the browser and on submit.
* Fix: Entries sent from the builder Preview are left out of the dashboard totals, today, week and trend, reports, the unread count, the Inbox and a form's entry limit. They show as Preview and can be listed with the Result filter.
* Change: The create form dialog, the quick start wizard and Form settings use the same wording and help for the form name, description and form types.
* Change: In Form settings, Notifications, the Send email and Send to webhook buttons are one group with a gap, above the list and again below it once there is a notification. The webhook is called "Webhook" everywhere.
* New: A webhook sends only the data you tick: form, entry details, each answer and, on payment forms, the amount, currency and status. A live example shows the exact JSON, and "View as JSON" edits the same body with merge tags. Webhooks saved before keep sending the same body.
* Fix: Custom headers of a webhook are name and value rows you can type into, with a JSON view. Before, the field put the old text back on every keystroke. Headers that SubtleForms sets itself, such as Host and the signature, are refused with a reason.
* Change: The webhook test in a form sends the ticked data built from the form's own fields.
* Fix: The question text of a Checkbox grid is no longer a label that points at a control which does not exist, so screen readers name the group once.
* Fix: The Submissions list no longer scrolls sideways in a narrow pane, shows each entry on two lines with a sticky footer and a slim icon bulk bar, shows a count on every tab that updates at once after each action, marks starred entries with a flat amber star only, and gives each row action its own tooltip.

= 2.4.1 - 2026-10-20 =
* Fix: Choosing 50 or 100 rows per page on the Forms screen shows the forms instead of "Forms could not be loaded".
* Fix: Clearing a saved setting, such as an API key or a sender name, saves it empty instead of keeping the old value.
* Fix: A form has no padding of its own, so it lines up with the text around it.
* Fix: No line or border above the submit button.
* Change: "Inherit from theme" adds no styling of its own. The theme styles the fields, labels and buttons, and the buttons use the theme's button style. Custom controls such as the dropdown and date pickers, the signature pad and the rich text editor keep their look so they stay usable.
* Change: A form on "Inherit from theme" whose colours, type or field and button style were changed keeps the SubtleForms styling, starting from the theme. The appearance panel says which applies.
* Fix: On a theme form whose theme has no primary colour, the submit button is no longer white on white.
* Change: Fields on the builder canvas use flat colours instead of gradients.
* Fix: A webhook address typed without https:// gets it, and an address WordPress refuses (a local or private host, or a port other than 80, 443 and 8080) is listed in the entry's activity log with the reason instead of failing silently.
* Fix: Webhooks no longer send the form's spam check token, the honeypot or CAPTCHA tokens with the answers.
* Change: The default webhook body is the one the Webhooks settings describe, and the one SubtleForms Pro sends: the event, form and entry IDs, a link to the entry, the answers keyed by field under "fields", and every answer with its label under "answers". Receivers that read answers at the top level of the body should read them from "fields".
* Fix: The webhook test in Settings works without SubtleForms Pro. The button is ready as soon as an address is typed, the test uses the same address check, body and signing as real deliveries, and it says why an address is refused.
* New: Each webhook action in Form settings has a Send test request button that sends the action's own method, headers, signing and custom body.
* Change: A field ID can use hyphens and up to 64 characters. Saving a form refuses an ID used by two fields anywhere in the form (inside steps, columns and containers too) or a name SubtleForms reserves for its own values.
* Change: Gravity Forms and Fluent Forms imports keep each field's name from the other plugin (Fluent's field name, Gravity's parameter name) as its field ID when it is valid, so data and integrations that use those names keep matching.
* New: Change a field's ID in the field settings. Click the pencil next to the ID, type the new one, press Enter. The ID is checked as you type, and merge tags, formulas, conditional logic, emails, webhooks, confirmations, integrations and payment settings that use it are updated. Undo puts it back, and earlier entries keep their answers under the old ID.
* Fix: Forms imported in Tools, migrated from Gravity Forms or Fluent Forms, or created with a schema get the same save steps as a builder save, so add-ons such as SubtleForms Pro can finish them (a signed webhook gets its secret, logic rules for missing fields are removed).
* Fix: The live form sends the page's language with its requests when a translation add-on gives one, so translated labels and confirmations are used.
* New: An action, subtleforms/submission/deleted, fires when an entry is deleted for good, so add-ons can remove what they keep about it.
* Fix: Settings, Integrations lists integrations your SubtleForms Pro plan does not include with the plan that has them, and an integration's status dot turns green as soon as it is switched on and set up, without a reload.
* Fix: Entry ages read 1 hour ago, 1 minute ago and 1 day ago instead of using the plural for one.
* Fix: Deleting a coupon, discarding changes, deleting forms or steps, resetting settings and export errors use the SubtleForms dialog instead of the browser's confirm and alert boxes.
* Change: In the builder the field inspector's first tab is called Field and its Appearance section is called Display, so they are not confused with the Settings view and the Style tab.
* Fix: On a window shorter than the WordPress menu, SubtleForms screens fill the window instead of showing a dark band under the page, and the lower menu items stay reachable.
* Fix: On a phone the form builder says it needs a wider screen instead of showing a clipped toolbar, with a button back to the forms and an option to open it anyway.
* Fix: With the reading pane on the right, a narrow window shows the open entry over the list at full width, and its actions wrap onto a second line instead of overlapping or being cut off.
* Fix: On a phone the forms and submissions lists show each row as a card instead of a table that scrolls sideways, checkboxes keep their normal size, the tabs stay on one line and the search box gets its own line.
* Fix: The Quick Start Wizard fits the window on every step with its buttons always in view, and the Help & tour menu closes when you pick Start Tour or View Documentation.
* Fix: The builder tour describes the real header buttons, shows the toolbar and settings of a selected field, and no longer scrolls the page.
* Fix: Pages with a form no longer jump when the form appears: the space for the form is kept from the start.

= 2.4.0 - 2026-10-20 =
* New: Each payment form can pick its own currency, and more currencies are available, including JPY, INR, PKR and AED.
* Fix: Forms follow the site currency unless you pick one, the Custom amount field shows the right symbol, and yen totals are whole yen.
* Fix: Product and priced option answers in entries, emails and exports show whole units for every currency without cents, such as KRW, not only for JPY.
* Fix: Entries, CSV exports and resent emails show prices in the currency the entry was charged in, so changing the site or form currency later does not relabel older entries.
* Fix: Coupons give the same total at payment and on submit, and coupon dates are checked.
* Fix: Draft forms are not priced for visitors, and small orders below the card minimum get a clear message.
* Fix: Product settings are under General, priced options are not shown selected on the canvas, and dropdown priced options use the standard picker.
* Fix: Failed payments show as Payment failed, payment messages can be translated, and Pro asks admins to connect Stripe when no gateway is set up.
* Fix: Tools export and import keep each entry's order and payment details.
* Change: Entries refer to the form version they were sent with instead of keeping a full copy of the form. Older entries are cleaned up in the background and stay readable.
* Fix: Entries, emails, CSV exports, PDFs and integrations show option labels, Yes or No, matrix rows with their columns, dependent dropdown labels (also in the Webhook action's full payload), dates and times in the field format, and product lines with prices.
* Fix: CSV exports list uploaded files by name with a download link.
* Fix: A very long field label is shortened in emails, exports, entries and the required message. The admin label is used when it is set.
* Fix: The submissions list names the sender by a name or email answer, or shows Anonymous, never a quantity or a choice.
* Fix: The server checks every answer the way the form does: choices, dates, times, ratings, sliders, matrix answers, colours, signatures and read-only fields. Its messages match the form and can be translated.
* Fix: Email fields accept several addresses when allowed, and user@localhost when RFC validation is off. A website typed without https:// gets it.
* Fix: Pasted international phone numbers pick their country, the leading 0 is dropped, and the server checks the calling code and length.
* Fix: Custom amount limits, Product quantity limits and Priced options are enforced instead of charging a different amount.
* Fix: A required Rich text field with no text is refused, and a Repeater below its minimum shows one message.
* Fix: Hidden field values are worked out on the server, and Order summary and Fixed fee fields store nothing.
* Fix: A failed builder save names the field, and numeric labels, placeholders and default values save.
* Fix: The admin and confirmation email switches apply to every form, and the saved sender is used when an email has no From address.
* Fix: Submitting the form preview does not send email or webhooks, does not count toward the entry limit, and is only available to an administrator.
* Fix: A form block that is not using AJAX submits with a normal page load.
* Fix: A form block that is not using AJAX shows the errors and keeps the answers when a submission is refused, shows the confirmation message once it is accepted, and follows a redirect confirmation only after a successful submission.
* Fix: A form block that is not using AJAX follows a confirmation redirect to another site, as the AJAX form does, instead of sending visitors to the home page.
* Fix: Confirmation messages and redirects fill merge tags.
* Fix: A custom webhook body fills merge tags.
* Fix: Resend says when the email was not queued, and sending it again still sends.
* Fix: Removing a flag or spam label restores the entry status, including a payment status.
* Fix: Delete follows the Trash or Hard setting for forms and entries.
* Fix: The New count follows the form you are viewing, and opening an entry marks it read in the list.
* Fix: Dashboard counts refresh when an entry is saved.
* Fix: Dashboard and reports count from midnight in the site timezone.
* Fix: Autosave uses the interval in Settings, and turning it off stops it.
* Fix: A link to an entry loads that entry even when it is past the first page. The list keeps its tab and search, and Back returns to the list.
* Fix: Confirmation rows use the same spacing as the rest of the builder.
* Fix: A form in a block is the same width as the same form in a shortcode.
* Fix: A theme-styled form uses the theme button, the theme font and the width of the content column, and the builder preview loads the theme fonts.
* Fix: Publishing a form no longer looks unpublished when the only difference is the order of appearance settings.
* Fix: Gravity Forms and Fluent Forms imports keep pages, hidden fields, names and conditional logic, and leave payment, quiz and post fields out.
* Fix: On Tools, choosing a file is one keyboard stop, notices clear when you change section, and forms with the same title show their number and status.
* Fix: Importing entries warns when a file is from another form and skips entries that are already there. The transfer screen says notes, the IP address, the browser, files, logs and unpublished drafts are not in the file.
* Fix: Importing the same entries file again skips entries that were flagged, marked as spam, restored, read or starred since, and two different entries with the same answers at the same time are both imported.
* Fix: A webhook that is still waiting says Queued.
* Fix: A color field saves the color it shows, including its default.
* Fix: Each CAPTCHA field uses its own provider and keys, and the form says when a check is not set up.
* Fix: A form has one CAPTCHA field per provider. Publishing a second reCAPTCHA, hCaptcha or Turnstile field is refused with a message, and the visitor's token is checked once.
* Fix: When publishing is refused because of a field, the builder shows the reason instead of [object Object].
* Fix: Password fields can show a strength meter and ask for the password again.
* Fix: A US phone number is grouped as it is typed, and a short number is rejected.
* Fix: Dropdown, radio and multiple choice start with choices, and the canvas shows the default choice.
* Fix: Choice groups are not tied to a missing control, prefix and suffix text is named for screen readers, and a consent link uses the words already in the sentence.
* Fix: A section heading and custom HTML each take a full row, and column layouts use a real column count.
* Fix: Hidden and color fields no longer repeat the admin label or the default value.
* Fix: Net Promoter Score has a low and a high label, and a Calculation field has a prefix and a suffix.
* Fix: An Action Hook field runs when the form is shown and when it is submitted.
* Fix: Logic for a checkbox, toggle or country offers the real values, and an off toggle counts as empty.
* Fix: The second dependent dropdown lists only the choices that belong to the first answer, and the first dropdown keeps its label.
* Fix: Replacing dependent dropdowns from a file asks first, and a semicolon file imports as separate columns.
* Fix: Dropdown, country, phone and date fields work from the keyboard. The calendar can jump to a month and year, and country buttons show a letter code.
* Fix: The first invalid dropdown, country, date or phone control receives focus.
* Fix: Fields inside a column saved as an object with its own fields list are shown, checked and sent, so a product there is not charged unseen.
* Fix: Deleting a field inside a step or container shows the Field deleted notice with Undo.
* Fix: If the forms list fails to load after you change tab, search or sort, the old rows are cleared instead of shown under the new tab.
* Fix: If the entries list fails to load after you change tab, search, date or form, the old entries are cleared instead of shown under the new filters.
* Fix: A desktop preview wider than the builder canvas is scaled from its top left corner and stays whole and centred.
* Fix: The Payment Form template's product is a fixed product with no quantity box in the builder or on the form, and it is charged once.
* Fix: The Donation Form template's Custom Amount is required, with a minimum of 1, so a donation form cannot be sent without a donation.
* Fix: Templates lose only card number, expiry and CVV inputs. A field that just mentions a card, such as a gift card message, is kept.
* Fix: A payment template that already has Priced options or a Custom Amount gets no extra fixed product, and a multi-step template gets its payment fields inside its steps.
* Fix: Conditional logic on the server reads a website as it was typed, so a rule for example.com still shows, stores and charges the fields it controls.
* Fix: The form checks a Product quantity before sending, with the same whole number, minimum and maximum rules as the server.
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

= 2.6.1 =
Forms appear faster, and the SubtleForms block shows the form with its own style in the editor and on the site.

= 2.6.0 =
Spam protection (the hidden trap field and the too-fast check) is on for new forms only. Nothing changes for your existing forms unless you accept the offer on the SubtleForms dashboard to turn it on for all of them.

= 2.5.0 =
The Branding tab is gone from Settings. White label branding for Agency licences is now set in the licence portal on subtleforms.com. Update SubtleForms Pro to 2.5.0 at the same time.

= 2.4.1 =
Webhooks now send the documented body, with answers under "fields", and can be tested without Pro. If a receiver reads answers at the top level of the body, update it to read them from "fields". Field IDs can be edited. Update SubtleForms Pro to 2.4.2 at the same time.

= 2.4.0 =
Field options, CAPTCHA keys, dependent dropdowns and keyboard use of dropdowns, country, phone and date fields.

= 2.3.9 =
Free plugin and SubtleForms Pro split cleanly: everything in this plugin works without a license. Requires WordPress 6.6. Update SubtleForms Pro to 2.4.0 at the same time.

= 2.3.8 =
Dependent dropdowns are edited as columns and can show as dropdowns, buttons or columns on the form.
