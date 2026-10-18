# Re-audit of SubtleForms Pro 2.3.3 and License Server 1.6.0 on free 2.3.8 (area: pro-server)

Auditor area: pro-server. Date: 2026-10-19.

Test beds (the shared site http://localhost:8932 was only read, never changed):

- Server and Pro copy, http://localhost:8936 (/home/claude/wp/qa238pro): a copy of the shared site 8932 (SQLite backup, URLs replaced), so it runs the same free 2.3.8, Pro 2.3.3, License Server 1.6.0 and WooCommerce, and is its own license server (Agency key E8C859C0). I used it for the Pro module compatibility tests (integrations were turned on there) and for all License Server repros. QA licenses (ids 123 to 130) belong to the QA buyer qa238-pro-buyer.
- Clean client, http://localhost:8937 (/home/claude/wp/qa238pro-client): a fresh WordPress 7.1.3 with free from /home/claude/work/v238/free-dist and a release-like Pro copy staged from /home/claude/work/v238/pro233 (the build-zip.sh file list with a production vendor/, 379 files, at /home/claude/work/qa238/pro-server/rel/subtleforms-pro). Its license server is 8936. I used it for license states, white label, Plugin Check and uninstall.
- Outgoing HTTP was logged and mocked with a pre_http_request mu-plugin (qa238-httplog.php) on both copies, and mail was captured with pre_wp_mail.
- Scripts and raw output are in /home/claude/work/qa238/pro-server/ (scripts/, pw/, *.jsonl, *.pdf). Screenshots are in /home/claude/shots/qa238/pro-server/.

To restart the copies: `(nohup /tmp/claude-0/serve-qa238pro.sh > /dev/null 2>&1 &)` and `(nohup /tmp/claude-0/serve-qa238pro-client.sh > /dev/null 2>&1 &)`.

## 1. Summary

1. None of the 31 Pro bugs (PRO-01 to PRO-31) or the 18 License Server bugs (LS-01 to LS-18) is fixed. Pro and the server did not change, and every one reproduced again on 2.3.8. Two P1s remain on each side: card data in the Pro "Payment Form" template (PRO-01), templates that post entries to example.com (PRO-02), account takeover by email change (LS-01) and guest buyers who cannot download (LS-02).
2. New P2 (PRO2-01): the Settings screen cannot be saved once a HubSpot Portal ID is filled in. Every real portal ID is a number above 100, and the validator reads "4455" as a number with "max 100". The save fails with a generic "Validation failed" on every tab. The shared sites 8930, 8931 and 8932 already hold portal ID 4455, so Settings saves fail there for every auditor. The cause is in free: src/Validation/Rules.php:232 with src/Validation/Schemas.php:267.
3. Compatibility with free 2.3.4 to 2.3.8 is mostly good. Hidden fields reach webhooks, Mailchimp merge fields, HubSpot properties, notes, emails and PDFs. Chained choices are sent everywhere, as raw values. The new date picker drives Pro "after" logic in the browser. Pro fields render under theme inheritance. The new inbox pane shows the Pro PDF button and the integration log with Retry. Reports gets real views and conversion from the Pro license.
4. New P3 gaps from the new free features:
   - Tools import skips Pro's save hook, so imported signed webhooks go out unsigned (PRO2-02).
   - Chained labels and choices are not registered for WPML or Polylang (PRO2-05).
   - Reports and Tools say "part of Pro" on licensed and white-labelled sites (PRO2-06).
   - Chained values reach integrations as raw slugs (PRO2-08).
   - A formula error marker reaches the PDF (PRO2-07).
5. Other new P3s: switching to another key leaves the old key's seat used (PRO2-03), and the HubSpot note embeds the signature as a long base64 string (PRO2-04).
6. Plugin Check on Pro gives the same three updater findings as before and nothing else.
7. Branding and agency management: today white label is 6 settings in one site option. The license server sends plan and features but no branding, keeps no per-license settings and has no sub-accounts. The gaps are listed in section 7.

## 2. Re-verification of old bugs

### 2.1 Pro (from /home/claude/work/qa/pro.md)

| ID | Old summary | Status on 2.3.8 | Evidence |
|---|---|---|---|
| PRO-01 | Payment Form template collects card number, expiry, CVV in text fields | Still open | 8936: form 2295 from template payment_form. A REST submit stored card_number 4242424242424242 and cvv 123 in the entry. The template webhook targets payment-gateway.example.com/api/charge (scripts output) |
| PRO-02 | 20 Pro templates ship an enabled webhook to *.example.com | Still open | GET /templates: 20 templates with an enabled webhook. Submitting form 2295 queued a POST to https://payment-gateway.example.com/api/charge (server-http.jsonl; it was blocked only by WP_HTTP_BLOCK_EXTERNAL here) |
| PRO-03 | Slow license server blocks a visitor page load | Still open | 8937: validate mocked as a 5 s timeout and next_check set to the past. Home page load 1 took 16.63 s, loads 2 and 3 took 0.12 s and 0.07 s. Three POSTs to /license/validate were logged |
| PRO-04 | Polylang translations not used on the front end | Still open (code and network check; not re-run with Polylang, see section 6) | The browser fetches /forms/2294/schema with no language parameter even on ?lang=fr (s-theme.js output). free resources/frontend/components/FormRenderer.jsx:108 is unchanged |
| PRO-05 | PDF cannot show Arabic, Urdu, Hebrew, CJK, emoji | Still open | entry-uni.pdf, shot pdf-unicode-1.png: Arabic and Hebrew reversed and unshaped, CJK and emoji drawn as boxes |
| PRO-06 | HubSpot 207 with errors logged as succeeded | Still open | Upsert mocked as 207 with errors[]. The log row for entry 5932 reads status succeeded, http_status 207 |
| PRO-07 | Integration log rows survive entry deletion and uninstall; no privacy eraser | Still open | Entry 5932 deleted with force=1: 3 log rows remain, request bodies include t207@example.test. Registered erasers: no Pro eraser. After uninstall on 8937 the table wp_subtleforms_pro_integration_log and its 3 rows remain |
| PRO-08 | Starter sees "Included with SubtleForms Pro ... as soon as your license is active" | Still open | 8937 Starter key: Settings, Integrations shows that text and "Unlock" (starter-integrations.png) |
| PRO-09 | Read-only banner only for Signature forms | Still open | No license: form 3 (signature) shows "This form is in read-only mode". Form 7 (Calculation and Picture Choice only) is fully editable (nolic-builder-3.png, nolic-builder-7.png) |
| PRO-10 | Pro fields and advanced logic not gated on save | Still open, and wider | No license: POST /forms with signature, calculation and starts_with returns 201. The same Pro template schema without metadata.template returns 201. New path: Tools import created "QA238-pro-server import profields" without a license (200) |
| PRO-11 | Webhook payload leaks honeypot and time-trap fields | Still open | Webhook body for entry 5930 has fields website_url and form_rendered_at (integration log row 61) |
| PRO-12 | Webhook log rows have form_id 0 | Still open | Integration log row 61 (webhook, entry 5930) has form_id 0. The Mailchimp and HubSpot rows have 2294 |
| PRO-13 | Error messages point to "Settings > Extensions" | Still open | Keys emptied: the entry log says "Finish the setup in Settings > Extensions > CRM." and "Add an API key in Settings > Extensions > Email Marketing." |
| PRO-14 | Revoked license shows "EXPIRED <future date>" and Renew | Still open | 8937: Pro key valid to 2027-10-19 with its activation removed on the server. The plan card shows "EXPIRED October 19, 2027", a primary Renew button and "recognised as staging" (revoked-license-screen.png) |
| PRO-15 | Uninstall leaves Pro options | Still open | After `wp plugin uninstall` on 8937 these remain: subtleforms_pro_branding, subtleforms_pro_activated_at, subtleforms_pro_version, subtleforms_pro_integration_log_db and the site transient subtleforms_pro_update_info. The Zapier option was not created in this run, so it could not be checked. The server slot was freed (activation count went from 1 to 0) |
| PRO-16 | Textdomain notice when free is missing | Still open | Free folder renamed on 8937: "_load_textdomain_just_in_time ... subtleforms-pro domain was triggered too early" appears on every request |
| PRO-17 | Dev key stays valid after switching to production | Still open | SF-DEV-AGENCY activated on local, then the environment was set to production: plan agency, valid, next_check about 12 h ahead. A new dev key is refused as expected |
| PRO-18 | License key in update URLs | Still open | update/check?license_key=SFP-7CB47657-...&site_url=... The package URL also carries the full key (client-http.jsonl) |
| PRO-19 | plugin_version empty on activation | Still open | Server activations for licenses 123, 124 and 125: plugin_version is empty after activation |
| PRO-20 | Expiry email only on exact days 30/14/7/3/1 | Still open | 4 days left plus a cron run: no mail. 7 days left: "Your SubtleForms Pro license expires in 7 days" (client-mail.jsonl) |
| PRO-21 | Stale merge tags after a provider switch; Brevo tags | Still open | Provider switched to convertkit: POST api.kit.com/v4/subscribers sent fields {"UTM","VISIT"} (the Mailchimp merge tags) and the job was logged as succeeded |
| PRO-22 | Donation template has no payment field | Still open | donation_form field types: text, email, radio, number, radio, text, textarea |
| PRO-23 | PDF shows "1" for a single checkbox | Still open, and wider | Form 2297: checkbox "I agree" shows 1 and Toggle shows 1. Consent shows Yes and Select shows its label "Gold plan" |
| PRO-24 | White label does not reach the Plugins screen, emails, notices, PDF | Still open | 8937 Agency with name "Acme Forms": the Plugins screen still lists "SubtleForms" and "SubtleForms Pro" (branding-plugins-php.png). The expiry mail subject says "SubtleForms Pro" |
| PRO-25 | Native confirm() on Deactivate | Still open | Native dialog: "Deactivate the license on this site? Pro fields and actions stop working until you activate again." That text also contradicts the lapse policy, which keeps live forms working |
| PRO-26 | Logic tidy not applied on form create | Still open | POST /forms with a rule on missing field "ghost" stores the rule. The next schema save removes it (logic null) |
| PRO-27 | GET /settings returns secrets | Still open | GET /subtleforms/v1/settings contains the Mailchimp key, the HubSpot token and the global signing secret |
| PRO-28 | PDF temp file at a predictable public URL | Still open | EntryPdf::toFile wrote uploads/subtleforms-pdf-tmp/qa238-pro-server-compat-entry-5930.pdf, and an unauthenticated GET returned 200 application/pdf (PHP server, no .htaccess) |
| PRO-29 | "[ERROR] Pro License Validate: status=..." in debug.log | Still open | debug.log on 8937 contains "[SubtleForms][ERROR] Pro License Validate: status=unreachable" |
| PRO-30 | Integration status dot only updates after reload | Still open | Email Marketing switched off and saved: the dot stays "active" until reload. Switched on and saved: it stays "inactive" until reload (s-dot.js output) |
| PRO-31 | No Update URI header | Still open | WordPress core sends subtleforms-pro/subtleforms-pro.php to api.wordpress.org/plugins/update-check |

### 2.2 License Server (from /home/claude/work/qa/license-server.md)

| ID | Old summary | Status on 1.6.0 (re-run) | Evidence |
|---|---|---|---|
| LS-01 | Email change gives access to another buyer's licenses | Still open | qa238-attacker had no licenses. They changed their email to qa238-ls04-guest@example.test in My Account and got no confirmation step. My Account, Licenses then shows key SFP-0058558F-... with Renew and Upgrade (ls01-takeover-licenses.png) |
| LS-02 | Guest buyers cannot download | Still open | Guest order 6781 completed: no user was created and no registration filter is hooked. /my-account/pro-downloads/?sfls_download=latest redirects to a login form only. Registration options: checkout no, my account no |
| LS-03 | Refund of a renewal or upgrade keeps the benefit | Still open | Renewal order 6782 moved the expiry from 2027-10-18 to 2028-10-18, and after the refund it is still 2028-10-18. Upgrade order 6784 moved Starter/1 to Pro/5, and after the refund it is still Pro/5, active |
| LS-04 | Renewal product bought as a new license | Still open | Guest order 6781 for product 3004 (Starter renewal, $39) issued a new Starter license (id 130) |
| LS-05 | Pricing says "30% off: $34, $69 or $139" | Still open | Page 1003 contains "Renew at 30% off: $34, $69 or $139". The renewal products cost 39, 79 and 159 |
| LS-06 | Per-key rate limit lets anyone lock a key | Still open | Limit set to 5 per key with a temporary filter: 5 IPs got 200, a 6th IP got 429 with Retry-After 599 |
| LS-07 | Production hosts treated as local | Still open | Starter key LIMIT already full (1 of 1): myshop.wpengine.com, dev.realclient.com and also shop.kinsta.cloud.evil.com activated with is_local true |
| LS-08 | Release zips reachable by direct URL | Still open | `wp sfls release add` stored subtleforms-pro-0.0.238.zip, and a direct GET returned 200 application/zip. Note: older rows on the shared site use random nested names written by a server build that was not shipped (see section 4.3) |
| LS-09 | CSV export makes 2 extra queries per license | Still open | csv_rows for 1,216 licenses ran 2,432 queries (0.75 s on SQLite). It grows with the license count |
| LS-10 | Inconsistent error shape and message | Still open | validate on a site that is not activated returns 200 with "message" (other errors use "error"). site_url=javascript:alert(1) returns "license_key and site_url are required." |
| LS-11 | Order email subject "is on its way!" | Still open (subject re-run; renewal thank-you text not re-run) | Mails for orders 6781, 6782 and 6784: "Your order from SubtleForms is on its way!" |
| LS-12 | "478.0 B" sizes | Still open | Pro releases screen: "452.0 B", "464.0 B" (ls12-releases.png) |
| LS-13 | Paddle event skipped as stale | Still open | Real call of SFLS_Billing::sync_subscription. Activated event at 22:36:31 stored billing_synced_at 22:37:31 (the processing time). A past_due event at 22:37:01 returned "stale" and billing_status stayed active |
| LS-14 | Changelog as `<p>* item</p>` | Still open | update/check for 0.0.238 returns changelog "<p>* QA238 test</p>" |
| LS-15 | http return URL allowed on /connect-site/ | Still open | invalid_reason accepts site and return http://shop.realclient.com, and /connect-site/ with an http return goes on to login |
| LS-16 | Retention: logs never pruned, uninstall leftovers, key in URLs | Still open (code review plus observation) | No prune of sfls_activation_log (IP per row) or sfls_paddle_events. uninstall.php has no _sfls_paddle_customer_id user meta and no sfls_issue_lock_* or sfls_paddle_lock_* cleanup. Package URLs carry the full key (update/check output) |
| LS-17 | Reminders capped at 500 per window | Still open | 1,200 licenses expiring within 30 days: expiring_between returned 500, and `wp sfls remind --dry-run` reported "499 reminder(s) due" |
| LS-18 | No email when a license is issued by hand | Still open | Issue license form has no send-email option. "Issued: SFP-4846F53F-..." was shown and no mail was captured |

## 3. Pro compatibility with free 2.3.4 to 2.3.8

Form "QA238-pro-server compat" (8936, id 2294) has these fields: name, email, Hidden utm = {get:utm}, Chained Select (buttons), Date (picker), a text field with an advanced rule (date after 2026-12-01 OR utm in vip,press), number, Calculation, Signature, Consent, Picture Choice and Rating. It also has a signed webhook, a Mailchimp mapping (UTM, PLACE, VISIT), HubSpot properties, an HTML admin email and the PDF attachment. It was submitted in Chromium as a visitor on ?utm=vip.

| Free change | Pro module | Status | Evidence |
|---|---|---|---|
| Hidden field (2.3.7) | Webhook, Mailchimp, HubSpot, CRM note, email, PDF, Zapier | Works | Entry 5930: utm=vip. Webhook fields.utm vip, Mailchimp merge UTM vip, HubSpot utm_source vip, note row "Campaign vip", PDF row Campaign vip. The integration mapping lists the hidden field (integrationFields.js does not skip it). Zapier uses the same FieldMapper::answers |
| Hidden field in advanced logic | Logic module | Works | The "in vip,press" rule showed Late note on ?utm=vip and not on ?utm=none (browser) |
| Chained select, buttons layout (2.3.8) | Integrations, PDF, webhook | Partial | Values reach every destination, but as raw values: webhook ["pakistan","punjab"], Mailchimp PLACE and HubSpot "pakistan, punjab", PDF and email "pakistan, punjab" (PRO2-08). The same entry's Select shows its label |
| Chained select | Multilanguage | Broken | Level labels and choices are not registered (PRO2-05) |
| Custom date picker (2.3.4) | Advanced "after" rule | Works | With the picker set to 2026-12-05 the Late note appears. Stored as 2026-12-05 |
| Theme inheritance (2.3.5) | Signature, Calculation, Picture Choice | Works | Form class subtleforms--inherit-theme. Signature canvas is 696x160, the calculation shows "$ 0.00" and the picture cards render (theme-inherit-pro-fields.png) |
| Tools JSON export and import (2.3.6) | Webhook actions, integrations mapping, Pro fields | Partial | Export keeps Pro data: webhook with headers and signing secret, per-form integrations, Pro fields. Import on 8937 kept them. Import skips Pro's schema_before_save hook (PRO2-02) and Pro gating (PRO-10). An import of the Pro template event_registration failed with no reason ("could not be imported") |
| Tools export file | Webhook secrets | Observation | The JSON contains the form webhook signing secret ("form-secret-238") and custom headers such as Authorization in clear text. The Tools page does not say so |
| Submissions inbox reading pane (2.3.7) | Entry PDF, integration log, Retry and Send again | Works | Pane for entry 5930 shows PDF (GET returned 200 application/pdf), HubSpot, Mailchimp and Webhook rows with HTTP 200, and 3 Retry or Send again buttons (inbox-pane.png) |
| Reports page (2.3.6), "Views and conversion stay in Pro" | Analytics capability | Works, wrong copy | Pro supplies only the capability extensions.analytics. Free counts views and renders the data. With Agency: Form performance shows 5,932 views, 1,534 submissions, 25.9 percent, and per-day rows. The compat form row has 4 views and 1 submission. The page still says "Views and conversion are part of Pro" (PRO2-06) |
| Tools page, "CSV export is part of Pro" | CSV export | Wrong copy | Shown on Agency and white-labelled sites (PRO2-06) |
| Form settings vertical tabs (2.3.4) | Webhooks, integrations panels | Works | Form 2294's integrations and actions saved and ran. Builder panels mount through IntegrationsPanel and ActionsPanel |
| Settings screen | CRM portal ID | Broken | Settings cannot be saved with a portal ID (PRO2-01) |
| White label on the new pages (Tools, Reports) | Branding | Partial | The name and menu follow "Acme Forms". Tools still says "SubtleForms JSON" and "between SubtleForms sites". Upgrade copy is not hidden by hideUpgrade (PRO2-06) |
| Calculation with an empty input | PDF | Broken | The PDF shows "Total __formula_error__" (PRO2-07) |

### 3.1 Licensing on the clean client (8937)

| Item | Status | Evidence |
|---|---|---|
| Bad format, unknown, expired and suspended keys | Works (same messages as 2.3.3) | lic.php output |
| Starter, Pro, Agency and grace capabilities | Works: Starter 8 caps, Pro 14, Agency 16, grace keeps Pro | caps.php output |
| Unreachable under 48 h | Works: grace_period, grace_fallback, retry in 299 s | |
| Unreachable over 48 h | Works: lapsed. Visitors keep payments, fields.advanced and WooCommerce | |
| Site limit | Works ("already active on 1 site") | as-domain.php output |
| Revoked | Works except the label (PRO-14) | |
| Update check | Works: 9.2.0 offered on the Plugins screen | |
| Uninstall frees the slot | Works | activation count 1 to 0 |

### 3.2 Plugin Check on Pro

The run used Plugin Check 2.1.0 on the release-like copy, with `wp plugin check subtleforms-pro`. Output: /home/claude/work/qa238/pro-server/pcp-pro.csv. There are three findings, all in src/Licensing/Updater.php: ERROR plugin_updater_detected (site_transient_update_plugins), and WARNING update_modification_detected twice (pre_set_site_transient_update_plugins, _site_transient_update_plugins). This is the same as before and is expected for a plugin sold outside WordPress.org.

## 4. New bugs

| ID | Sev | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|
| PRO2-01 | P2 | Settings, Integrations, CRM: enter a HubSpot Portal ID (any real one, for example 4455 or 12345678). Then change anything on any Settings tab and save | Saves. Portal IDs are 6 to 9 digit numbers | 422 "Validation failed" for the whole Settings save. The banner does not name the field unless the CRM panel is open. The REST error is `ext_crm_portal_id: Maximum value is 100`, for both a string and a number. The shared sites already store 4455, so Settings cannot be saved there | dot-after-save.png. PUT /settings with "12345678" returns 422 | free src/Validation/Rules.php:232 applies "max" as a numeric limit to numeric strings, and src/Validation/Schemas.php:267 declares ext_crm_portal_id 'optional\|string\|max:100' |
| PRO2-02 | P3 | Export a form with a signed webhook (or edit the JSON so signing is on with an empty secret, as a hand-made or older export would have), import it in Tools, submit | Imported forms get a signing secret like forms saved in the builder, and run Pro's other save steps | The webhook is sent without X-SubtleForms-Signature (headers: Content-Type, X-QA, User-Agent, X-SubtleForms-Delivery). The Logic tidy and the WooCommerce product snapshot are skipped too | 8937 form 2, integration log request headers | free src/Tools/TransferService.php:128 and :182 call FormsRepository::saveSchemaVersion directly. The filter subtleforms/forms/schema_before_save is only applied in src/Api/FormsApi.php:641. Pro hooks: WebhookRequest::ensureSecrets, Logic tidySchema, ProductField::beforeSave |
| PRO2-03 | P3 | Activate key A on a production site, then activate key B on the same site (key form, or "Use a different key" on a lapsed license) | Key A's activation is released | Key A keeps qa-shop-one.com, so a Starter key stays "1 of 1 used" until the customer removes it in My Account | Server activations after the switch: license 129 still has qa-shop-one.com | pro src/Licensing/LicenseManager.php:252-311 activate() overwrites the stored key without calling deactivate() for the previous one |
| PRO2-04 | P3 | Form with a Signature and HubSpot "add note" on; submit | Note says "Signed" or links the entry, as free emails and CSV do since 2.3.3 | The note body contains the full data:image/png;base64 string. The body is cut at 65,000 characters, which can break the table HTML for large signatures | server-http.jsonl, POST /crm/v3/objects/notes | pro src/Modules/Integrations/Crm/HubSpot.php:128-145 prints FieldMapper::answers values as they are |
| PRO2-05 | P3 | Agency, Multilanguage on, form with a Chained Select | Level labels and choices are offered for translation | Multilanguage::collect for form 2294 registers "Place" but not "Country", "State", "Pakistan" or "Punjab" | collect() output (16 strings) | pro src/Modules/Branding/Multilanguage.php:307-381 walks `options` only, not `levels[].label` or `levels[].options` |
| PRO2-06 | P3 | Agency (or white label with "Hide credits") open Reports and Tools | No upgrade copy when licensed or when upgrade prompts are hidden; the white-label name | Reports: "How many people send a form. Views and conversion are part of Pro." and the panel line "Views and conversion are part of Pro." Tools: "CSV export is part of Pro.", "Export is SubtleForms JSON", "between SubtleForms sites" | wl-reports.png, wl-tools.png, reports-agency.png | free resources/admin/pages/ReportsPage.jsx:58 and :97 and ToolsPage.jsx:301 are static strings with no capability or getBranding() check |
| PRO2-07 | P3 | Calculation "{qty} * 12.5", submit with qty empty, open the PDF | Empty or a dash | "Total __formula_error__" in the PDF. The same value is stored in the entry and sent to webhooks | entry-uni.pdf, entries 5931 and 5935 payload | free src/Engine/Formula.php:34 marker stored as the answer. Pro EntryPdf prints it |
| PRO2-08 | P3 | Chained Select with labels Pakistan and Punjab, values pakistan and punjab; submit with Mailchimp, HubSpot, PDF and email | Labels, as Select fields get ("Gold plan") | "pakistan, punjab" in Mailchimp PLACE, HubSpot place, the HubSpot note, the PDF and the HTML email | server-http.jsonl, pdf-5930-1.png, server-mail.jsonl | free src/Support/FieldMapper.php answers() does not map chained values to their level labels |

### 4.1 Cross-area notes (for other auditors, not counted above)

- The shipped free build is older than the last source commit. free-dist/build/frontend/frontend.js is dated 01:36, and commit bbf5871 "announce them as radios" is from 02:17. The live chained buttons render aria-pressed, not role radio or aria-checked, and two elements share id "subtleforms-field-place-label" (s-dom.js output).
- The shared sites store ext_crm_portal_id 4455, so Settings saves fail there for everyone (PRO2-01).

### 4.2 Server data on the shared site

The release rows on 8932 (copied to 8936) point to random nested files such as d40cf24c4ed00388/3881...zip, and an option sfls_random_names exists. That data was written by a server build that was not shipped. Shipped 1.6.0 reads only basenames, so has_package() is false for 9.2.0. The admin shows "Customers cannot download Pro yet", while update/check still offers 9.2.0 with a package URL that /update/package answers with 404 no_package.

### 4.3 Server uninstall and leftover cron

A cron hook subtleforms_pro_license_refresh exists on the shared site data. Neither Pro 2.3.3 nor free 2.3.8 registers it, so it is a leftover from another build.

## 5. Missing features (updated)

Compared with Gravity Forms add-ons, WPForms Elite, Fluent Forms Pro, Formidable, Forminator Pro, EDD Software Licensing, Freemius and Lemon Squeezy.

| Feature | Priority | Plan / component | Reason |
|---|---|---|---|
| Google Sheets integration | Must | Pro | The most requested form integration. Still absent |
| PayPal | Must | Starter | Every competitor at this price offers it |
| Recurring payments and subscriptions | Must | Pro | Payment buyers expect it |
| Save and resume | Must | Starter | Standard in Gravity, WPForms and Fluent |
| GDPR exporter and eraser for Pro integration logs and server licenses, activations and IPs | Must | Pro and License Server | PRO-07 and LS-16. Personal data outlives the entry |
| Verified license ownership and guest download access | Must | License Server | LS-01, LS-02 |
| Refund handling for renewals and upgrades | Must | License Server | LS-03 |
| Slack notifications | Should | Pro | Common Pro add-on |
| ActiveCampaign, MailerLite, GetResponse, Constant Contact | Should | Pro | Only Mailchimp, Brevo and Kit today |
| Salesforce, Zoho, Pipedrive | Should | Pro or Agency | HubSpot only |
| Per-form email marketing provider and Brevo and Kit double opt-in | Should | Pro | One global provider (PRO-21) |
| Alert email when an integration finally fails | Should | Pro | Failures only show in the log |
| User registration, post creation, partial entries | Should | Pro | Competitor parity |
| Quiz scoring and survey reports | Should | Pro | Quiz templates have no scoring |
| PDF for the submitter, custom templates, RTL and CJK fonts | Should | Starter | PRO-05 |
| Multisite network license | Should | Agency | Per-site only |
| White label completeness (Plugins list, emails, notices, PDF, block title, Tools and Reports copy) | Should | Agency | PRO-24, PRO2-06 |
| White label and agency client management on subtleforms.com | Should | Agency and License Server | Asked by the owner. See section 7 |
| Role manager | Should | Pro | manage_options everywhere |
| Translation of chained choices | Should | Agency | PRO2-05 |
| Bulk actions, audit log, license transfer, downgrades, email customisation, invoices, MRR analytics, outgoing webhooks | Should | License Server | Unchanged since the last audit |
| Make and n8n apps, Notion, Airtable, Twilio, geolocation | Nice | Pro | |
| Team seats and per-customer API keys | Nice | License Server | Part of section 7 |

Dropped from the list: "Form analytics reports". Reports now shows views and conversion when licensed.

## 6. Not tested and why

- PRO-04 with real Polylang or WPML: these plugins are not installed anywhere, and downloads.wordpress.org is blocked by the proxy (403). I re-checked the code and the browser request instead.
- Live provider APIs (Mailchimp, Kit, HubSpot, Zapier), Stripe and WooCommerce checkout: no network access, and payments belong to the payments auditor. Requests were captured and mocked.
- Paddle through the real API: only the sync path was called directly with crafted events (LS-13).
- Real HTTPS update download: the 9.2.0 package on this data cannot be served by 1.6.0 (section 4.2). The 0.0.238 test release was published and unpinned again.
- LS-11, renewal thank-you page text: not re-run. The email subject was re-run.
- PRO-15, Zapier option: it was not created in this run.
- Server uninstall with "Delete all": not run. Code reviewed.

## 7. Branding and agency management: current state

### 7.1 Every branding setting Pro has today

Storage: one site option, `subtleforms_pro_branding` (autoload off). It is read by Module::settings() at pro src/Modules/Branding/Module.php:77-89 and written by POST /subtleforms/v1/pro/branding at Module.php:216-246 (manage_options, owner check at :201-203). The module only registers when the license is valid and has the `white_label` feature (Module.php:50-68). On a lapsed license, white label switches off, and LapsePolicy lists it as paused (pro src/Licensing/LapsePolicy.php:126).

| Setting (option key) | Values | Where it is applied |
|---|---|---|
| name | text, at most 60 characters (Module.php:235) | Module.php:122-125 sets branding.name and menuName. Free src/Admin/AdminMenu.php:157-160 (wp-admin menu label), :406 (localized to JS), :604-620 (filter and clean), :1220 (admin page title). JS: resources/admin/components/AppNav.jsx:89 (nav aria-label), ui/Logo.jsx:22-39 (wordmark), app/AdminApp.jsx:188 (document title), pages/DashboardPage.jsx:365 (system status row), components/OnboardingWizard.jsx:251, :267 |
| logo_id | Media Library image ID (must be an image, Module.php:221-231) | Module.php:126-131 makes branding.logoUrl. Applied in ui/Logo.jsx:25-30 |
| hide_credits | bool | Module.php:132-136 sets hideCredits, hideHelp and hideUpgrade together. hideCredits: HelpMenu.jsx:57, TopBarUtilities.jsx:91-140 (credits, version). hideUpgrade: TopBarUtilities.jsx:23 (plan chip), licensing/ProBadge.jsx:31, ui/UpgradeModal.jsx:234, ui/UpgradePrompt.jsx:45. hideHelp: TopBarUtilities.jsx:24 |
| support_url | http, https or mailto (Module.php:96-99) | Module.php:137-141 sets supportUrl and keeps the Help menu. utils/branding.js:22-24, TopBarUtilities.jsx:124, PageErrorBoundary.jsx:253 |
| restrict | bool | Module.php:142 sets showLicense. Used by pages/SettingsPage.jsx:92 (hides the License and Branding tabs) and Module.php:273-289 (403 on /subtleforms/v1/license* and /account* for other admins), :201-203 (branding REST) |
| owner | user ID, set to whoever turns restrict on (Module.php:241) | Module.php:104-110 currentUserIsOwner() |

The free screen is resources/admin/components/settings/BrandingSettings.jsx:17, which mounts window.SubtleFormsPro.BrandingSettings (pro resources/admin/index.jsx). The free default values are at src/Admin/AdminMenu.php:571-620 and utils/branding.js:7-17.

Not covered by white label today:

- Plugins screen name and description (plugin headers).
- Expiry and notice email subjects: pro src/Licensing/LicenseScheduler.php:360, LicenseScheduler notices at :93-111.
- PDF header: site logo from the theme custom_logo and the site name, EntryPdf.php:192-210, :256; Creator metadata "SubtleForms Pro", EntryPdf.php:89.
- Webhook User-Agent "SubtleForms Pro/x", WebhookRequest.php:75.
- Block title "SubtleForms" (build/blocks/form/block.json).
- Tools and Reports copy (PRO2-06).

Multilanguage (WPML and Polylang) rides on the same `white_label` feature (PlanCapabilities.php:56).

### 7.2 How the Pro client talks to the license server today

Base URL: `https://subtleforms.com/wp-json/sfls/v1/`. It can be overridden with the constant SUBTLEFORMS_LICENSE_API or the filter subtleforms_pro/license_api_url (pro src/API/Client.php:33, :143-146). The store URL is derived from it (Client.php:134-139). Transport: JSON POST or GET query, 15 s timeout, 2 retries with 0.5 s and 1 s pauses (Client.php:34-36, :198-232). 429, 5xx and non-JSON answers count as "unreachable" (Client.php:247-272). Requests are not signed or authenticated beyond the key.

| Call | Endpoint and payload | When |
|---|---|---|
| Activate | POST license/activate {license_key, site_url: "https://" + host}. No version is sent (PRO-19) | Key entered (LicenseManager.php:281) |
| Validate | POST license/validate {license_key, site_url} | Any request (admin or visitor) once next_check has passed, under a 60 s lock (LicenseManager.php:193-211). Also the daily cron subtleforms_pro_daily_license_check with force (LicenseScheduler.php:37-43, :60-67) |
| Deactivate | POST license/deactivate {license_key, site_url} | Deactivate button (LicenseManager.php:313-326). Uninstall, as a non-blocking POST (uninstall.php:43) |
| Status | GET license/status | Wrapper exists (Client.php:94, LicenseValidator.php:85). No caller found |
| Update check | GET update/check ?license_key&site_url&version&slug. Package via update/package then a signed update/download | pre_set_site_transient_update_plugins. Cached in site transient subtleforms_pro_update_info for 12 h, or 1 h when there is no version (Updater.php:23-24, :126-142) |
| Account connect | Browser to {store}/connect-site/?site&return&state, then POST connect/exchange {code, site_url} | Connect button (AccountConnect.php:62-77, :87-145). Stores option subtleforms_pro_account {email, name} |

What the server already sends down (SFLS_Licenses::payload, server includes/class-sfls-licenses.php:616-641; activate adds `activated`, exchange adds `license_key` and `account`):

- valid, status (valid, grace_period, expired, suspended), reason on failure
- plan, features (slugs from SFLS_Plans, class-sfls-plans.php:22-47, filterable with sfls_plans)
- expires_at, grace_period_ends_at
- sites_allowed, sites_used, is_local
- check_again_in (12 h)
- billing, billing_status, trial, trial_ends_at, renews_at, cancels_at, renewal_amount, manage_url

Client caching:

- Option subtleforms_license_data holds the whole normalised answer plus checked_at, last_valid_at and next_check. The TTL is capped at 12 h (LicenseManager.php:461-491).
- Features are also cached in the transient subtleforms_pro_features_{md5(key)} for 6 h (:227-242).
- When unreachable, the last state is kept for 48 h as grace_period with grace_fallback, with a retry every 5 minutes or Retry-After (:561-582).
- Plan to capability mapping is local (pro src/Licensing/PlanCapabilities.php:28-56), so new feature slugs from the server need a Pro update to mean anything.
- No signature or integrity check exists on any answer.

### 7.3 What the server's My Account offers today

WooCommerce My Account endpoints (server includes/class-sfls-account.php):

- **Licenses** (:248-283, card :285-436). Per license: plan and status pill, full key with Copy, Download Pro, Renew, Upgrade buttons with a prorated price, Paddle billing panel (payment method, cancel, resume, change plan, :492-620), term or expiry, "Sites x / y", purchase date with order link, and connected sites with last seen, Pro version, a "Staging, free" tag and Deactivate (:623-647).
- **Pro downloads** (:649-800), with signed one-time links.
- **Dashboard tiles** (:802-853): active licenses, next renewal, latest Pro version.
- **Connect-site picker** (class-sfls-connect.php:182-230, :471-560): the signed-in customer picks one of their licenses for the site. The server stores a one-time code in a transient for 10 minutes (CODE_TTL, :22).

Nothing in My Account for branding, settings that flow to sites, notes per site, other users, or client sites.

### 7.4 Data model on the server

All tables are listed in server includes/class-sfls-db.php:98-257 (schema 5).

- wp_sfls_licenses: id, license_key (unique), plan, status (active, suspended, refunded), sites_allowed (0 is unlimited), customer_email, user_id, order_id, product_id, notes, reminders, expires_at, created_at, updated_at, billing, billing_status, trial, trial_started_at, trial_ends_at, renews_at, cancels_at, billing_amount, billing_currency, paddle_customer_id, paddle_subscription_id, paddle_price_id, paddle_transaction_id, checkout_token_hash, billing_synced_at.
- wp_sfls_activations: id, license_id, domain (unique per license), is_local, plugin_version, activated_at, last_seen_at.
- wp_sfls_activation_log: license_id, domain, event, source, ip, created_at.
- Other tables: wp_sfls_download_tokens, wp_sfls_trial_claims, wp_sfls_paddle_events, wp_sfls_releases, wp_sfls_github_deliveries.
- Users are plain WordPress or WooCommerce customers. Ownership is user_id OR customer_email (class-sfls-licenses.php:210-234, see LS-01).
- No table or meta exists for: per-license settings, branding, sub-users or teams, client sites as entities (beyond the activation domain string), or per-site settings.

### 7.5 Gaps to build for server-managed branding and agency management

1. **Storage.** A per-license (or per-account) branding profile on the server: name, logo file stored on subtleforms.com rather than a site Media ID, hide credits, support URL, restrict. This means a new table (for example sfls_license_settings keyed by license_id) or license meta, plus logo upload and storage.
2. **My Account UI.** A Branding screen for Agency licenses only, with the form, a logo upload and a preview. Optionally a per-site override keyed by activation, because today an activation is only a domain row.
3. **Delivery to sites.** Either add a `branding` block to SFLS_Licenses::payload(), so it arrives on activate, validate and exchange, or add a new GET endpoint (for example branding/get?license_key&site_url). The payload builder is class-sfls-licenses.php:616-641 and the REST routes are class-sfls-rest.php:42-54. Pro needs new client code to read it: LicenseManager::buildDataFromResponse (LicenseManager.php:461-491) drops unknown keys today. Branding\Module::settings() must also prefer the server profile over the site option, or merge the two.
4. **Logo delivery.** Sites cannot use a Media Library ID from another site. The server must serve a logo URL (public CDN path or signed URL), or Pro must download and cache the image locally.
5. **Server down.** The answers are not signed today. A signed branding blob (for example an HMAC or Ed25519 signature with a key shipped in Pro) would stop a local edit of the cached option from forging branding or plan data. Pro should cache the last good profile (inside subtleforms_license_data or a separate option), keep it within the 48 h fallback (LicenseManager.php:561-582) or longer for branding, and decide what to show when the license lapses. Today white label switches off on lapse (LapsePolicy.php:126).
6. **Refresh timing.** Branding would change at the next validate (up to 12 h) or the daily cron. Instant updates need either a "refresh now" button on the site, which already exists as POST /subtleforms/v1/license/validate in Pro LicenseApi, or a push from the server to the site, which needs a site-side endpoint plus authentication, and nothing like that exists.
7. **Restrict and owner.** "Only I can see License and Branding" is per WordPress user on the site (owner user ID). Moved to the server, it needs a site-side notion of which local user is the agency, or a rule such as "branding is read-only on the site when managed on the server".
8. **Agency client management.** The server needs entities that do not exist:
   - Client or sub-account records under an agency account.
   - Invitations and team seats (users other than the buyer acting on a license, which ownership by user_id and email cannot express).
   - Assigning activations or sites to a client.
   - Per-client branding profiles.
   - Client-facing views (a client sees only their sites).
   - Possibly separate keys per client site, to revoke one client without touching others. Today one Agency key is shared by every site, and any site holding it can deactivate other sites only through My Account.
9. **Ownership hardening first.** LS-01 (licenses matched by email) must be fixed before giving agencies multi-user control, or an email change would also hand over client branding and sites.
10. **Plan gating.** `white_label` is the only flag (PlanCapabilities.php:56, SFLS_Plans agency features). Separate flags for server-managed branding and client management would need new slugs on both sides and a Pro update, because Pro maps slugs locally.
11. **Remaining white-label surfaces.** These stay site-side whatever the source of the settings (section 7.1 list): Plugins screen, emails, PDF, notices and the block title.
