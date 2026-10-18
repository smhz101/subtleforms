# QA audit: advanced, media, layout and system fields (area "fields-advanced")

SubtleForms free 2.3.3 with SubtleForms Pro 2.3.3 active (Agency license), test site http://localhost:8899, 14 October 2026.
Scripts: /home/claude/work/qa/fields-advanced/ . Screenshots: /home/claude/shots/qa/fields-advanced/ (builder/, builder-layout/, front/, entries/).

## 1. Summary

- The browser side of the advanced inputs is in good shape: required checks, date min/max, per-step validation, step skipping, repeater min/max with per-row conditions, uploads with type/size/count checks and progress all worked in a real browser, and the server re-checks required fields, uploads, repeater limits, skipped steps and calculation totals.
- The server does not check the value of most advanced types. A direct REST submit stored "not-a-date", time "99:99", datetime "garbage", a 99 star rating on a 7 star field, NPS 15, a slider value below its minimum and off its step, a matrix answer that is not one of the columns, a signature that is plain text, a colour "javascript:alert(1)" and a new value for a read-only date (FA-01).
- Three layout blocks cannot be configured in the builder: the Notice has no text or style control, the Section Heading has no title control and the Page Break has no title control. A Notice added from the library is empty and therefore hidden on the live form (FA-02).
- Files uploaded inside a Repeater row are never moved out of the pending folder, so the daily clean-up deletes them; the entry shows raw JSON instead of a download link, and forged file records are accepted (FA-03).
- The Hidden field is not in the field library at all (FA-04), and when it is on a form its label is drawn on the live page (FA-05).
- A required Color Picker with a default colour shows the colour but fails "This field is required" until the visitor changes it (FA-06).
- Calculations: rows of a Repeater do not calculate (browser shows 0, server keeps the posted value), any unanswered field turns the whole formula into an error shown as 0, and the internal marker `__formula_error__` is stored and shown in entries, emails and CSV (FA-07, FA-08, FA-09).
- Output: the matrix loses its row names (one answer per row) or column names (several per row) in email, CSV and PDF; date, time and datetime "format" settings are ignored everywhere; uploads appear in CSV as raw records (FA-10, FA-11, FA-12).
- CAPTCHA fields ignore their own Site Key, render nothing but a stray label (the field key) when the global CAPTCHA settings are not configured, and the form is then submitted without any verification. The Action Hook field never fires its hook (FA-13, FA-14).
- Biggest competitive gaps: date range/relative dates/disabled days and localised display, conditional (if) and date functions in formulas, save and continue later, a progress bar, image resize and Media Library storage, signature pen options.

## 2. What exists (inventory) and status

Columns: Save = set in schema and shown again in the builder after reload (all settings were set through the REST schema save and read back by opening the builder; the inspector showed every stored value, see /home/claude/work/qa/fields-advanced/builder-inventory.json). Canvas = drawn in the builder. Live = live page via shortcode. Browser = browser enforcement. Server = enforcement on a direct REST submit (harness.php, guest, rest_do_request). Out = entry detail / email {all_fields} / CSV / Pro PDF.

Shared settings on every input type (General: Label, Help text; Appearance: Field label visibility, Help text placement; Validation: Required, Message when left empty, Custom validation message; Advanced: Admin label, CSS class; Logic tab; Style tab) were checked on each field below and all saved and reloaded. Admin label replaced the label in email, CSV and PDF (Works). Help text placement "above" rendered above (Works). CSS class reached the live wrapper (Works). Custom required and validation messages were shown by browser and server (Works, checked on Date).

### 2.1 Date (`date`), free

| Setting | Save | Live / browser | Server | Output | Status |
|---|---|---|---|---|---|
| Date format (d/m/Y) | Yes | Ignored, native picker uses browser locale | n/a | Entry, email, CSV, PDF show Y-m-d | Broken (FA-11) |
| Default value ({date}) | Yes | Today filled | n/a | Stored | Works |
| Min date / Max date | Yes | min/max attributes, out-of-range message | Rejected 2027-05-05 with the custom message | n/a | Works |
| Read-only | Yes | readonly input | New value accepted | Stored tampered value | Partial (FA-01) |
| Required | Yes | Error shown | Rejected | n/a | Works |
| Value format check | n/a | Native input | "not-a-date" stored | Shown as typed | Broken (FA-01) |
| Mobile picker | n/a | Native date input at 390px, no overflow | n/a | n/a | Works |
| Timezone | n/a | {date} uses browser local date; stored as plain Y-m-d | n/a | n/a | Works (no conversion, none expected) |

### 2.2 Time (`time`), free
| Setting | Save | Live / browser | Server | Output | Status |
|---|---|---|---|---|---|
| Time format (g:i A) | Yes | Ignored (native control) | n/a | Stored and shown as 09:30 | Broken (FA-11) |
| Default value 09:30 | Yes | Prefilled | n/a | Stored | Works |
| Read-only, required | Yes | Works | Required works, read-only not enforced | | Partial |
| Value check | n/a | Native | "99:99" stored | | Broken (FA-01) |
| Min/max time, step | Not offered | | | | Missing |

### 2.3 Date & Time (`datetime`), free
| Setting | Save | Live / browser | Server | Output | Status |
|---|---|---|---|---|---|
| DateTime format | Yes | Ignored | n/a | Stored and shown raw "2026-06-15T14:30" | Broken (FA-11) |
| Required, read-only | Yes | Works | Required works | | Partial |
| Value check | n/a | Native | "garbage" stored | | Broken (FA-01) |
| Default value, min/max | Not offered | | | | Missing |

### 2.4 Rating (`rating`), free
| Setting | Save | Live / browser | Server | Output | Status |
|---|---|---|---|---|---|
| Number of stars (7) | Yes | 7 stars, keyboard radios | 99 accepted | Number shown | Partial (FA-01) |
| Required | Yes | Works | Works | | Works |
| Icon, colour, size, labels | Not offered (colour hard coded #f59e0b) | | | | Missing |

### 2.5 Opinion Scale (`scale`), free
| Setting | Save | Live | Server | Status |
|---|---|---|---|---|
| Start at (0/1), End at (3 to 10) | Yes | 0 to 10 buttons | Out of range 42 rejected | Works |
| Low/High end labels | Yes | Shown | n/a | Works |
| Default value 3 | Yes | Preselected | n/a | Works |
| Required | Yes | Works | Works | Works |

### 2.6 NPS (`net_promoter_score`), free
| Setting | Save | Live | Server | Status |
|---|---|---|---|---|
| (no own settings) | | 0 to 10 radios, legend "Not at all likely / Extremely likely" | 15 accepted | Partial (FA-01) |
| End labels | Renderer reads minLabel/maxLabel but the builder has no control | | | Missing (FA-15) |
| Required | Yes | Works | Works | Works |

### 2.7 Slider (`range_slider`), free
| Setting | Save | Live | Server | Status |
|---|---|---|---|---|
| Minimum 10, Maximum 50, Step 5 | Yes | range input with those attributes, keyboard moves by 5 | 7 accepted (below min and off step) | Partial (FA-01) |
| Default value 20 | Yes | Starts at 20, value shown | n/a | Works |
| Required | Yes | Can never fail (always seeded with a number) | | Works as designed |
| Prefix/suffix, value labels, range (two handles) | Not offered | | | Missing |

### 2.8 Matrix (`checkbox_grid`), free
| Setting | Save | Live | Server | Output | Status |
|---|---|---|---|---|---|
| Rows, Columns (one per line) | Yes | Table, stacks inside 274px on mobile without page overflow | Unknown column "Nope" accepted | | Partial (FA-01) |
| Allow several answers per row | Yes | Radios or checkboxes | | Entry detail: single "Speed: Good"; multi "AM: true PM: true" | Partial |
| Required (every row) | Yes | "Please answer the Speed row." | Same message | | Works |
| Email / CSV / PDF | | | | Single: "Good, OK" without row names. Multi: "Mon: Yes, Yes" without column names | Broken (FA-10) |

### 2.9 Calculation (`calculation`), Pro (fields.advanced)
| Setting / behaviour | Result | Status |
|---|---|---|
| Formula, Decimal places | Saved; live total updates; server recomputes and ignores a posted value (c1 posted 123456, stored 113) | Works |
| Charge this amount (usePrice) | Payment quote used the recomputed value (3 seats x 12.5 = 37.50; posted 1 ignored); formula error flagged | Works (charge itself needs Stripe, not testable) |
| Number fields, choice values, checkbox sum | {qty}*{price}+{pick}+{adds} = 44 on server and in browser | Works |
| Functions round, min, max, abs, floor, ceil | round({qty}/3,1)+max+min+abs+floor+ceil = 10 | Works |
| Chained calculation ({tot}*2) | 88 | Works |
| Reference to repeater rows ({rows.0.rq} + {rows.1.rq}) | 7 in browser and on server | Works |
| Calculation inside a Repeater row ({rq}*2) | Browser shows 0 for every row; server stores the posted 99 | Broken (FA-07) |
| Division by zero | Browser shows 0.000 with no message; server stores "__formula_error__", shown in entry, email, CSV | Broken (FA-09) |
| Unanswered field in a formula | Whole result fails (Total 0.00 while qty 3 x price 0 + 20 should be 20) | Broken (FA-08) |
| Prefix / suffix | Renderer supports prefix ($ shown), no builder control | Missing (FA-15) |
| Validation tab | Shown but empty | Partial (cosmetic) |

### 2.10 Signature (`signature`), Pro (fields.advanced)
| Setting / behaviour | Result | Status |
|---|---|---|
| Clear button text ("Wipe") | Saved, but the button always says "Clear" | Broken (FA-16) |
| Draw with mouse | PNG data URL stored, image shown in entry detail and PDF; email says "Signed (the signature image is in the entry)" | Works |
| Type your name instead | Offered (accessibility) | Works (not submitted in test) |
| Required | Browser and server reject empty | Works |
| Server value check | Plain text "hello" accepted as a signature | Broken (FA-01) |
| Mobile | Canvas 274x160 at 390px. Touch drawing not run (see section 5) | Not run |

### 2.11 Color Picker (`color_picker`), free
| Setting | Result | Status |
|---|---|---|
| Default Color (#ff0000) | Swatch and hex box show red but the value is empty: required error until the visitor changes it; an optional field saves nothing | Broken (FA-06) |
| Default value | A second, separate default setting next to Default Color | Partial (duplicate) |
| Hex text box | Editable; typing #00ff00 submitted | Works |
| Server check | "javascript:alert(1)" stored | Broken (FA-01) |

### 2.12 Rich Text (`rich_text`), free
| Behaviour | Result | Status |
|---|---|---|
| Toolbar Bold, Italic, bullets, numbers | Works; `<b>` kept | Works |
| Sanitising | script tags and javascript: links removed on the server | Works |
| Required | Browser works; server accepts "<p><br></p>" as an answer | Partial (FA-17) |
| Email / CSV / PDF | Email and PDF plain text, CSV keeps the HTML | Works |
| Placeholder, character limit, link button | Not offered | Missing |

### 2.13 Hidden (`hidden`), free
| Setting / behaviour | Result | Status |
|---|---|---|
| Field library | Not listed, cannot be added in the builder | Broken (FA-04) |
| Value with {get:utm_source} | "src-newsletter" from ?utm_source=newsletter | Works |
| Default value | Second default setting beside Value | Partial (duplicate) |
| Admin label | Used in email, CSV, PDF ("Campaign") | Works |
| Live page | Its label "Hidden one" and an empty block are drawn | Broken (FA-05) |
| Tampering | Posted value replaces the configured one (same as most plugins) | Works as designed |
| Dynamic values: user, page URL, referrer, cookie, IP, embed post ID | Only {date}, {user_email}, {user_name}, {get:x} | Missing |

### 2.14 File Upload (`file_upload`) and Image Upload (`image_upload`), free (several files is Pro)
| Setting / behaviour | Result | Status |
|---|---|---|
| Allowed file types | Hint "PDF, TXT up to 2 KB"; png refused in browser and on server | Works |
| Max Size (bytes) | big.txt refused in browser and server; 60000 shown as "59 KB" | Works (unit in bytes is unfriendly) |
| Content check | fake.png (text) and evil.php.txt refused; shell.php refused | Works |
| Allow several files (Pro), Most files | Drop zone, 3 files into max 2 refused in browser; server refused 3 IDs and 2 IDs on a single-file field | Works |
| Required | Works browser and server | Works |
| Forged or foreign upload IDs | Expired-file error | Works |
| Storage | Random 32-hex names in uploads/subtleforms-uploads/files, .htaccess deny | Partial (FA-18: readable by direct URL where .htaccess is ignored) |
| Admin download | Link with nonce downloads doc.pdf; without nonce a confirmation page; guest gets 400 | Works |
| Entry detail | File name and size per file | Works |
| Email | Name plus admin download link | Works |
| CSV | "1. id: ...; name: doc.pdf; size: 45; type: application/pdf" | Broken (FA-12) |
| PDF | File names | Works |
| Entry to Trash / deleted permanently | Trash keeps files; permanent delete removes them | Works |
| Form deleted permanently | Entries and files stay behind | Broken (FA-19) |
| Upload inside a Repeater | See FA-03 | Broken |
| Image preview, resize, Media Library, cloud, chunked | Not offered | Missing |

### 2.15 Section Heading (`section_break`)
| Setting | Result | Status |
|---|---|---|
| Title | No control in the inspector; set via REST it renders | Broken (FA-02) |
| Description, CSS class, Logic, Style | Work | Works |
| Live layout | Heading did not take the full row: the next block (HTML) sat beside it | Partial (FA-20) |

### 2.16 Custom HTML (`html`)
| Setting | Result | Status |
|---|---|---|
| HTML Content | Saved and sanitised on save (script and onerror removed); text of the removed script stays visible ("window.qaXss=1") | Works (minor cosmetic) |
| Merge tags ({date}) | Printed literally | Missing |
| Inspector | Shows "No configurable settings for this field type." above the content box | Partial (cosmetic) |

### 2.17 Notice (`disclaimer`)
| Setting | Result | Status |
|---|---|---|
| Notice text, Style (info/warning/success) | No control in the inspector ("Layout field: configure via canvas", but the canvas is not editable). Set via REST it renders with the warning style | Broken (FA-02) |
| Empty notice | Hidden on the live form, so a notice added in the builder never shows | Broken (follows FA-02) |

### 2.18 Page Break / multi-step (`step`)
| Behaviour | Result | Status |
|---|---|---|
| Step title | No control in the inspector and no rename on the step tab | Broken (FA-02) |
| Step description | Control exists; not shown on the live step navigation | Broken (FA-21) |
| Step navigation | Numbered steps with titles, completed steps clickable | Works |
| Per-step validation, Next / Previous, values kept | Works | Works |
| Conditional skip of a step (Logic tab, Pro advanced logic) | Step 2 skipped when "Yes"; server dropped the skipped step's answer and required it when not skipped | Works |
| Progress bar / percentage | None on standard multi-step forms | Missing |
| Save and continue later | None (save_resume type registered but hidden and not rendered) | Missing |
| Mobile | No overflow | Works |

### 2.19 Group, 2/3/4 Columns (`group_container`, `two_column_container`, `three_column_container`, `four_column_container`)
All four are hidden from the library on purpose since 2.1 (fields have their own width); existing forms keep working.
| Setting | Result | Status |
|---|---|---|
| Label, Help text, Label visibility, Spacing, CSS class | Saved and shown (group label and help on live page) | Works |
| Required fields inside | Enforced in browser and on server (g1, c2b) | Works |
| Columns side by side, stacking on mobile | 2/3/4 columns side by side at 1280px, stacked full width at 390px, no overflow | Works |
| Column wrapper class | "subtleforms-columns-NaN" | Partial (FA-22) |
| Logic on the container | No Logic tab | Missing |

### 2.20 Repeater (`repeat_container`), free
| Setting / behaviour | Result | Status |
|---|---|---|
| Label, Help text, Button Label ("Add person"), Admin label, CSS class | Saved and shown | Works |
| Min Repeats 2 / Max Repeats 3 | Starts with 2 groups, "2 of 3", add hidden at 3; server refused 4 groups | Works |
| Server min | Refused 1 group, but the message names fields of the missing group instead of "add at least 2" | Partial (FA-23) |
| Remove group | Works | Works |
| Nested fields, required per row | Works in browser and server ("people.1.pname") | Works |
| Conditions per row | Child age shown only in the row where Kind = Child; server required it only there | Works |
| Entry detail | Table per row | Works |
| Email | "1. Person name: ...; Kind: Child; ..." | Works |
| CSV | One column per child, rows separated by line breaks | Works |
| Upload in a row | See FA-03 | Broken |
| Calculation in a row | See FA-07 | Broken |
| Drag to reorder, duplicate row, Logic on the repeater | Not offered | Missing |

### 2.21 reCaptcha, hCaptcha, Turnstile (`recaptcha`, `hcaptcha`, `turnstile`), free
| Behaviour | Result | Status |
|---|---|---|
| Site Key per field | Saved, never used: the widget comes from the global CAPTCHA setting, the same widget for all three types | Broken (FA-13) |
| No global keys | Live page shows the field key ("rc", "hc", "ts") as a label over an empty block, console error "CAPTCHA HTML is missing" | Broken (FA-13) |
| Server verification without keys | None: the form submitted without any token | Broken (FA-13) |
| Server verification with keys | Code fails closed when Google/hCaptcha/Cloudflare cannot be reached. Not testable here: those hosts are not reachable from this network | Not testable here |

### 2.22 Action Hook (`action_hook`)
Hidden from the library. Hook Name is saved, but no code anywhere calls do_action with it (render or submit). Broken (FA-14).

### 2.23 Cross-field summary

Settings = controls the builder shows for the type (Settings, Validation including Required, plus the Logic and Style tabs counted once each). Works / Partial / Broken count the settings and behaviours in the tables above.

| Field | Settings | Works | Partial | Broken | Missing Must | Missing Should |
|---|---|---|---|---|---|---|
| Date | 16 | 13 | 1 | 2 | 2 | 1 |
| Time | 14 | 12 | 1 | 2 | 0 | 1 |
| Date & Time | 13 | 11 | 1 | 2 | 0 | 1 |
| Rating | 12 | 11 | 1 | 0 | 0 | 1 |
| Opinion Scale | 16 | 16 | 0 | 0 | 0 | 0 |
| NPS | 11 | 10 | 1 | 0 | 0 | 1 |
| Slider | 15 | 14 | 1 | 0 | 0 | 0 |
| Matrix | 14 | 12 | 1 | 1 | 0 | 0 |
| Calculation (Pro) | 9 | 7 | 1 | 3 | 2 | 2 |
| Signature (Pro) | 12 | 9 | 0 | 2 | 0 | 2 |
| Color Picker | 13 | 11 | 1 | 2 | 0 | 0 |
| Rich Text | 11 | 10 | 1 | 0 | 0 | 0 |
| Hidden | 6 | 4 | 1 | 2 | 1 | 1 |
| File Upload | 15 | 13 | 1 | 3 | 1 | 3 |
| Image Upload | 15 | 13 | 1 | 3 | 1 | 3 |
| Section Heading | 4 | 3 | 1 | 1 | 1 | 0 |
| Custom HTML | 4 | 4 | 1 | 0 | 0 | 1 |
| Notice | 3 | 2 | 0 | 2 | 1 | 0 |
| Page Break | 2 | 4 | 0 | 2 | 3 | 1 |
| Group (hidden in library) | 6 | 6 | 0 | 0 | 0 | 1 |
| 2 / 3 / 4 Columns (hidden in library) | 6 each | 6 | 1 | 0 | 0 | 0 |
| Repeater | 10 | 10 | 1 | 2 | 1 | 1 |
| reCaptcha / hCaptcha / Turnstile | 2 each | 1 | 0 | 3 | 1 | 0 |
| Action Hook (hidden in library) | 1 | 0 | 0 | 1 | 0 | 1 |

(Page Break "Works" counts its behaviours: navigation, per-step validation, skip logic, mobile.)

## 3. Bugs

| ID | Sev | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|
| FA-01 | P2 | REST POST /subtleforms/v1/submit to a form with date (min/max, read-only), time, datetime, rating (7), NPS, slider (10 to 50 step 5), matrix, signature, colour with: d1 "not-a-date", d2 changed, t1 "99:99", dt1 "garbage", r1 99, n1 15, sl1 7, m1 {"Speed":"Nope"}, sig "hello", col "javascript:alert(1)" | 422 with field errors | 200, entry 680 completed with every value as posted, also in email, CSV and PDF | /home/claude/work/qa/fields-advanced/rest-inputs-bypass.txt, csv-out.txt, pdf-680.pdf | src/Engine/FieldValidator.php:233-286, the type switch has no case for these types; validateDateBounds (461) skips non ISO values; readOnly is never checked |
| FA-02 | P1 | Builder: add Notice, Section Heading or Page Break from the library and open Settings | Text/style, title fields | Notice shows only CSS class and "Layout field: configure via canvas"; Section Heading and Page Break show only Description. A new Notice is empty and is hidden on the live form; step titles stay "Step 1" | builder-layout.log, /home/claude/shots/qa/fields-advanced/builder/layout-02-di-Settings.png, builder-layout/insp-Notice.png | layoutControls of these types have no `section`; DynamicInspectorPanel.jsx:134 files them under "appearance", but FieldInspector.jsx:370 (AppearancePanel) only renders when the definition itself declares an appearance control, so the panel is never shown. FieldSettings.php only tags layoutControls for containers |
| FA-03 | P1 | Repeater with a File Upload child; upload small.txt in row 1 and submit | File stored with the entry, download link | Record stored but the file stays in uploads/subtleforms-uploads/pending (removed by the daily clean-up); entry shows the raw JSON record, email and CSV show "id, name, size, type"; a forged record {"id": other entry's file, "name":"forged.pdf"} inside a row is accepted and stored (entry 807) | front-others-repeater.log, entry-retry output, ls of pending folder | Uploads::resolvePayload (src/Uploads/Uploads.php:366) and recordsIn (461) only look at top-level keys |
| FA-04 | P2 | Builder field library | Hidden field listed (it is in FieldSettings::LIBRARY "advanced") | Not listed; cannot be added | builder-layout.log "tile present Hidden false" | src/Fields/CoreFields.php:1078 `paletteHidden: true` |
| FA-05 | P2 | Form with a Hidden field, open the live page | Nothing visible | Label "Hidden one" and an empty block are drawn | /home/claude/shots/qa/fields-advanced/front/inputs-empty-errors.png | resources/frontend/components/FieldRenderer.jsx: the generic input wrapper (around line 493) draws the label for type hidden |
| FA-06 | P2 | Required Color Picker with Default Color #ff0000; submit without touching it | Red is the answer | "This field is required."; an optional one saves nothing | front-inputs.log | resources/frontend/utils/defaults.js collectDefaultValues never seeds `default`; FieldRenderer.jsx:1555 only displays it |
| FA-07 | P2 | Repeater row with Number {rq} and Calculation {rq}*2; enter 2 and 5 | 4 and 10 | Browser shows 0 in each row; server stores whatever is posted (99) | front-calc.js output, rest-calc.txt | PublicSubmitApi::applyCalculations (src/Api/PublicSubmitApi.php:687) evaluates against the top-level payload only; frontend evaluates row formulas without the row scope |
| FA-08 | P2 | Total = {qty}*{price}+{pick}+{adds}, leave the optional checkbox "adds" empty | Empty counts as 0 (Total 20) | Whole formula fails, Total shows 0.00 | front-calc.js output "price=0" | resources/frontend/utils/formula.js:17-24 readRef returns FORMULA_ERROR for a missing key; Formula.php resolve() same |
| FA-09 | P2 | Divide = {qty}/{price} with price 0 | A blank or 0 with a clear message | "__formula_error__" stored and shown in entry detail, email and CSV; browser shows 0.000 with no message | rest-calc.txt, csv-out.txt, entries/calc-692.png | Formula::ERROR is written into the payload by applyCalculations |
| FA-10 | P2 | Matrix single (rows Speed, Price) and multi (Mon x AM/PM); submit and read email, CSV, PDF | "Speed: Good; Price: OK", "Mon: AM, PM" | "Good, OK" and "Mon: Yes, Yes"; entry detail multi shows "AM: true" | resend output for entry 751, csv-out.txt, pdf-680.pdf | Answer formatting for checkbox_grid in FieldMapper / EmailAction drops the keys |
| FA-11 | P2 | Date format d/m/Y, Time format g:i A, DateTime format d/m/Y H:i | Display in that format | Ignored on the live form (native inputs) and in entry, email, CSV and PDF (2026-06-15, 09:30, 2026-06-15T14:30) | entry-detail.log, resend output | `format` is never read outside the definition |
| FA-12 | P2 | Export CSV of a form with uploads | File names with download links | "1. id: ccf3...; name: doc.pdf; size: 45; type: application/pdf" | csv-out.txt | SubmissionsApi::export_submissions_csv flattens the record array |
| FA-13 | P2 | Add reCaptcha, hCaptcha and Turnstile fields with their own Site Key, no global CAPTCHA settings | Field uses its key, or the builder warns that CAPTCHA is not set up; the form is not left unprotected silently | Live page shows "rc", "hc", "ts" labels over empty blocks; submit is accepted without a token; with global settings all three types render the one global provider | front/layout-desktop.png, layout page console errors | FormsApi::injectCaptchaHtml (src/Api/FormsApi.php:1217) injects the global provider HTML; PublicSubmitApi.php:151 verifies only when the global setting is enabled and configured; per-field site_key unused |
| FA-14 | P3 | Action Hook field with Hook Name qa_adv_hook; render and submit | do_action('qa_adv_hook') | Never fired | hookcheck.php output "fired during render: 0"; grep shows no do_action for hook_name | Not implemented |
| FA-15 | P3 | NPS end labels, Calculation prefix/suffix | Builder controls | Renderer supports them but the builder has no controls | builder-inventory.json | Missing inspectorControls in CoreFields / FieldsV2 |
| FA-16 | P3 | Signature, Clear button text "Wipe" | Button reads "Wipe" | "Clear" | front-inputs.log "signature buttons" | resources/frontend/components/fields/SignaturePad.jsx clear button uses a fixed string; clearLabel not passed |
| FA-17 | P3 | REST submit a required Rich Text with "<p><br></p>" | Required error | Accepted | harness output entry 878 (only the signature failed) | FieldValidator::isEmpty does not strip tags for rich_text |
| FA-18 | P3 | Open /wp-content/uploads/subtleforms-uploads/files/<id> on a server that ignores .htaccess (PHP built-in server here, nginx in production) | 403 | 200 with the file content | curl output in this session | Protection relies on .htaccess/web.config; names are random 128-bit IDs known only to the uploader, so the risk is low |
| FA-19 | P2 | Delete a form permanently that has entries with uploads | Entries and files removed, or a warning | 20 entries and their files stayed in the database and uploads folder (cleaned up by hand) | cleanup.js output, row count 20 | Form delete does not cascade to submissions or call Uploads::deleteForPayload |
| FA-20 | P3 | Section Heading followed by Custom HTML | Heading on its own full-width row | HTML block sits to the right of the heading | front/layout-desktop.png | Section break wrapper not full width in the field grid |
| FA-21 | P3 | Page Break description "Step one help" | Shown under the step title | Not shown | front/steps-1.png | StepNavigation.jsx reads step.config?.description only |
| FA-22 | P3 | Any column container on the live form | subtleforms-columns-2/3/4 | subtleforms-columns-NaN | front-others-layout.log | FieldRenderer.jsx:336 parseInt("two") |
| FA-23 | P3 | REST submit 1 group to a Repeater with Min Repeats 2 | "Add at least 2 entries." | Errors for the fields of the missing second group, including a conditional field | harness output | Repeater min handled by validating empty groups |
| FA-24 | P3 | Failed submits | Not stored, or kept out of exports | Every 422 submit is stored with status failed, including keys not in the form ("x"), and appears in CSV export | csv-out.txt | PublicSubmitApi creates the record before the pipeline validates |
| FA-25 | P3 | Hidden field definition | One admin label control | Admin label control added twice (deduplicated in the panel); Value and Default value both exist; Color Picker has Default Color and Default value | defs.json | FieldSettings::decorate adds adminLabel for hidden twice and DEFAULTABLE adds defaultValue to types that have their own default |

Pro gating note (not a bug): Signature, Calculation and Picture Choice are locked only in the builder library (FieldDock is_pro_locked). With fields.advanced switched off in-process, the server still saved a schema with Signature and Calculation (freegate.php). Several files per upload field is enforced on the server.

## 4. Missing features and options (compared with Gravity Forms, WPForms Pro, Fluent Forms Pro, Formidable Pro, Forminator Pro)

| Field | Missing | Priority |
|---|---|---|
| Date | Relative min/max (today, today+7), disable weekends, specific dates and past dates | Must |
| Date | Display format applied and a localised picker (flatpickr style) with first day of week | Must |
| Date | Date range (start/end pair), dropdown or text input styles | Should |
| Time | Min/max time, minute step, 12/24 hour display | Should |
| Datetime | Default value, min/max | Should |
| Rating | Icon type (star, heart, thumb, smiley), size, colour, labels | Should |
| NPS | Builder controls for end labels | Should |
| Slider | Prefix/suffix, value display options, two-handle range | Nice |
| Matrix | Dropdown or text cells, randomise rows | Nice |
| Calculation | if()/conditional function, comparison operators | Must |
| Calculation | Empty fields treated as 0 | Must |
| Calculation | Date difference (days between two dates), age from date | Should |
| Calculation | Prefix/suffix and thousand separator controls, hide field option | Should |
| Signature | Pen colour and width, background, undo | Should |
| Signature | Signature image in emails (link or inline) | Should |
| Colour | Palette presets, alpha | Nice |
| Rich text | Placeholder, character/word limit, link and heading buttons | Nice |
| Hidden | Visible in the library (FA-04) | Must |
| Hidden | Dynamic defaults: page URL, page title, embed post ID, referrer, user ID/role, IP, cookie, UTM shortcuts | Should |
| Uploads | Image thumbnails/preview | Should |
| Uploads | Store in the Media Library or send to cloud storage (S3, Drive, Dropbox) | Should |
| Uploads | Max size in MB instead of bytes | Should |
| Uploads | Chunked upload for large files, client-side image resize/compression | Nice |
| Uploads | Drag and drop for a single-file field (only Pro multi has a drop zone) | Nice |
| HTML | Merge tags inside content ({date}, field values) | Should |
| Notice / Section | Editable text, title and style (FA-02) | Must |
| Multi-step | Editable step titles (FA-02) | Must |
| Multi-step | Progress bar (percentage) with choice of steps or bar | Must |
| Multi-step | Save and continue later (resume link by email) | Must |
| Multi-step | Auto-advance on single choice, custom Next/Previous labels per step, scroll to top option | Should |
| Repeater | Drag to reorder rows, duplicate row, row label template, logic on the repeater | Should |
| Repeater | Uploads and calculations per row (FA-03, FA-07) | Must |
| Containers | Logic on a group | Should |
| CAPTCHA | Per-form choice of provider, builder warning when not configured, invisible/v3 score threshold per form | Must |
| Action hook | Working hook, or remove the type | Should |

## 5. What could not be tested and why

- Real CAPTCHA verification (Google reCAPTCHA, hCaptcha, Cloudflare Turnstile): those hosts are not reachable from this network, and global CAPTCHA settings are shared with other auditors, so they were not changed. Server behaviour without keys was tested; with keys only the code path was read (it fails closed on network errors).
- Charging a calculated amount with Stripe or PayPal: gateways not reachable. The server-side price (payments/quote) was tested.
- Touch drawing on the signature pad with a real touch device: the mobile layout was checked at 390px with touch emulation, but no stroke was drawn with touch events.
- Native date and time pickers on real iOS/Android: only Chromium mobile emulation (the inputs are native type=date/time/datetime-local).
- Free plan without Pro: Pro must stay active for other auditors; gating was checked in-process with a capabilities filter (freegate.php) and from code.

All QA forms, pages and entries (including the orphans from FA-19) and the test upload files were removed at the end.
