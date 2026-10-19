# QA audit: basic and choice fields (fields-basic), SubtleForms free 2.3.3

Auditor area: fields-basic. Test site http://localhost:8899 with SubtleForms Pro active (Agency license), so Pro logic operators and CSV export were available. Every QA form, page and entry created for this audit (prefix "QA-fields-basic-") has been deleted, and the queued notification emails for those forms were unscheduled (WP cron is disabled on this site, so they would otherwise pile up).

Scripts and raw output: /home/claude/work/qa/fields-basic/ (out/*.json hold every observed result). Screenshots: /home/claude/shots/qa/fields-basic/.

## 1. Summary

- 18 field types audited, about 230 individual settings. Most settings save, reload, show on the builder canvas, render on the live form and are enforced in the browser and on the server. Required checks, hidden-by-logic behaviour and conditional logic (96 trigger/operator cases, browser and server agree on every one) are solid.
- P1: the Name and Address fields ignore their sub-field settings completely. The server schema validator turns the `fields` map into a plain list, so "Middle name", "Suffix", "Street line 2", switching off State/Postal/Country and every sub-field label and placeholder are lost on save. Separately, the live renderer never reads `fields` at all (it reads old `enable_*` flags), so even a correctly saved setting would not show. A required Name always demands first and last name, a required Address always demands all five parts, whatever the admin chose.
- P2: several advertised settings do nothing: Password "Show strength meter" and "Require confirmation", Phone "Format", Country "Enable search", Email "Allow multiple" (makes the field reject any list) and "RFC validation", Chained Select "Source: CSV". The library even describes Password as "Hidden input with strength meter".
- P2: the server does not check that choice answers are one of the offered options (Dropdown, Radio, Checkboxes, Picture Choice, Country, Chained Select), does not enforce Read-only, accepts any string for Single Checkbox, Consent and Toggle, and accepts a Name with only a first name although the browser requires both.
- P2: a numeric placeholder, label or default value cannot be saved: "1000" as a Number placeholder or "750" as a Number default value makes the whole form save fail with only "Unsaved changes / Retry autosave" in the header.
- P2: entries, emails and CSV show stored option values ("b", "o1, o2", "pa") instead of the choice labels, and Single Checkbox / Consent show "1" on the entry screen but "Yes" in the email.
- P2: a submission rejected by server validation is still stored as an entry with status "failed" and is included in the CSV export.
- Biggest competitive gaps (Must): searchable/enhanced select and multi-select dropdown, "Other" choice, phone country selector, address autocomplete and country formats, password strength and confirmation, email confirmation field, input mask, unique value check, consent text stored with the entry.

## 2. What exists and its status

### 2.1 Method

| Check | How it was tested |
|---|---|
| Inventory | Every type added from the builder library on a blank form; every control on every inspector tab read from the DOM (builder-settings.js, out/builder-report.json, builder-<type>-<tab>.png). |
| Save and reload | Every control on Settings and Validation set through the UI, Save draft, schema read back by REST, builder reloaded and the inspector read again (out/builder-report.json). |
| Builder canvas | Canvas screenshots after setting values (builder-<type>-after-set.png) and of a fully configured form (canvas-all-NN.png, out/builder-canvas.json). |
| Live page | Fully configured form created by REST, rendered through the shortcode at 1280px and 390px (live-all-1280.png, live-all-390.png, out/live-dom.json). |
| Browser enforcement | 19 cases filling valid answers and breaking one setting at a time, submit request intercepted (browser-validate.js, out/browser-validate.json, validate-*.png). |
| Server enforcement | 38 anonymous REST submits that bypass the browser, plus required and read-only forms (rest-battery.js, out/rest-battery.json). |
| Storage, entry, email, CSV | Stored payload via REST, entry detail page (entry-696.png, out/entry-696.txt), queued email body from the cron job args ({all_fields}), CSV via POST /submissions/export (out/export-all.csv). |
| Conditional logic | 96 trigger/operator cases run through the browser evaluator (resources/shared/conditions.js) and the server evaluator (ConditionalLogic::evaluateCondition) with the answers the browser really sends (logic/cases.json, js.json, php.json); every type as a hidden required target in the browser and by REST; seven trigger types live in the browser; Logic tab UI per trigger type (logic-live.js, out/logic-live.json, logic-*.png). |
| Accessibility | axe-core scan of the live form, Tab order, keyboard operation of radio, toggle and picture choice, label and group association, error announcement (a11y-keyboard.js, out/a11y.json). |
| Form level Field defaults | Form with label visibility hidden, help text above, form required and validation messages; browser and REST (field-defaults.js, field-defaults.png). |

### 2.2 Shared behaviour (applies to every type below unless the type table says otherwise)

| Setting / behaviour | Status | Evidence and notes |
|---|---|---|
| Label (General) | Works | Saves, reloads, canvas, live, entry, email, CSV header. |
| Help text (General) | Works | Saves, reloads, canvas, live, linked with aria-describedby. Limited to 500 characters by the schema validator (save fails above that, no message). |
| Field label visibility (Appearance) | Works | `subtleforms-field--no-label`, label kept for screen readers. |
| Help text placement (Appearance) | Works | Above or below, canvas and live. |
| Admin label (Advanced) | Works | Used as the label in entry detail, {all_fields} email and CSV header ("Admin TXT"). |
| CSS class (Advanced) | Works | Class on the live field wrapper. |
| Required (Validation) | Works for single-value types | Browser and server; see per-type rows for Name, Address, Single Checkbox, Consent, Toggle. |
| Message when left empty (Validation) | Works for single-value types | Browser and server. Ignored in the browser for Name and Address (bug FB-12). |
| Custom validation message (Validation) | Works | Replaces format, range and pattern messages in browser and server. |
| Form Settings > Field defaults (label visibility, help placement, required message, validation message) | Works, Partial for Name/Address | Browser and server use them; Name and Address show their hard-coded message instead of the form default (field-defaults.png). |
| Logic tab (show/hide by rules) | Works | All 18 types hide and show as targets in the browser (1 field visible before, 19 after). By REST, hidden required targets are not required and values sent for them are dropped (stored payload `{"gate":"hide"}`). |
| Logic operators (is, is not, contains, does not contain, is empty, is not empty, greater than, less than; Pro: starts with, ends with, is one of, is not one of, between, before, after) | Works | 96 cases, browser and server agree on all 96. Every operator is offered for every type, including date operators on a checkbox (Should: filter by type). |
| Style tab (Width, Alignment, Space above/below, Base size, Label weight, Corner radius, Border width, colours) | Not run | Shared appearance controls, identical for all 18 types; owned by the appearance audit and covered by tests/browser/field-widths.spec.js. Present on every type (builder-<type>-Style.png). |
| Hidden-by-logic required | Works | Browser and server skip required and drop the value. |
| Label association and error announcement | Works for single inputs | Error has role=alert, id linked from aria-describedby, aria-invalid set (out/browser-validate.json, required form). Group types have problems, see FB-17, FB-18. |
| Mobile 390px | Works | No overflow; two-column checkbox layout collapses to one column; picture grid keeps 2 columns (live-all-390.png). |
| Failed validation | Partial | Rejected submissions are stored as "failed" entries and exported (FB-09). |

### 2.3 Per-field tables

Status columns: Save = saves and reloads in the builder; Canvas = shown on the builder canvas; Live = rendered on the live page; Browser = enforced in the browser; Server = enforced on REST bypass; Store/Entry/Email/CSV = stored and displayed. "n/a" means the setting has nothing to enforce or display there.

#### Text (text), 17 settings

| Setting | Panel | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|---|
| Label, Help text, Label visibility, Help placement, Admin label, CSS class | General / Appearance / Advanced | Yes | Yes | Yes | n/a | n/a | Works |
| Placeholder | Appearance | Yes | Yes | Yes | n/a | n/a | Partial: a purely numeric placeholder above 255 blocks saving (FB-04) |
| Default value (supports {user_email}, {user_name}, {date}, {get:param}) | Appearance | Yes (REST) | Yes | Yes, `{get:pre}` filled "hello" | n/a | n/a | Works |
| Prefix, Suffix | Appearance | Yes | Yes | Yes | n/a | n/a | Partial: aria-hidden so screen readers never hear them, and suffix fails colour contrast (FB-19) |
| Read-only | Advanced | Yes | No visual cue | Yes, typing ignored | Yes | No, "hacked" stored | Partial (FB-07) |
| Required | Validation | Yes | Asterisk | Yes | Yes | Yes | Works |
| Max Length | Validation | Yes | n/a | maxlength attribute | Typing stops at 10 silently | Yes | Works (label "Max Length" uses different casing from "Minimum characters") |
| Minimum characters | Validation | Yes | n/a | minlength | Yes | Yes | Works |
| Pattern (regular expression) | Validation | Yes | n/a | No pattern attribute | Yes | Yes | Works |
| Message when left empty, Custom validation message | Validation | Yes | n/a | Yes | Yes | Yes | Works |
| Store / entry / email / CSV | | | | | | | Works. An array sent for a text field is stored as an array (`["a","b"]`) instead of being rejected. |
| Logic as trigger / target | | | | | | | Works |

Missing compared with competitors: input mask (Must), character counter (Should), autocomplete attribute choice (Should; fixed to "off" for text), unique value / no duplicates (Must), prepopulate by query string as a named parameter rather than only {get:param} in default value (Nice), placeholder from field defaults in Settings (Nice).

#### Paragraph (textarea), 15 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings, Placeholder, Default value | Yes | Yes | Yes ("Hello world" prefilled) | n/a | n/a | Works |
| Rows | Yes | Yes | Yes (6) | n/a | n/a | Works |
| Read-only | Yes | No | Yes | Yes | No | Partial (FB-07) |
| Required, Max Length, Minimum characters, messages | Yes | n/a | min/maxlength | Yes | Yes | Works |
| Entry / email / CSV | | | | | | Works, line breaks kept |

Missing: character or word counter with limit by words (Must), rich text toggle (Nice, exists as a separate Rich Text type), auto-grow height (Nice), unique value (Should).

#### Email (email), 14 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings, Placeholder | Yes | Yes | Yes | n/a | n/a | Works |
| Default value ({user_email}) | Yes | Yes | Empty for guests as expected | n/a | n/a | Works |
| Allow Multiple | Yes | n/a | No `multiple` attribute | Rejects "a@x.com, b@x.com" | Rejects it ("Invalid email address.") | Broken (FB-05) |
| RFC Validation | Yes | n/a | n/a | No effect | No effect (off still rejects user@localhost) | Broken, setting does nothing (FB-06) |
| Read-only | Yes | No | Yes | Yes | No | Partial (FB-07) |
| Required, format check, messages | Yes | n/a | type=email, autocomplete=email | Yes | Yes | Works |
| Entry / email / CSV | | | | | | Works |

Missing: confirmation field ("Confirm email") (Must), domain allow/block list (Should), disposable address block (Nice), suggestion for typos such as gmial.com (Nice), set as Reply-To in notifications from the field (check in notifications area).

#### Number (number), 17 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings | Yes | Yes | Yes | n/a | n/a | Works |
| Placeholder | Yes | Yes | Yes | n/a | n/a | Partial: "1000" blocks saving (FB-04, builder-numeric-placeholder-save.png) |
| Default value | Yes | Yes | Yes (5) | n/a | n/a | Partial: any numeric default above 500 blocks saving (FB-04) |
| Prefix, Suffix | Yes | Yes | Yes | n/a | n/a | Partial (FB-19) |
| Step size | Yes | n/a | step attribute | Yes ("Must match the step of 0.5.") | Yes | Works |
| Minimum Value, Maximum Value | Yes | n/a | min/max | Yes | Yes | Works; server says "Cannot exceed 100." where the browser says "Must be no more than 100." and the server texts are not translatable (FB-14) |
| Read-only | Yes | No | Yes | Yes | No | Partial (FB-07) |
| Required (0 counts as an answer), messages | Yes | n/a | Yes | Yes | Yes | Works |
| Entry / email / CSV | | | | | | Works |

Missing: number format (currency, decimals, thousands separator) (Must), calculations from this field exist in the separate Calculation type (Works elsewhere), slider mode (Nice, separate type), min/max shown as hint (Nice).

#### Phone (phone), 13 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings, Placeholder, Default value | Yes | Yes | Yes | n/a | n/a | Works (numeric-only placeholder such as "5550100" blocks saving, FB-04) |
| Format (International / US / Custom) | Yes | No | No effect on input | "12" accepted with US format | "12" accepted | Broken (FB-08) |
| Read-only | Yes | No | Yes | Yes | No | Partial (FB-07) |
| Required, character check (digits, spaces, + - ( )) | Yes | n/a | type=tel autocomplete=tel | Yes | Yes | Works |
| Entry / email / CSV | | | | | | Works |

Missing: country selector with flags and dial codes (Must), smart formatting and validation per country (libphonenumber) (Must), input mask (Should), default country (Should), E.164 storage for integrations (Should).

#### Website (url), 14 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings, Placeholder, Default value | Yes | Yes | Yes | n/a | n/a | Works |
| Prefix, Suffix | Yes | Yes | Yes | n/a | n/a | Partial (FB-19) |
| Read-only | Yes | No | Yes | Yes | No | Partial (FB-07) |
| Required, URL check | Yes | n/a | type=url | Requires http(s) | Accepts ftp://, rejects javascript: | Partial: browser and server disagree on schemes (FB-15) |
| Entry / email / CSV | | | | | | Works (stored as plain text, not a link, in the entry) |

Missing: accept "example.com" and add https:// automatically (Must, common support ticket), allowed domains (Nice).

#### Name (name_group), 10 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Label, Help text, Label visibility, Help placement, Admin label, CSS class | Yes | Yes | Yes | n/a | n/a | Works |
| Sub-fields: Middle Name and Suffix on/off, label and placeholder of every part | Lost on save (stored as a list without keys) | Before save only | Never (renderer reads `enable_*`, hard-coded "First Name"/"Last Name", no Suffix input at all) | n/a | n/a | Broken (FB-01, FB-02) |
| Required | Yes | Asterisk | Yes | Always requires first and last | Accepts first name only | Partial (FB-10) |
| Message when left empty | Yes | n/a | n/a | Ignored, always "Please enter your first and last name." | Used | Partial (FB-12) |
| Custom validation message | Yes | n/a | n/a | n/a | n/a | Works (nothing to validate) |
| Store / entry / email / CSV | | | | | | Works: entry lists "First Name: Ada / Middle Name: B / Last Name: Lovelace", email and CSV "Ada B Lovelace" |
| Logic as trigger (contains "Ada") | | | | | | Works |

Missing: name formats (First Last, First Middle Last, Prefix/Title dropdown such as Mr/Ms/Dr) (Must), single "Full name" format (Must), sub-label position above/below (Should), per-part required (Should).

#### Address (address_group), 10 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings | Yes | Yes | Yes | n/a | n/a | Works |
| Sub-fields: Street line 2 on, State / Postal / Country off, labels and placeholders | Lost on save | Before save only | Never | n/a | n/a | Broken (FB-01, FB-02; validate-parts.png shows the switched-off State and Country drawn and demanded) |
| Required | Yes | Asterisk | Yes | Always requires all five parts | Accepts any one part (city only) | Partial (FB-10) |
| Message when left empty | Yes | n/a | n/a | Ignored, always "Please enter your full address." | Used | Partial (FB-12) |
| Country list inside Address | n/a | n/a | 250 countries, stores code | n/a | Not checked | Works, entry shows "Country: PK" (code, not name) |
| Store / entry / email / CSV | | | | | | Works (one line in email and CSV, one row per part in entry) |

Missing: country-specific formats and labels (US State dropdown, ZIP vs Postcode) (Must), Google Places / address autocomplete (Must for paid tier), default country (Should), state/province dropdown for common countries (Should), map preview (Nice).

#### Password (password), 14 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings, Placeholder | Yes | Yes | Yes | n/a | n/a | Works |
| Show Strength Meter | Yes | No | Not rendered | n/a | n/a | Broken (FB-03) |
| Require Confirmation | Yes | No | No second input | n/a | n/a | Broken (FB-03) |
| Store a hash | Yes | n/a | n/a | n/a | Stored as hash | Works: entry says "Password provided (stored as a hash)" |
| Minimum Length | Yes | n/a | minlength | Yes | Yes | Works |
| Required, messages | Yes | n/a | autocomplete=new-password | Yes | Yes | Works |
| Email / CSV | | | | | | Works: left out of {all_fields} and CSV by design |

Missing: strength meter and minimum strength rule (Must; the library text promises it), confirmation input (Must), show/hide password eye button (Should), character class rules (Should).

#### Dropdown (dropdown), 12 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings, Placeholder | Yes | Yes | Yes | n/a | n/a | Works |
| Choices: add, reorder, label, value ("Show values"), bulk edit, default tick | Yes | Yes | Yes | n/a | Value not checked against options ("zzz" stored) | Partial (FB-11). New dropdown from the library has no choices at all (FB-16). |
| Default value (text box) | Yes | Not previewed on canvas | Yes ("Beta" preselected) | n/a | n/a | Works; duplicates the tick in Choices |
| Required, messages | Yes | n/a | Yes | Yes | Yes | Works |
| Entry / email / CSV | | | | | | Partial: shows value "b", not label "Beta" (FB-13) |
| Logic as trigger | | | | | | Works; Logic tab offers the choices as a value list |

Missing: searchable / enhanced select (Must), multiple selection (Must), "Other" option with text input (Should), randomize order (Should), choice groups (optgroup) (Nice), dynamic choices from posts/terms/users (Should; post_selection type exists but is hidden and not rendered), choice values shown as labels in entries (Must, see FB-13).

#### Radio Buttons (radio), 12 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings | Yes | Yes | Yes | n/a | n/a | Works |
| Layout (stacked, inline, two columns, three columns, buttons) | Yes | Yes | Inline and two columns observed | n/a | n/a | Works |
| Choices, Default value | Yes | Yes (default not previewed) | Yes ("Green" checked) | n/a | Value not checked ("purple" stored) | Partial (FB-11, FB-16) |
| Required, messages | Yes | n/a | Yes | Yes | Yes | Works |
| Keyboard | | | Arrow keys move the choice | | | Works |
| Entry / email / CSV | | | | | | Partial (FB-13) |

Missing: "Other" option (Must), randomize (Should), image/icon per choice (Nice; Picture Choice exists), choice description text (Nice).

#### Checkboxes (multiple_choice), 14 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings, Layout | Yes | Yes | Yes | n/a | n/a | Works |
| Allow Multiple | Yes | Yes | Off draws radio buttons | n/a | n/a | Works, but makes a second Radio type (confusing) |
| Choices, defaults | Yes | Yes | Yes ("One" ticked) | n/a | Values not checked (["bogus","fake"] stored) | Partial (FB-11, FB-16) |
| Minimum / Maximum selections | Yes | n/a | n/a | Yes | Yes | Works |
| Required, messages | Yes | n/a | Yes | Yes | Yes | Works |
| Entry / email / CSV | | | | | | Partial: values "o1, o2" (FB-13) |

Missing: select all (Should), "Other" option (Must), randomize (Should), image choices (exists as Picture Choice), "none of the above" exclusive choice (Nice).

#### Single Checkbox (checkbox), 10 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings | Yes | Yes | Yes | n/a | n/a | Works |
| Checkbox label | Yes | Yes | Yes | n/a | n/a | Works |
| Required | Yes | Asterisk | Yes | Yes | Rejects false and "0"; accepts any other string ("hello" stored) | Partial (FB-11) |
| Entry / email / CSV | | | | | | Partial: entry "1", email "Yes", CSV "1" or the raw string (FB-13) |
| Logic as trigger | | | | | | Works only with "is not empty" or value "true"; "1", "yes" and "checked" do not match and the Logic tab gives a free text box (FB-20) |

Missing: custom checked/unchecked values for entries and integrations (Should), default checked state (Should).

#### Toggle (toggle), 13 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings, Text beside the switch | Yes | Yes | Yes | n/a | n/a | Works |
| Default state | Yes | Yes | Yes (on) | n/a | n/a | Works |
| Saved value when on / off | Yes | n/a | Yes ("Y") | n/a | Any value accepted ("maybe" stored) | Partial (FB-11) |
| Required (must be on) | Yes | n/a | Yes | Yes | Yes | Works |
| Keyboard | | | Space toggles, role=switch | | | Works |
| Entry / email / CSV | | | | | | Works (shows the saved value) |
| Logic as trigger | | | | | | Works with the saved value; "is empty" never matches the off value (FB-20) |

Missing: display labels for on/off states (Nice).

#### Picture Choice (picture_choice), 14 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings | Yes | Yes | Yes | n/a | n/a | Works |
| Allow more than one choice | Yes | Yes | Checkboxes | n/a | n/a | Works |
| Columns (2, 3, 4) | Yes | Yes | Yes | n/a | n/a | Works; keeps 2 columns at 390px |
| Choices with image (Media Library) | Yes | Yes | Yes, images alt="" with label beside | n/a | Value not checked (["zzz"] stored) | Partial (FB-11) |
| Minimum / Maximum selections | Yes | n/a | n/a | Yes | Yes | Works |
| Required, messages | Yes | n/a | Yes | Yes | Yes | Works |
| Keyboard | | | Focus ring on the card, Space selects | | | Works |
| Entry / email / CSV | | | | | | Partial: values "pa", no thumbnail (FB-13) |

Missing: show labels on/off (Should), image size/aspect setting (Should), image in entry and email (Nice).

#### Country (country), 15 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings, Placeholder | Yes | Yes | Yes | n/a | n/a | Works |
| Default country | Yes | Yes | Yes (Pakistan) | n/a | n/a | Works |
| Preferred countries | Yes | Yes | Yes (US, UK first) | n/a | n/a | Works; entered as free text lines, no validation of codes |
| Output Format (code / name) | Yes | n/a | Yes | n/a | n/a | Works |
| Enable Search | Yes | n/a | Plain native select, only a data attribute | n/a | n/a | Broken (FB-08) |
| Default value | Yes | n/a | n/a | n/a | n/a | Works but duplicates "Default country" (confusing) |
| Required, messages | Yes | n/a | Yes | Yes | Yes | Works; any value accepted by the server ("Narnia" stored, FB-11) |
| Entry / email / CSV | | | | | | Works |
| Logic as trigger | | | | | | Works, but the value must match the output format and the Logic tab gives free text, not the country list (FB-20) |

Missing: searchable select with flags (Must), restrict to a list of countries (Should), detect visitor country (Nice).

#### Chained Select (chained_select), 11 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings | Yes | Yes | Yes | n/a | n/a | Works |
| Levels (label and options per level) | Yes | Yes | Yes | n/a | n/a | Partial: levels are independent lists, so level 2 does not depend on level 1 (Focus and Corolla are offered for both Ford and Toyota); the first level's label ("Make") is not shown (FB-21) |
| Source (Manual / CSV), default CSV | Yes | n/a | No effect, there is no CSV input anywhere | n/a | n/a | Broken (FB-21) |
| Required, messages | Yes | n/a | Yes | Yes | Yes (only the first level needs a value) | Partial |
| Server value check | | | | | Any values accepted (["x","y"]) | Partial (FB-11) |
| Entry / email / CSV | | | | | | Works ("ford, focus"), values not labels |

Missing: dependent options tree in the builder (Must, the whole point of the type), CSV import (Must, the setting already promises it), per-level placeholder (Should).

#### Consent / GDPR (consent), 12 settings

| Setting | Save | Canvas | Live | Browser | Server | Overall |
|---|---|---|---|---|---|---|
| Shared settings | Yes | Yes | Yes | n/a | n/a | Works |
| Consent statement with {{link}} | Yes | Yes | Yes | n/a | n/a | Works. The default text "I agree to the Privacy Policy." plus the default link renders "I agree to the Privacy Policy. Privacy Policy" (FB-22) |
| Privacy Policy URL (defaults to the site privacy page), Link text | Yes | Yes | Yes, opens in a new tab | n/a | n/a | Works |
| Required | Yes | Asterisk | Yes | Yes | Rejects false and "0"; accepts "yes" | Partial (FB-11) |
| Entry / email / CSV | | | | | | Partial: entry "1", email "Yes"; consent text, policy URL and time are not stored (missing) |

Missing: store the consent statement and policy version with the entry (Must for GDPR), consent description box under the checkbox (Should), checked-by-default forbidden notice (Nice).

## 3. Bugs

| ID | Sev | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|
| FB-01 | P1 | Builder: add Name, Settings > Appearance, switch on Middle Name and Suffix (or Address: switch on Street line 2, switch off Country). Save draft, reload. | Settings kept. | Toggles back to defaults. Saved schema has `fields` as a list without keys: `[{"label":"First Name","enabled":true},...]`. | out/builder-report.json (name_group and address_group "after"); fields-basic.spec.js FB-01 fails | src/Validation/Schemas.php:337 `'fields' => 'optional|array|list:FieldDefinition'` treats the composite sub-field map as nested fields and re-indexes it. |
| FB-02 | P1 | Even with the sub-field map intact (builder before save, or REST): enable Middle Name / Suffix / Street line 2, or disable State / Postal / Country, view the live form. | Live form follows the sub-field settings and labels. | Live form always draws First/Last and Street/City/State/Postal/Country with hard-coded labels; Suffix is never drawn; switched-off parts are drawn and demanded. | live-all-1280.png, validate-parts.png; fields-basic.spec.js FB-02 | resources/frontend/components/FieldRenderer.jsx:983-1178 reads `config.enable_middle_name`, `enable_street2`, `enable_state` etc. and never `config.fields`; resources/frontend/utils/fieldValidation.js:304-329 requires fixed parts. |
| FB-03 | P2 | Password field, Show Strength Meter on (default) and Require Confirmation on. View live. | Strength meter and a confirm input. | Single password input only. | live-all-1280.png, out/live-dom.json (pw) | Not implemented in FieldRenderer.jsx:576-610; library text in src/Fields/FieldSettings.php:686 promises a meter. |
| FB-04 | P2 | Builder: Number field, Placeholder "1000" (or Default value "750", or a label "2024"... any purely numeric value above 255 for label/placeholder, above 500 for default value). Save draft. | Saves. | Save fails; header shows "Unsaved changes / Retry autosave" with no explanation. REST: `"schema.fields[4].placeholder":"Maximum value is 255"`. | builder-numeric-placeholder-save.png; fields-basic.spec.js FB-03 | src/Validation/Rules.php:232 applies the numeric `max` check to numeric strings after the string-length check. |
| FB-05 | P2 | Email field with Allow Multiple on; enter "a@example.com, b@example.com". | Accepted, stored as two addresses. | Browser: "Invalid email address."; REST: 422. | validate-ro.png, out/rest-battery.json (ro); spec FB-06 | No `multiple` handling in fieldValidation.js:180 or FieldValidator.php:387-397. |
| FB-06 | P3 | Email with RFC Validation off; submit "user@localhost". | Looser check. | Same check as with it on. | out/rest-battery.json (ro "rfc off weird") | Setting not read anywhere. |
| FB-07 | P2 | Text with Read-only and Default value "fixed"; REST submit `{"rot":"hacked"}`. | Server keeps "fixed" or rejects. | "hacked" stored. Applies to every type with Read-only. | out/entries.json (743); spec FB-05 | FieldValidator does not know readOnly. |
| FB-08 | P2 | Phone Format "US" and submit "12"; Country "Enable Search" on. | US format enforced or formatted; searchable country list. | Both settings have no effect. | out/rest-battery.json, out/browser-validate.json ("ph 2 digits us format" sent); out/live-dom.json (co is a native select) | FieldRenderer.jsx:576-610 ignores `format`; FieldRenderer.jsx:859 only sets `data-searchable`. |
| FB-09 | P2 | Submit any answer the server rejects (for example txt too short) by REST. | Nothing stored, or kept out of entries and exports. | Entry stored with status "failed" holding the rejected answers; included in the CSV export (38 rows, many "failed"). | out/export-all.csv | src/Api/PublicSubmitApi.php:269 creates the entry before the pipeline validates, then marks it failed (lines 338-345). |
| FB-10 | P2 | Required Name: REST `{"nm":{"first_name":"Ada"}}`. Required Address: `{"addr":{"city":"X"}}`. | Same rule as the browser. | Accepted by the server; browser demands first and last name and all five address parts. | out/rest-battery.json, out/fetch-entries output (748) | FieldValidator.php:129 `isCompositeEmpty` passes when any part has a value. |
| FB-11 | P2 | REST submit values not offered by the field: dropdown "zzz", radio "purple", checkboxes ["bogus"], picture ["zzz"], country "Narnia", chained ["x","y"], toggle "maybe", checkbox "hello", consent "yes". | 422 for values that are not options. | All stored as sent. | out/entries.json (724, 725, 728, 729, 730, 732, 733, 734, 737); spec FB-04 | FieldValidator::validateFieldType (src/Engine/FieldValidator.php:233-287) has no option membership check. |
| FB-12 | P3 | Name or Address required with a custom "Message when left empty" or a form default required message; submit empty. | Custom message. | Browser shows "Please enter your first and last name." / "Please enter your full address."; server uses the custom one. | field-defaults.png, out/field-defaults.json | fieldValidation.js:153-154 returns getCompositeRequiredError text, never requiredText. |
| FB-13 | P2 | Submit Dropdown "Beta" (value b), Checkboxes One/Two, Picture A, Single Checkbox ticked. Look at entry, email, CSV. | Labels ("Beta", "One, Two"), consistent Yes/No. | Values "b", "o1, o2", "pa"; checkbox "1" in entry and CSV but "Yes" in email. | entry-696.png, out/entry-696.txt, out/export-all.csv, queued email body for entry 696: "Dropdown QA: b / Radio QA: green / Checkboxes QA: o1, o2 / Single checkbox QA: Yes / Picture QA: pa / Address QA: 1 Main St, Apt 2, Lahore, Punjab, 54000, PK" | FieldMapper::toText and EntryValues::toText format raw values; no label lookup. |
| FB-14 | P3 | Number out of range by REST. | Translatable messages matching the browser. | "Cannot exceed 100." (browser "Must be no more than 100."); "Must be at least %s.", "Invalid email address.", "Invalid URL.", "Must be a valid number.", "Invalid phone number." are not wrapped in __(). | out/rest-battery.json | src/Engine/FieldValidator.php:338, 342, 393, 409, 425, 430, 446. |
| FB-15 | P3 | Website: REST "ftp://example.com" accepted; browser rejects it. Browser rejects "example.com". | One rule; bare domains accepted with https:// added. | Mismatch; bare domains rejected. | out/rest-battery.json, validate-web_no_scheme.png | fieldValidation.js:183 vs FieldValidator.php:403. |
| FB-16 | P3 | Add Dropdown, Radio Buttons or Checkboxes from the library. | Two or three starter choices like competitors (Picture Choice already has two). | No choices; empty field on the canvas and a warning. | builder-dropdown-Settings.png, builder-added-all.png | src/Fields/CoreFields.php dropdown/radio/multiple_choice `options => array()`. |
| FB-17 | P3 | Screen reader on Name or Address group. | Group named by the field label (fieldset/legend or role=group). | Outer label has no `for` target and no group role; the group label "Name QA" is not announced with the inputs; the group error is not linked with aria-describedby and Address parts get no aria-invalid. | out/a11y.json (groups), out/browser-validate.json (required a11y: nm and addr `linked:false`, addr `invalidCount:0`) | FieldRenderer.jsx:506 label rendered for every type; composite branch has no role. |
| FB-18 | P3 | Radio, Checkboxes, Picture Choice: the visible field label has `for="subtleforms-field-rd"` but no element has that id. | Label pointing at nothing removed or replaced by legend. | Dangling `for` (the radiogroup still has aria-labelledby, so names are announced). | out/a11y.json | FieldRenderer.jsx:506. |
| FB-19 | P3 | Text/Number/Website with prefix "$" and suffix "kg". | Units read by screen readers; contrast at least 4.5:1. | Prefix and suffix are aria-hidden; axe color-contrast failures on the affixes. | out/a11y.json (violations) | FieldRenderer.jsx:617, 623 and affix CSS colour. |
| FB-20 | P3 | Logic rule on a Single Checkbox, Consent, Toggle or Country trigger. | Value picker that matches what is stored (Checked/Unchecked, On/Off, country list). | Free text box; only "true" matches a ticked box ("1", "yes", "checked" do not); Toggle off value never counts as "is empty"; Country must be typed in the output format. All 15 operators offered for every type. | logic/ (cases flagged as UX), logic-ui-*.png, out/logic-live.json (ui) | LogicEditor.jsx:274-276 only offers choices for fields with options. |
| FB-21 | P2 | Chained Select: add two levels with options. Live: choose Ford. | Level 2 lists only Ford models; "Source: CSV" lets you import a CSV. | Level 2 always shows every model; first level label hidden; CSV source has no input (and is the default). | live-all-1280.png, builder-chained_select-Settings.png | resources/shared/chainedOptions.js:17-20 (levels are flat), ChainedLevelsControl.jsx has no child options, src/Fields/CoreFields.php:633 default `source => csv`. |
| FB-22 | P3 | Add Consent / GDPR from the library and look at the canvas. | "I agree to the Privacy Policy." with the words linked. | "I agree to the Privacy Policy. Privacy Policy" (link appended after the text). | builder-chained_select-Settings.png (consent at the bottom of the canvas) | Default `checkboxLabel` has no {{link}}; renderConsentLabel (FieldRenderer.jsx:100) appends linkText. |
| FB-23 | P3 | Text field: REST `{"txt":["a","b"]}`. | Rejected (text expects a string). | Stored as an array, CSV "a, b". | out/entries.json (702) | validateTextLength returns null for non-strings. |
| FB-24 | P3 | Builder canvas: Dropdown default "Beta", Radio default "Green", Checkboxes default "One", Toggle default on. | Canvas previews the defaults. | Canvas shows nothing selected (live form is correct). | out/builder-canvas.json (selects "Pick one", checked []) | Builder FieldRenderer does not apply defaultValue. |

Side observation for the forms/entries auditors: DELETE /forms/{id}?force=true (used by the repo's own test cleanup helper) leaves the form's entries in the submissions table with no form (orphans from other runs were visible). I deleted my own entries before deleting forms.

## 4. Missing features and options

| Field | Missing | Priority |
|---|---|---|
| Text | Input mask (phone, date, custom) | Must |
| Text | Unique value / no duplicate entries | Must |
| Text | Character counter shown to the visitor | Should |
| Text | Autocomplete attribute choice (name, organization, etc.) | Should |
| Text | Prepopulate via named query parameter (field setting, not only {get:x}) | Nice |
| Paragraph | Word or character limit with counter | Must |
| Paragraph | Unique value | Should |
| Paragraph | Auto-grow height | Nice |
| Email | Confirmation field | Must |
| Email | Domain allow / block list | Should |
| Email | Typo suggestion, disposable address block | Nice |
| Number | Number format: currency, decimals, thousands separator | Must |
| Number | Show range hint | Nice |
| Phone | Country selector with flags and dial codes | Must |
| Phone | Smart formatting and per-country validation | Must |
| Phone | Default country, E.164 storage | Should |
| Website | Accept bare domain and add https:// | Must |
| Name | Formats (simple full name, first/last, with prefix/title) | Must |
| Name | Per-part required and sub-label position | Should |
| Address | Country-specific formats (US states, ZIP vs postcode) | Must |
| Address | Google Places autocomplete | Must (Pro tier) |
| Address | Default country, state dropdowns | Should |
| Password | Strength meter and minimum strength | Must |
| Password | Confirmation input | Must |
| Password | Show / hide toggle | Should |
| Dropdown | Searchable / enhanced select | Must |
| Dropdown | Multiple selection | Must |
| Dropdown | Labels (not values) in entries, emails, CSV | Must |
| Dropdown | "Other" option | Should |
| Dropdown | Randomize choices | Should |
| Dropdown | Dynamic choices (posts, terms, users) | Should |
| Dropdown | Option groups | Nice |
| Radio | "Other" option with text input | Must |
| Radio | Randomize | Should |
| Radio | Choice description | Nice |
| Checkboxes | "Other" option | Must |
| Checkboxes | Select all | Should |
| Checkboxes | Randomize | Should |
| Checkboxes | Exclusive "None of the above" | Nice |
| Single Checkbox | Custom checked / unchecked stored values | Should |
| Single Checkbox | Checked by default | Should |
| Toggle | Display labels for on/off | Nice |
| Picture Choice | Hide labels, image size / ratio | Should |
| Picture Choice | Image in entry and email | Nice |
| Country | Searchable select with flags | Must |
| Country | Limit to selected countries | Should |
| Country | Detect visitor country | Nice |
| Chained Select | Dependent option tree in the builder | Must |
| Chained Select | CSV import | Must |
| Chained Select | Per-level placeholder | Should |
| Consent | Store statement text, policy URL and time with the entry | Must |
| Consent | Description box (full terms text) | Should |
| All choice types | Starter choices when added | Should |
| All | Logic value pickers by type and operators filtered by type | Should |
| All | Server-side Read-only and option membership (security parity) | Must (see FB-07, FB-11) |

### Cross-field summary matrix

Settings count excludes the shared Logic and Style tabs. Works / Partial / Broken are from section 2.3.

| Field | Settings | Works | Partial | Broken | Missing Must | Missing Should |
|---|---|---|---|---|---|---|
| Text | 17 | 13 | 4 (Placeholder, Prefix, Suffix, Read-only) | 0 | 2 | 2 |
| Paragraph | 15 | 14 | 1 (Read-only) | 0 | 1 | 1 |
| Email | 14 | 11 | 1 (Read-only) | 2 (Allow Multiple, RFC Validation) | 1 | 1 |
| Number | 17 | 12 | 5 (Placeholder, Default value, Prefix, Suffix, Read-only) | 0 | 1 | 0 |
| Phone | 13 | 10 | 2 (Placeholder, Read-only) | 1 (Format) | 2 | 1 |
| Website | 14 | 10 | 4 (Prefix, Suffix, Read-only, URL check) | 0 | 1 | 0 |
| Name | 10 | 7 | 2 (Required, Required message) | 1 (Sub-fields) | 1 | 1 |
| Address | 10 | 7 | 2 (Required, Required message) | 1 (Sub-fields) | 2 | 1 |
| Password | 14 | 12 | 0 | 2 (Strength meter, Confirmation) | 2 | 1 |
| Dropdown | 12 | 11 | 1 (Choices: server check, display) | 0 | 3 | 3 |
| Radio Buttons | 12 | 11 | 1 (Choices) | 0 | 1 | 1 |
| Checkboxes | 14 | 13 | 1 (Choices) | 0 | 1 | 2 |
| Single Checkbox | 10 | 9 | 1 (Required server and display) | 0 | 0 | 2 |
| Toggle | 13 | 12 | 1 (On/off values not checked) | 0 | 0 | 0 |
| Picture Choice | 14 | 13 | 1 (Choices) | 0 | 0 | 1 |
| Country | 15 | 14 | 0 | 1 (Enable Search) | 1 | 1 |
| Chained Select | 11 | 8 | 2 (Levels, Required) | 1 (Source) | 2 | 1 |
| Consent / GDPR | 12 | 10 | 2 (Statement default, Required server) | 0 | 1 | 1 |

## 5. Not tested and why

- Style tab (width, alignment, spacing, size, weight, radius, border, colours): Not run. Shared by all types and owned by the appearance audit; listed per type in the builder screenshots.
- PDF of an entry: Not run (Pro feature, covered by the integrations/Pro audit).
- Real email delivery: Not testable here (no mail server). The {all_fields} body was read from the queued subtleforms_async_email job, which is the exact body wp_mail receives.
- Multi-step "Step" setting in the inspector: Not run (only shown on multi-step forms; covered by tests/browser/builder-steps.spec.js).
- Screen reader output: checked by DOM semantics and axe, not with a real screen reader.
- Conversational form mode for these fields: Not run (separate renderer, outside this area).
- Builder canvas for the Choices editor drag and drop, bulk edit and Media Library picker: present and used by the code path, not exercised by drag in Playwright.

Automated checks: /home/claude/work/qa/fields-basic/fields-basic.spec.js asserts the correct behaviour for FB-01 to FB-07 (except FB-03 password and FB-04 builder UI, which are covered by the scripts) plus one passing logic check. Run here: 6 failed (the bugs), 1 passed. Command: `cd /home/claude/work/free/subtleforms && NODE_PATH=$PWD/node_modules PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test -c playwright.browser.config.js /home/claude/work/qa/fields-basic/fields-basic.spec.js` (or copy it into tests/browser/). The other scripts in that folder (builder-settings.js, rest-battery.js, browser-validate.js, logic-live.js, logic/run.mjs + run.php, a11y-keyboard.js, field-defaults.js) regenerate every result in out/.
