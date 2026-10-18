# SubtleForms free 2.3.3: free-features QA audit

Auditor area: free-features. Site: http://localhost:8899 (SubtleForms Pro 2.3.3 also active, which matters for a few items noted below). Scripts: /home/claude/work/qa/free-features/. Screenshots: /home/claude/shots/qa/free-features/. All QA forms, pages, entries (including the 5,000 seeded entries), cron jobs, the QA user and the throwaway multisite install were removed at the end. Global settings were checked against the backup taken at the start and are identical. No plugin code was changed.

## 1. Summary

The core loop works well: templates, builder (click, drag, keyboard, undo/redo), publishing, live rendering in blocks and shortcodes, AJAX submit, conditional logic (PHP and JS agree on every operator tested), availability rules, entries list at 5,000 rows (about 150 ms per REST page), CSV export, retention purge, GDPR export/erase and multisite activation. The existing browser suite passed 30 of 31 (one flaky test, passed on rerun).

The top problems:
- Settings cannot be saved at all once the stored HubSpot Portal ID is a number above 100 (it always is). The validator reads "max:100" as a value limit, so every tab fails with "Validation failed" (FF-01).
- The AI assistant settings tab is fake. "Test Connection" always reports success, and saving it fails with "ai_api_key: Unknown field" (FF-02).
- Forms on cached pages stop working once the cached nonce expires. Visitors see "Submission failed." (FF-03).
- 21 of the 59 templates send every entry to made-up `*.example.com` webhooks and have no email notification. The "Payment Form" template stores and transmits raw card number, expiry and CVV (FF-04, FF-05).
- The Quick Start Wizard never creates a form (FF-06).
- After an autosave or "Save draft", the builder says "Published" even though the changes are not live (FF-07).
- Several global settings save but do nothing: Sender name/email, Admin Notifications, User Confirmation, Delete Behavior, Autosave interval (FF-08 to FF-10).
- The time trap drops real entries from visitors whose clocks run ahead, and it lets bots through when they omit the timestamp (FF-11, FF-12).
- Validation failures store junk "failed" entries, and those entries count toward entry limits (FF-13).

## 2. Inventory and status

### Onboarding, dashboard, forms list

| Feature | Status | Evidence / note |
|---|---|---|
| First run (new admin user) | Works | 01-dashboard-firstrun.png, 02-forms-firstrun.png. New users land on the list with the template library. |
| Quick Start Wizard (Forms page "?" menu) | Broken | FF-06. 04-wizard-step1..5.png, 05-after-wizard.png |
| Builder tour | Works | Skip buttons and tour status endpoints work (suite). |
| Dashboard stat cards, 14-day chart, quick actions | Works | 01, 70. Counts come from a cached transient, so the dashboard "Unread" (1,167) briefly differed from the menu badge (1,141). "Today" and chart days are UTC, not site time (FF-24). |
| Dashboard form selector / Form performance | Works | Search box plus select. Views, submissions and conversion shown. |
| Health card | Partial | `DashboardApi` returns table checks. Not visible as a distinct card in the screenshots taken at 1440px. |
| All Forms: tabs, counts, search, pagination, rows per page | Works | 60-forms-search.png. "1–20 of 166, Page 1 of 9". |
| Bulk Mark as Published / Draft / Move to Trash | Works | b_forms.log. No confirmation before unpublishing live forms. |
| Row menu: Change status, Duplicate, View submissions, Trash | Works | 62-forms-row-menu.png. Duplicate, trash, restore and delete are covered by forms-trash-duplicate.spec (passed). |
| Import / export of forms (JSON) | Missing | No route and no UI. See section 4. |

### Templates

| Feature | Status | Evidence / note |
|---|---|---|
| 59 templates create a form, publish and accept a submission | Works | templates_run.log. 58 of 59 stored an entry. job_application needs a required upload, which is expected. templates.spec (UI path, all 59) passed. |
| Template content quality | Broken | FF-04 (fake webhooks, no admin email in 21 templates; 27 have no notification at all), FF-05 (card data). Templates use `{{field}}` tags while the email UI teaches `{field:key}`. Both work in email. |

### Builder

| Feature | Status | Evidence / note |
|---|---|---|
| Click to add field | Works | b_builder.log |
| Drag and drop from library onto the canvas (dnd-kit) | Works | 11-builder-dragging.png, 12-builder-after-drag.png. Dropped between Name and Email. |
| Keyboard: drag handle Space/Arrow/Space reorder, Delete key, "/" search then Enter to add | Works | b_builder2.log |
| Undo / Redo (Ctrl+Z, Ctrl+Shift+Z, header buttons) | Works | b_builder.log. One flaky run in form-type.spec: undo after removing the only Page Break did not bring the steps back (passed on rerun). |
| Autosave | Partial | Fires 30 s after the last change (hard-coded `AUTOSAVE_DEBOUNCE_MS = 30000`). The setting says 3 s and the menu says "a few seconds" (FF-10). |
| Manual Save draft / Publish / Update | Works | Update makes the new fields live (b_builder.log: live inputs before and after). |
| Draft vs published and "Published, changes not live" | Partial | The badge is correct after a reload but wrong after any save in the session (FF-07). 13-builder-after-wait.png |
| Preview with Desktop / Tablet 768 / Mobile 380 | Works | 17-preview-*.png. Uses the real FormRenderer in an iframe. |
| Preview submissions save an entry | Partial | An entry is saved, but it is validated against the published schema, so values of draft-only fields are dropped silently. The entry is not marked as a test, so it counts in stats and limits and fires real notifications (FF-14). |
| Form settings: name, description, field defaults (label visibility, help placement, required/invalid messages) | Works (save) | 80-builder-settings.png. Saved in metadata. |
| Form type Standard / Multi-step / Conversational | Works | form-type.spec 2 of 3 passed, 1 flaky. |
| Confirmation message with heading and "Submit another response" | Works | 20-conf-message.png. HTML is stripped (safe). Merge tags only in `{key}` form (FF-15). |
| Confirmation redirect with merge tags | Partial | Redirect works. `{field:name}` is left literal; `{name}` works (FF-15). |
| Conditional confirmations (Pro gate on this site) | Works | 22/23-conf-conditional-*.png |
| Submit button text | Works | "Send it now" rendered |
| Availability: opens at, closes at, max entries, logged-in only, custom messages | Works | 24 to 27-avail-*.png. Also enforced on direct REST submits (403). Timezones checked in-process for Asia/Karachi, America/New_York and UTC (tz.php). |
| Appearance / themes / styles | Not run | Covered by the field auditor (Appearance panel) and the block theme option. The block "theme" attribute renders. |
| Per-form spam settings | Missing | `is_enabled_for_form()` reads a `disable_honeypot` config key that no UI writes. |

### Conditional logic engine

| Feature | Status | Evidence |
|---|---|---|
| Operators equals, not_equals, contains, not_contains, starts_with, ends_with, empty, not_empty, greater_than, less_than, in, not_in, between, before, after (relative "today") | Works | 22-case matrix. PHP (cond.php) and JS (shared/conditions.js) agree on every case. Text compares ignore case. "1,000 > 999" is false (no thousands separators). |
| AND/OR groups (groups ORed, rules all/any) | Works | logicPasses checks |
| Show/hide fields, server-side stripping, required only when visible | Works | t_logic.js. Hidden values are removed from the stored entry. |
| Steps, confirmations, notification routing | Works | Conditional email skipped with `conditions_not_met` in the log. Step logic is covered by builder-steps.spec (other auditor). |

### Notifications and actions

| Feature | Status | Evidence |
|---|---|---|
| Email: To with several addresses or `{field:email}`, subject merge tags, `{all_fields}` HTML table, plain text mode, `{entry_id}` `{site_name}` `{date}` `{form_title}` `{admin_email}` | Works | Cron job payloads plus a mock PHPMailer (mailrun.php) |
| Conditional routing per notification ("Only when") | Works (Pro gate) | Support-only email sent only for topic=support |
| Sender name / sender email | Broken | FF-08. FromName "WordPress", From wordpress@... |
| Reply-To, CC, BCC, From per notification | Missing | No UI. Only raw `headers` in the schema. |
| Attach uploaded files | Missing | Files go in as download links. Only the Pro PDF is attached. |
| Option labels in emails | Partial | `{all_fields}` shows the option value ("sales") instead of the label ("Sales"). The entry screen does the same (FF-25). |
| Async email queue (WP-Cron), retries 5/15/30 min | Works | A failed send queued retry_count=1. Logs show async_failed and async_completed. |
| Resend notifications | Partial | FF-16: a second resend within 10 minutes is dropped silently but reports success. |
| Test email (Settings > Email) | Works | Reports "Failed to send test email" correctly on this site (43-settings-test-email.png) |
| Webhook action (free class, run in-process) | Partial | URL, method, headers, HMAC `X-SubtleForms-Signature` and retries work. Custom JSON placeholders are not filled (FF-17). No timestamp in the signature, so replays are possible. Pro replaces this class on Pro sites. |

### Entries

| Feature | Status | Evidence |
|---|---|---|
| List, tabs New/Read/Starred/Flagged/Spam/Trash | Works | b_entries.log. The "New" count ignores the form filter (FF-26). |
| Search, field value filter, date ranges (Today, 7, 30 days, 3 months) | Works | 32-entries-field-filter.png. No custom from/to range. |
| Column picker | Partial | Offers only ID, Form, Status, Browser, Device, Submitted. Toggling ID or Browser did not add columns in the run. No form field columns (section 4). 33-entries-colpicker.png |
| Detail page, notes, logs, star, mark read, resend, adjacent navigation | Works | 36-entry-star-note.png |
| Flag / unflag on the detail page | Broken | FF-18 |
| Spam / Not spam, Flag (status column) | Partial | FF-19: overwrites the pipeline status (payment_pending is lost). "Restore" sets the status to an empty string. |
| Trash, restore, delete permanently, bulk actions | Works | entries-trash.spec, entries.spec (passed) |
| Export CSV (all, filtered, selected) | Works | 5,000 rows in 309 ms, UTF-8 BOM, formula injection escaped (`csv_cell`). Hard cap of 10,000 rows with no warning. |
| Print entry | Missing | No print view in free. PDF is Pro. |
| Delete behaviour setting | Broken | FF-09 |
| Retention purge (data_retention_days) and Trash emptying | Works | 60 days removed 1,745 of 5,000 seeded entries via `subtleforms_daily_cleanup`. Logs of purged entries are left behind (FF-27). |

### Global settings (every tab)

| Setting | Saves | Has effect |
|---|---|---|
| Default New Form Status | Yes* | Yes (create returned published) |
| Enable Autosave, Autosave interval | Yes* | No (FF-10) |
| Delete Behavior | Yes* | No (FF-09) |
| Success Message, Error Message, Redirect after submit (Display) | Yes* | Yes (FrontendAssets localizes them; the default thank-you text is shown) |
| Submission limit per user/IP | Yes* | Yes in code (`countSubmissionsBy`). Not toggled live because it would block other auditors on the shared IP. |
| Admin Notifications, User Confirmation Emails | Yes* | No (FF-08) |
| Sender Name, Sender Email | Yes* | No (FF-08) |
| Admin Email | Yes* | Yes (`{admin_email}` falls back to it) |
| Debug Mode | Yes* | Yes (EmailAction debug logs) |
| Honeypot, Minimum Submission Time | Yes* | Yes (spam.php) |
| CAPTCHA (reCAPTCHA v2/v3, hCaptcha, Turnstile) | Yes* | Not testable here (providers not reachable) |
| Data retention, Trash days | Yes* | Yes |
| AI assistant (provider, model, key, 4 agents) | No | No backend at all (FF-02) |
| Integrations, Branding, License | Pro | Other auditors |
| Reset All Settings | Not run | Would wipe settings shared with other auditors |

*"Yes" means the field is accepted by validation. On this site no save succeeds because of FF-01.

### Spam, privacy, analytics, embedding

| Feature | Status | Evidence |
|---|---|---|
| Honeypot (silent "Thank you", nothing stored) | Works | spam.php |
| Time trap | Partial | FF-11, FF-12 |
| Rate limit, public submit | Works | 30 per minute per IP, then 429. The stricter 10 per minute policy never matches (FF-28). |
| Spam tab / review of blocked submissions | Missing | Blocked submissions are dropped. The Spam tab only holds entries marked by hand. |
| WP personal data exporter | Partial | Works, but "Form Name" is always null with PHP warnings (FF-20) |
| WP personal data eraser | Partial | Works, but matches emails by substring (FF-21) |
| Privacy policy text | Works | Added through `wp_add_privacy_policy_content` |
| Analytics: views beacon, conversion per form in the list and dashboard | Works | Forms list showed "50%, 4 views" for a QA form. Reports (series) are Pro. |
| Gutenberg block: form, showTitle, showDescription, theme, tabIndex, fieldValues prefill | Works | 50-front-multi.png. Prefill "name=Prefilled Name" worked and the title was hidden. |
| Block "ajax" option | Broken (no effect) | FF-22 |
| Shortcode `[subtleforms id]` | Works | Only the `id` attribute exists |
| Several forms per page, AJAX submit without reload | Works | 3 forms (2 blocks and 1 shortcode). Submit caused 0 navigations. |
| Works with page caching | Broken | FF-03, 53-front-expired-nonce.png |
| Elementor / other builder widgets | Missing | None in free |
| Public schema endpoint hides actions | Works | Guest GET /forms/{id}/schema returns no actions or recipients |

### Performance

| Item | Result |
|---|---|
| Assets only on pages with forms | Works (performance.spec) |
| build/frontend | frontend.js 130 KB (36 KB gzip), CSS 56 KB. Signature and rich text are lazy chunks of about 2.5 KB each. |
| build/admin | admin.js 192 KB (57 KB gzip), page-builder.js 404 KB, vendor-joi 172 KB, index.jsx.css 216 KB |
| DB queries per submit (free plus Pro, 4 fields, 3 emails) | 29 queries, 37 ms. Includes 3 `DELETE FROM wp_options WHERE option_name LIKE '_transient_subtleforms:%'` per submit (FF-29) and 7 log inserts. |
| 5,000 entries | REST list page 1: 137 ms, page 100: 166 ms, search 147 ms, field filter 151 ms, unread tab 136 ms, 7 days 137 ms, dashboard 173 ms. UI filter switch about 1 s. First entries page load 4.9 s (all forms). |
| Storage | Every entry stores a full copy of the form schema in `meta.form_schema` (FF-30) |

### Accessibility, i18n, multisite, uninstall, PHP

| Item | Status | Evidence |
|---|---|---|
| axe-core on the live form, desktop and phone | Works | a11y.spec, 3 tests passed (every field type, dark newsletter, multi-step) |
| POT file | Partial | languages/subtleforms.pot has 3,022 strings but says version 2.3.0. subtleforms-js.pot is empty. |
| JS translations | Broken | FF-23: no `wp_set_script_translations` anywhere |
| RTL | Works | 70-rtl-dashboard.png, 71-rtl-builder.png. A one-string ar.mo was used for the QA user only, then removed. The layout mirrors correctly. |
| Multisite network activation | Works | Throwaway network (port 8911). Subsite tables were created and a form created, published and submitted on /sub2. |
| Uninstall, single site | Works | Main site tables and options removed |
| Uninstall, multisite | Broken | FF-31 |
| PHP 8.1 to 8.4 | Partial | Ran on PHP 8.3.6 only. Static check: no implicit nullable parameters (8.4 deprecation) and no `${}` interpolation (8.2). Header says Requires PHP 8.1. 8.1, 8.2 and 8.4 were not run. |

### Security spot checks

| Item | Result |
|---|---|
| REST routes in src/Api | Every admin route uses `manage_options` plus a `wp_rest` nonce (ApiGuards, SettingsApi, DashboardApi, AnalyticsApi). Public routes: `POST /submit` (`__return_true`, rate limited), `POST /uploads` (`__return_true`, 30 per 10 minutes per IP, form and field checked, orphan cleanup cron), `GET /forms/{id}/schema` (published only, actions stripped), `POST /forms/{id}/view` and payments quote/coupon (nonce plus rate limit). No route lacks a permission_callback. Full list: /home/claude/work/qa/free-features/routes.txt |
| Custom capabilities | None. Everything is `manage_options`, so editors cannot be given entry access (section 4). |
| SQL | User input reaches SQL only through prepare or whitelists (orderby, order). Unprepared queries are static schema checks in Activator. |
| Escaping | No unescaped echo found in src or templates. Confirmation HTML is stripped client-side. |
| Uploads | Stored in uploads/subtleforms-uploads with .htaccess deny and index.php. On nginx the folder is protected only by unguessable names. A dangerous-extension blocklist plus allowed MIME types. |
| Webhooks | `wp_remote_request` (not `wp_safe_remote_request`), so an admin can target internal hosts. Admin-only, low risk. |

### Developer hooks (51)

Actions: subtleforms/loaded, deactivated, admin_menu, admin_enqueue_scripts, register_actions, register_extensions, fields/register, frontend/enqueued, form/duplicated, forms/schema_published, schema/repaired_orphans, submission/saved, submission/completed, submission/trashed, submission/untrashed, email/after_send, payment/required, payment/void, extension/crm/contact, extension/email_marketing/subscribe.
Filters: subtleforms/capabilities, admin_branding, admin_data, analytics/track_views, captcha/enabled, captcha/provider, captcha/provider_config, captcha/providers, email/attachments, mail/args, mail/sent, fields/validate_value, forms/schema_before_save, public_schema, submit/confirmation, templates, license_data, multilanguage/strings, pdf/generate, payment/capture, payment/verify, payments/coupon_lookup, payments/external, payments/gateways, payments/is_priced, payments/line_items, payments/quote, payments/validate_coupon, extension/payments/create_intent, subtleforms_feature_enabled, subtleforms_is_pro_active.
Missing: a whole-submission validation filter (like gform_validation), a pre-save payload filter, an entry-deleted action, and per-notification filters (to, headers).

## 3. Bugs

| ID | Sev | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|
| FF-01 | P1 | Store a numeric HubSpot Portal ID such as 4455 (all real IDs are numeric). Go to Settings, any tab, change anything, Save. | Settings save | 422 "Validation failed", `ext_crm_portal_id: Maximum value is 100`. Every tab is blocked because the page posts the whole settings object. | b_settings.log; inproc PUT /settings returned 422 with only `{"ext_crm_portal_id":"4455"}` | src/Validation/Schemas.php:263 `optional\|string\|max:100`. The rule engine treats a numeric string as a number. |
| FF-02 | P1 | Settings > AI assistant, enter any key, click Test Connection, then Save | A real check, or no tab | "Connection successful! AI services are ready." for any key. Save fails with `ai_api_key: Unknown field` and blocks the whole save. No backend uses any ai_* setting. | 41-settings-ai-test.png, b_settings.log | resources/admin/components/settings/AISettings.jsx:34 ("Simulate API test"). The tab is registered in SettingsPage.jsx:54. |
| FF-03 | P1 | Serve a form page from a full-page cache older than the nonce lifetime (simulated by sending an expired X-WP-Nonce as a guest) and submit | Entry saved | 403 `rest_cookie_invalid_nonce`. The visitor sees "Submission failed." and nothing is stored. | 53-front-expired-nonce.png; curl with a stale nonce | FrontendAssets.php:79 localizes `wp_create_nonce('wp_rest')` and FormRenderer.jsx:864 always sends it. Guests need no nonce, and nothing refreshes it. |
| FF-04 | P1 | Create a form from Advanced Contact, Sales Inquiry, Payment Form, Donation Form and 17 other templates, then submit | Entries notify the site owner | Each entry is queued as a POST to a fake third-party host (crm.example.com, payment-gateway.example.com, hr-system.example.com and others) with no admin email. 27 templates have no email action at all. | templates_run.log; cron_dump for entry 858; 81-builder-actions-template-webhook.png | src/Templates/FormTemplates.php template actions |
| FF-05 | P1 | Use the "Payment Form" template | A payment field or no card inputs | Plain text fields Card Number, Expiry Date and CVV. Values are stored in the DB and sent in the webhook body (seen in the queued job). This breaks PCI DSS. | templates.json (payment_form); cron_dump.php 858 | FormTemplates.php payment_form |
| FF-06 | P2 | Forms > "?" > Quick Start Wizard > Next x4 > Create Form | A new form opens in the builder | The wizard closes and nothing is created. POST /forms returns 422 `status: Unknown field`, logged only to the console. | 04-wizard-step5.png, 05-after-wizard.png, b_onboard2 log | resources/admin/pages/FormsPage.jsx:110 sends `status: 'draft'`, which FORM_CREATE rejects. The help menu also stays open behind the modal. |
| FF-07 | P2 | Open a published form, add a field, wait for autosave (or use Save draft) | Badge "Published, changes not live" | Badge flips to "Published" while GET /forms says `has_unpublished_changes: true` and the live page lacks the field. A reload shows the correct badge. | 13-builder-after-wait.png, b_builder.log, b_builder2.log | Builder state after a draft save resets the unpublished flag (useBuilderOrchestrator.js AUTOSAVE_SUCCESS) |
| FF-08 | P2 | Settings > Email: set Sender Name and Email, or turn Admin Notifications off, then submit a form | From uses the sender; no admin email | From stays "WordPress" <wordpress@host>. The admin email is still queued with the toggle off. User Confirmation Emails is the same. | mailrun.php output; cron_dump 687 | No PHP code reads sender_name, sender_email, admin_notification_enabled or user_confirmation_enabled (only Schemas.php) |
| FF-09 | P3 | Settings > General > Delete Behavior "Hard", then delete an entry. "Soft", then delete a form. | Follows the setting | Entries always go to Trash and forms always follow the client's `move_to_trash` param | inproc DELETE results | Setting unused in PHP and JS |
| FF-10 | P3 | Settings > Autosave off, or interval 3 s; edit in the builder | Follows the setting | Autosave always runs 30 s after the last edit. The menu says "a few seconds". | b_builder.log (save at 44 s after the edit at 14 s) | resources/admin/hooks/useDraftAutosave.js:21, BuilderPage.jsx:128 ignores the settings |
| FF-11 | P2 | Visitor whose device clock is 5 minutes fast submits within 5 minutes | Entry saved | "Thank you! Your submission has been received." shown, nothing stored | 52-front-clock-skew.png; spam.php "client clock +5min" | FormRenderer.jsx:96 uses the browser clock `Date.now()`; SpamProtection::check_time_trap compares it with server time() |
| FF-12 | P2 | POST /submit without `form_rendered_at` | Time trap applies | Accepted and stored (bot bypass) | spam.php "no timestamp" stored entry 5897 | SpamProtection.php:97 skips when the field is missing. Disabling the honeypot also disables the time trap (is_enabled). |
| FF-13 | P2 | Submit a form with a required field missing (422 to the visitor) | Nothing stored | A "failed" entry is stored with raw data, including `form_rendered_at`. It shows in Entries and counts toward "Maximum entries" (FormRestrictions counts all statuses except spam and trash). | Entry 5925 in t_logic.js | PublicSubmitApi creates the record before pipeline validation |
| FF-14 | P2 | Builder: add a field (unpublished), Preview, fill it, submit | Test entry with all answers, or clearly marked | The entry omits the draft field value, has no preview flag, fires real notifications and counts in stats and limits | b_builder2.log (payload without the URL field) | The submit validates against the active (published) schema |
| FF-15 | P3 | Confirmation message "Got it {field:name}" or redirect `?who={field:name}` | Replaced, as in emails | Shown literally. Only `{name}` works, and `{form_title}` / `{entry_id}` do not work. | 20-conf-message.png, b_confirm.log | FormRenderer.jsx:890 regex `\{([\w.-]+)\}`. Emails use MergeTags.php (`{field:key}`). Two syntaxes. |
| FF-16 | P3 | Entry > Resend notifications twice within 10 minutes (before cron runs) | Both resends queued | The second returns `sent: true, count: 3` but nothing is queued | t_resend.js: 3 jobs instead of 6 | `wp_schedule_single_event` drops identical events within 10 minutes. EmailAction only records `async_dispatch_failed` in meta, so the result is still ok. |
| FF-17 | P2 | Free webhook, Payload Mode Custom `{"name":"{{name}}"}` (placeholder shown in the UI) | Answers filled in | Body sent literally `{"name":"{{name}}","email":"{field:email}"}` | wh.php | src/Engine/Actions/WebhookAction.php:47-55. Pro's own WebhookRequest fills tags, so this hits free-only sites. |
| FF-18 | P2 | Entry detail > Flag, then click Flagged to unflag | Unflagged | "Failed to update status". It stays Flagged after a reload. | 35-entry-unflag.png, b_entries2.log (422) | SubmissionDetailPage.jsx:43 sends `status:'completed'`. Schemas.php:86 allows only spam, flagged, archived, none. |
| FF-19 | P2 | Entry with status payment_pending (or failed): bulk Flag or Spam, then Restore | The payment state is kept | The status becomes "flagged"/"spam", then an empty string. The original state is lost. | t_flag.js (entry 5890) | One `status` column serves both the pipeline result and the review label (SubmissionsApi.php:616-623) |
| FF-20 | P3 | Tools > Export Personal Data for an email with entries | Form name in the export | "Form Name": null plus PHP warning `Undefined array key "name"` | gdpr.php; debug.log | src/Privacy/PrivacyExporter.php:87 uses `$form['name']`; the column is `title` |
| FF-21 | P2 | Erase personal data for `ann@example.com` | Only Ann's entries | Also matches `joann@example.com` (proved with `eed42@example.com` matching `seed42@example.com`) and deletes those entries | gdpr.php output | PrivacyEraser/Exporter `payload LIKE %email%` (PrivacyEraser.php:129) |
| FF-22 | P3 | Block option AJAX on or off | Changes behaviour | No effect: submission is always AJAX | Code: blockOptions.ajax is never read | resources/frontend/components/FormRenderer.jsx (only fieldValues, showTitle, theme, tabIndex used) |
| FF-23 | P2 | Install any language pack | Admin and frontend React strings translated | Only PHP strings can translate | grep: no `wp_set_script_translations` in src | Missing calls for admin, frontend and block handles. subtleforms-js.pot is empty and the main POT is stale (2.3.0). |
| FF-24 | P3 | Site timezone UTC+5, look at Dashboard "Today" and the chart | Site-local days | UTC days ("Since midnight (UTC)") | DashboardApi.php:125, Stats.php | `gmdate()` everywhere |
| FF-25 | P3 | Select field with label "Sales" / value "sales"; view the email and entry | Label shown | Value "sales" shown | mailrun output, 36-entry-star-note.png | EmailAction format_answers, entry view |
| FF-26 | P3 | Entries filtered to one form | Tab counts for that form | "New 1639" global count | 31-entries-5k.png | Count query ignores form_id |
| FF-27 | P3 | Retention purge | Entry logs removed too | `subtleforms_logs` rows for purged entries remain | SubmissionsRepository.php:760 | delete_older_than deletes only submissions (and files) |
| FF-28 | P3 | Rate limit policy for public submit | 10 per minute as coded | 30 per minute (generic unauthenticated policy) | spam.php: 429 after 30 | RateLimiter.php:120 matches `/forms/x/submit`; the route is `/submit` |
| FF-29 | P3 | Every submission | No full scans of wp_options | 3 `DELETE ... LIKE '_transient_subtleforms:%'` per submit | q.php | Count cache invalidation in SubmissionsRepository |
| FF-30 | P3 | Any entry | Schema referenced by version | Full schema copied into each entry's meta and returned in list responses (about 1 KB per entry and per row) | Entry JSON in t_email output | SaveAction / PublicSubmitApi meta |
| FF-31 | P2 | Multisite: network activate, use on a subsite, network deactivate, delete | All sites cleaned | Main site cleaned. Subsite keeps 8 `wp_2_subtleforms_*` tables and 13 options. | multisite run output | uninstall.php has no `get_sites()` / `switch_to_blog()` loop |
| FF-32 | P3 | Settings > Email "Admin Notifications" help vs per-form actions | One source of truth | Global toggles duplicate per-form actions and do nothing (see FF-08) | | Remove or wire them up |
| FF-33 | P3 | Builder Settings view | Spacing | "Add conditional confirmation" button touches the "Submit button text" label | 81-builder-actions-template-webhook.png | FormBehaviorPanels.jsx spacing |
| FF-34 | P3 | Block forms and a shortcode form on one page | Same width | Block forms are narrower than the shortcode form | 50-front-multi.png | Different container styles |

## 4. Missing features (compared with Gravity Forms, WPForms Pro, Fluent Forms Pro, Formidable Pro, Forminator Pro)

| Feature | Priority | Edition |
|---|---|---|
| Reply-To, CC, BCC, From name/email per notification | Must | Free |
| Attach uploaded files to notifications | Must | Free |
| Form field columns in the entries list (pick Name, Email and others) | Must | Free |
| Form import/export (JSON), including between sites | Must | Free |
| Store blocked spam for review (Spam tab), Akismet integration | Should | Free (Akismet), Pro (AI) |
| Save and resume (partial progress link) | Should | Pro |
| Partial entries / abandonment capture | Should | Pro |
| Entry editing inline by admins, with an edit log | Must | Free (basic), Pro (log) |
| Print entry view | Should | Free |
| Custom date range filter on entries | Should | Free |
| Keep data on uninstall option | Should | Free |
| Custom capabilities (view/manage entries, manage forms) for non-admin roles | Should | Free |
| Shortcode attributes (title, description, field values) | Should | Free |
| Per-form spam settings (disable honeypot, CAPTCHA per form) | Should | Free |
| Form revisions history with restore | Should | Pro |
| User registration / login / profile forms | Should | Pro |
| Post creation (front-end posts, custom post types) | Should | Pro |
| Quiz scoring and survey/poll results reports | Should | Pro |
| Form locker / password protection | Nice | Pro |
| Double opt-in email confirmation | Should | Pro |
| Entry approval workflow | Nice | Pro |
| Multi-page progress bar options (steps, percent) | Should | Free |
| Global styles / theme presets shared across forms | Should | Free |
| Import from Contact Form 7, WPForms, Gravity Forms | Should | Free |
| A/B testing of forms | Nice | Pro |
| Geolocation / address autocomplete | Nice | Pro |
| SMS notifications (Twilio) | Nice | Pro |
| Slack / Discord / Teams notifications | Should | Pro |
| Elementor, Divi and Beaver Builder widgets | Should | Free |
| Signed webhook with timestamp (replay protection) and a delivery log in free | Nice | Free |
| Send-to-self / test entry mode in preview | Should | Free |
| Daily or weekly entry digest email | Nice | Pro |
| Whole-submission validation hook, pre-save filter, entry-deleted action | Should | Free |
| Option to require consent before storing IP / user agent | Should | Free |

## 5. Not tested and why

- CAPTCHA verification (reCAPTCHA, hCaptcha, Turnstile): the provider endpoints are not reachable, and turning CAPTCHA on globally would break other auditors' submits. Not run.
- Submission limit per user/IP (global): not toggled live because all auditors submit from 127.0.0.1 and would be locked out. Confirmed only in code.
- Reset All Settings: would wipe shared settings. Not run.
- Real email delivery: the site has no mail transport. Content and headers were checked with a mock PHPMailer.
- Webhook delivery to a real endpoint: the free action was checked up to the queued request (URL, headers, signature, body). Network delivery was not tested.
- PHP 8.1, 8.2 and 8.4: only PHP 8.3.6 is installed. Static checks only.
- Field-by-field behaviour and payments: other auditors.
- Free plugin without Pro: Pro stays active on the shared site. The free webhook class was run directly in-process, and Pro-gated features (conditional confirmations, action conditions) appear as Pro here.
- Elementor and other builders: no integration exists, so there was nothing to test.
