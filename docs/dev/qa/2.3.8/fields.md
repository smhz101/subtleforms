# QA re-audit: fields (SubtleForms free 2.3.8)

Area: every field type in the free plugin, field options and behaviour, re-verification of FB-01 to FB-24 (fields-basic, 2.3.3) and FA-01 to FA-25 (fields-advanced, 2.3.3), plus the 2.3.4 to 2.3.8 field work. Site http://localhost:8930 (/home/claude/wp/audit238) running the release zip contents (/home/claude/work/v238/free-dist) with Pro 2.3.3 active, 19 October 2026.

Scripts and raw results: /home/claude/work/qa238/fields/ (out/*.json, out/*.csv, out/*.txt). Screenshots: /home/claude/shots/qa238/fields/. New bug IDs use the prefix FLD2-. All QA238-fields- forms, pages, entries, queued emails and the two test upload files were removed at the end (0 forms and 0 entries left in the range used).

## 1. Summary

- P2 release problem: the frontend bundle in the 2.3.8 zip (build/frontend/frontend.js, 01:36) was built before the last commit bbf5871 (02:17, "announce them as radios"). The uploaded zip and free-dist are byte identical. So the shipped chained Buttons and Columns layouts are plain aria-pressed buttons, every choice is a tab stop and arrow keys do nothing. The admin bundle (02:35) does contain the fix. Rebuild before submitting to WordPress.org (FLD2-01).
- Most 2.3.3 bugs are still open because the server validator, field mapper, uploads, logic editor, steps and formula code did not change between 2.3.3 and 2.3.8 (git diff f2b7b03..HEAD is empty for src/Engine, src/Uploads, FieldMapper, PublicSubmitApi, SubmissionsApi, LogicEditor, StepNavigation, SignaturePad, formula.js). Of the 49 old IDs: 3 Fixed (FA-04, FA-05, FB-21), 5 Partly fixed or Changed (FB-04, FB-08, FB-24, FA-11, FA-25), 41 Still open. Still open and most important: Name and Address sub-field settings lost and ignored (FB-01, FB-02, P1), layout blocks without title or text controls (FA-02, P1), uploads inside a Repeater never leave the pending folder (FA-03, P1), no server check of option membership, dates, times, ratings and colours (FB-11, FA-01), rejected submissions stored and exported (FB-09), values instead of labels in entries, emails and CSV (FB-13).
- Dependent dropdowns (2.3.8) work end to end in the builder and on the form: column editor, outline paste, CSV import with quoted commas, example and current-list download, empty file refused, legacy lists kept fully visible, three layouts. But choices typed in the editor are stored as choice_1, choice_2 (also every non-Latin label), and because entries show stored values (FB-13), admins read "choice_1, choice_2" in entries, emails and CSV (FLD2-02). Removing the last choice and adding a new one reuses its identifier, so old entries silently point at the new choice (FLD2-03). Columns layout pre-selects and submits the first choice, so a required chained field can never fail and untouched fields store an answer (FLD2-09).
- Custom pickers (2.3.4) look right at 1280 and 390, store the same values as before (2026-12-02, 14:05, 2026-10-20T09:30, PK or Pakistan), apply the display format, respect min and max dates, and can be cleared when optional. Keyboard and screen reader support is weaker than the native controls they replaced: no aria-activedescendant, no typeahead, focus drops to the page after a choice in Country, Phone and Date, Country with search off cannot be used with arrow keys, the calendar has no arrow-key grid and no year jump, and the triggers lost aria-invalid and aria-required so the first-error focus skips them (FLD2-04, FLD2-05, FLD2-06, FLD2-16).
- Phone with country (2.3.4): flags on and off save and reload, the picked country survives an empty number and the shared +1 code in the UI. But a pasted international number is glued to the current dial code ("+44 20 7946 0958" became "+92 442079460958"), the trunk 0 is kept, the server accepts "+1", "+1 5" and "+999 123", and the stored "+1 ..." cannot tell US from Canada (FLD2-07).
- Hidden field (2.3.7): in the library, invisible on the live page (FA-04, FA-05 fixed), tokens resolve in the browser, value stored and sent in email under its admin label. Value and Default value are still two settings (FA-25 partly).
- Long labels (2.3.7): 2,000 characters save and render; 2,001 is refused. The error is only a hover title on "Unsaved changes" and names the setting, not the field; a year such as "2026" as a label still fails with "Maximum value is 2000" (FB-04). A 1,476 character label is repeated verbatim in emails, CSV headers and server messages (FLD2-11, FLD2-12).
- Repeater, Group and Columns toolbar (2.3.7): move up and down, width, duplicate and delete work on containers. The container's own toolbar has no "Move to" (FLD2-19).

## 2. Re-verification of 2.3.3 bug IDs

Evidence files are in /home/claude/work/qa238/fields/out unless a path is given. "Code unchanged" means the file named in the old cause has no diff between 2.3.3 (f2b7b03) and 2.3.8 (HEAD).

### 2.1 fields-basic (FB)

| ID | Old summary | Status on 2.3.8 | Evidence |
|---|---|---|---|
| FB-01 | Name and Address sub-field map lost on save | Still open | REST save of the Name field with first/middle/last/suffix map read back as a keyless list `[{"label":"Given",...}]` (all-schema-roundtrip.json). Schemas.php `fields` rule unchanged. |
| FB-02 | Live renderer ignores sub-field settings | Still open | Parts form: Last Name, State, Country drawn although switched off; errors "Please enter your first and last name." and "Please enter your full address." (live-basic.json, parts.png). |
| FB-03 | Password strength meter and confirmation not rendered | Still open | One password input, no meter (live-basic.json). |
| FB-04 | Numeric placeholder, default or label blocks save | Still open, message changed for labels | REST: placeholder "1000" refused "Maximum value is 255", default "750" refused "Maximum value is 500", label "2026" refused "Maximum value is 2000", label "1999" saves (schema-probe.json). Builder: label "2026" leaves "Unsaved changes" with the hover title "Field label: Maximum value is 2000" (builder3.json). |
| FB-05 | Email Allow Multiple rejects lists | Still open | "a@example.com, b@example.com" 422 "Invalid email address." (rest-basic.json). |
| FB-06 | Email RFC Validation does nothing | Still open | RFC off, "user@localhost" still 422 (rest-basic.json). |
| FB-07 | Read-only not enforced on the server | Still open | `{"rot":"hacked"}` stored (rest-basic.json, entry list shows "hacked"). Also a read-only date accepted "1999-01-01" (rest-adv.json). |
| FB-08 | Phone Format and Country Enable Search do nothing | Partly fixed | Country search now works (typed "paki", Enter chose Pakistan; "zzzz" shows "No countries match that search.", pickers.json). Phone Format US still accepts "12" on the server and is not applied in the browser. |
| FB-09 | Rejected submissions stored as failed entries and exported | Still open | 50 failed and 26 completed entries for the basic forms; CSV export of the All form has 44 "failed" rows (export-all.csv). Failed entries also keep the spam time-trap value, which the inbox shows as the sender name "1792361444" (entry-6006.png). |
| FB-10 | Server accepts partial Name and Address when required | Still open | `nm:{first_name:"Ada"}` stored; required form accepted `addr:{city:"X"}` (rest-basic.json). |
| FB-11 | No option membership check on the server | Still open | dd "zzz", rd "purple", mc ["bogus","fake"], pc ["zzz"], co "Narnia", cs ["x","y"], tg "maybe", cb "hello", cn "yes" all stored (rest-basic.json). New fields too: dropdown "enterprise", country "ZZ", chained ["ford","corolla"] (wrong parent), ["x","y","z"], "ford" as a string and a 4-level path on a 3-level field (rest-new.json). |
| FB-12 | Name/Address ignore custom required message in the browser | Still open | Browser shows the fixed messages (live-basic.json). fieldValidation.js unchanged. |
| FB-13 | Entries, email and CSV show values not labels | Still open | Email for the baseline entry: "Dropdown QA: b", "Checkboxes QA: o1, o2", "Picture QA: pa", "Single checkbox QA: Yes" while CSV says "1" (rest-basic.json, export-all.csv). Now worse for chained fields, see FLD2-02. |
| FB-14 | Server messages differ and are not translatable | Still open | "Cannot exceed 100." from the server (rest-basic.json); FieldValidator.php unchanged. |
| FB-15 | Website scheme rules differ browser vs server; bare domains refused | Still open | "ftp://example.com" stored, "example.com" 422 (rest-basic.json). |
| FB-16 | New Dropdown, Radio, Checkboxes have no starter choices | Still open | Builder adds them with "Add at least one option." (builder1.json). |
| FB-17 | Name/Address group not named or linked for screen readers | Still open | Renderer composite branch unchanged; parts form shows the outer label plus part labels and no group role (live-basic.json). |
| FB-18 | Dangling label `for` on Radio, Checkboxes, Picture Choice | Still open | Labels for subtleforms-field-rd, -mc, -pc point at no element (live-basic.json). |
| FB-19 | Prefix/suffix aria-hidden and low contrast | Still open | All six affixes aria-hidden; axe color-contrast on the suffix (live-basic.json). |
| FB-20 | Logic value pickers for checkbox, consent, toggle, country | Still open (not re-run in the UI) | LogicEditor.jsx and conditions code unchanged since 2.3.3. |
| FB-21 | Chained Select levels not dependent, CSV source broken | Fixed (with new bugs) | Levels now depend on the parent (Toyota shows Corolla and Yaris only, Kia shows no second list), CSV import works (chained-live.json, builder-chained.json). See FLD2-01 to FLD2-03, FLD2-09, FLD2-10, FLD2-13. |
| FB-22 | Consent default text shows "Privacy Policy" twice | Still open | Canvas: "I agree to the Privacy Policy. Privacy Policy" (builder1.json). |
| FB-23 | Array accepted for a text field | Still open | `{"txt":["a","b"]}` stored (rest-basic.json). |
| FB-24 | Canvas does not preview defaults | Partly fixed | Country default PK shows on the canvas; Dropdown default "Beta" and Radio default "Green" still not shown (b2-long-label-save.png). |

### 2.2 fields-advanced (FA)

| ID | Old summary | Status on 2.3.8 | Evidence |
|---|---|---|---|
| FA-01 | No server value check for date, time, datetime, rating, NPS, slider, matrix, signature, colour, read-only | Still open | Stored: d1 "not-a-date", d2 changed, t1 "99:99", dt1 "garbage", r1 99, n1 15, sl1 7, m1 Speed "Nope", sig "hello", col "javascript:alert(1)" (rest-adv.json). Also "15/06/2026", "2:05 PM", "2026-06-15 09:30" stored as typed (rest-new.json). Min and max date are enforced. |
| FA-02 | Notice, Section Heading, Page Break cannot be configured | Still open | Notice: "Layout field: configure via canvas"; Section Heading: Description only; Page Break: Description only, steps stay "Step 1", "Step 2" (builder1.json, builder4.json). |
| FA-03 | Uploads inside a Repeater stay in pending, forged records accepted | Still open | Browser upload in a row: entry 6040 stored the record, file 4f86763f... stayed in subtleforms-uploads/pending, not in files. |
| FA-04 | Hidden not in the library | Fixed | "Hidden" tile present and adds a field (builder1.json). |
| FA-05 | Hidden label drawn on the live page | Fixed | No label, no wrapper, value "src=newsletter||2026-10-19|" (live-new.json, live-adv.json). |
| FA-06 | Colour default shown but not submitted | Still open | Required colour with default #ff0000: swatch red, submit refused "This field is required." (color.json). |
| FA-07 | Calculation inside a Repeater row | Still open | Browser "Row calc 0.00"; server stored posted "99" for both rows (live-adv.json, rest-adv.json). |
| FA-08 | Empty field breaks the whole formula | Still open | Price empty: browser Total 0.00, server "__formula_error__" (live-adv.json, rest-adv.json). |
| FA-09 | Division by zero stores __formula_error__ | Still open | div "__formula_error__" stored (rest-adv.json). |
| FA-10 | Matrix loses row or column names in output | Still open | Email "Matrix single: Good, OK", "Matrix multi: Mon: Yes, Yes" (rest-adv.json). |
| FA-11 | Date/time format ignored | Partly fixed | The live picker now shows the format: "15/10/2026", "2:05 PM", "20/10/2026 09:30" (pickers.json). Entry, email and CSV still show 2026-12-02, 14:05, 2026-10-20T09:30 (entry-6006.png, export-new.csv). |
| FA-12 | CSV shows raw upload records | Still open | "1. id: c27e...; name: small.txt; size: 11; type: text/plain" (QA238 upload form CSV, command output). |
| FA-13 | CAPTCHA fields ignore site key, draw a label, no verification without global keys | Still open | Live: label "Captcha" over an empty block, console "CAPTCHA HTML is missing"; REST submit without a token stored (live-adv.json, rest-adv.json). |
| FA-14 | Action Hook never fires | Still open | qa238_hook fired 0 times across 8 submits (rest-adv run output). |
| FA-15 | NPS end labels and Calculation prefix have no builder controls | Still open | Inspectors listed in builder4.json. |
| FA-16 | Signature Clear label ignored | Still open | clearLabel "Wipe", button reads "Clear" (live-adv.json). |
| FA-17 | Required Rich Text accepts `<p><br></p>` | Still open | Stored (rest-adv.json). |
| FA-18 | Upload folders readable without .htaccess | Still open | GET .../subtleforms-uploads/pending/4f86763f... returned 200. |
| FA-19 | Deleting a form leaves entries and files | Still open | Deleted form 2310 with one upload entry: entry 6043 and its file stayed (cleaned up by hand). |
| FA-20 | Section Heading not full width | Still open, looks worse | Section (128 px wide), Custom HTML and Notice sit side by side on one row (live-adv.json, adv-layout.png). |
| FA-21 | Step description not shown | Still open | "Step one help" not on the page (live-adv.json). |
| FA-22 | Column wrapper class NaN | Still open | "subtleforms-columns-NaN" (live-adv.json). |
| FA-23 | Repeater min message names missing fields | Still open | 1 group on min 2: `{"people.1.pn":"Name is required."}` (rest-rep.json). Max 3 works ("Add no more than 3 entries."). |
| FA-24 | Failed submits stored and exported | Still open | Same as FB-09. |
| FA-25 | Duplicate settings (Hidden Value and Default value, Colour Default Color and Default value) | Partly fixed | Hidden admin label shown once; Hidden still has Value plus Default value, Colour still has Default Color plus Default value (builder1.json, builder4.json). |

Totals: Fixed 3 (FA-04, FA-05, FB-21), Partly fixed or changed 5 (FB-04, FB-08, FB-24, FA-11, FA-25), Still open 41.

## 3. New features audit (2.3.4 to 2.3.8)

### 3.1 Custom pickers: Dropdown, Country, Date, Time, Date and Time

| Check | Dropdown | Country | Date | Time | Date and Time |
|---|---|---|---|---|---|
| Live render 1280 and 390, no overflow | Works | Works | Works (menu 274 px inside 390) | Works | Works |
| Builder canvas | Works (placeholder shown, default not, FB-24) | Works (PK shown) | Works | Works | Works |
| Stored value unchanged from 2.3.3 | Works ("pro", "green") | Works ("Pakistan" name format, "AF" code format) | Works ("2026-12-02") | Works ("14:05") | Works ("2026-10-20T09:30") |
| Display format | n/a | n/a | Works (d/m/Y shown as 15/10/2026) | Works (g:i A shown as 2:05 PM) | Works (20/10/2026 09:30) |
| Min/max | n/a | n/a | Works (21 to 31 December disabled, server refuses outside) | Not offered | Not offered |
| Clear when optional | Works ("Clear selection" only when not required) | Works | Works (Clear button) | Works | Works |
| Mouse | Works | Works | Works | Works | Works |
| Keyboard | Partial: ArrowDown opens and moves, Enter chooses, Escape closes, focus stays; no typeahead, no Home/End; Clear not reachable by arrows | Partial: search gets focus, arrows and Enter work, but focus drops to the page after choosing or Escape; with search off, arrows do nothing and every country is a Tab stop | Partial: no arrow-key grid; Tab passes through 42 day buttons; focus drops after choosing | Partial: Tab through 24 or 12 hour and 60 minute buttons | Partial |
| Screen reader | Partial: name from label, no aria-activedescendant, current value only in the button text | Partial: same | Partial: days named only "15", no month or year; dialog not focused on open | Partial: role=listbox with button children (no options) | Partial |
| Required and error state | Partial: is-invalid class only, no aria-invalid or aria-required; first-error focus skips the picker | Same | Same | Same | Same |
| Server check | Broken (FB-11) | Broken (FB-11) | Partial (min/max yes, format no, FA-01) | Broken (FA-01) | Broken (FA-01) |
| Entry, email, CSV | Value not label (FB-13) | Works | Raw ISO (FA-11) | Raw | Raw with T |

### 3.2 Phone with country

| Setting / behaviour | Save | Canvas | Live | Browser | Server | Status |
|---|---|---|---|---|---|---|
| Country code toggle (General) | Yes (enableCountryCode true after reload) | Picker drawn | Picker with search, flags and dial code | n/a | n/a | Works |
| Default country (two letters) | Yes | Yes | +1 for US, +92 for PK | n/a | n/a | Works (free text, unknown codes fall back to US silently) |
| Show flags (Style, only when the toggle is on) | Yes (appearance.showFlags false after reload, toggle off) | No flag | No flag on the button or in the list | n/a | n/a | Works |
| Picking a country before digits | n/a | n/a | Canada kept after choosing, then typing 4165550100 | n/a | n/a | Works |
| +1 shared code | n/a | n/a | Canada stays selected in the UI | n/a | Stored "+1 4165550100", country not stored | Partial (FLD2-07) |
| Pasting an international number | n/a | n/a | "+44 20 7946 0958" into a PK field gives +92 and 442079460958 | n/a | Stored "+92 442079460958" | Broken (FLD2-07) |
| Search by dial code | n/a | n/a | "+44" lists Angola +244 first | n/a | n/a | Partial |
| Required | n/a | n/a | Required error when empty | Yes | "+1" alone accepted | Partial |
| Accessible name of the country button | n/a | n/a | "+1" only | n/a | n/a | Partial (FLD2-08) |
| Entry, email, CSV | | | | | | Works ("+1 4165550100") |

### 3.3 Hidden field

| Check | Status | Evidence |
|---|---|---|
| In the field library, added from it | Works | builder1.json |
| Inspector: Label (builder only), Value with token help, Admin label, CSS class | Works | builder1.json |
| Value and Default value both present | Partial (FA-25) | builder1.json |
| Live page: no label, no box | Works | live-new.json |
| {get:utm}, {date}, {user_email}, {user_name} | Works in the browser ("src=newsletter||2026-10-19|" for a guest) | live-new.json |
| Tokens resolved on the server | Missing: a REST or no-JS submit without the field stores nothing; {date} is the visitor's local date | rest-new.json "hidden omitted" |
| Tampering | Posted value replaces the configured one; HTML stripped to "" | rest-new.json |
| Entry, email (admin label "Campaign"), CSV | Works | entry-6006.png, export-new.csv |

### 3.4 Repeater, Group and Columns toolbar

| Check | Status | Evidence |
|---|---|---|
| Move up, Move down | Works (buttons present on Repeater and Columns) | builder5.json |
| Width | Present ("Field width: Full") | builder2.json |
| Duplicate | Works (2 to 3 repeaters) | builder5.json |
| Delete | Works (3 to 2) | builder5.json |
| Move into a container ("Move to") | Partial: offered on child fields, not on the container's own toolbar | builder2.json (FLD2-19) |
| Group (hidden in the library) | Toolbar on existing forms not separately exercised | Not run |

### 3.5 Long labels (up to 2,000 characters)

| Check | Status | Evidence |
|---|---|---|
| 256, 2,000 ASCII and 2,000 multibyte characters save and reload | Works | schema-probe.json |
| 2,001 refused | Works on the server | schema-probe.json |
| Builder error names the label | Partial: only the hover title "Field label: Maximum length is 2000 characters", no notice, does not say which field | builder3.json, b3-2001.png |
| Numeric label | Broken: "2026" refused "Maximum value is 2000" (FB-04) | schema-probe.json |
| Builder control | Partial: single-line input for a paragraph; a long unbroken label overflows the canvas to the right | b2-long-label-save.png |
| Live form 1280 and 390 | Works (wraps, readable, bold) | live-new-1280.png, live-new-390-crop.png |
| HTML in a label | Stripped ("Agree to terms", link removed) | schema-probe.json |
| Email, CSV, entry, server messages | Partial: the full label is repeated (FLD2-12) | rest-new.json, export-new.csv |

### 3.6 Dependent dropdowns (chained select)

| Setting / behaviour | Save | Canvas | Live | Browser | Server | Status |
|---|---|---|---|---|---|---|
| Column editor (Set up / Edit dropdowns, add dropdown, name, add choice, remove choice, select a parent to see its children, help text follows the selection) | Yes | Yes | Yes | n/a | n/a | Partial: identifiers choice_N (FLD2-02), reuse after removing the last choice (FLD2-03) |
| Outline paste (two spaces or tab, deeper indent clamped) | Yes ("Pakistan > Lahore > Gulberg, DHA", "UAE > Dubai > Marina") | Yes | n/a | n/a | n/a | Works; new third level gets an empty name and shows "Selection"; replace has no confirmation |
| Source Manual / CSV in the Dropdowns panel | Yes (source csv, sourceChosen, csvFileName) | n/a | n/a | n/a | n/a | Works |
| CSV import (header row names dropdowns, quoted "London, City", short rows) | Yes | n/a | Yes | n/a | n/a | Works |
| Example file download | n/a | n/a | n/a | n/a | n/a | Works (4 rows, 3 columns) |
| Current lists download, round trip | n/a | n/a | n/a | n/a | n/a | Works |
| Empty file or header only | Refused with "This file needs a header row and at least one row of choices.", lists kept | | | | | Works |
| Semicolon CSV, non-Latin labels | Accepted silently as one column; Urdu labels stored as choice_1... | | | | | Partial (FLD2-13, FLD2-02) |
| Legacy lists without parents | n/a | n/a | Every choice shown in both dropdowns | n/a | n/a | Works (live and in the editor) |
| On the form: Dropdowns | Yes | Yes | Native selects, next appears after a choice, Kia (no models) ends the path | n/a | n/a | Works (native select style differs from the new pickers) |
| On the form: Buttons | Yes | Yes | Row appears after a selection | Tab per button, arrows do nothing, aria-pressed | n/a | Partial (FLD2-01) |
| On the form: Columns | Yes | Yes | All lists, first choice selected, empty list inactive | Same as Buttons; first choice submitted untouched | n/a | Partial (FLD2-01, FLD2-09) |
| Required | Yes | n/a | Error on the first list only | Columns can never fail | Only the first level checked | Partial (FLD2-10) |
| Server path check | n/a | n/a | n/a | n/a | None | Broken (FB-11) |
| Entry, email, CSV | | | | | | Partial: values ("ford", or "choice_1") |
| axe | | | | | | color-contrast on the Columns header labels (4.37:1) |

### 3.7 Chained choice identifiers (2.3.4 fix)

Removing a middle choice and adding a new one gives a new identifier. Removing the last choice (Kia, choice_3) and adding Honda gives choice_3 again (builder-chained.json, schema_manual). Partial (FLD2-03).

## 4. New bugs

| ID | Sev | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|
| FLD2-01 | P2 | Install the 2.3.8 zip; form with a chained field in Buttons or Columns; Tab into it and press ArrowRight | Radios: aria-checked, one Tab stop per list, arrows move (release notes, commit bbf5871) | Buttons with aria-pressed, every choice is a Tab stop, arrows do nothing | live-new.json and aria-new-1280.txt (`button "Ford" [pressed]`), chained-live.json; `grep -c aria-checked` is 0 in free-dist/build/frontend/frontend.js and 1 in the source build | build/frontend/frontend.js in the zip dated 2026-10-19 01:36, commit bbf5871 at 02:17; the frontend bundle was not rebuilt (admin bundle is 02:35) |
| FLD2-02 | P2 | Builder, chained field, Edit dropdowns, add choices and type Ford, Toyota; or import a CSV with Urdu or Chinese labels; submit | Readable identifiers, or labels in entries | Stored values choice_1, choice_2, choice_3 for every typed choice and every non-Latin label; entries, emails and CSV show those values (FB-13) | builder-chained.json (schema_manual, schema_urdu) | chainedLevels.js addChoice calls makeChoice(options, '') so the value is choice_N, renameChoice keeps it; slugifyChoice drops non a-z0-9 |
| FLD2-03 | P2 | Editor: Make has Ford, Toyota, Kia; remove Kia; add Honda; save | New identifier | Honda gets choice_3, the identifier Kia had; old entries now read as Honda | builder-chained.json | uniqueValue only checks the current list; makeChoice bases the value on options.length + 1 |
| FLD2-04 | P2 | Keyboard and screen reader on Dropdown and Country pickers | Combobox or listbox pattern with the active option announced, typeahead, focus back on the trigger after choosing | No aria-activedescendant, no typeahead; Country (and Phone) focus goes to the page body after Enter or Escape; Country with search off: ArrowDown does nothing, Tab walks through 250 options | pickers.json (co_chosen, co_esc, cor_arrow, cor_tab) | ChoiceSelect.jsx, CountrySelect.jsx, PhoneField.jsx: focus not returned in choose(); no onKeyDown on the Country trigger |
| FLD2-05 | P2 | Keyboard on Date, Time, Date and Time pickers | Arrow keys in the calendar grid, focus moved into the dialog, days named with month and year | Tab through 42 day buttons, ArrowRight does nothing, dialog not focused, days named "15", hour and minute columns are role=listbox with plain buttons | pickers.json (dt_keyboard), DateTimeField.jsx | No grid key handling or labels in DateTimeField.jsx |
| FLD2-06 | P3 | Submit the required pickers form empty | Fields marked aria-invalid and aria-required; focus on the first invalid field (Date) | Triggers have no aria-invalid or aria-required (the 2.3.3 native select had both); focus went to the 4th invalid field (Phone) | req-new.json | ChoiceSelect, CountrySelect, DateTimeField pass `invalid` only as a CSS class |
| FLD2-07 | P2 | Phone with country (PK). Paste "+44 20 7946 0958"; type "07700 900123" with +44; REST "+1", "+1 5", "+999 123" | Country follows a pasted +code; trunk 0 dropped or flagged; server checks length and a real dial code; stored country known | "+92 442079460958" stored; "+1 07700900123"; "+1" accepted for a required field, "+1 5" and "+999 123" stored; US and Canada both "+1 ..." | pickers.json, phone2 output, rest-new.json | PhoneField onChange keeps the current country; joinPhoneValue strips "+"; FieldValidator phone check is characters only |
| FLD2-08 | P3 | Screen reader on the phone country button; Windows browsers | Name such as "Country code, Canada +1"; flags that render everywhere | Name "+1"; flag emoji (Windows shows letters; WordPress emoji script swaps them for CDN images, broken offline as seen in the screenshots) | aria-new-1280.txt, live-new-1280.png | PhoneField trigger has no aria-label; flagEmoji |
| FLD2-09 | P2 | Required chained field in Columns layout; submit without touching it | Required error or no answer | Passes; ["ford"] (first choice) stored for every untouched visitor | req-new.json (no error for csc), pickers.json (csc ["ford"] posted) | ChainedSelect.jsx seeds defaultChainedColumnSelections into the value |
| FLD2-10 | P3 | Required chained field; REST ["toyota"] or browser with only Make chosen | Every level with choices answered | Accepted | rest-new.json ("req: only first level chained") | Only depth 0 is checked in the browser and FieldValidator |
| FLD2-11 | P3 | Builder: label of 2,001 characters, or "2026"; Save draft | Visible message naming the field | Header "Unsaved changes / Retry autosave"; only a hover title "Field label: Maximum length is 2000 characters" or "Field label: Maximum value is 2000"; no field named; the label box is one line and a long word overflows the canvas | builder3.json, b2-long-label-save.png | saveErrors.js areaOf names the setting only; Rules.php numeric max (FB-04) |
| FLD2-12 | P3 | Checkbox with a 1,476 character label, submit | Short name in outputs (admin label or truncated) | Full paragraph as the email line label, CSV header and server message "<label> is required." | rest-new.json, export-new.csv | FieldMapper uses the public label when no admin label is set |
| FLD2-13 | P3 | Import a semicolon CSV (Excel in many locales); replace lists with CSV or outline on a form with entries | Delimiter detected or a warning; confirm before replacing | One column "Province;City" accepted silently; replace has no confirmation and regenerates all identifiers | builder-chained.json | chainedLevels.js parseCsv comma only |
| FLD2-14 | P3 | Builder chained "On the form" and "Source" groups with a screen reader | role=radio with aria-checked | role=radiogroup containing aria-pressed buttons | ChainedDisplayControl.jsx, ChainedSourceControl.jsx | ARIA mismatch |
| FLD2-15 | P3 | Calendar for a date of birth | Month and year jump or typed entry; week start and month names from the site locale | Only Previous/Next month (about 480 clicks for 40 years back); week starts Sunday; month name in the browser locale | pick-date.png, DateTimeField.jsx | Not implemented |
| FLD2-16 | P3 | Hidden field with {date} or {user_email}, submitted by REST or without JavaScript | Server resolves tokens | Nothing stored; {date} uses the visitor's local date | rest-new.json | Tokens only in resources/frontend/utils/defaults.js |
| FLD2-17 | P3 | Rejected submission | Spam time-trap value not stored | Failed entries keep form_rendered_at, and the inbox shows "1792361444" as the sender | entry-6006.png list | Follows FB-09 |
| FLD2-18 | P3 | Chained Columns layout, axe | 4.5:1 | Column header labels 4.37:1 | live-new.json | ChainedSelect.scss label colour |
| FLD2-19 | P3 | Select a Repeater and look at its toolbar | Move into a container, as the release notes say | Drag, Move up, Move down, Width, Duplicate, Delete; no Move to | builder2.json | Container toolbar omits the Move to menu |

## 5. Cross-field matrix (2.3.8, same counting as the 2.3.3 matrices)

Settings count excludes the shared Logic and Style tabs for basic fields and includes them for advanced fields, as in the 2.3.3 reports. Missing Must/Should use section 6.

| Field | Settings | Works | Partial | Broken | Missing Must | Missing Should | Change from 2.3.3 |
|---|---|---|---|---|---|---|---|
| Text | 17 | 13 | 4 | 0 | 2 | 2 | none |
| Paragraph | 15 | 14 | 1 | 0 | 1 | 1 | none |
| Email | 14 | 11 | 1 | 2 | 1 | 1 | none |
| Number | 17 | 12 | 5 | 0 | 1 | 0 | none |
| Phone | 16 | 12 | 3 | 1 | 1 | 1 | +3 settings (country code, default country, flags); country selector no longer missing |
| Website | 14 | 10 | 4 | 0 | 1 | 0 | none |
| Name | 10 | 7 | 2 | 1 | 1 | 1 | none |
| Address | 10 | 7 | 2 | 1 | 2 | 1 | none |
| Password | 14 | 12 | 0 | 2 | 2 | 1 | none |
| Dropdown | 12 | 10 | 2 | 0 | 3 | 3 | picker added, keyboard and a11y partial |
| Radio Buttons | 12 | 11 | 1 | 0 | 1 | 1 | none |
| Checkboxes | 14 | 13 | 1 | 0 | 1 | 2 | none |
| Single Checkbox | 10 | 9 | 1 | 0 | 0 | 2 | none |
| Toggle | 13 | 12 | 1 | 0 | 0 | 0 | none |
| Picture Choice | 14 | 13 | 1 | 0 | 0 | 1 | none |
| Country | 15 | 14 | 1 | 0 | 0 | 1 | Enable Search works; picker keyboard partial |
| Chained Select | 13 | 9 | 4 | 0 | 0 | 1 | rebuilt; was 11 / 8 / 2 / 1 |
| Consent / GDPR | 12 | 10 | 2 | 0 | 1 | 1 | none |
| Date | 16 | 12 | 3 | 1 | 2 | 1 | format now shown live (Broken to Partial), picker keyboard partial |
| Time | 14 | 11 | 2 | 1 | 0 | 1 | same |
| Date & Time | 13 | 10 | 2 | 1 | 0 | 1 | same |
| Rating | 12 | 11 | 1 | 0 | 0 | 1 | none |
| Opinion Scale | 16 | 16 | 0 | 0 | 0 | 0 | none |
| NPS | 11 | 10 | 1 | 0 | 0 | 1 | none |
| Slider | 15 | 14 | 1 | 0 | 0 | 0 | none |
| Matrix | 14 | 12 | 1 | 1 | 0 | 0 | none |
| Calculation (Pro) | 9 | 7 | 1 | 3 | 2 | 2 | none |
| Signature (Pro) | 12 | 9 | 0 | 2 | 0 | 2 | none |
| Color Picker | 13 | 11 | 1 | 2 | 0 | 0 | none |
| Rich Text | 11 | 10 | 1 | 0 | 0 | 0 | none |
| Hidden | 6 | 5 | 1 | 0 | 0 | 1 | library and live label fixed (was 4 / 1 / 2, Must 1) |
| File Upload | 15 | 13 | 1 | 3 | 1 | 3 | none |
| Image Upload | 15 | 13 | 1 | 3 | 1 | 3 | none |
| Section Heading | 4 | 3 | 1 | 1 | 1 | 0 | none |
| Custom HTML | 4 | 3 | 1 | 0 | 0 | 1 | none (2.3.3 row counted 4 + 1) |
| Notice | 3 | 1 | 0 | 2 | 1 | 0 | none |
| Page Break | 6 (behaviours) | 4 | 0 | 2 | 3 | 1 | none |
| Group (hidden in library) | 7 | 7 | 0 | 0 | 0 | 1 | toolbar added |
| 2 / 3 / 4 Columns (hidden) | 7 each | 6 | 1 | 0 | 0 | 0 | toolbar added; NaN class still |
| Repeater | 11 | 9 | 2 | 2 | 1 | 1 | toolbar added (partial, no Move to) |
| reCaptcha / hCaptcha / Turnstile | 2 each | 1 | 0 | 3 | 1 | 0 | none |
| Action Hook (hidden) | 1 | 0 | 0 | 1 | 0 | 1 | none |

## 6. Missing features (updated)

Dropped since 2.3.3 because they now exist: Phone country selector with flags and dial codes; Country searchable select with flags; Chained Select dependent option tree in the builder; Chained Select CSV import; Hidden field in the library.

| Field | Missing | Priority | Free or Pro | Reason |
|---|---|---|---|---|
| All choice types | Labels, not stored values, in entries, emails, CSV (and readable identifiers for chained choices) | Must | Free | Admins cannot read "choice_1" or "b"; every competitor shows labels |
| All | Server checks: option membership, read-only, date/time format, rating and NPS range, colour format, chained path | Must | Free | Security and data quality parity with the browser |
| Pickers | Accessible combobox pattern, typeahead, focus return, aria-invalid | Must | Free | WCAG 2.1 AA for the WordPress.org audience; the native controls had it |
| Date | Month and year jump or typed entry, relative min/max, disabled days, site locale and week start | Must | Free | Birth dates and bookings are the common uses |
| Text | Input mask | Must | Free | Common request |
| Text | Unique value / no duplicates | Must | Free (Pro for cross-form) | Registrations |
| Paragraph | Word or character limit with counter | Must | Free | Common |
| Email | Confirmation field | Must | Free | Common |
| Number | Number format (currency, decimals, separators) | Must | Free | Common |
| Phone | Per-country validation and formatting, E.164 storage with the country | Must | Free | Paste and +1 problems (FLD2-07), integrations need E.164 |
| Website | Accept a bare domain and add https:// | Must | Free | Support tickets |
| Name | Formats (full name, first/last, with title) | Must | Free | FB-01/02 first |
| Address | Country formats (US states, ZIP vs postcode) | Must | Free | |
| Address | Address autocomplete | Must | Pro | Paid tier staple |
| Password | Strength meter and confirmation (the settings exist) | Must | Free | Settings do nothing |
| Dropdown | Multiple selection | Must | Free | |
| Radio, Checkboxes | "Other" with text input | Must | Free | |
| Consent | Store statement text, policy URL and time with the entry | Must | Free | GDPR proof |
| Calculation | if() and comparisons, empty counts as 0 | Must | Pro | FA-08 |
| Multi-step | Editable step titles, progress bar, save and continue | Must | Free (save and continue Pro) | FA-02 |
| Notice / Section | Editable text, title and style | Must | Free | FA-02 |
| Repeater | Uploads and calculations per row | Must | Free | FA-03, FA-07 |
| CAPTCHA | Per-form provider, builder warning when not configured | Must | Free | FA-13 |
| Chained Select | Per-level placeholder, delimiter detection, warning before replacing lists with entries | Should | Free | FLD2-13 |
| Chained Select | Searchable dropdown levels using the new picker | Should | Free | Long lists (cities) |
| Phone | Remember the picked country in the stored value | Should | Free | US/Canada |
| Hidden | Server-side tokens; page URL, referrer, post ID, user ID, IP | Should | Free | FLD2-16 |
| Long labels | Multi-line label editor, short display name for outputs | Should | Free | FLD2-11, FLD2-12 |
| Time | Min/max, minute step | Should | Free | |
| Date & Time | Default value, min/max | Should | Free | |
| Dropdown | Randomise, dynamic choices (posts, terms, users), "Other" | Should | Free | |
| Checkboxes | Select all, randomise | Should | Free | |
| Single Checkbox | Custom stored values, checked by default | Should | Free | |
| Picture Choice | Hide labels, image ratio | Should | Free | |
| Country | Limit to listed countries | Should | Free | |
| Rating | Icon, size, colour, labels | Should | Free | |
| NPS | End label controls | Should | Free | FA-15 |
| Signature | Pen options, image in email | Should | Pro | |
| Uploads | Thumbnails, Media Library or cloud storage, size in MB | Should | Pro for cloud | |
| Repeater | Reorder rows, duplicate row, logic on the repeater | Should | Free | |
| Containers | Logic on a group | Should | Free | |
| All | Logic value pickers and operators by type | Should | Free | FB-20 |
| Email | Domain allow/block list | Should | Free | |
| Password | Show/hide button | Should | Free | |
| Address | Default country, state dropdowns | Should | Free | |
| HTML | Merge tags in content | Should | Free | |
| Action Hook | Make it fire or remove the type | Should | Free | FA-14 |
| Text | Character counter, autocomplete choice | Should | Free | |
| Email | Typo suggestion, disposable block | Nice | Pro | |
| Slider | Two handles, prefix/suffix | Nice | Free | |
| Matrix | Dropdown or text cells | Nice | Pro | |
| Colour | Palette presets | Nice | Free | |
| Rich text | Placeholder, limit, link button | Nice | Free | |
| Country | Detect visitor country | Nice | Pro | |
| Dropdown | Option groups | Nice | Free | |

## 7. Not tested and why

- Real screen readers: semantics checked with Playwright aria snapshots and axe only.
- Real iOS and Android pickers: Chromium mobile emulation at 390 px with touch; menus stay inside the viewport (Time menu ends 10 px below a 900 px viewport and scrolls).
- FB-20 logic value pickers: not re-run in the UI; LogicEditor.jsx and the condition engine are unchanged since 2.3.3.
- Group toolbar on its own (Group is hidden from the library): only Columns and Repeater exercised.
- Undo after removing the last page break (2.3.4 note): builder area, not run here.
- PDF output: Pro feature, not re-run (code paths unchanged).
- Real CAPTCHA verification and Stripe: hosts not reachable from this network.
- Real email delivery: bodies read from the queued subtleforms_async_email jobs, then unscheduled.
- Environment note: the site's mu-plugin filter subtleforms/rate_limit/policy is never applied by 2.3.8 (RateLimiter::policy has no filter), so anonymous /submit is limited to 30 per minute per IP (shared by all auditors on this site). Server batteries were run in-process with rest_do_request and a random REMOTE_ADDR (battery.php), which still goes through the full REST route, permission and validation code.
