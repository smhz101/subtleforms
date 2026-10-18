# QA audit: SubtleForms License Server 1.6.0

Auditor area: license-server. Site: http://localhost:8899 (WooCommerce 10.2.1, theme subtleforms-site, SQLite). Date: 2026-10-14.
Scratch scripts and raw outputs: /home/claude/work/qa/license-server/. Screenshots: /home/claude/shots/qa/license-server/ (admin screens in admin/ and adm2/).

## 1. Summary

The core machinery is solid and well tested: the PHPUnit suite passes (162 tests, 1438 assertions), Plugin Check reports no errors, and every REST endpoint, signed download, release upload, Paddle webhook and GitHub webhook check I ran by hand behaved as documented. The guest checkout works, a completed order issues a key and puts it in the email and on the order received page, and upgrades with proration, renewals, deactivation from My Account and the connect-site flow all work end to end.

Top problems:
1. Security (P1): license ownership is decided by email, and WooCommerce lets any signed-in customer change their account email without verification. Changing it to a guest buyer's address shows that buyer's keys, download buttons, deactivate and upgrade actions (LS-01).
2. Guest buyers cannot download Pro (P1 on this configuration): checkout does not create an account, registration is off, and the Download Pro link in the email and on the thank-you page leads to a login form the buyer has no credentials for (LS-02).
3. Refunding or cancelling a renewal or upgrade order leaves the extra year or the bigger plan in place (LS-03).
4. Renewal products can be bought as new licenses at the renewal price with ?sfls_buy (LS-04), and the pricing page promises "30% off: $34, $69 or $139" while the renewal products cost $39, $79 and $159 (LS-05).
5. The per-key rate limit can be used to lock a customer out, and the local-site rules give free seats to production hosts such as *.wpengine.com (LS-06, LS-07).
6. No GDPR exporter or eraser, no audit log for admin changes, no bulk actions, no customer-facing invoices, no grace setting, no license transfer UI (section 4).

## 2. Inventory and status

### 2.1 Selling flow (WooCommerce, other gateways)

| Item | Status | Evidence |
|---|---|---|
| License products (Starter, Pro, Agency; yearly, renewal, lifetime) created by the Products wizard, sold individually, renewal products hidden | Works | admin/sfls-products.png; wp eval output (3001 to 3006, 3018 to 3020, sold_individually true) |
| Pricing page with Yearly / Lifetime toggle and Buy buttons to checkout | Works (content defect LS-05) | 01-pricing.png |
| ?sfls_buy puts one plan in cart and opens checkout | Works | buy.js output, 02-checkout.png |
| Simple checkout (email, country, first and last name only) | Works | 02-checkout.png, labels printed by buy.js |
| Guest order with cheque, on-hold, then Completed issues one key, order note | Works | order 6408, notes "1 SubtleForms license key issued." |
| Quantity 3 issues 3 keys | Works | order 6427, 3 keys |
| Key on order received page with Copy, Download Pro, Manage licenses, install steps | Works | 05-order-received-completed.png |
| Completed email contains the key, plan, renewal date and install steps | Works (subject copy LS-11) | mails.log |
| Guest buyer can reach downloads | Broken | LS-02, 06-guest-downloads.png |
| My Account Dashboard, Licenses, Pro downloads, nav without Addresses and Downloads | Works | 07-dashboard.png, 08-licenses.png, 09-downloads.png |
| Download zip from My Account (signed one-time link) | Works | acct2.js: subtleforms-pro-2.2.0.zip downloaded |
| Deactivate a site from My Account | Works | 12-after-deactivate.png, activity log on edit screen |
| Upgrade Starter to Pro with proration ($50.00, $49 credit, same key, same expiry) | Works | 13-upgrade-checkout.png, order 6415 note |
| Renew from My Account (renewal product $79, adds 12 months to current expiry) | Works | order 6422, expiry 2027-10-14 to 2028-10-14 |
| Refund of a new-license order suspends the key | Works | Paddle refund test (license suspended); woo path covered by PHPUnit |
| Refund or cancel of renewal or upgrade order | Broken | LS-03 |
| Cart one plan at a time, Change plan link | Works | PHPUnit CartTest; Change plan link visible in 02-checkout.png |

### 2.2 Paddle Billing and Pay with Paddle gateway (Paddle not reachable)

| Item | Status | Evidence |
|---|---|---|
| Gateway registered (sfls_paddle), hidden when Paddle not configured, mode falls back to WooCommerce | Works | wp eval: sfls_paddle enabled but not available, woo_selling false |
| Webhook without secret answers 503 | Works | wh tests |
| Missing, wrong, stale signature answer 401 | Works | malformed_signature, bad_signature, stale_signature |
| Signed transaction.completed completes the Woo order, adds Paddle tax as fee, sets "Paddle (Visa ending 4242)", issues key | Works | order 6431: completed, total 108.90 |
| Replay of the same event_id ignored | Works | {"duplicate":true} |
| subscription.activated links license to subscription (billing paddle, renews_at, expiry +3 days) | Works | license 1765 output |
| subscription.past_due sends "Payment failed" email | Works | mails.log |
| subscription.canceled sends "Auto-renew is off" email, keeps paid expiry | Works | mails.log, license output |
| adjustment.updated (approved full refund) records Woo refund and suspends license | Works | order refunded 108.90, license suspended |
| Out-of-order events skipped | Partial | LS-13 |
| Trial eligibility rules (email, company domain, plus-addressing, gmail dots, googlemail) | Works | Trials::check output |
| /paddle/eligibility endpoint | Works (answers "unavailable" because Paddle is not configured here) | curl output |
| Inline Paddle checkout, real charges, trials, renewals, upgrades through Paddle API, refunds through Paddle API | Not testable here | Needs Paddle sandbox; PHPUnit PaddleWooGatewayTest and PaddleBillingTest cover them with mocked HTTP and pass |

### 2.3 License REST API sfls/v1

| Item | Status | Evidence |
|---|---|---|
| activate, validate, status, deactivate | Works | api1.out |
| Domain normalisation: www, https, path, case, port, lowercase key, spaces, JSON body | Works | api1.out |
| Site limit (Starter 1) and freeing a slot | Works | activation_limit 400, then success after deactivate |
| Staging, localhost, *.local free | Works | is_local true |
| Production hosts treated as local | Broken | LS-07 |
| Multisite: subdirectory sites share one seat (path dropped), subdomain sites each take a seat | Works as designed, no network concept | api1.out |
| Error messages | Partial | LS-10 |
| update/check, update/versions, update/package (302 to signed link) | Works | api1.out |
| update/download: single use, tampered sig, version, site or expires refused | Works | download tests |
| Expired license cutoff (only versions released before expiry, no latest, no activation) | Works | expired key tests |
| Beta channel, yanked beta falls back to stable, pin and unpin | Works | pin test |
| Rate limiting 429 with Retry-After per IP and per key | Works, with design problem LS-06 | rate limit test with temporary filter |
| update/check and update/download not rate limited | Partial | 7 of 7 requests passed; low risk |
| Dev keys SF-DEV-* | Works as documented: handled by Pro on local sites, the server answers license_not_found | api1.out |

### 2.4 Connect-site flow

| Item | Status | Evidence |
|---|---|---|
| Signed-out visitor sent to login and back | Works | 20-connect-signedout.png, URL output |
| License picker shows site, version, plan, usage | Works | 21-connect-pick.png |
| Connect redirects to return with sfls_code and state | Works | captured URL |
| Exchange returns key and payload, www variant accepted, code single use | Works | curl output |
| Return host different from site refused | Works | 22-connect-badreturn.png |
| http return allowed | Partial | LS-15 |

### 2.5 Releases 1.6.0

| Item | Status | Evidence |
|---|---|---|
| Real curl multipart upload with deploy token (tiny zip with subtleforms-pro/subtleforms-pro.php, Version 0.0.1) | Works | 201 created, then 200 existing on re-run |
| Missing token, bad token, token in query string | Works (401) | curl output |
| sha256 mismatch, bad layout, not a zip | Works (422) | curl output |
| Beta version with hyphen goes to beta channel | Works | 9.0.0-beta.1 channel beta |
| Publish and yank through API (?rest_route form needed on PHP built-in server, documented) | Works | curl output |
| Admin Pro releases screen with stats, sources, versions on sites | Works (cosmetic LS-12) | admin/sfls-release.png |
| WP-CLI release list, latest (pin), unpin, delete, token create and list | Works | outputs |
| GitHub webhook: 503 without secret, ping ok, bad signature 401, release without asset fails with reason, other repo ignored, draft ignored | Works | gh tests with temporary option filter |
| GitHub asset download | Not testable here | outbound HTTP blocked; ReleaseApiTest and GitHubWebhookTest mock it and pass |
| Direct access to zips blocked | Partial | LS-08 |

### 2.6 Admin, CLI, emails, blocks

| Item | Status | Evidence |
|---|---|---|
| Licenses list, overview cards, status filters, plan filter, search by key, email and domain, pagination | Works | admin/sfls.png, sfls_s_shop-qa.png |
| Bulk actions | Missing | no bulk UI (section 4) |
| Issue license (count, plan, notes) | Works | 4 keys issued by form |
| Edit license, save sites, regenerate key, suspend row action | Works | adm2/31-saved.png, 32-regenerated.png, 33-suspended.png |
| CSV export with formula neutralising | Works (slow, LS-09) | export.csv |
| Settings tabs General, Paddle, Releases | Works | admin/sfls-settings*.png |
| Nonces and capability checks on every admin_post handler and My Account action | Works | code review: guard() then check_admin_referer on all handlers; bad nonce 403 on export |
| WP-CLI: create, list, remind, release, token | Works | outputs |
| Renewal reminders (30, 7 days, expired) once per stage | Works | 3 reminders sent, second run 0 |
| Blocks and shortcodes: pricing (yearly and lifetime, popular, renewal note), changelog, latest version, downloads (signed-out sign-in prompt) | Works | 01-pricing.png, changelog page, do_shortcode output |
| GDPR exporter and eraser | Missing | not registered (section 4) |
| Uninstall | Not run | it would delete shared data; code reviewed, see LS-16 |
| Migration 1.3 schema to schema 5 | Works | mig.php: 1.3 tables with 2 rows upgraded under a temporary table prefix, billing backfilled woocommerce and manual, new tables created, then dropped |
| Performance with 10,000 licenses | Works (CSV slow) | list 1.8 s first page, 1.3 s page 400, search 0.5 s, validate 0.25 to 0.44 s, update/check 0.55 s, CSV 17.5 s |
| PHPUnit | Works | 162 tests, 1438 assertions, OK (phpunit.txt) |
| Plugin Check | Works | "No errors found" (pcp.txt) |

## 3. Bugs

| ID | Sev | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|
| LS-01 | P1 | 1. A guest buys a license as victim@x (no account). 2. Any other signed-in customer opens My Account > Account details and changes the email to victim@x (no password or confirmation needed). 3. Open My Account > Licenses. | Licenses only visible to the verified owner. | The victim's key is shown in full, with Download, Renew, Upgrade and Deactivate. Reproduced: qa-ls-buyer changed email to the renewal-loophole buyer's address and saw key SFP-398C250F-... | takeover.js output, 24-takeover-licenses.png | SFLS_Licenses::user_owns() and for_user() match customer_email (includes/class-sfls-licenses.php:210-234); the connect flow and downloads rely on it. Link licenses to user_id at checkout or on a verified email claim, and do not match by email for accounts whose email changed after the order. |
| LS-02 | P1 | Signed out, buy Starter with cheque, admin completes the order, click Download Pro in the email or on the thank-you page. | Buyer can download Pro. | Login form only; no account was created at checkout and registration is off (woocommerce_enable_signup_and_login_from_checkout=no, woocommerce_enable_myaccount_registration=no). The buyer has a key but no way to get the zip. | 06-guest-downloads.png | The plugin does not force account creation for license carts (no woocommerce_checkout_registration_required filter in includes/). Either require an account for license orders or give guests a signed download link in the email. |
| LS-03 | P2 | Upgrade Starter to Pro (order 6415, $50), complete, then refund it in full. Separately renew (order 6422, $79), complete, refund. | Upgrade reverted to Starter; renewal year removed. | Order refunded, license still Pro with 5 sites; renewal expiry still 2028-10-14. | command output in this session (refund tests) | SFLS_Woo::suspend_for_order() only touches licenses whose order_id equals the refunded order (includes/class-sfls-woo.php, suspend_for_order). Renewal and upgrade orders reference the license through _sfls_license_ids only. |
| LS-04 | P2 | Signed out, open /?sfls_buy=3004 (Starter Renewal, $39) and check out. | Renewal products only for existing license holders. | Cart accepts it (302 to checkout) and completion issues a new Starter key for $39 instead of $49. | order 6426 output "NEW KEY plan=starter" | handle_cart_links()/buy() accept any license product; issue_for_order() falls back to create() when renewable_license() finds nothing (includes/class-sfls-woo.php). |
| LS-05 | P2 | Open /pricing/. | Renewal note matches renewal prices. | Note says "Renew at 30% off: $34, $69 or $139"; renewal products are $39, $79, $159 (about 20%). The theme demo content repeats "30% off". | 01-pricing.png; page 1003 content; theme demo/subtleforms-demo-content.xml:1178, 1694, 2377 | Hard coded text in the page, not computed from products. |
| LS-06 | P2 | Send 5 validate requests for one key from 5 different IPs with a limit of 5 (temporary filter), then a 6th from a new IP. | A new IP with a valid key is served. | 429 with Retry-After for every IP: anyone who knows a key (former contractor, leaked in a support ticket) can keep the license from validating and updating. With the default 30 per 10 minutes per key, an Agency license on many sites updating at the same time also hits 429 on /update/package. | rate limit test output | limit_license_request() applies a per-key bucket to all callers (includes/class-sfls-rest.php). Count only failures per key, or key plus domain, and scale with sites_allowed. |
| LS-07 | P2 | Starter key already on 1 site; activate myshop.wpengine.com, dev.realclient.com. | Production hosts use a seat. | Both activated with is_local true and no seat used. *.wpengine.com is the WP Engine production primary domain; *.kinsta.cloud is used for live sites; "dev." and "test." prefixes and a substring test (".wpengine.com" anywhere in the host) are easy to abuse. | api1.out | is_local_domain() (includes/class-sfls-licenses.php:495-506). Use WP Engine "stg"/"dev" install patterns, exact suffix matches, and an admin setting for the list. |
| LS-08 | P2 | Request http://localhost:8899/wp-content/uploads/sfls-private/subtleforms-pro-2.2.0.zip without auth. | 403. | 200 and the zip. Protection depends on .htaccess (Apache) or a hand-added Nginx rule; file names are predictable. | curl "direct zip: 200" | Releases are stored as subtleforms-pro-<version>.zip. Store under a random file name (or outside the web root) so a missing server rule does not leak Pro. |
| LS-09 | P3 | Export 10,000 licenses as CSV. | A few seconds. | 17.5 s (two extra queries per license); larger stores will time out. | export output | csv_rows() calls activations() and used_slots() per row (includes/class-sfls-licenses.php:767-787). |
| LS-10 | P3 | validate on a site that is not activated; activate with site_url=javascript:alert(1). | Same error shape everywhere and a specific message. | Not-activated answer is HTTP 200 with "message" while other errors use "error"; a bad site_url says "license_key and site_url are required." | api1.out | class-sfls-rest.php validate() and resolve(). |
| LS-11 | P3 | Complete a license order; place a renewal order. | Copy fits a digital license. | WooCommerce default subject "Your order from SubtleForms is on its way!"; renewal thank-you page says "Your license key appears here as soon as your payment is confirmed." | mails.log, 16-renew-received.png | Delivery panel copy does not distinguish renewals; completed email subject not filtered for license-only orders. |
| LS-12 | P3 | Open Licenses > Pro releases. | "478 B". | "478.0 B" for every size under 1 KB. | admin/sfls-release.png | size formatting with one decimal for bytes. |
| LS-13 | P3 | Link an order to a subscription (subscription.activated), then send subscription.past_due whose occurred_at is later than the activated event but earlier than the moment the link was processed. | Applied. | Skipped as "stale". | sub2 and sub3 first run returned "stale" | link_licenses() sets billing_synced_at to current_time() instead of the event's occurred_at (includes/class-sfls-woo-paddle-orders.php:506). |
| LS-14 | P3 | update/check changelog. | A list. | "<p>* Test upload release</p>" (bullets as text in the WordPress update modal). | api1.out | update_check() uses wpautop(esc_html()) (includes/class-sfls-rest.php). |
| LS-15 | P3 | /connect-site/ with return=http://... | https only outside local sites. | http accepted, so the one-time code travels in clear text. | invalid_reason() code review, includes/class-sfls-connect.php | scheme check allows http. |
| LS-16 | P3 | Review data retention. | IPs and payloads pruned or erasable. | Activation log (IP per event) and wp_sfls_paddle_events are never pruned; uninstall leaves user meta _sfls_paddle_customer_id and stale lock options sfls_issue_lock_*, sfls_paddle_lock_*. Full license keys appear in download URLs (server access logs). | code review | uninstall.php, class-sfls-releases.php signed_url(). |
| LS-17 | P3 | Run `wp sfls remind --dry-run` with 10,000 licenses (1,000 expiring within 30 days). | All due reminders sent. | "499 reminder(s) due": capped at 500 rows per window, the rest go out on later days. | remind output | expiring_between() LIMIT 500 (includes/class-sfls-licenses.php:836). |
| LS-18 | P3 | Issue a license by hand for a customer email. | Option to email the key. | No email is sent and there is no option to send one. | mails.log has no entry for qa-ls-issued | page_new / handle_create. |

Notes from code review not reproduced: a refunded order set back to Completed does not reactivate its keys (_sfls_issued is already yes), and a lifetime license upgraded with a yearly product (when the target plan has no lifetime product) keeps a null expiry in apply_upgrade(). I could not force the second case through the products option, so treat it as unverified.

## 4. Missing features (compared with EDD Software Licensing and Recurring, Freemius, Lemon Squeezy and Paddle based servers, WooCommerce Software Add-on, License Manager for WooCommerce)

| Feature | Priority | Notes |
|---|---|---|
| GDPR personal data exporter and eraser for licenses, activations (IPs), trial claims, Paddle IDs | Must | WooCommerce and SubtleForms register theirs; this plugin registers none. |
| Verified ownership for licenses (account linked at purchase, email change does not move licenses) | Must | Fixes LS-01. |
| Guaranteed access for guest buyers (forced account or signed email download link) | Must | Fixes LS-02. |
| Refund handling for renewal and upgrade orders, plus partial refund rules | Must | LS-03. |
| Bulk actions on the licenses list (suspend, extend, delete, resend key, export selection) | Should | EDD, LMFWC have them. |
| Audit log for admin and billing changes (plan, sites, expiry, status, key regenerated, refunds, by whom) | Should | Today only activations and deactivations are logged. |
| Customer self-service license transfer to another account, and site transfer with history | Should | Deactivate exists; transferring ownership does not. |
| Downgrades (Agency to Pro) and plan change UI in admin | Should | Only upgrades exist. |
| Renewal discounts and coupons restricted to renewals; configurable grace period | Should | Renewal price is a fixed product; grace is a constant (14 days). |
| Email customisation (subjects, bodies, enable or disable each email, test send for every type) and resend key | Should | Only reminder test send exists. |
| Invoices or receipts as PDF from My Account (non-Paddle mode) and VAT number field | Should | Paddle mode relies on Paddle receipts; WooCommerce mode has none. |
| Analytics: MRR, renewals, churn, trial conversion, revenue per plan | Should | Only three overview cards. |
| Outgoing webhooks (license created, renewed, expired, refunded) for Zapier or a CRM | Should | Internal do_action hooks exist but nothing configurable. |
| Export and import of licenses (import from EDD, LMFWC, Freemius CSV) | Should | Export only. |
| Abuse detection (too many distinct domains per key over time, many activations from one IP, key sharing alerts) | Should | |
| Team or agency seats (invite teammates to manage an account's licenses) | Nice | Freemius and Lemon Squeezy offer it. |
| Multisite network license handling (count a network as one site or per subsite by setting) | Nice | Path is dropped, subdomains count separately. |
| Configurable staging allowance per plan and admin-editable local host list | Nice | Rules are hard coded (LS-07). |
| License key format options (prefix, length, segments) | Nice | Fixed SFP-XXXXXXXX x4. |
| API keys per customer for programmatic access to their licenses | Nice | |
| Telemetry or opt-in usage stats beyond plugin version per site | Nice | |
| Affiliate integration (AffiliateWP or Paddle affiliates) | Nice | |
| WP-CLI: suspend, extend, delete, deactivate site, show license | Nice | CLI can create and list only. |
| Admin notes per license with history | Nice | A single notes field exists. |

## 5. Not tested and why

- Paddle sandbox (not reachable). Ran here: signed fake webhooks against the live endpoint (signature, replay, completion, link, past due, cancel, refund) and the PHPUnit Paddle suites with mocked HTTP. Owner must run the 12 step "Sandbox test checklist" in README.md (sections 1 to 12), and in addition: refund an upgrade order and a renewal order and confirm what happens to the license (LS-03), and replay a subscription.updated that occurred just before a transaction.completed to see LS-13.
- Paddle inline checkout script (assets/js/sfls-paddle-inline.js) and Paddle.js: need the sandbox.
- GitHub asset download and Test connection: outbound HTTP to api.github.com is blocked here; covered by mocked tests. Owner: follow docs/CI.md Path 3 once with a real release.
- CI upload of the real 4.5 MB Pro zip: the site PHP upload limit is 2M (post_max_size 8M); only the tiny zip was uploaded. Owner: raise upload_max_filesize and post_max_size to at least 8M on the server and run the sample curl in docs/CI.md.
- Uninstall with "Delete all" ticked: not run because it drops shared tables; reviewed uninstall.php instead (LS-16).
- Migrations of the 1.4 and 1.5 options (sell_with, release options to table): not run on real old data; the 1.3 to schema 5 table migration was run under a temporary table prefix and PHPUnit covers the release option migration.
- Legacy Paddle overlay mode and /license-welcome/: needs Paddle configured.
- Real email delivery: sendmail is not installed; mail content was captured from the wp_mail filter.
- Real multisite install: only the domain normalisation for subdirectory and subdomain URLs was tested.

Cleanup: all QA orders, licenses (including the 10,000 perf licenses), the QA user, QA releases 0.0.1 and 9.0.0-beta.1 with their zips, the QA deploy token, QA Paddle events, GitHub deliveries and trial claims were deleted, and the temporary mu-plugins (qa-ls-mailcap, qa-ls-ratelimit, qa-ls-paddle) were removed. The admin Agency license and its connection were not touched. Pinning was set to 2.1.0 for a few seconds and unpinned.
