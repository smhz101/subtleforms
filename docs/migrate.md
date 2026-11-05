# Migrate: importing forms from other plugins

Settings > Tools > Migrate brings forms across from Contact Form 7, Gravity Forms, Fluent Forms, WPForms and Ninja Forms.

There are two ways in:

- **From this site (one click).** SubtleForms looks in the database for forms those plugins left, lists them with their field counts, and imports the ones you tick. The other plugin does not need to be active.
- **From an export file.** Upload a Gravity Forms, Fluent Forms or WPForms JSON export, or a Ninja Forms `.nff` file (plain JSON, or JSON or a PHP array in base64; any other content is refused with a plain message). The same mapping is used, so a form comes across the same way either way.

What always holds:

- Forms are created as **drafts**, titled like the original. Open them in the builder, check them and publish.
- The original forms are only read. Nothing in the other plugin changes.
- **Payment settings are not imported.** **No email is sent** during an import: the form is saved, not submitted.
- **Entries are copied only when the owner ticks a box** (see Entries below). Nothing is copied by default.
- Each imported form remembers where it came from (`metadata.importRef`, for example `cf7:12`, and `metadata.importedFrom`). Importing the same form again asks "Import again as a copy?" instead of making a silent duplicate. A copy is titled "<title> (copy)".
- Each form gets a report. Every field, setting, merge tag or email that could not be copied, or was copied in a different shape, has its own line. Example: `Gravity Forms field 'Product' (type product) was skipped: payments are not imported.`

## Entries (WPForms and Ninja Forms)

Entries hold personal data your visitors sent, so they are never copied by default. When a selected WPForms or Ninja Forms form has entries, the screen shows the count and an unticked box: "Also import N entries. Entries contain personal data your visitors sent. They are copied into SubtleForms; the originals are not changed or deleted." The entries of a form are copied only if that box is ticked, and the server refuses the request without `consent`.

- WPForms Lite keeps no entries. WPForms Pro keeps them in `{prefix}wpforms_entries` (the `fields` column, or `wpforms_entry_fields` when that is empty). Spam, trash, abandoned and partial entries are left out.
- Ninja Forms keeps entries as `nf_sub` posts with `_form_id` and `_field_{id}` post meta. Trashed ones are left out.
- Entries go into the form that was just imported, in batches of 200 per request, with a progress bar. Each keeps its original date, is marked read, and keeps the IP address and browser only when the other plugin stored them (WPForms Pro does, Ninja Forms does not).
- Each entry records `meta.import`: `ref` (for example `wpforms:12:345`), `imported_from`, `original_form_id` and `original_id`. A second run skips entries whose `ref` is already in the form.
- Uploaded files are not copied. The address of each file is kept as text in the answer, and the screen says how many were linked.
- Answers are matched to the new field keys. Answers to fields that were skipped (payments, captcha and so on) are not copied.

## Reply-To

Every email notification has a Reply-To setting (`settings.replyTo`, editable in the builder with Insert tag). It takes one address or a merge tag such as `{field:email}`, so a reply goes to the person who sent the form. When the email is sent the tag is filled and line breaks are removed; the result is used only when it is exactly one valid address (`sanitize_email` then `is_email`). Two addresses, a display name, an empty answer or anything that would add a header (`a@b.com\r\nBcc: x@y.com`) leaves Reply-To out, logged at debug level. Reply-To is the only header that takes a merge tag: a `From` header with a tag is dropped and the site sender is used.

An importer copies Reply-To when the original is one field tag or one address. Anything else (text around a tag, two addresses, a field that was not imported) is reported.

## Architecture

| Piece | File |
| --- | --- |
| Source contract (detect, list, read, map) | `src/Tools/Import/Source.php` |
| Contact Form 7 | `Cf7Source.php` (reads posts and meta), `Cf7Parser.php` (form-tags), `Cf7Mapper.php` |
| Gravity Forms | `GravitySource.php` (reads `gf_form` and `gf_form_meta`, or `rg_` before 2.3), `GravityMapper.php` |
| Fluent Forms | `FluentSource.php` (reads `fluentform_forms` and `fluentform_form_meta`), `FluentMapper.php` |
| WPForms | `WPFormsSource.php` (reads `wpforms` posts, and `wpforms_entries` for entries), `WPFormsMapper.php` |
| Ninja Forms | `NinjaSource.php` (reads the `nf3_` tables and `nf_sub` posts), `NinjaMapper.php`, `NinjaExport.php` (.nff files) |
| Entries | `EntrySource.php` (count, read, convert), `Importer::importEntries()` |
| Field type table (this page lists the same) | `src/Tools/Import/FieldMap.php` |
| Shared schema helpers and report | `SchemaBuilder.php`, `ImportNotes.php` |
| Saving, re-import guard | `Importer.php` |
| File upload path | `src/Tools/FormMigration.php` (uses the same mappers) |

Mappers are pure: they take the rows a source read and return `{ title, schema, notes }` without touching the database, so they are unit tested field by field (`tests/unit/Import*Test.php`, fixtures in `tests/fixtures/import/`).

To add another plugin, write a class that implements `Source` and add it with the `subtleforms/import/sources` filter. Add its types to `FieldMap` and to this page. After a form is saved, `subtleforms/import/imported` fires with the new form ID, the source id and the original form id.

### REST

All routes need the `manage_options` capability and the REST nonce, like the rest of Tools.

| Route | What it does |
| --- | --- |
| `GET /subtleforms/v1/tools/migrate/sources` | Each source with `count` (forms found) and `active` (plugin active) |
| `GET /subtleforms/v1/tools/migrate/sources/{source}/forms` | Forms of one source: `id`, `title`, `fields`, `notes` (report lines an import would give), `imported` (SubtleForms forms already made from it), `entries` (entries the plugin holds for it) |
| `POST /subtleforms/v1/tools/migrate/sources/{source}/entries` | Body `{ "id": "12", "form_id": 34, "after": 0, "consent": true }`. Copies up to 200 entries after the source entry id `after` into SubtleForms form `form_id`, which must be a form imported from source form `id`. Returns `imported`, `skipped`, `failed`, `files`, `next` (send it as `after`) and `done` |
| `POST /subtleforms/v1/tools/migrate/sources/{source}/import` | Body `{ "ids": ["12"], "copies": [] }`. One result per form: `status` is `imported`, `exists` (imported before; send the id in `copies` to import a copy), `missing` or `failed`, with `form_id`, `edit_url`, `fields`, `entries` (how many entries the source has) and `notes` (`[{ level: skipped|changed|info, text }]`) |

## Field types

`step` means a page break: SubtleForms starts a new step there and the fields after it go into that step. "Skipped" types are left out and named in the report with the reason shown.

### Contact Form 7

| Contact Form 7 | SubtleForms | Notes |
| --- | --- | --- |
| `text` | Text | placeholder or default value, `minlength`, `maxlength`, `40/100` size |
| `email` | Email | |
| `url` | Website | |
| `tel` | Phone | |
| `number` | Number | `min`, `max`, `step` |
| `range` | Slider | `min`, `max`, `step` |
| `date` | Date | fixed `min`/`max` dates; relative ones are reported |
| `textarea` | Paragraph | `40x6` gives the rows |
| `select` | Dropdown | `include_blank` and `first_as_label` give the placeholder; `multiple` becomes Checkboxes |
| `checkbox` | Checkboxes | `default:1_3` ticks boxes; `exclusive` becomes Radio Buttons; `free_text` is reported |
| `radio` | Radio Buttons | always required, first choice ticked unless `default:` says otherwise |
| `acceptance` | Consent / GDPR | the wrapped text is the checkbox text, its first link the policy link; required unless `optional` |
| `file` | File upload | `limit` and `filetypes` |
| `hidden` | Hidden | `default:get` becomes `{get:name}` |
| `submit` | (submit button text) | |
| `quiz` | skipped | quizzes, polls, surveys and ratings are not imported |
| `captchac` | skipped | SubtleForms has its own spam protection and CAPTCHA settings |
| `captchar` | skipped | same |
| `recaptcha` | skipped | same |

Required `*` variants (`text*`, `email*` and so on) are required fields. Labels are the text written just before each tag (usually inside `<label>`); a tag without one takes its placeholder or its name in words. Other text between tags becomes Custom HTML, a heading becomes a Section Heading. `default:user_email` and `default:user_display_name` become `{user_email}` and `{user_name}`. Pipes (`"Label|value"`) keep both label and value. `id:` and `class:` options are ignored.

Mail and Mail (2) become email notifications (Mail (2) only when it is on). `[your-name]` and `[_raw_your-name]` become `{field:your-name}`. `[_site_title]` becomes `{site_name}`, `[_site_admin_email]` `{admin_email}`, `[_date]` `{date}`, `[_serial_number]` `{entry_id}`, `[_site_url]` the site address. Other special tags (`[_remote_ip]`, `[_post_title]` ...) are left as typed and reported. `Reply-To: [your-email]` becomes the email's Reply-To setting `{field:your-email}`. The sender and other additional headers (Cc, Bcc) become email headers when they hold no field tags, else they are reported. File attachments are reported. `skip_mail` or `demo_mode` imports the emails switched off.

The "sent" message (`mail_sent_ok`) is the confirmation message, `invalid_required` the required message. `subscribers_only: true` keeps the form for logged-in visitors. Other additional settings are reported.

### Gravity Forms

| Gravity Forms | SubtleForms | Notes |
| --- | --- | --- |
| `text` | Text | `maxLength`; a password input becomes Password |
| `textarea` | Paragraph | `maxLength` |
| `select` | Dropdown | choices with values, selected choice as default, placeholder |
| `multiselect` | Checkboxes | reported as changed |
| `checkbox` | Checkboxes | selected choices as defaults |
| `radio` | Radio Buttons | the "Other" choice is reported |
| `name` | Name | parts on or off, labels and placeholders; Prefix is reported; a one-box name is Text |
| `email` | Email | the confirm email box is reported |
| `phone` | Phone | |
| `address` | Address | parts on or off, labels and placeholders |
| `website` | Website | |
| `number` | Number | range min and max; currency format is reported |
| `date` | Date | |
| `time` | Time | |
| `fileupload` | File upload | allowed extensions, size in MB, several files |
| `hidden` | Hidden | default value; `{user:user_email}` and friends become SubtleForms tokens |
| `html` | Custom HTML | |
| `section` | Section Heading | conditions now show or hide only the heading (reported) |
| `page` | step | step titles from the form's page names |
| `consent` | Consent / GDPR | checkbox text and description |
| `password` | Password | |
| `list` | skipped | list fields have no SubtleForms equivalent |
| `product` | skipped | payments are not imported |
| `quantity` | skipped | payments |
| `option` | skipped | payments |
| `shipping` | skipped | payments |
| `total` | skipped | payments |
| `donation` | skipped | payments |
| `calculation` | skipped | payments |
| `singleproduct` | skipped | payments |
| `creditcard` | skipped | payments |
| `stripe_creditcard` | skipped | payments |
| `paypal` | skipped | payments |
| `paypal_checkout` | skipped | payments |
| `square` | skipped | payments |
| `coupon` | skipped | payments |
| `captcha` | skipped | SubtleForms has its own spam protection and CAPTCHA settings |
| `quiz` | skipped | quizzes, polls, surveys and ratings are not imported |
| `poll` | skipped | same |
| `survey` | skipped | same |
| `likert` | skipped | same |
| `rank` | skipped | same |
| `rating` | skipped | same |
| `post_title` | skipped | post creation fields are not imported |
| `post_content` | skipped | same |
| `post_excerpt` | skipped | same |
| `post_tags` | skipped | same |
| `post_category` | skipped | same |
| `post_image` | skipped | same |
| `post_custom_field` | skipped | same |
| `signature` | skipped | this field needs SubtleForms Pro |
| `repeater` | skipped | repeating fields are not imported |

Any other type is skipped with "this field type has no SubtleForms equivalent". Fields shown to admins only, or hidden, become Hidden fields (reported). The parameter name, when it is a valid field ID, is kept as the field ID. CSS classes are ignored.

Conditional logic maps when every rule uses a whole field and one of `is`, `isnot`, `>`, `<`, `contains`, `starts_with`, `ends_with`. Rules on a part of a field (`1.3`) or other operators are reported and left out. Logic on a page goes onto its step.

Notifications become email notifications. `{Label:3}` becomes `{field:key}`; a part (`{Name (First):1.3}`) becomes the whole answer (reported). `{all_fields}`, `{form_title}`, `{entry_id}`, `{admin_email}` and `{date_mdy}` map; others (`{ip}`, `{embed_url}` ...) are left as typed and reported. Sent to a field: the answer to that field. Routing: imported switched off, sent to the admin email, reported. Notification conditions become "only when" conditions. Reply-To (`{Email:2}` or one address) becomes the email's Reply-To setting. From, Cc and Bcc become headers when they hold no field tags. Attachments are reported. Notifications on other events (payment, save) are imported switched off.

The default confirmation is used: a message, a redirect (with its query string) or a page (as a redirect to `/?page_id=N`). Conditional confirmations are reported. Require login and a total entry limit carry across; limits per period, the schedule and Save and Continue are reported.

### Fluent Forms

| Fluent Forms | SubtleForms | Notes |
| --- | --- | --- |
| `input_text` | Text | `maxlength` |
| `input_email` | Email | |
| `textarea` | Paragraph | `rows`, `maxlength` |
| `select` | Dropdown | placeholder; `multiple` becomes Checkboxes |
| `multi_select` | Checkboxes | reported as changed |
| `input_radio` | Radio Buttons | |
| `input_checkbox` | Checkboxes | |
| `input_name` | Name | first, middle, last: shown, labels, placeholders, required |
| `phone` | Phone | |
| `address` | Address | parts shown, labels, placeholders, required |
| `input_number` | Number | `min`, `max`, step |
| `input_date` | Date | |
| `input_url` | Website | |
| `input_file` | File upload | size, number of files, allowed types |
| `input_image` | Image upload | |
| `input_password` | Password | |
| `select_country` | Country | |
| `rangeslider` | Slider | |
| `section_break` | Section Heading | |
| `form_step` | step | step titles from the steps settings |
| `terms_and_condition` | Consent / GDPR | the terms text, its first link as the policy link; always required |
| `gdpr_agreement` | Consent / GDPR | same |
| `custom_html` | Custom HTML | |
| `input_hidden` | Hidden | `{get.ref}` becomes `{get:ref}` |
| `custom_submit_button` | (submit button text) | |
| `repeater_field` | skipped | repeating fields are not imported |
| `input_repeat` | skipped | same |
| `payment_method` | skipped | payments are not imported |
| `multi_payment_component` | skipped | payments |
| `subscription_payment_component` | skipped | payments |
| `custom_payment_component` | skipped | payments |
| `item_quantity_component` | skipped | payments |
| `payment_summary_component` | skipped | payments |
| `payment_coupon` | skipped | payments |
| `recaptcha` | skipped | SubtleForms has its own spam protection and CAPTCHA settings |
| `hcaptcha` | skipped | same |
| `turnstile` | skipped | same |
| `quiz_score` | skipped | quizzes, polls, surveys and ratings are not imported |
| `ratings` | skipped | same |
| `net_promoter_score` | skipped | same |
| `tabular_grid` | skipped | same |
| `post_title` | skipped | post creation fields are not imported |
| `post_content` | skipped | same |
| `post_excerpt` | skipped | same |
| `featured_image` | skipped | same |
| `taxonomy` | skipped | same |
| `signature` | skipped | this field needs SubtleForms Pro |

Fields inside a column container come across one under the other (reported). The `name` attribute is kept as the field ID when it is valid. Conditions map for `=`, `!=`, `>`, `<`, `contains`, `doNotContains`, `startsWith`, `endsWith` on whole fields; others are reported.

Notifications: `{inputs.email}` becomes `{field:email}` (a part such as `{inputs.names.first_name}` becomes the whole answer, reported), `{all_data}` `{all_fields}`, `{wp.admin_email}` `{admin_email}`, `{wp.site_title}` `{site_name}`, `{submission.id}` `{entry_id}`, `{date.*}` `{date}`. Other smart codes are left as typed and reported. Sent to a field: that answer. Routing: switched off, reported. Conditions become "only when" conditions. Reply-To (`{inputs.email}` or one address) becomes the email's Reply-To setting. Plain text emails stay plain text.

The confirmation message, a custom URL or a page carries across. Require login and a total entry limit carry across; other limits and the schedule are reported.

### WPForms

| WPForms | SubtleForms | Notes |
| --- | --- | --- |
| `name` | Name | `simple` is one Text box; first-last and first-middle-last give the Name parts, with placeholders |
| `email` | Email | the confirm email box is reported |
| `text` | Text | character limit; word limit and input mask are reported |
| `textarea` | Paragraph | character limit |
| `number` | Number | `min`, `max` |
| `number-slider` | Slider | `min`, `max`, `step` |
| `phone` | Phone |  |
| `address` | Address | parts shown or hidden, placeholders |
| `url` | Website |  |
| `select` | Dropdown | choices, placeholder, selected choice; `multiple` becomes Checkboxes |
| `radio` | Radio Buttons | choices, selected choice |
| `checkbox` | Checkboxes | choices, selected choices |
| `gdpr-checkbox` | Consent / GDPR | the checkbox text; always required |
| `date-time` | Date | Date, Time or Date and time by its format |
| `hidden` | Hidden | default value |
| `html` | Custom HTML | the code |
| `content` | Custom HTML | the content |
| `divider` | Section Heading | label and description |
| `pagebreak` | step | a new step; the top break gives the first step its title, each break the title of the page after it; the bottom break is ignored |
| `file-upload` | File upload | extensions, size in MB, number of files; entries keep the file address as text |
| `rating` | Rating | number of stars |
| `net_promoter_score` | Net Promoter Score |  |
| `password` | Password |  |
| `richtext` | Rich text |  |
| `layout` | (layout) | its fields come one under the other (reported) |
| `likert_scale` | skipped | quizzes, polls, surveys and ratings are not imported |
| `captcha` | skipped | SubtleForms has its own spam protection and CAPTCHA settings |
| `payment-single` | skipped | payments are not imported |
| `payment-multiple` | skipped | payments are not imported |
| `payment-checkbox` | skipped | payments are not imported |
| `payment-select` | skipped | payments are not imported |
| `payment-total` | skipped | payments are not imported |
| `payment-coupon` | skipped | payments are not imported |
| `credit-card` | skipped | payments are not imported |
| `stripe-credit-card` | skipped | payments are not imported |
| `square` | skipped | payments are not imported |
| `authorize_net` | skipped | payments are not imported |
| `paypal-commerce` | skipped | payments are not imported |
| `signature` | skipped | signature fields are not imported |
| `repeater` | skipped | repeating fields are not imported |
| `entry-preview` | skipped | entry preview fields are not imported |

Fields show or hide on the rules WPForms keeps in groups: rules in one group must all match. One group with `==`, `!=`, contains, does not contain, empty, not empty, `>` or `<` is copied (choice ids become the choice values). Several groups joined by OR, or starts with and ends with, are reported on the field and not copied.

Each notification becomes an email. `{field_id="3"}` becomes `{field:key}`, `{all_fields}`, `{admin_email}`, `{form_name}`, `{site_name}`, `{entry_id}` and `{date}` map; others (`{user_ip}`, `{page_url}` ...) are left as typed and reported. Reply-To, sender, conditions that send when a rule matches, and the switch that turns all notifications off carry across; conditions that stop an email are imported switched off and reported. The first confirmation is used: a message, a redirect, or a page (as a redirect to its address on this site; from an export file the address is left for you to set). Other confirmations are reported. The honeypot is noted, since SubtleForms has its own spam protection.

### Ninja Forms

| Ninja Forms | SubtleForms | Notes |
| --- | --- | --- |
| `firstname` | Text | a Text box of its own |
| `lastname` | Text | a Text box of its own |
| `email` | Email |  |
| `textbox` | Text | character limit; mask is reported |
| `textarea` | Paragraph | character limit; the rich text editor is reported |
| `phone` | Phone |  |
| `number` | Number | `min`, `max`, step |
| `listselect` | Dropdown | choices, selected choice |
| `listradio` | Radio Buttons | choices, selected choice |
| `listcheckbox` | Checkboxes | choices, selected choices |
| `listmultiselect` | Checkboxes | reported as changed |
| `checkbox` | Checkbox | a single yes or no box |
| `date` | Date | format; Date and time gives a Date and time field |
| `address` | Text | a Text box of its own |
| `city` | Text | a Text box of its own |
| `zip` | Text | a Text box of its own |
| `liststate` | Dropdown | choices |
| `listcountry` | Country |  |
| `hidden` | Hidden | default value |
| `html` | Custom HTML | the content |
| `hr` | Section Heading |  |
| `starrating` | Rating | number of stars |
| `file_upload` | File upload | types, size in MB; entries keep the file address as text |
| `password` | Password |  |
| `submit` | (submit button text) | its label is the submit button text |
| `recaptcha` | skipped | SubtleForms has its own spam protection and CAPTCHA settings |
| `recaptcha_v3` | skipped | SubtleForms has its own spam protection and CAPTCHA settings |
| `hcaptcha` | skipped | SubtleForms has its own spam protection and CAPTCHA settings |
| `spam` | skipped | SubtleForms has its own spam protection and CAPTCHA settings |
| `timed_submit` | skipped | SubtleForms has its own spam protection and CAPTCHA settings |
| `confirm` | skipped | confirm fields are not imported |
| `passwordconfirm` | skipped | confirm fields are not imported |
| `repeater` | skipped | repeating fields are not imported |
| `product` | skipped | payments are not imported |
| `quantity` | skipped | payments are not imported |
| `shipping` | skipped | payments are not imported |
| `total` | skipped | payments are not imported |
| `tax` | skipped | payments are not imported |
| `creditcard` | skipped | payments are not imported |
| `creditcardcvc` | skipped | payments are not imported |
| `creditcardexpiration` | skipped | payments are not imported |
| `creditcardfullname` | skipped | payments are not imported |
| `creditcardnumber` | skipped | payments are not imported |
| `creditcardzip` | skipped | payments are not imported |
| `signature` | skipped | signature fields are not imported |

Conditional logic (a Ninja Forms add-on) is kept on the field it shows or hides: one `show_field` or `hide_field` result with rules that all must match, using equal, not equal, contains, not contains, greater and less. Anything else is reported. Email actions become emails (`{field:key}` and `{fields_table}` map; `{wp:admin_email}`, `{system:date}` and similar map; others are reported); a Success Message action is the confirmation message, a Redirect action the redirect. The Store Submission action needs nothing, since SubtleForms always saves entries. Other actions (Mailchimp and so on) are reported. Form settings: the submission limit and require login carry across.
