# SubtleForms free 2.3.8: free-features re-audit

Auditor area: free-features. Site: http://localhost:8931 (/home/claude/wp/audit238b, Pro 2.3.3 and License Server 1.6.0 active). Second site for round trips, theme switching and uninstall: http://localhost:8934 (/home/claude/wp/audit238d, made with make-site.sh). Scripts: /home/claude/work/qa238/free-features/. Sample import files: /home/claude/work/qa238/free-features/samples/. Screenshots: /home/claude/shots/qa238/free-features/. Baseline for "new" code: commit f2b7b03 (2.3.3 merge) in /home/claude/work/v238/src/subtleforms.

Housekeeping: every QA238-free-features form, page and entry (including the 5,000 seeded entries), the two QA users, my queued cron events and my 504 junk API log rows were removed from 8931. Global settings on 8931 were compared with the backup taken at the start and are identical. Pro was deactivated on 8931 for about two minutes (22:49:45 to 22:51:35 UTC) and reactivated; the Agency license still reads valid. The second site 8934 was left in the state the uninstall test produced (SubtleForms and Pro deactivated, SubtleForms data uninstalled). No plugin code was changed.

## 1. Summary

- Imports trust the file. Forms import (Tools and the Gravity/Fluent importer) saves the schema without the sanitising the builder save applies, and submissions import stores answers as given. A crafted file put `onerror` script on the public form page and in the admin entry view (FF2-01, P1 security).
- The Gravity Forms and Fluent Forms importers lose a lot without saying so. Modern Fluent exports lose every notification and the confirmation, column containers lose their fields, multi-step becomes one page, conditional logic is dropped, Gravity merge tags stay literal and "send to a field" notifications get the address "2" (FF2-02 to FF2-05).
- The inbox deep link and Previous/Next only work for entries in the first 200 rows. A linked entry further down never shows in the list, and Previous/Next stop working (FF2-06).
- Silent partial exports still exist: a never-published form, or a form whose id is missing, exports as an empty file with "Forms exported." (FF2-07). The over-2,000-entries refusal works.
- The 30-day API log keeps no bodies and no IP, and pruning works, but any visitor can add rows without limit (500 junk requests gave 500 rows), and every view beacon and submit is logged (FF2-08).
- Uninstall leaves the new API log table, its option, the new inbox user meta, plus the coupons tables, about 630 transients and queued cron jobs (FF2-09). The owner's note says no table was added in 2.3.4 to 2.3.8; 2.3.6 adds `wp_subtleforms_api_logs`.
- Old bugs: 1 fixed (FF-33), 1 partly fixed (FF-23, the POT is current but JS strings still cannot be translated), 32 still open. FF-01 now also blocks the new "Submissions list density" default in Settings > General on every Pro site with a HubSpot Portal ID.
- Works well: settings vertical tabs and Notifications tab (every value saves and reloads), SubtleForms JSON round trip of forms and entries between two sites (fields, settings, actions, status, read, starred and dates kept), the over-2,000 refusal, Activity and Webhooks logs, Reports totals, reading pane right/below/off, density per admin and site default, inline layout wrapping, preview widths from theme.json, access control on all 11 new REST routes, and the whole free plugin with Pro deactivated.

## 2. Re-verification of the 2.3.3 bugs

| ID | Old summary | Status on 2.3.8 | Evidence |
|---|---|---|---|
| FF-01 | Settings cannot be saved once HubSpot Portal ID > 100 | Still open | PUT /settings with the stored settings: 422 `ext_crm_portal_id: Maximum value is 100` (ff01.js). Settings UI: "Validation failed" when saving the new density default (07-settings-save-result.png). A one-key PUT works, the UI always sends every key. Schemas.php:267 unchanged. |
| FF-02 | AI tab fake test, save fails | Still open | Test Connection with `sk-obviously-invalid`: "Connection successful! AI services are ready." (61-ff02-ai.png). PUT `ai_api_key`: 422 Unknown field. AISettings.jsx:36 still "Simulate API test". |
| FF-03 | Cached page nonce breaks guest submit | Still open | Guest POST /submit with a stale X-WP-Nonce: 403 `rest_cookie_invalid_nonce` (spam.js). |
| FF-04 | Templates post to fake webhooks, no email | Still open | 20 templates have an `*.example.com` webhook and no email, 27 have no action at all (tpl.js). Creating "Advanced Contact Form" in the UI gave actions save + webhook `https://crm.example.com/api/contacts` (tpl_ui.js, form 2304). |
| FF-05 | Payment Form template collects raw card data | Still open | UI-created "Payment Form": plain text fields Card Number, Expiry Date, CVV and a webhook to `payment-gateway.example.com` (form 2305, 05-payment-template.png). |
| FF-06 | Quick Start Wizard creates nothing | Still open | Wizard run to the end: POST /forms 422 `status: Unknown field`, form count 54 before and after (ui_old.js, 60-ff06-after-wizard.png). FormsPage.jsx:114. |
| FF-07 | Badge says Published after autosave | Still open | Add Website field: "Published, changes not live"; after the autosave the badge reads "Published" while GET /forms says `has_unpublished_changes: true` (62-ff07-badge.png). |
| FF-08 | Sender name/email and admin toggle ignored | Still open | Mock mailer with sender override: From "WordPress" <wordpress@example.com>. With `admin_notification_enabled=false` the admin email job was still queued for entry 11022 (ff08b.php). |
| FF-09 | Delete Behavior setting unused | Still open | With `delete_behavior=hard`, DELETE /submissions/11027 returned `trashed: true` and the entry still existed. |
| FF-10 | Autosave interval ignored (30 s) | Still open | Autosave request 30 s after the edit; setting is 3 s (ui_old2.js). useDraftAutosave.js:21. |
| FF-11 | Fast client clock loses real entries | Still open | `form_rendered_at` = now + 300: "Thank you." and nothing stored (spam.js). |
| FF-12 | No timestamp bypasses time trap | Still open | Submit without `form_rendered_at`: stored as entry 11020. |
| FF-13 | Validation failures stored as "failed" entries | Still open | Missing required name: 422 to the visitor, entry 11021 stored with status `failed`. |
| FF-14 | Preview submit drops draft fields, no test flag | Still open | Preview with an unpublished Website field filled: entry 11027 payload has only name and email, meta has no preview flag (ui_old2.js). |
| FF-15 | `{field:name}` and `{form_title}` not replaced in confirmations | Still open | Live confirmation "Got it {field:name} / {name} / {form_title}" showed "Got it {field:name} / Free Only Visitor /" (prooff.js, 50-proon-live-submit.png). |
| FF-16 | Second resend within 10 min dropped but reports success | Still open | Resend 1: jobs 1 to 2. Resend 2: `sent: true`, jobs stay 2 (ff16.js). |
| FF-17 | Free webhook custom payload placeholders not filled | Still open | With Pro deactivated, free WebhookAction queued body `{"name":"{{name}}","email":"{field:email}"}` (wh.php). |
| FF-18 | Unflag from entry detail fails | Still open | Pane: Flag then Flagged; status stays `flagged`. PUT status `completed`: 422 `Must be one of: spam, flagged, archived, none` (ff19.js, 63-ff18-unflag.png). SubmissionDetailPage.jsx:792. |
| FF-19 | Flag/Spam overwrite pipeline status | Still open | Entry 11026 `payment_pending` to `flagged`, to `spam`, Restore gives `""` (ff19.js). |
| FF-20 | Privacy export Form Name null + warning | Still open | Exporter: "Form Name": null and PHP warning PrivacyExporter.php:87 (gdpr.php). |
| FF-21 | Privacy eraser matches by substring | Still open | Erasing `qa238ann@example.com` deleted the entry of `zqa238ann@example.com`. |
| FF-22 | Block AJAX option has no effect | Still open | Code: FormRenderer.jsx never reads `ajax` (static, as before). |
| FF-23 | No JS translations, stale POT | Partly fixed | languages/subtleforms.pot now says 2.3.8 (392 KB). No `wp_set_script_translations` anywhere; subtleforms-js.pot is 408 bytes (header only). |
| FF-24 | Dashboard "today" is UTC | Still open, also in the new Reports | Timezone UTC+14 in-process: local date Oct 19, dashboard `submissions_today` and the Reports series last day "Today" are Oct 18 (tz2.php). ReportsApi.php:390, 416. |
| FF-25 | Option value shown instead of label | Still open | Email `{all_fields}`: Topic "sales"; entry pane: Topic "sales" (12-pane-newtab.png). |
| FF-26 | New count ignores form filter | Still open | `/submissions/unread-count?form_id=2311` returned the site total 1,480. |
| FF-27 | Retention purge leaves logs | Still open | On 8934: 340 entries purged, all 931 of their log rows left (ff27.php). |
| FF-28 | Submit rate limit 30/min, not 10 | Still open | `RateLimiter::policy('/submit','POST')` without the test mu-plugin: 30/60 s; `/forms/x/submit` 10/60 s. Live not testable (mu-plugin raises the limit). |
| FF-29 | Transient LIKE deletes on each submit | Still open | One submit: 24 queries, 3 `DELETE ... LIKE '_transient_subtleforms:2.3.8:counts:%'` (ff29.php). |
| FF-30 | Full schema copied into every entry | Still open | Entry 11027 meta has `form_schema` (and step state keys). |
| FF-31 | Multisite uninstall leaves subsite tables | Still open (code) | uninstall.php unchanged, no `get_sites()` loop. Multisite not rebuilt. |
| FF-32 | Global email toggles duplicate per-form actions | Still open | Same evidence as FF-08. |
| FF-33 | "Add conditional confirmation" touches label | Fixed | Confirmation tab spacing is correct (02-settings-2-Confirmation.png). |
| FF-34 | Block form narrower than shortcode form | Still open | Same form on one page: block 576 px, shortcode 696 px (ff34.js, 64-ff34-widths.png). |

## 3. New features audit (2.3.4 to 2.3.8)

### Form settings (vertical tabs) and Notifications tab

| Item | Status | Evidence / note |
|---|---|---|
| Seven sections in four groups: General, Field defaults, Confirmation, Notifications, Availability, Integrations, Advanced (Payments only on payment forms) | Works | 02-settings-0..6 screenshots. |
| Values save, survive tab switching and reload | Works | Description, required message, heading, message with `{name}`, submit text, a new email notification, max entries 77, canvas Wide: all stored in metadata/actions and shown again after reload (settings_save.js). |
| Notifications tab: add email, add "Send to API" | Works | New email defaults to `{admin_email}`, "New entry: {form_title}". Fields: Enabled, To, Subject, Message, Send as HTML. Still no From, Reply-To, CC, BCC (section 5). |
| Keyboard and semantics | Partial | Section buttons use `aria-current`, not a tablist; arrow keys do nothing (fine, but differs from Settings page). The "+ Send Email" and "+ Send to API" buttons touch (02-settings-3-Notifications.png). |
| Phone width 390 px | Partial | Sections become a horizontal strip, no page scroll. Radio controls in Advanced render as tall ovals and the builder header icons overlap (03-settings-mobile.png). UI auditor area. |

### Appearance: theme inheritance, preview sizes, inline layout

Themes used (all installed locally, on 8934): block themes Twenty Twenty-Five, Twenty Twenty-Four and the site theme subtleforms-site; classic themes Twenty Twenty-One and Twenty Twenty. Twenty Twenty-Three was available but not rendered.

| Item | Status | Evidence / note |
|---|---|---|
| "Inherit from theme" preset saves | Works | Stored `{"preset":"theme","tokens":{"fontFamily":"inherit","colorBackground":"transparent"},"variants":{...,"width":"theme","layout":"inherit"}}`. |
| Font follows the theme | Works | Live form font = body font in all five themes (Inter, Manrope, Inter, system, Hoefler) (41-*.png, theme_live.js). |
| Text and label colour follow the theme | Works | Label colour equals the body colour in all five themes. Input text stays the plugin's #131417. |
| Button colour and shape follow the theme | Partial | The button uses `--wp--preset--color--primary`, then `contrast`, then text colour. It matched on TT5, TT4 and TT1 by coincidence; on subtleforms-site (theme button blue) and Twenty Twenty (pink) the form button is black. Radius is always 4 px (themes: pill, 0, 8 px). FF2-11. |
| Content width | Partial | Block themes: form fills the content column (TT5 581 px in 645, TT4 556 in 620). Twenty Twenty (classic, root font 62.5%): the `40rem` fallback gives a 360 px form in a 580 px column (41-twentytwenty-1280-crop.png). FF2-11. |
| "A custom value still wins" | Partial | Custom button colour #cc0000 wins. Custom font "Georgia, serif" is stored but the theme font is shown (form 2302). FF2-11. |
| Save after choosing Inherit | Partial | After a plain Update the builder shows "Published, changes not live" because the draft and published JSON differ only in key order (40-twentytwentyfive-preview-Desktop.png). FF2-10. |
| Preview names and icons Desktop, Tablet, Mobile | Works | Same icons as fields. |
| Preview widths from theme | Works | subtleforms-site 1200/760/390, TT5 1340/645/390, TT4 1280/620/390, TT1 (no theme.json) 1280/768/390. All distinct. Note: "Tablet" is the theme content width (620 px on TT4), not a tablet size. |
| Preview matches live | Partial | TT5 preview shows the system font, live shows Manrope (theme font faces not loaded in the preview). TT4 and TT1 match. FF2-12. |
| Inline layout wrap | Works | One email + button: same row at 1280, stacked at 390, in all five themes. Five fields: wrap two or three per row at 1280, one per row at 390, nothing crushed. |

### Tools: SubtleForms JSON export and import

| Item | Status | Evidence / note |
|---|---|---|
| Export selected forms (UI download) | Works | `subtleforms-forms.json`, 3.3 KB, "Forms exported." (tools_ui2.js). |
| Export all forms | Works | 448 ms for 50 forms. Refused above 100. |
| Import forms (UI and REST), round trip to second site | Works | 2309 on 8931 to 2294 on 8934: fields, conditional logic, metadata (confirmation, submit text, restrictions, appearance, canvas width, required message) and actions identical. Imported "published" forms are live at once, with the old site's email and webhook targets. A live submit on 8934 was stored (rt_import.js). |
| What a form export contains | Partial | The published version only. Unpublished draft changes (a draft-only field) are left out without a note. A never-published form exports as an empty file (FF2-07). |
| Export submissions | Works | Status, read, starred, created_at and answers kept; Trash entries skipped; passwords already stored as "Password provided". Notes, IP, user agent, files and logs are not exported (FF2-18). |
| Import submissions, round trip | Works | 4 entries into the imported form on 8934 with the same status, read, starred and dates. |
| Refusal of partial submission exports | Works | Form with 5,000 entries: 422 "This form has more than 2000 submissions, so nothing was exported." in UI and REST (32-tools-subs-refused.png). Import of 2,001 rows refused. |
| Duplicates and mismatches on import | Partial | Same file twice doubles the entries. A package from another form imports into any form without a warning. FF2-18. |
| Wrong file type | Works | A Gravity file into "Import forms": "This file is not a SubtleForms forms export." |
| Sanitising of imported content | Broken | FF2-01. |
| Keyboard access to Import buttons | Broken for keyboard | Mouse works; Enter/Space on the visible button do nothing (FF2-16). |

### Tools: Gravity Forms and Fluent Forms import

Sample files were built from the plugins' own code: Gravity Forms export envelope `{"0":{form},"1":{form},"version":"2.9.4"}` with indexed notifications and confirmations (GFExport::prepare_forms_for_export, pronamic/gravityforms mirror) and the field, notification and confirmation objects from docs.gravityforms.com; Fluent Forms export as an array of forms with `form_fields` and `metas` (fluentform/fluentform TransferService::exportForms, default settings from Form::getFormsDefaultSettings and the predefined forms). Files: samples/gravityforms-export-2026-10-19.json, samples/fluentform-export-forms-1-19-10-2026.json, samples/fluentform-legacy-export.json.

| Item | Status | Evidence / note |
|---|---|---|
| Detection and preview before saving | Works | Source detected, preview lists forms, field counts and notes (33-migrate-preview.png, 35-migrate-gf-preview.png). |
| Drafts created | Works | Both importers create drafts; "2 draft forms created." |
| Payments, quizzes, captcha left out and listed | Works | GF product, total, captcha; Fluent payment_method, ratings listed. Fluent `multi_payment_component` is "kept as a note" and becomes a visible HTML block. |
| Gravity basic fields, choices, required, description, html, email notifications to `{admin_email}` | Works | Text, email, phone, select, radio, checkbox, textarea, date, time, file, hidden, website, number, consent, section mapped. |
| Gravity: pages, logic, merge tags, field recipients, page confirmations, consent text, keys | Broken | FF2-04. |
| Fluent modern export: notifications and confirmation | Broken | FF2-02: actions `[]`, no confirmation. |
| Fluent containers, steps, hidden, name fields | Broken | FF2-03. |
| Fluent legacy file (top-level notifications) | Broken | FF2-05. |

### Tools: Activity, Webhooks, API log

| Item | Status | Evidence / note |
|---|---|---|
| Activity: newest first, level and form filters, paging | Works | level=error 150 rows, form_id=2309 31 rows, per_page capped at 50, a bogus level is ignored (34-tools-Activity.png). |
| Webhooks: URL, method, HTTP status, error | Partial | The delivery result row ("async_failed", error "User has blocked requests...") is right. The dispatch row says "succeeded" with no HTTP status for a call that was only queued (FF2-15). |
| API log: method, route, status, user, duration; no bodies | Works | Table columns: id, method, route, status, user_id, duration_ms, created_at. No body, IP or user agent. Query strings (search terms) are not stored. |
| API log pruning after 30 days | Works | Rows 31 and 29 days old inserted; on the next REST call after the daily transient expired the 31-day row was gone and the 29-day row kept. Pruning runs only on SubtleForms REST traffic. |
| API log size | Broken | Any visitor can add rows (FF2-08). 1,612 rows after about one hour of two auditors on this site. |
| Personal data in the API log | Partial | No personal data from forms. The route text is attacker-controlled (any path under /subtleforms/v1/ is stored, up to 191 characters) and user ids are stored for 30 days. Not mentioned in the privacy policy text. |

### Reports

| Item | Status | Evidence / note |
|---|---|---|
| Forms, Submissions, Unread, Last 7 days, 7-day chart | Works | Matches the database except as noted; 174 ms with 5,397 entries. |
| What counts as a submission | Partial | "Submissions" and "Unread" include spam and failed validation entries (5,397 = completed + failed + payment_pending + spam). FF2-19. |
| Day boundaries | Partial | UTC days; "Today" is the UTC date (FF-24). |
| Views and conversion stay Pro | Works | With Pro off the panel is a blurred sample with an upsell (50-prooff-reports.png). The invented sample numbers are in the page text (FF2-19). |

### Submissions inbox

| Item | Status | Evidence / note |
|---|---|---|
| Reading pane right of the list (site default) | Works | Entry opens beside the list, row highlighted, URL gets `submission_id` (11-pane-right.png). |
| Reading pane below | Works | List above, pane below (16-pane-below.png). |
| No split | Works | Opens the full entry page; a link with `submission_id` opens it full page. Browser Back then leaves SubtleForms instead of returning to the list (FF2-14). |
| Previous / Next follow tab, search and filters | Works | All: 3 to 4 to 3. New tab: 8 to 12 to 16. Search "Inbox Person 7": 7 to 70. |
| Address keeps the entry | Partial | Reload reopens the entry, but the tab and search are lost, so Previous/Next then follow the full list (FF2-14). |
| Later pages for a linked entry | Partial | Entry at row about 70: list loads the next batch, turns to page 4 and highlights it. Entries at rows 200, 300 or 5,000: never found, not highlighted, Previous disabled, Next does nothing (FF2-06). |
| Delete from the open list | Works | Delete in the pane removes the row, refills the page, closes the pane, clears the URL. |
| Read state after opening | Partial | Opening marks the entry read on the server, but the list keeps the unread dot and the New count (FF2-13). |
| Density comfortable / default / compact per admin | Works | Row height 72 / 56.5 / 47 px; saved in user meta `subtleforms_submissions_view`; survives reload; "Use site default" removes it. Other admins unaffected. |
| Density and pane default in Settings > General | Partial | Applied correctly to admins without their own choice (set through the option: compact + below). Saving it in the UI fails on any site that hits FF-01; on a site without a portal ID a full settings PUT saved it (200) and the inbox used it. |
| Performance with 5,000 seeded entries | Works | REST: list p1 201 ms, p50 152 ms, search 164 ms, unread 167 ms, Reports 174 ms, dashboard 256 ms. UI: first inbox load 2.8 to 4.4 s, pane open 0.6 to 2.0 s, Next 0.6 to 1.2 s per step. All 5,100 QA entries removed afterwards. |

### Security spot checks on new REST routes (diff of src/Api against f2b7b03)

New routes: GET /tools/forms/export, POST /tools/forms/import, GET /tools/submissions/export, POST /tools/submissions/import, POST /tools/migrate/preview, POST /tools/migrate/import, GET /tools/logs, GET /tools/api-logs, GET /reports/overview, POST /settings/inbox-view. Plus the ApiLog filters on every SubtleForms route.

| Check | Result |
|---|---|
| Guest | 403 `subtleforms_forbidden` on all 10 (curl). |
| Editor with a valid nonce | 403 on all 10 (sec.js). |
| Admin without nonce (CSRF) | GET: 403; POST: 403 `rest_cookie_invalid_nonce`. |
| Admin with nonce | 200 as expected. inbox-view writes only the current user's meta and only allowed values. |
| SQL | Logs and API log queries use prepare with placeholders; level whitelisted; per_page capped at 50. |
| Output | Tools, Reports and the inbox render with React escaping; no new `dangerouslySetInnerHTML`. |
| Import content | Not sanitised (FF2-01). |
| Import limits | 100 forms, 2,000 entries per request; no request size limit beyond PHP. |
| Unauthenticated writes | Every guest request under /subtleforms/v1/, including 404s, writes an API log row (FF2-08). |

### Free plugin with Pro deactivated

| Item | Status | Evidence |
|---|---|---|
| Dashboard, Forms, Submissions, Tools, Reports, Settings, Payments, Extensions | Works | All load with no JS error and no REST error (50-prooff-*.png, prooff.js). |
| Builder, Notifications, Confirmation, Preview | Works | No errors. |
| Live submit, confirmation, email job, free webhook | Works | Entry stored; email queued; free WebhookAction ran (FF-17 still applies). |
| Tools export/import/migrate, logs, Reports, inbox view | Works | All routes 200 with Pro off (freeapi.js). |
| Pro gates | Works | CSV export opens the Pro dialog; Reports shows the locked panel; header shows "Upgrade to Pro". |
| PHP log during the window | Works | No new SubtleForms warnings except routine lines logged at ERROR level (FF2-22). |
| Reactivation | Works | Pro active again, license `valid`, plan `agency`. |

## 4. New bugs

| ID | Sev | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|
| FF2-01 | P1 | Tools > Import forms with a SubtleForms file whose Custom HTML field content is `<img src=x onerror="...">` (or a label with markup); open the published page. Tools > Import submissions with a rich text answer `<img src=x onerror="...">`; open the entry. The Gravity/Fluent importer uses the same save path (GF html `content`, Fluent `html_codes`). | Imported content is cleaned like a builder save (the normal save turns the same schema into `Name` and `window.__xs=1<img src="x">hi`) | Stored as given. On the live page `onerror` ran for every visitor (`window.__xh=1`); in the admin entry view `onerror` ran (`window.__xr=1`). Matters for files from third parties and for multisite site admins without `unfiltered_html`. | xss_import.js output, 20-xss-live.png, 21-xss-entry.png | TransferService.php:128 and :182 call `saveSchemaVersion()` directly, skipping the FormsApi request validator and sanitiser (FormsApi.php:598). TransferService.php:307 stores the payload raw. SubmissionDetailPage.jsx:917 and frontend FieldRenderer.jsx:222/235 render HTML as stored. |
| FF2-02 | P2 | Tools > Migrate with a current Fluent Forms export (notifications and formSettings in `metas`) | Admin and user notifications and the confirmation message imported | `actions: []`, no confirmation. Imported forms notify nobody. The preview does not mention it. | migrate.js output (form 2299) | FormMigration.php:509-561 read only top-level `notifications` / `formSettings`; Fluent has exported them as `metas` rows with JSON string values for years. |
| FF2-03 | P2 | Same Fluent file with a two-column container (Company, Job title), a form_step, an input_hidden and a Name field | Container children imported, steps as page breaks, Hidden as the new Hidden field, name with a label | Company and Job title are gone (one HTML block "field was a container field and was not converted." shown to visitors), form_step and input_hidden become visible HTML notes, Name becomes `names` with an empty label and not required | migrate.js output, 33-migrate-preview.png | FormMigration.php:309-375 has no case for `container`, `form_step`, `input_hidden`, and takes the label from the container settings. |
| FF2-04 | P2 | Tools > Migrate with a Gravity Forms export: multi-page, a field with conditional logic, notifications using `{Name (First):1.3}`, a "send to field" notification (`toType: field`, `to: "2"`), a page confirmation (`pageId: 42`), a consent field | Pages, logic and recipients converted, or listed in the preview | Page becomes a section heading (form type Standard), logic dropped silently, merge tags left literal in subjects, messages and the confirmation, notification To is "2" (publishable, shown "Email → 2"), page confirmation becomes a redirect with an empty URL (visitor sees the default thank-you), consent checkbox text lost, multiselect becomes single-choice dropdown, keys are `field_1`... because `adminLabel: ""` is not null | migrate.js output (2297, 2298), 37-migrated-notifications.png, redir.js | FormMigration.php:276 (`page` to `section_break`), 234 (`??` does not skip empty strings), 451-472 (no `toType`, routing or merge-tag mapping), 492-497 (`pageId` ignored). |
| FF2-05 | P2 | Tools > Migrate with an older Fluent file that has a top-level `notifications` object | One email action | Two junk email actions: To "{wp.admin_email}" and To "{admin_email}", subject "New entry", empty message (built from the `sendTo` and `conditionals` sub-objects) | migrate.js output (form 2300) | FormMigration.php:516 loops over the keys of a single notification object as if it were a list. |
| FF2-06 | P2 | Submissions, open a link with `submission_id` of an entry below row 200 (tested rows 200, 300, 5,000) | List loads until the row is found, highlights it, Previous/Next work | After 2 list requests nothing more loads; the row is never highlighted; Previous is disabled and Next does nothing. Rows within the first 200 work. | inboxperf.js (43 s and 121 s waits), 18-deeplink-5000.png | SubmissionsTable.jsx:349-357 relies on the effect re-firing after each batch, but prefetchNextChunk (227-229) returns the in-flight promise while the admin app uses legacy `render()` (index.jsx:22), so the state update re-runs the effect synchronously before `prefetchPromiseRef` is cleared. |
| FF2-07 | P2 | Tools > tick a form that was never published (only autosaved), Export forms. Or GET /tools/forms/export?ids=<id>,999999 | Refused, or the form exported with its draft | 200 `forms: []`, UI says "Forms exported."; importing that file then fails "The export does not contain any forms." | Draft-only export check (form 2317) | TransferService.php:76-88 `continue` on missing forms and forms without an active schema version, with no error. |
| FF2-08 | P2 | As a guest, request 500 random paths under /wp-json/subtleforms/v1/ | Not logged, or logged with a cap/rate limit | 500 new rows (404, user 0, route text stored). Every public view beacon and submit is also logged. No row cap; pruning is by age only. | Flood test: 98 to 605 rows | ApiLog.php:97-131 logs every request whose route starts with /subtleforms/ (193-195), including unmatched routes and guests. |
| FF2-09 | P2 | On 8934: deactivate SubtleForms, run uninstall.php | All SubtleForms data removed | Left: tables `wp_subtleforms_api_logs`, `wp_subtleforms_coupons`, `wp_subtleforms_coupon_uses`; options `subtleforms_api_log_table`, `subtleforms_coupons_db`, `subtleforms_db_supports_json`, `subtleforms_site_activated`; 632 transients (`_transient_subtleforms_rl_*`, `_transient_subtleforms:<ver>:counts:*`); user meta `subtleforms_submissions_view`; cron events `subtleforms_async_email` / `subtleforms_async_webhook` with arguments | uninst2.php output | uninstall.php:22-29 table list lacks api_logs and coupons; 39-55 option list; 64-67 deletes `_transient_sf_rl_%` but the limiter uses `subtleforms_rl_`; 80-84 meta list; `wp_clear_scheduled_hook` without args leaves events that have args. |
| FF2-10 | P3 | Builder > Preview > Appearance > Inherit from theme > Update (publish) and reopen | Badge "Published" | "Published, changes not live" with no change pending | 40-twentytwentyfive-preview-Desktop.png; draft and config differ only in `layout`/`width` key order | FormsRepository.php:151 compares the JSON strings; saveDraftSchema (939) stores the raw schema while saveSchemaVersion runs sanitizeAppearance, which reorders keys. |
| FF2-11 | P3 | Inherit from theme on subtleforms-site, Twenty Twenty; add a custom font Georgia | Button follows the theme's button colour and radius; custom font wins; width follows the content column | Button black on themes without a `primary` slug (site theme blue, TT20 pink), radius always 4 px; custom font ignored; TT20 form 360 px wide in a 580 px column | theme_live.js output, 41-*.png | appearance.css:222-239 sets `font-family` directly and maps colours only to `primary`/`contrast`/`foreground` slugs; appearance.js:410 falls back to `40rem` (root-relative). |
| FF2-12 | P3 | Builder Preview with Twenty Twenty-Five active | Same font as live (Manrope) | System font in the preview | theme_ui.js output | Preview loads theme stylesheets and global CSS but not the theme's font faces (AdminMenu.php:409-410). |
| FF2-13 | P3 | New tab, open entries 8, 12, 16 in the pane | Dot and New count update | Server marks them read; list keeps the unread dots and "New 226" | 12-pane-newtab.png, DB is_read=1 | Pane read change is not pushed back into the table buffer or counts. |
| FF2-14 | P3 | Search "Inbox Person 7", open 7, reload. Or "No split", open an entry, press browser Back | Filter kept; Back returns to the list | Reload clears tab and search, so Previous/Next follow the full list; Back leaves SubtleForms | inbox.js step E, inbox4.js | Tab and search live in component state only (SubmissionsPage.jsx:35-38); entry navigation replaces the history entry. |
| FF2-15 | P3 | Form with a webhook; submit; Tools > Webhooks | "Queued", then the delivery result | First row "succeeded" with no HTTP status for a call only queued; the real failure appears later as another row | tools/logs output for entry 11005 | Step log status `succeeded` with `dispatched: true` is shown as the call result (LogsRepository::search). |
| FF2-16 | P3 | Tools, Tab to "Import forms" / "Import submissions" / "Choose export file", press Enter or Space | File chooser opens | Nothing; the next Tab stop is an invisible file input | dbg.js | ToolsPage.jsx:332 puts a `<button>` inside the `<label>`; clicks on a nested button do not activate the label. |
| FF2-17 | P3 | Tools: import a wrong file on Transfer, switch to Migrate. Look at the form picker | Notice cleared; forms distinguishable | Old error stays on Migrate; two forms named "B14" with no id or status | 33-migrate-preview.png, 30-tools.png | Shared notice state in ToolsPage.jsx; picker shows titles only. |
| FF2-18 | P3 | Import the same submissions file twice; import RT entries into the Inbox form | Duplicates detected or warned; form mismatch warned | 4 + 4 entries; mismatched import accepted silently. Notes, IP, user agent, files and logs are not exported; draft changes of forms are not exported; none of this is said in the UI | rt_import.js, edge-case run | TransferService.php:286-340 has no identity or form check. |
| FF2-19 | P3 | Reports with spam and failed entries; Reports with Pro off | Submissions exclude spam/failed; locked panel without fake data | Spam and failed counted (5,397); the locked panel's sample KPIs ("2,094 views") are in the page text for screen readers | reports overview vs DB, 50-prooff-reports.png | ReportsApi.php:413-415 count all non-trash; FormAnalyticsPanel.jsx:169 sample data, KPIs not hidden. |
| FF2-20 | P3 | Load any SubtleForms admin page | No front-end hooks in admin | `do_action('wp_enqueue_scripts')` runs in wp-admin to collect theme styles (WooCommerce front CSS is included) and about 20 KB of global CSS is inlined into the page data | themeStylesheets() timing 17 ms, 7 stylesheets | AdminMenu.php:474-500, 409-411. |
| FF2-21 | P3 | Delete a published form permanently | Its schema versions removed | 2 schema rows left per test form; 1,503 orphan rows on this site | Delete check, form 2316 | FormsRepository.php:791 deletes only the forms row. |
| FF2-22 | P3 | Any submission with WP_DEBUG_LOG on and Debug Mode off | No log lines, or debug level | "Email job scheduled", "Webhook job scheduled", "Email sent successfully" written at ERROR level every time | debug.log this session (13 lines) | AsyncDispatcher.php:71, 123 log through the error channel. |

## 5. Missing features (compared with Gravity Forms, WPForms Pro, Fluent Forms Pro, Formidable Pro, Forminator Pro)

Dropped from the 2.3.3 list: "Form import/export (JSON)" now exists (with FF2-01, FF2-07, FF2-18). "Import from Gravity Forms" exists in part; CF7 and WPForms remain.

| Feature | Priority | Edition | Reason |
|---|---|---|---|
| Reply-To, CC, BCC, From per notification | Must | Free | Every competitor has them; the Notifications tab still offers only To. |
| Attach uploaded files to notifications | Must | Free | Files are sent as links only. |
| Form field columns in the entries list | Must | Free | Column picker still offers only ID, Form, Status, Browser, Device, Submitted. |
| Entry editing by admins, with edit log | Must | Free (basic), Pro (log) | Standard in all five. |
| Export entries above 2,000 (in parts, by date range) | Should | Free | Tools refuses whole forms over 2,000 and CSV is Pro, so a free site cannot move a large form. |
| Import mapping report for migrations (logic, notifications, steps that were dropped) | Should | Free | Gravity/Fluent imports lose these silently today. |
| Import from Contact Form 7 and WPForms | Should | Free | The two largest sources of switchers. |
| Store blocked spam for review, Akismet | Should | Free (Akismet), Pro (AI) | Unchanged. |
| Save and resume | Should | Pro | Unchanged. |
| Partial entries / abandonment | Should | Pro | Unchanged. |
| Print entry view | Should | Free | Unchanged. |
| Custom date range filter on entries | Should | Free | Unchanged. |
| Keep data on uninstall option | Should | Free | Unchanged, and uninstall is incomplete (FF2-09). |
| Custom capabilities for non-admin roles | Should | Free | Tools, Reports and inbox are all `manage_options`. |
| Shortcode attributes (title, description, field values) | Should | Free | Shortcode still accepts only `id`. |
| Per-form spam settings | Should | Free | Unchanged. |
| Form revisions with restore | Should | Pro | Schema versions are stored but not exposed. |
| User registration / login forms | Should | Pro | Unchanged. |
| Post creation | Should | Pro | Unchanged. |
| Quiz scoring, survey/poll reports | Should | Pro | Unchanged. |
| Double opt-in | Should | Pro | Unchanged. |
| Multi-page progress bar options | Should | Free | Unchanged. |
| Global styles shared across forms | Should | Free | "Inherit from theme" helps but is per form. |
| Slack / Discord / Teams notifications | Should | Pro | Unchanged. |
| Elementor, Divi, Beaver Builder widgets | Should | Free | Unchanged. |
| Send-to-self / test entry mode in preview | Should | Free | FF-14. |
| Whole-submission validation hook, pre-save filter, entry-deleted action | Should | Free | Unchanged. |
| Consent option before storing IP / user agent | Should | Free | Unchanged. |
| API log opt-out and a row cap | Should | Free | New 2.3.6 log is always on (FF2-08). |
| Form locker / password | Nice | Pro | Unchanged. |
| Entry approval workflow | Nice | Pro | Unchanged. |
| A/B testing | Nice | Pro | Unchanged. |
| Geolocation / address autocomplete | Nice | Pro | Unchanged. |
| SMS notifications | Nice | Pro | Unchanged. |
| Signed webhook with timestamp in free | Nice | Free | Unchanged. |
| Daily or weekly entry digest | Nice | Pro | Unchanged. |

## 6. Not tested and why

- Real Gravity Forms and Fluent Forms installs: neither plugin can be installed here (wordpress.org downloads are blocked, Gravity Forms is commercial). Sample exports were built from their source code and docs instead.
- Twenty Twenty-Three was not rendered (two other block themes and two classic themes were). No other theme downloads possible.
- Multisite (FF-31 and the new tables on subsites): the throwaway network from the 2.3.3 audit no longer exists; checked in code only.
- Live rate limit (FF-28): the test mu-plugin raises it; checked through `RateLimiter::policy()`.
- CAPTCHA, real email delivery and real webhook delivery: no outbound network. Mail was checked with a mock PHPMailer, webhooks up to the queued or blocked request.
- Large import files (memory, upload limits) and import of files with thousands of forms: not run.
- PHP 8.1, 8.2 and 8.4: only PHP 8.3 is installed.
- Pro-off window was kept to about two minutes because the UI/UX reviewer shares the site; it covered every admin page, the builder, a live submit, the free webhook and all Tools and Reports routes.
- Field-level behaviour (pickers, phone, hidden field, chained dropdowns) and payments: other auditors. Two field-level observations made in passing: the custom dropdown picker takes the classic theme's uppercase button style on Twenty Twenty (41-twentytwenty-1280-crop.png), and entry views show option values instead of labels (FF-25).
