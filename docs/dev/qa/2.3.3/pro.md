# SubtleForms Pro 2.3.3: full QA audit (area: pro)

Auditor area: Pro plugin (licensing, plan gating, updater, integrations, PDF, logic, branding, templates, uninstall, performance, Plugin Check, security). Payments (Stripe, WooCommerce checkout) were left to the payments auditor.

Test bed: an isolated WordPress 7.1.3 site built for this audit at http://localhost:8905 (SQLite, WP_ENVIRONMENT_TYPE local, plugins installed from the release zips `out/subtleforms-2.3.3.zip` and `out/subtleforms-pro-2.3.3.zip`), talking to the real license server 1.6.0 on http://localhost:8899. Six QA licenses (Starter, Pro, Agency, expired Pro, suspended Pro, Starter for the site limit) were created on the server for a QA buyer account. The shared site's Agency connection was never touched (verified at the end: key E8C859C0, agency, valid, activation `localhost` intact). Outgoing HTTP was logged and mocked with a `pre_http_request` mu-plugin. All QA licenses, the buyer, the temporary releases and the QA site were removed at the end. Scripts: `/home/claude/work/qa/pro/`. Screenshots: `/home/claude/shots/qa/pro/`.

## 1. Summary

- Licensing is solid: account connect, manual keys, site limit, expired, suspended, revoked (site removed on the server), grace period, 48 hour unreachable fallback and dev keys all behave as designed, and live forms keep working when a license lapses. Plan gating matches PRO_FEATURES.md exactly on the server for Starter, Pro and Agency.
- P1: the Pro "Payment Form" template collects card number, expiry and CVV in plain text fields and stores them in the database and sends them by webhook (PCI violation).
- P1: 20 of the 47 Pro templates ship with an enabled webhook action that posts every entry (name, email, IP address) to placeholder `*.example.com` URLs, and retries 3 times.
- P2: a slow or unreachable license server blocks one visitor page load for up to about 46 seconds every 5 minutes (synchronous re-validation with 3 tries of 15 seconds); measured 16.8 s with a 5 s timeout.
- P2: Multilanguage with Polylang does not translate forms on the front end, because the form loads its schema over REST without the visitor's language.
- P2: entry PDFs cannot show Arabic, Urdu, Hebrew (wrong order, unshaped, missing glyphs), Chinese, Japanese or emoji (empty boxes).
- P2: HubSpot partial failures (HTTP 207 with errors) are logged as "succeeded"; integration logs with personal data survive entry deletion and plugin uninstall.
- Integrations (Mailchimp, Brevo, Kit, HubSpot, CRM webhook, webhooks with HMAC signing and retries, Zapier REST hooks and the Zapier app) send correct requests for the documented APIs; all external calls were mocked, so live checks remain for the owner.
- Updates work end to end through the license server (2.3.3 to 2.3.9 test release installed from the Plugins screen); the beta channel is never offered. Plugin Check on the release zip reports only the expected updater findings.
- Compared with Gravity Forms, WPForms Elite, Fluent Forms Pro, Formidable and Forminator Pro, the biggest gaps are Google Sheets, Slack, ActiveCampaign and other common integrations, save and resume, user registration, post creation, quiz scoring and survey reports, and PayPal.

## 2. Inventory and status

### 2.1 Activation and requirements

| Item | Status | Evidence |
|---|---|---|
| Activate Pro without the free plugin | Works (WordPress "Requires Plugins" blocks it: "requires 1 plugin ... subtleforms") | wp-cli output |
| Activate Pro with free 2.2.1 | Works (activation refused: "requires SubtleForms 2.3.0 or higher. You are running 2.2.1") | wp-cli output |
| Pro active, free downgraded to 2.2.1 | Works (admin notice, Pro does not boot, no fatal) | shots/qa/pro/act-old-free.png |
| Pro active, free missing | Works (notice "requires SubtleForms (free version)") but logs a PHP notice (PRO-16) | shots/qa/pro/act-no-free.png |
| First run redirect to Settings > License | Works | shots/qa/pro/first-run-after-activate.png |
| Deactivate / reactivate | Works (key kept, daily license cron unscheduled then rescheduled) | wp-cli output |

### 2.2 Licensing

| Flow or state | Status | What it does to features and forms | Evidence |
|---|---|---|---|
| Account connect (Connect your SubtleForms account) | Works. Store lists the buyer's licenses, blocks expired and suspended ones, returns with a one-time code, site activated, account email shown | All plan features on | connect-1-store.png, connect-2-back.png |
| Forged or expired connect state | Works ("did not come from this site", nothing changed) | none | connect-bad-state.png |
| Disconnect | Works, frees the slot on the server (activation row removed). Uses a browser confirm() dialog (PRO-25) | Pro features off | disconnect-after.png, server activation log |
| Manual key, valid (Pro, Agency, Starter) | Works | Plan features on | paste-pro-*.png, lic-pro.png |
| Manual key, bad format | Works (400 "Invalid license key format") | none | lic.php output |
| Manual key, unknown | Works ("That license key was not found") | none | lic.php output |
| Manual key, expired | Works ("This license has expired. Renew it...") but no renew link in the notice | none | paste-expired-2.png |
| Manual key, suspended | Works ("This license is not active. Contact SubtleForms support.") | none | lic.php output |
| Site limit reached | Works ("This license is already active on 1 site. Deactivate it there, or upgrade your plan."), key not stored | none | limit.php output (domain qa-shop-two.com) |
| Grace period (expired under 14 days) | Works: status grace_period, everything stays on | All on | caps.php output |
| Expired after activation | Works: lapsed. Admin gets no Pro capabilities; visitors keep payments, Pro fields and the WooCommerce checkout; advanced logic keeps evaluating; webhooks still sent once; email marketing and CRM stop | Live forms keep working (submitted form 66 as visitor, conditional field hidden, entry saved, webhooks sent, no Mailchimp call) | lapsed-support-*.png, http-log |
| Suspended / refunded | Works: same as expired | as above | caps.php output |
| Revoked (site removed on the server) | Works: status inactive, lapsed notice "not activated for this site" with paused / still working lists. Plan card shows "EXPIRED October 14, 2027" (PRO-14) | as above | lapsed-license-screen.png, lapsed-dashboard-notice.png |
| License server unreachable, last valid under 48 h | Works: grace_period with grace_fallback, retried after 5 minutes | All on | caps.php output |
| Unreachable for more than 48 h | Works: invalid, lapsed (live forms keep working) | Lapsed | caps.php output |
| Slow license server | Broken for visitors (PRO-03) | One page load waits up to about 46 s | curl timing 16.8 s with a 5 s mock timeout |
| Dev keys SF-DEV-STARTER/PRO/AGENCY on local | Works, correct plan per key, no HTTP calls | Plan features on | caps.php output |
| Dev key activation on production | Works (refused). A dev key already stored stays valid up to 12 h after the site becomes production (PRO-17) | | caps.php output |
| Expiry warning email (7 days) | Works ("Your SubtleForms Pro license expires in 7 days"). Exact day thresholds only (PRO-20) | | mail-log.jsonl |
| White label restriction of License screens | Works (second admin gets 403 on /license/* and /pro/branding, License tab hidden) | | brand-admin2-settings.png |

### 2.3 Plan capabilities (server side, verified per plan with `caps.php` and REST probes in `gate.php`)

| Capability (free key) | What it unlocks | Starter | Pro | Agency | Server gate verified | UI gate verified |
|---|---|---|---|---|---|---|
| actions.payment, extensions.payments | Stripe checkout, coupons | yes | yes | yes | caps map (payments auditor tested flows) | not run here |
| logic.conditional.advanced | any/OR groups, extra operators, step logic, conditional emails and confirmations | yes | yes | yes | Not gated on save (PRO-10); runtime always evaluates (by design) | Builder shows advanced operators only when licensed |
| fields.advanced | Signature, Calculation, Picture Choice, multi-file uploads | yes | yes | yes | Not gated on save (PRO-10) | Field dock shows Pro badge (nolic-builder-calconly.png); read-only banner only for Signature (PRO-09) |
| extensions.pdf | Entry PDF download and email attachment | yes | yes | yes | Route absent without license (404), 200 on Starter | Entry screen PDF button |
| extensions.analytics | Analytics reports | yes | yes | yes | 403 without license, 200 on Starter | not checked |
| templates.pro | 47 Pro templates | yes | yes | yes | 403 when metadata.template names a Pro template; bypassable (PRO-10) | Templates show locked without license |
| submissions.export (csv_export) | CSV export | yes | yes | yes | 403 without license, 200 on Starter | Upsell modal without license, download on Starter (csv-*.png) |
| extensions.webhooks (webhooks) | Webhook retries (1 to 5) | no | yes | yes | Starter sends once (retries 0) | Webhooks panel locked on Starter |
| extensions.email_marketing (integrations) | Mailchimp, Brevo, Kit | no | yes | yes | 403 "Your SubtleForms Pro plan does not include this integration" on Starter | Locked panel, wrong copy (PRO-08) |
| extensions.crm (integrations) | HubSpot, CRM webhook | no | yes | yes | 403 on Starter | Locked panel, wrong copy |
| extensions.zapier (integrations) | Zapier REST hooks and polling | no | yes | yes | 403 "Zapier needs the SubtleForms Pro or Agency plan" | Warning notice on Starter |
| integrations.woocommerce, extensions.ecommerce (integrations) | WooCommerce checkout and Product field | no | yes | yes | caps map | not run here |
| branding.white_label (white_label) | White label | no | no | yes | /pro/branding 404 below Agency | Branding tab locked with "Agency" badge (starter-branding.png) |
| extensions.multilanguage (white_label) | WPML / Polylang | no | no | yes | caps map | Locked panel says "Included with SubtleForms Pro" (PRO-08) |

The capability lists per plan match PRO_FEATURES.md and the license server's SFLS_Plans table.

### 2.4 Updates

| Item | Status | Evidence |
|---|---|---|
| Update check through /sfls/v1/update/check | Works (published test release 2.3.9 offered on Plugins screen) | update-1-available.png |
| Package download through /update/package (signed one-time link) | Works (updated to 2.3.9 from the Plugins screen). Needed a QA-only filter because wp_safe_remote_get rejects localhost:8899; not an issue on subtleforms.com:443 | update-2-done.png |
| Beta channel | Works: 2.9.0-beta.1 published on the beta channel was not offered (Pro never sends channel=beta) | http-log |
| Expired license | Partial: server returns new_version with empty package, so WordPress shows "Automatic update is unavailable" without telling the user to renew (see missing items) | curl output |
| Temporary releases | Removed afterwards; latest stable back to 2.2.0 | sfls release list |

### 2.5 Integrations (requests captured from real code paths, external APIs mocked)

| Integration | Settings UI | Test connection | Field mapping | Delivery on submit | Retry and logs | Failure handling | Status |
|---|---|---|---|---|---|---|---|
| Mailchimp | Works (provider, key, lists loaded, default audience, double opt-in) mc-*.png | Works (GET /3.0/lists, merge-fields) | Works (email, FNAME/LNAME split from full name, PHONE, tags, consent box) | Works: PUT /3.0/lists/{id}/members/{md5(lowercase email)}?skip_merge_validation=true with status_if_new, then POST .../tags | Works (entry log, one retry after 5 min on 5xx/429/timeout, manual Retry) | 400 compliance state logged as failed with Mailchimp's message; consent unchecked logged as skipped | Works |
| Brevo | Works | Works (GET /v3/contacts/lists, /contacts/attributes) | Works | Works: POST /v3/contacts {email, updateEnabled:true, attributes, listIds:[7]}, header api-key | Works | Not tested beyond 2xx | Partial: no double opt-in, tags accepted in UI and reported as sent but Brevo has no tags (PRO-21) |
| Kit (ConvertKit v4) | Works | Works (GET /v4/forms, /v4/custom_fields) | Works | Works: POST /v4/subscribers, POST /v4/forms/{id}/subscribers {email_address, referrer}, GET /v4/tags then POST /v4/tags/{id}/subscribers; header X-Kit-Api-Key | Works | Unknown tags reported as tags_not_found | Works (stale mappings after provider switch, PRO-21) |
| HubSpot | Works | Works (GET /crm/v3/properties/contacts) | Works | Works: POST /crm/v3/objects/contacts/batch/upsert {inputs:[{idProperty:"email", id, properties}]}, then POST /crm/v3/objects/notes with association type 202 and an HTML answer table; Bearer private app token | Works | 207 with errors logged as succeeded (PRO-06) | Partial |
| CRM webhook (Make, Zapier catch hook, any CRM) | Works | Works (posts a sample contact) | Works | Works: JSON {event:"contact.submitted", email, first_name, last_name, properties, answers, form_id, ...} | Works | | Works |
| Webhooks (form action) | Works (retries 0 to 5, default secret, test endpoint, delivery log) dlog-*.png | Works ("Delivered. HTTP 200") | Custom headers, custom JSON body with {{field}} tags | Works: POST with X-SubtleForms-Delivery, custom header, X-SubtleForms-Signature sha256=HMAC verified correct | Works: retries 1 min, 5 min, 25 min then failed; "Send again" in log succeeded | Payload leaks honeypot and time-trap fields (PRO-11); log rows have form_id 0 (PRO-12) | Partial |
| Zapier (REST hooks API) | Works (site address, API key create, connected zaps) | /zapier/me, /forms, /entries Work with key, 401 with wrong key | n/a | Works: entry POSTed to hooks.zapier.com target, 410 Gone removes the hook | Works | Non-https, localhost and private IP targets rejected | Works |
| Zapier app (integrations/zapier) | n/a | `npx jest test/app.test.js`: 13 passed; `test/live.test.js` against the QA site: 3 passed | | | | | Works here; publishing to Zapier is owner only |
| Conditional notifications ("Only when") | Works (support-only email not sent for Sales, sent for Support) | | | | | | Works |
| PDF attached to admin email | Works (attachment 20 KB, temp file deleted after send) | | | | | | Works |

### 2.6 PDF

| Item | Status | Evidence |
|---|---|---|
| Download from entry (REST /entries/{id}/pdf, admin only) | Works (application/pdf, attachment filename, no-store) | pdf/h58.txt |
| Layouts default, minimal, detailed | Works | pdf-detailed.png, pdf-minimal.png |
| Attach to admin notification | Works, visitor emails untouched | mail-log.jsonl |
| Signature image | Works | pdf-entry58-unicode.png |
| Calculation value | Works (server recomputed 59.97 from tampered "1"), but prefix "$" missing | pdf-entry58-unicode.png |
| Single checkbox | Shows "1" instead of Yes (PRO-23) | pdf-detailed.png |
| Latin accents (Zoë Ünïcödé) | Works | |
| Arabic, Urdu, Hebrew | Broken (PRO-05) | pdf-entry58-unicode.png |
| Chinese, Japanese, emoji | Broken (empty boxes) | pdf-entry58-unicode.png |
| Branding | Uses the theme Custom Logo and site name; white label settings are not used; localhost shown top right | |

### 2.7 Logic module (advanced logic and calculations)

| Item | Status | Evidence |
|---|---|---|
| "is one of" with "any" match on a field (show Company for Sales or Pricing) | Works in the browser and on the server | int-sales-*.png, lapsed-support-*.png |
| Conditional confirmations, first match wins | Works ("QA SALES CONFIRMATION") | int-sales-3-after.png |
| Conditional step skipped, its required field not validated | Works (topic support submits; topic sales requires Company) | logic.php output |
| Date "after" rule in an OR group | Works (late note required only after 2026-12-01) | logic.php output |
| Tidy on save (rules on deleted fields removed) | Works on schema save and publish, not on form create (PRO-26) | logic.php output |
| Calculation computed on the server | Works (59.97 stored) | entry 58 payload |

### 2.8 Branding and white label (Agency)

| Item | Status | Evidence |
|---|---|---|
| Plugin name in menu and app header | Works ("Acme Forms") | brand-owner-*.png |
| Logo from Media Library | Works (non-image IDs refused) | |
| Hide credits, help links, upgrade prompts | Works in the SubtleForms app | |
| Support URL | Works | |
| License and Branding screens for one admin | Works (403 for admin2) | brand-admin2-settings.png |
| Plugins screen, plugin row, update notices, license emails, admin notices, PDFs | Not white-labelled (still "SubtleForms Pro"); other admins can still deactivate or delete Pro (PRO-24) | brand-owner-plugins_php.png |
| Lapsed license | White label switches off (by design of LapsePolicy, worth a product decision) | |

### 2.9 Multilanguage

| Item | Status | Evidence |
|---|---|---|
| Polylang detected, 1267 strings from 69 forms registered | Works | ml.php output |
| French page shows translated labels and confirmation | Broken (PRO-04): labels and confirmation stay English; the same schema with ?lang=fr returns "Nom complet" | ml-fr-form.png, ml-fr-after.png |
| WPML | Not testable here (commercial plugin) | |

### 2.10 Pro templates (47)

| Item | Status | Evidence |
|---|---|---|
| Create, publish and submit each template | Works for 46 of 47 (REST submit 200 and entry stored). job_application needs a file upload (expected 422 when skipped). templates.php output | |
| Template content | Broken for payment_form (PRO-01) and 20 templates with live example.com webhooks (PRO-02). donation_form has no payment field (PRO-22). Quiz templates have no scoring. No template uses a Pro field or advanced logic, so "Pro templates" add little that free fields cannot do | ProTemplates.php |

### 2.11 Other

| Item | Status | Evidence |
|---|---|---|
| CSV export, Starter | Works (download, formula injection escaped with a leading quote, UTF-8 BOM) | export-starter*.csv |
| CSV export, no license | Works (upsell modal; server 403) | csv-nolicense.png |
| proFeatureDetector.js read-only mode | Partial (PRO-09) | nolic-builder-proform.png, nolic-builder-calconly.png |
| uninstall.php | Partial: frees the license slot on the server (activation removed, non-blocking POST), removes key, data, account, first run, cron; leaves other data (PRO-07, PRO-19) | uninstall-after.png |
| Performance: front end | Works: Pro adds no front-end CSS or JS; median page time 0.069 s with Pro vs 0.067 s without | curl timing |
| Performance: admin | 43 KB pro-admin.js and 12.7 KB admin.css on SubtleForms screens only | |
| Zip size | 4.37 MB zip, 10.97 MB unpacked, 458 files; vendor/dompdf is 9.9 MB (90 percent), 261 files, including 8 DejaVu TTF files (about 4.6 MB) | unzip -l |
| Plugin Check on the release zip | Only the expected updater findings (plugin_updater_detected, update_modification_detected x2 in src/Licensing/Updater.php). Nothing else | pcp-pro.csv |
| Security spot checks | REST permission callbacks present on every Pro route (manage_options, owner check, Zapier key with hash_equals); dismiss AJAX has nonce and capability; output escaped; webhook custom bodies built structurally (no JSON injection); Zapier targets validated; logs mask Authorization and api-key headers. Hardening items: PRO-13, PRO-18, PRO-27, PRO-28 | code and REST probes |

## 3. Bugs

| ID | Sev | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|
| PRO-01 | P1 | Create a form from the Pro template "Payment Form", submit it | Payments through the Card Payment (Stripe) field; card data never touches the site | Template has plain text fields Card Number, Expiry Date, CVV and a Billing Address; the values are stored in the entry and sent by the template's webhook | Entry 34 payload `card_number`, `cvv` | src/Templates/ProTemplates.php:315-335 |
| PRO-02 | P1 | Create a form from any of 20 Pro templates (advanced_contact, event_registration, support_ticket, payment_form, booking_form, job_application, survey_nps, membership_application, sales_inquiry, partnership_request, press_inquiry, webinar_signup, course_enrollment, volunteer_signup, conference_registration, employee_satisfaction, onboarding_checkin, feature_request, donation_form, vendor_application), publish, submit | No outgoing webhook until the user adds a real URL | An enabled webhook action POSTs the full entry, IP address and user agent to `https://crm.example.com/api/contacts` and similar, then retries 3 times; failures fill the delivery log | http-log: 19 POSTs to *.example.com; integration log rows 1-19 | ProTemplates.php:168-171, 261-266, 351-354, 449, 542, 629, 700, 789, 889, 966, 1047, 1125, 1215, 1304, 1395, 1509, 1598, 1688, 1776, 1876 |
| PRO-03 | P2 | Let `next_check` pass (every 12 h, or 5 min after a failure) while the license server is slow or times out; load any front-end page | Visitors never wait for the license server | The first request re-validates synchronously: 3 attempts with a 15 s timeout plus 1.5 s back-off, up to about 46.5 s; measured 16.8 s on the home page with a 5 s mock timeout, next load 0.19 s | curl timing | LicenseManager.php:210 (validate in getLicenseData on any request via capabilities filter), API/Client.php:36-38 (TIMEOUT 15, MAX_RETRIES 2), withRetry usleep |
| PRO-04 | P2 | Agency, Polylang active with English and French, Settings > Integrations > Multilanguage on, translate "Full name" to "Nom complet" in String Translation, open the French page with the form | French labels and confirmation | English labels and confirmation. The form fetches `GET /wp-json/subtleforms/v1/forms/66/schema` without a language; `?lang=fr` on the same URL returns "Nom complet" | ml-fr-form.png, ml-fr-after.png, s-mlreq.js output | Front end does not pass the current language to REST (free FormsApi.php:558 filterPublicSchema runs in a language-less REST request); Multilanguage::translate uses pll__() (src/Modules/Branding/Multilanguage.php:228) |
| PRO-05 | P2 | Submit an entry with Arabic, Urdu, Hebrew, Chinese and emoji text, download the PDF | Readable text in the right direction | Arabic and Hebrew letters reversed and unshaped, several Urdu letters and all CJK and emoji show empty boxes | pdf-entry58-unicode.png | EntryPdf.php:269 uses only DejaVu Sans; dompdf has no bidi or shaping and no CJK font |
| PRO-06 | P2 | HubSpot connected; HubSpot answers the upsert with HTTP 207 and an errors array | Logged as failed with HubSpot's message | Logged "succeeded", contact_id empty, no note | gate run: entry 53 log "succeeded http_status 207" | Crm/HubSpot.php:189-192 treats any 2xx as success and does not read `errors` |
| PRO-07 | P2 | Send an entry to Mailchimp or a webhook, then permanently delete the entry (or uninstall Pro) | Integration log rows with that person's data are removed (and offered to WordPress privacy erasers) | 4 log rows for deleted entry 48 remain with full request bodies (name, email, phone, IP); after uninstall the table and its 62 rows remain; kept 90 days by prune only | gate output "log rows after: 4"; uninstall check | No delete hook in Integrations; no privacy exporter or eraser; uninstall.php does not drop wp_subtleforms_pro_integration_log |
| PRO-08 | P3 | Activate a Starter license, open Settings > Integrations > Email Marketing, CRM or Multilanguage | Says which plan is needed (Pro, or Agency for Multilanguage) | "Included with SubtleForms Pro. You can look around. Settings unlock as soon as your license is active." on an active license; Multilanguage needs Agency | starter-multilanguage.png | free resources/admin/components/settings/ExtensionsSettings.jsx:63-68 |
| PRO-09 | P3 | No license; open a form that uses Calculation or Picture Choice or advanced logic but no Signature | Read-only banner like Signature forms | Fully editable | nolic-builder-calconly.png vs nolic-builder-proform.png | free resources/admin/utils/proFeatureDetector.js:15-33 lists 8 of 47 Pro template IDs and only `signature` |
| PRO-10 | P3 | No license; POST /forms with a Signature field and a starts_with rule, or a Pro template schema without metadata.template | 403 like the Pro template check | 201, forms work on the front end (signature and calculation render with no license) | gate.php output, nolicense-sigform.png | Only templates.pro is checked, by metadata.template (free FormsApi.php:761-773); fields.advanced and advanced logic are UI-only gates |
| PRO-11 | P3 | Submit any form with a webhook | Only form answers | `fields` contains `website_url` (honeypot) and `form_rendered_at` (time trap) | http-log body | WebhookAction.php:161 passes the raw context payload |
| PRO-12 | P3 | Look at webhook rows in the delivery log or the integration log table | form_id of the entry | form_id 0 for webhook rows (Zapier rows are correct) | integration log rows | WebhookAction.php:87 calls Delivery::dispatch without the log array that carries form_id |
| PRO-13 | P3 | Read error messages on the entry screen | Point to Settings > Integrations | "Finish the setup in Settings > Extensions > CRM", "Add an API key in Settings > Extensions > Email Marketing", "Choose a Mailchimp audience in Settings > Extensions", Brevo list message | entry-48.png | Crm.php:117, EmailMarketing.php:142, Mailchimp.php:186, Brevo.php:133 |
| PRO-14 | P3 | Remove the site's activation on the server (revoked), open Settings > License | "Not activated" with the real expiry label | Plan card shows "EXPIRED October 14, 2027" and a primary "Renew" button; a manual (non-renewing) license shows "RENEWS"; "recognised as staging" shown for localhost | lapsed-license-screen.png, connect-2-back.png | resources/admin/components/LicenseSettings.jsx:233-236 |
| PRO-15 | P3 | Uninstall Pro | Pro options removed | Left behind: subtleforms_pro_zapier (Zapier API key and hook URLs), subtleforms_pro_branding, subtleforms_pro_activated_at, subtleforms_pro_version, subtleforms_pro_integration_log_db | uninstall check | uninstall.php option list |
| PRO-16 | P3 | Pro active while the free plugin is missing or too old | No PHP notice | `_load_textdomain_just_in_time ... subtleforms-pro domain was triggered too early` | debug.log | subtleforms-pro.php:58-90 calls __() at plugins_loaded:20 |
| PRO-17 | P3 | Activate SF-DEV-AGENCY on a local site, then switch the environment to production | Pro stops right away | Stays valid on the stored dev data until next_check (up to 12 h) | caps.php output | LicenseManager::getLicenseData trusts stored data when isDevKey() is false |
| PRO-18 | P3 | Watch the update requests | License key not in URLs | `update/check?license_key=SFP-...` and the package URL carry the full key in the query string (server access logs, proxies) | http-log | API/Client.php checkUpdate (GET), server package URL |
| PRO-19 | P3 | Activate any key, look at the server activation | Plugin version recorded | plugin_version empty until the first update check | srv.sh output | Client.php activateLicense does not send `version` |
| PRO-20 | P3 | License expiring in 4 days (or cron skips a day) | One warning email | No email unless the cron runs exactly on day 30, 14, 7, 3 or 1 | mail-log (4 days: none, 7 days: sent) | LicenseScheduler.php:333-339 exact equality |
| PRO-21 | P3 | Map PHONE on a form for Mailchimp, then switch the global provider to Kit or Brevo | Mappings checked or reset per provider | Old merge tags are sent (Kit gets `fields:{PHONE}`, which Kit rejects for unknown custom fields; Brevo gets PHONE instead of SMS). Brevo test contact says tags were sent although Brevo has no tags | prov.php output | One global provider; per-form mapping stores provider-specific targets |
| PRO-22 | P3 | Use the Donation Form template | Takes a donation | No payment field; amount and frequency are just recorded and posted to donations.example.com | ProTemplates.php:1698 | Template content |
| PRO-23 | P3 | PDF of an entry with a single checkbox ticked | "Yes" | "1" | pdf-detailed.png | EntryPdf answer formatting |
| PRO-24 | P3 | Agency white label with "Only I can see License and Branding", log in as another admin | Pro hidden or protected | Plugins screen still says SubtleForms and SubtleForms Pro with Deactivate and Delete links; expiry emails and admin notices say "SubtleForms Pro" | brand-owner-plugins_php.png, s-admin2.js output | Branding only filters the SubtleForms app |
| PRO-25 | P3 | Click Disconnect on Settings > License | WordPress-style confirm modal | Native browser confirm() | s-disconnect.js dialog text | LicenseSettings.jsx:358 |
| PRO-26 | P3 | Create a form (POST /forms) whose logic references a missing field | Rule removed as on save | Kept until the first schema save | logic.php output | Logic module hooks schema_before_save, which form creation does not fire |
| PRO-27 | P3 | GET /subtleforms/v1/settings as admin | Secrets masked | Full Mailchimp key, CRM token and signing secret returned to the browser; stored unencrypted in wp_options | gate output "FULL KEY" | free SettingsApi; Pro reads these settings |
| PRO-28 | P3 | Server without .htaccess support (nginx): PDF email attachment written to uploads/subtleforms-pdf-tmp/{form}-entry-{id}.pdf | Not publicly reachable | Predictable URL served with HTTP 200 until deleted after send (up to an hour if sending fails) | curl 200 application/pdf | EntryPdf.php:113 predictable name in a public folder |
| PRO-29 | P3 | WP_DEBUG on, any license check | Debug level | "[ERROR] Pro License Validate: status=valid" on every validation | debug.log | LicenseManager.php:214 |
| PRO-30 | P3 | Integrations panel on the Agency screenshot | Email Marketing dot turns green after enabling and saving | Stays grey until reload | mc-3-saved.png | free ExtensionsSettings StatusDot state |
| PRO-31 | P3 | No `Update URI` header in subtleforms-pro.php | Update URI set so WordPress.org never matches the slug | WordPress core sends subtleforms-pro to api.wordpress.org update-check | http-log | subtleforms-pro.php header |

Cross-area notes for other auditors (not counted above): license server CLI `wp sfls create --user=...` silently ignores the user because `--user` is a WP-CLI global flag (licenses were created with user_id 0); a validation failure stores a "failed" entry (entry 23); the entry screen shows select values ("sales") and checkbox "1" instead of labels; the settings schema still contains `ext_payments_paypal_client_secret` although PayPal is not offered.

## 4. Missing features (compared with Gravity Forms add-ons, WPForms Pro/Elite, Fluent Forms Pro, Formidable Pro, Forminator Pro)

| Feature | Present? | Priority | Suggested plan |
|---|---|---|---|
| Google Sheets integration | No | Must | Pro |
| Slack notifications | No | Should | Pro |
| ActiveCampaign, MailerLite, GetResponse, Constant Contact, AWeber | No (only Mailchimp, Brevo, Kit) | Should (ActiveCampaign and MailerLite are the most asked) | Pro |
| Salesforce, Zoho CRM, Pipedrive | No (HubSpot only, others through webhook/Zapier/Make) | Should | Pro or Agency |
| Make (Integromat) app, n8n node | Only through webhooks | Nice | Pro |
| Notion, Airtable | No | Nice | Pro |
| Google Drive or Dropbox upload of files | No | Should | Pro |
| Twilio SMS notifications | No | Nice | Pro |
| PayPal | No (marked "not included") | Must for a payments plugin at this price level | Starter |
| Recurring payments / subscriptions | No | Must for payment buyers | Pro |
| More than one email marketing account or provider per site (per-form provider) | No, one global provider | Should | Pro |
| Brevo and Kit double opt-in | No (Mailchimp only) | Should | Pro |
| Alert email when a webhook or integration finally fails | No | Should | Pro |
| User registration and login forms | No | Should | Pro |
| Post or custom post type submissions | No | Should | Pro |
| Save and resume (continue later link) | No | Must | Starter |
| Partial or abandoned entries | No | Should | Pro |
| Form locker (password, logged-in only, entry limits, schedule) | Partly in free availability rules | Should (password and per-user limits) | Starter |
| Survey and poll results reports | No | Should | Pro |
| Quiz scoring, grading and result pages | No (quiz templates exist without scoring) | Should | Pro |
| Geolocation and address autocomplete | No | Nice | Pro |
| Signature field | Yes | | Starter |
| Entry approval workflow | No | Nice | Agency |
| Front-end entry views and editing | No | Nice | Agency |
| PDF sent to the person who filled in the form, custom PDF templates, RTL and CJK fonts | No (admin only, 3 fixed layouts) | Should | Starter |
| Signature as an image link in CSV export | No (CSV says "Signed") | Nice | Starter |
| Multisite network license and network activation handling | No (per-site license only) | Should | Agency |
| White label completeness (plugins list name and description, emails, notices, PDFs, block name) | Partial | Should | Agency |
| Role manager (give editors access to entries or forms only) | No (manage_options everywhere) | Should | Pro |
| Conversion tracking (Google Analytics, Meta Pixel) | No (marked "not included") | Nice | Pro |
| Coupons, order summary | Yes (payments) | | Starter |
| Calculations | Yes | | Starter |

## 5. Not tested or not testable here

- Live provider APIs (Mailchimp, Brevo, Kit, HubSpot, Zapier): not reachable. Every request was captured and compared with the documented endpoints, verbs, headers and bodies; the HubSpot docs page could not be fetched during the audit, so the 207 behaviour in PRO-06 is based on HubSpot's documented batch API conventions. Owner must run: connect a real Mailchimp, Brevo (v3 key), Kit (v4 key) and HubSpot private app token on a staging site, use "Test connection" and "Send test contact" on a form, submit one entry, and check the contact, merge fields, tags, list and HubSpot note; for Zapier run `cd integrations/zapier && SF_LIVE_SITE=https://staging.example SF_LIVE_KEY=sfz_... npx jest test/live.test.js`, then `zapier validate` and publish.
- WPML: commercial plugin, not available. Owner must test with WPML and String Translation; expect the same REST language problem as PRO-04.
- Stripe and WooCommerce flows, including lapsed payments: covered by the payments auditor.
- Multisite: not set up; uninstall.php has a per-site loop that was not run.
- Real HTTPS update download from subtleforms.com: tested against localhost with a QA filter allowing port 8899; owner should confirm one real update on a live site after publishing 2.3.4.
- Email delivery: captured with pre_wp_mail; no real SMTP.
- Plugin Check was run on the release zip in the isolated site (not with the shared `/tmp/claude-0/pcp-run.sh`, which swaps symlinks on the shared site and skips vendor/ and uninstall.php in its Pro copy).
