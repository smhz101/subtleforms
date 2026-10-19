# SubtleForms free 2.3.8: WordPress.org submission audit (area "wporg")

Site: http://localhost:8933 (/home/claude/wp/wporg), SQLite, WordPress 7.1.3, only the free plugin active (subtleforms 2.3.8 from /home/claude/work/v238/free-dist). SubtleForms Pro, the License Server and WooCommerce were deactivated. Release zip checked: /home/claude/work/v238/src/subtleforms/dist/subtleforms-2.3.8.zip (identical file list to free-dist). Audit only: no plugin code was changed.

Screenshots: /home/claude/shots/qa238/wporg/. Scripts: /home/claude/work/qa238/wporg/. Plugin Check output: /home/claude/work/qa238/wporg/pcp.csv. Corrected readme draft: /home/claude/work/qa238/wporg-readme.txt.

## 1. Summary

1. Not ready to submit. The free plugin ships complete code for seven features that it then locks behind Pro: CSV export, analytics reports, advanced conditional logic, Picture Choice, Signature and Calculation fields, payment fields and coupons, multiple files per upload, and the webhook and analytics settings. Pro 2.3.3 only flips capability flags (pro233/src/Licensing/PlanCapabilities.php:35-54). I proved it: a 3-line `subtleforms/capabilities` filter with Pro absent made CSV export and analytics return full data (WP2-01, WP2-02), and forms using the locked logic and fields work for visitors on free alone (WP2-03, WP2-04). This is exactly guideline 5 (trialware). It is the main reason a review would be rejected.
2. The AI assistant settings tab in free is fake. It cannot save (422 "Unknown field"), and "Test connection" always says "Connection successful! AI services are ready." after a timer (WP2-08). That is misleading under guideline 9.
3. Upsell wording says the user's own data is "trapped" and that "locked fields and actions light up the moment your license is active" (WP2-09). Guideline 9 lists "implying users must pay to unlock included features" as dishonest.
4. readme.txt: there is no External services section, but reCAPTCHA, hCaptcha and Turnstile are each called when enabled (WP2-10). Contributors is `smhussain`, a different WordPress.org user (Kolkata, joined April 2026). The owner's account is `smhz101` (WP2-11). The changelog is 30.6 KB and the parser cuts it at 5,000 characters. The readme points to a /docs folder that does not exist and lists 7 screenshots that do not exist (WP2-13).
5. "Requires at least: 6.0" is wrong. The built scripts depend on `react-jsx-runtime`, which only exists from WordPress 6.6 (WP2-12).
6. Good news: there are no phone-home calls, no tracking beacons to third parties, no remote fonts or CDN assets, no updater, and no admin notice hijacking. Front-end assets load only on pages that contain a form. File uploads are well protected. Plugin Check (all categories, experimental included) reports only 2 warnings. But 214 phpcs suppressions hide 131 findings that a human reviewer will still see, including 2-letter `sf_` global functions (WP2-14).
7. The zip contains dev files: src/Validation/EXAMPLES.php (its header says "DO NOT INCLUDE THIS FILE IN PRODUCTION"), 39 .map files (6.06 MB of the 10.4 MB unzipped size), assets/README.md, placeholder SVGs, and vendor metadata from a dev install (WP2-15). Uninstall leaves 3 tables, 3 options and 2 cron hooks behind (WP2-16).
8. The free-only smoke test passed. I created a form from a template, published it, sent it as a guest, saw the entry in the inbox and reading pane, and exported JSON. CSV export opens the Pro modal. All 9 admin pages load with no PHP notice and no SubtleForms JavaScript error. Fresh install after uninstall and reactivation also loaded clean.
9. Slug: I could not reach wordpress.org/plugins (robots-blocked for the fetch tool, and the proxy refused the API with 403). A web search found no existing plugin named SubtleForms. subtleforms.com is the owner's site. No trademark problem found in the name or the tags.
10. Directory assets are missing. There is no banner (PNG or JPG, 772x250 and 1544x500), no icon (128 and 256 PNG, or icon.svg) and no screenshot-N.png. The repo only has ~500-byte placeholder SVGs.

## 2. Re-verification of old bug IDs

Not applicable. There is no previous wporg report.

## 3. Checklist (WordPress.org review)

Status: Pass, Fail, Warning. "Fix" is the exact change I recommend.

### 3.1 Detailed Plugin Guidelines (https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/)

| # | Guideline | Status | Evidence | Fix |
|---|---|---|---|---|
| 1 | GPL compatible | Pass | Header "GPL-2.0-or-later", readme "GPLv2 or later". Bundled JS deps: dnd-kit, react-query, react-virtual, clsx, nanoid, react-router (MIT), joi (BSD-3), lucide-react (ISC), @wordpress/* (GPL). vendor/composer is MIT. | Optional: use "GPLv2 or later" in the plugin header too, so header and readme match word for word. |
| 2 | Developer responsible for contents | Warning | 214 phpcs:ignore/disable lines. With annotations ignored there are 131 findings (section 3.4). | See WP2-14, WP2-18, WP2-22. |
| 3 | Stable version in directory | Pass | Stable tag 2.3.8 = Version 2.3.8 = SUBTLEFORMS_VERSION. | Keep in sync for the version you submit. |
| 4 | Human readable code | Warning | build/ is minified. Source is public at https://github.com/smhz101/subtleforms (resources/, `"private":false`). The readme only links GitHub under "Support". It does not say this is the source or how to build. | Add a "Source code and build" section (done in the draft readme). |
| 5 | No trialware | **Fail** | See section 4: 9 locked features whose code is in free. Proved by REST (WP2-01 to WP2-07). | For each feature: unlock it in free, or move the code into Pro (details in section 4). |
| 6 | SaaS allowed, documented | Fail | The CAPTCHA services are not documented in the readme. Free does no license validation, so no "license-only service" problem. | Add an External services section (WP2-10). |
| 7 | No tracking without consent | Pass with note | No wp_remote_* call to any SubtleForms or analytics host. Only the three CAPTCHA verify endpoints (off by default, Settings.php:67-71) and admin-entered webhook URLs (AsyncDispatcher.php:301). The guest page loaded no external host (smoke2.js: "guest external hosts: none"). Note: form views are counted locally by default (Settings.php:108-109). A free user cannot turn this off because the Analytics settings panel is locked (WP2-07). It is local only, so not a guideline 7 breach, but document it. | Document view counting in the readme Privacy text (done in the draft) and let free users turn it off. |
| 8 | No executable code from third parties | Pass | The CAPTCHA scripts are the providers' own scripts, needed for the service (allowed). No updater (plugin_updater check passed). No iframes in admin pages. The builder preview iframe is local. | None. |
| 9 | Not dishonest or misleading | **Fail** | Fake AI connection test (WP2-08). Copy says data is "trapped" and "locked fields light up" (WP2-09). FAQ "Is this plugin GDPR compliant? Yes." | Remove the AI tab and fix the wording. Change the GDPR answer to "helps you comply" (done in the draft). |
| 10 | No public credits without opt-in | Pass | No "Powered by" in build/frontend or Shortcode output. | None. |
| 11 | No admin hijacking | Pass with note | Upsells appear only on SubtleForms pages: the "Upgrade to Pro" button, Pro badges, the Extensions page, the Settings Pro group and the New form page ("59 templates", of which 47 are Pro stubs). No dashboard widget, plugin row links, footer text or site-wide nags. A third-party admin notice stayed visible on all SubtleForms pages (notice.js). The one notice (AdminNotices.php:25) only shows on SubtleForms screens. | After trialware is fixed, cut the number of lock badges. Say "12 templates, 47 more in Pro" instead of "59 ready-made templates". |
| 12 | Readme not spam | Pass | 4 tags, no competitor names in tags. Gravity Forms and Fluent Forms appear in the description only as import sources (allowed). | Keep competitor names out of tags. |
| 13 | Use WordPress default libraries | Pass | React, ReactDOM, wp-components, api-fetch, i18n and data are external dependencies (build/admin/admin.asset.php). No jQuery, PHPMailer or other core library bundled. | None. |
| 14 | Avoid frequent commits | Warning | 6 versions in 5 days (2.3.3 to 2.3.8). | On SVN, commit releases only, and batch fixes. |
| 15 | Increment versions | Pass | Version bumps are consistent. | Bump to 2.3.9 (or similar) for the compliant build and set Stable tag to match. |
| 16 | Complete plugin at submission | Pass | The zip is a working plugin (smoke test). | None. |
| 17 | Trademarks | Pass | The name "SubtleForms" is original, and the trademarks check passed. No "WordPress" or "WP" prefix. | None. |
| 18 | Directory rights | Info | Nothing to do. | None. |

### 3.2 readme.txt (https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/)

The official validator page (https://wordpress.org/plugins/developers/readme-validator/) only returns a form to the fetch tool. So I used the same parser through Plugin Check `plugin_readme` together with the documented rules.

| Item | Status | Evidence | Fix |
|---|---|---|---|
| Header fields present | Pass | Contributors, Tags, Requires at least, Tested up to, Requires PHP, Stable tag, License, License URI are all present. | None. |
| Contributors | **Fail** | `smhussain` is a real but different WordPress.org account (profiles.wordpress.org/smhussain: Kolkata, joined April 2026). The owner is `smhz101` (Lahore, joined 2012). | Set `Contributors: smhz101`, or the account that will own the plugin. |
| Tested up to | Pass | 7.1. The latest release is 7.1.3 (https://wordpress.org/download/releases/). | None. |
| Requires at least | **Fail** | 6.0. The build needs react-jsx-runtime (admin.asset.php, frontend.asset.php, index.asset.php). That handle only exists from WP 6.6 (https://make.wordpress.org/core/2024/06/06/jsx-in-wordpress-6-6/). Block apiVersion 3 needs 6.3. Activator.php:38 checks for 5.0. | Set 6.6 in the header and the readme, and update the Activator check. |
| Requires PHP | Pass | 8.1 in both. | None. |
| Stable tag | Pass | 2.3.8 matches. | Match the submitted version. |
| License | Pass with note | "GPLv2 or later" vs header "GPL-2.0-or-later" (same license). | Optional: align the strings. |
| Short description <= 150 | Pass | 148 characters. | Draft: 136. |
| Tags <= 5, no competitors | Pass | 4 tags. | Draft uses 5 useful tags. |
| Readme size | Fail | 42,658 bytes. The handbook says over 10k may cause errors. Plugin Check: "Changelog section is too long and was truncated. A maximum of 5000 characters is supported." The changelog is 30,664 characters. | Keep the last 3 versions in the readme. Move the rest to changelog.txt in the plugin root. Draft: 8.3 KB, changelog 1.1 KB, validated with no errors. |
| Sections | Warning | Description, Installation, FAQ, Screenshots, Changelog and Upgrade Notice are present. Extra custom sections: Privacy Policy, Technical Requirements, Support & Documentation, Credits, License. | Fewer custom sections. Add External services and Source code (draft). |
| External services section | **Fail** | Missing. reCAPTCHA (RecaptchaProvider.php:90,137,140), hCaptcha (HCaptchaProvider.php:66,110) and Turnstile (TurnstileProvider.php:67,112) are called when enabled. | Add "== External services ==" with what, when, what data, and terms and privacy links (draft). |
| FAQ accuracy | Fail | "Documentation: Available in plugins /docs directory" (there is no docs/ in the zip). The CSV FAQ says CSV is Pro, then describes CSV columns. "GDPR compliant? Yes." | Fixed in the draft. Docs are at https://subtleforms.com/docs/. |
| Screenshots match assets | **Fail** | 7 captions, no screenshot-1..7.png anywhere. | Capture 6 PNGs matching the draft captions and upload to SVN /assets. |
| Upgrade notice length | Pass | All under 300 characters (longest 276). | Keep only the current one (draft). |
| Pro upsell text | Pass (after fixes) | Upsell text and links are allowed. The current text lists as Pro the features whose code is in free. | Draft lists only Pro-only code. Edit it if you choose "move to Pro". |

### 3.3 Plugin header (https://developer.wordpress.org/plugins/plugin-basics/header-requirements/)

| Item | Status | Evidence | Fix |
|---|---|---|---|
| Plugin Name, Version, Text Domain, Domain Path, License | Pass | subtleforms.php:3-12 | None. |
| Description under 140 | Pass | 72 characters. | None. |
| Requires at least | Fail | 6.0 (see above). | 6.6 |
| Main file name = slug | Pass | subtleforms/subtleforms.php | None. |
| No Update URI | Pass | None. | None. |
| Direct access guard in main file | Warning | `wp_die()` is called when ABSPATH is undefined (subtleforms.php:27-29). A direct HTTP request gives a 500 "Call to undefined function wp_die()" and logs the full path (phpserver log). | Use `exit;`. |

### 3.4 Code (security, prefixes, libraries, build)

Plugin Check 2.1.0 ran with every check, `--include-experimental` and low-severity errors and warnings, on free-dist: 2 warnings (readme changelog length, and AdminMenu.php:486 `wp_enqueue_scripts`). Runtime and performance checks produced no output in CLI. I checked front-end asset scope by hand: there are no SubtleForms assets on the home page, and they load only on the form page. phpcs with the Plugin Check rulesets and `--ignore-annotations` gives 131 findings: 74 InterpolatedNotPrepared, 26 NonceVerification.Recommended, 12 NotPrepared, 8 debug functions, 4 filesystem functions, 3 input sanitize and other small items. The WordPress escaping, prefix and i18n sniffs add 54 ExceptionNotEscaped, 2 OutputNotEscaped, 16 non-prefixed globals and 3 non-prefixed functions.

| Item | Status | Evidence | Fix |
|---|---|---|---|
| Direct file access guards | Warning | 58 PHP files in src/ have no ABSPATH guard. They only declare classes, so the Plugin Check direct_file_access check passes. A direct request to src/Api/FormsApi.php still gives a PHP fatal with the full path. | Add `if ( ! defined( 'ABSPATH' ) ) { exit; }` to every PHP file. It is cheap and removes a common review comment. |
| Prefix: namespaces, classes, constants | Pass | Namespace `SubtleForms\`. Constants are `SUBTLEFORMS_*`. | None. |
| Prefix: global functions | **Fail** | `sf_is_pro_active`, `sf_is_feature_enabled`, `sf_show_upgrade_notice` (src/Support/functions.php:26,43,60), hidden by phpcs:disable. The handbook asks for at least 4-5 characters (https://developer.wordpress.org/plugins/plugin-basics/best-practices/). | Rename to `subtleforms_*`. Keep `sf_*` wrappers only if Pro needs them, and update Pro. |
| Prefix: options, transients, cron, hooks, handles, REST, shortcode, block | Pass with note | Options are `subtleforms_*`. Hooks are `subtleforms_*` or `subtleforms/*`. Handles are `subtleforms-*`. REST is `subtleforms/v1`. Shortcode is `subtleforms`. Block is `subtleforms/form`. Exceptions: rate-limit transients `sf_upload_*` (Uploads.php:135) and `sf_rl_view_*` (AnalyticsApi.php:185). | Use `subtleforms_rl_*`. |
| Prefix: template and uninstall globals | Warning | 16 non-prefixed globals in templates/admin/*.php and uninstall.php, suppressed. | Wrap them in a function or prefix them. |
| Text domain = slug (PHP and JS) | Pass | 1,207 PHP calls and 3,205 JS calls, all `subtleforms`. | None. |
| load_plugin_textdomain | Pass | Not present (correct for wp.org). | None. |
| JS translations | Warning | No `wp_set_script_translations` anywhere. | Call it for subtleforms-admin, subtleforms-frontend and the block script, so language packs reach the React UI. |
| Sanitize, validate, nonces, capabilities | Pass with notes | All REST routes have a permission_callback. The 2 public ones are /submit and /uploads, by design, with rate limits. The beacon checks a nonce. admin_post_subtleforms_file checks capability and nonce (Uploads.php:519-526). Remaining sniffs: AdminMenu.php:787 `$_GET['page']` not unslashed; AdminMenu.php:825 nonce not sanitized. | Unslash and sanitize both. The free-features audit covers runtime security. |
| Escaping | Warning | Activator.php:221 `wp_die( $error_message . '<br><br>...' )` is unescaped and not translatable. Activator.php:45 `$wp_version` is unescaped. 54 exception messages are not escaped. | esc_html() these. Exceptions are fine if they are never echoed. |
| SQL | Warning | 12 NotPrepared, 3 UnfinishedPrepare and 1 ReplacementsWrongNumber (PublicSubmitApi.php:945, a false positive by inspection), all suppressed. Identifiers are interpolated. | Use `%i` for table and column identifiers (needs WP 6.2+, fine at 6.6), so the suppressions can go. |
| eval, obfuscation, base64, extract | Pass | No eval (Formula.php is a tokenizer), no extract, no obfuscation. base64 is only used for CSV transport in JSON (SubmissionsApi.php:1104) and for signature images in mail (Mailer.php:87). | None. |
| Enqueue only, no printed scripts | Warning | Plugin scripts go through enqueue, wp_add_inline_script and localize (checked in admin HTML). A `<style>` is printed directly on every admin page (AdminMenu.php:149, menu_icon_styles) and in a fallback page (AdminMenu.php:1181). | Use wp_add_inline_style on a registered handle. |
| Core hook fired by plugin | Warning | `do_action( 'wp_enqueue_scripts' )` in admin, with $wp_styles, $wp_scripts and $wp_actions swapped (AdminMenu.php:475-495). This is the one Plugin Check warning. | Read theme styles another way, for example wp_get_global_stylesheet() or the theme's style.css, or add a comment that explains it. Reviewers ask about it. |
| Bundled libraries | Pass | See guideline 13. | None. |
| vendor/ and composer.json | Warning | composer.json ships (good). vendor/composer/installed.json and installed.php say `"dev": true` and list phpunit, yoast, sebastian and others, though those packages are not shipped. .distignore removes composer.json from SVN deploys, but the review team asks to keep it. | Run `composer install --no-dev --optimize-autoloader` before packaging. Remove `composer.json` from .distignore. |
| Minified JS has source | Pass with fix | Public repo with resources/ and build scripts (package.json `build:all`). | State it in the readme (draft). |
| Zip size and count | Pass | 2.53 MB zipped, 10.4 MB unzipped, 244 files (279 entries). | None. |
| Dev files in zip | **Fail** | src/Validation/EXAMPLES.php, a dev example file loaded under namespace SubtleForms\Examples. assets/README.md. Placeholder SVGs: assets/banner-772x250.svg, icon-256x256.svg, screenshot-*.svg. These belong in SVN /assets, not the zip. | Exclude them in gulpfile.js and .distignore. |
| .map files | Warning (decision) | 39 maps, 6,062,663 bytes, 58% of the unzipped size. Maps are allowed but not needed, because the source is public. | Do not ship maps. It halves the install size. |
| Debug code | Warning | Unconditional error_log on every bad REST nonce (ApiGuards.php:130,139). print_r and var_export are built even when logging is off (FieldsApi.php:106,169, FormsApi.php:753,757, Activator.php:214). "[SubtleForms][ERROR] ... Email job scheduled" is logged at ERROR level for a normal event (debug.log, this session). | Route everything through Logger with the right level. Do not build print_r strings unless debug is on. |
| Uninstall cleanup | **Fail** | After `wp plugin uninstall subtleforms` these were left: tables wp_subtleforms_coupons, wp_subtleforms_coupon_uses, wp_subtleforms_api_logs; options subtleforms_coupons_db, subtleforms_db_supports_json, subtleforms_api_log_table; cron events subtleforms_async_email and subtleforms_async_webhook. uninstall.php:22-29 and 39-54 miss them, and :101 uses wp_unschedule_event for only the next run. Transients subtleforms_dashboard_stats_v2, subtleforms_api_log_pruned, subtleforms_form_*, subtleforms_schema_* and the per-user inbox meta are also not cleared. | Add the missing tables and options, use wp_clear_scheduled_hook for every hook including subtleforms_stats_prune, and delete the transients by LIKE pattern. Do not create the Pro table subtleforms_license_meta in free (Activator.php:156-171). |
| Admin notices | Pass | Only the permalink notice (AdminNotices.php), shown on SubtleForms screens only. It is not dismissible, but it removes itself once fixed. | Optional: the text says the REST API "requires pretty permalinks". The REST API works with plain permalinks via ?rest_route=, so check the wording. |
| No admin hijack | Pass | Third-party notices stayed visible. The WP menu stays. Only #wpfooter is hidden on plugin pages (build/admin/index.jsx.css). | None. |
| ALLOW_UNFILTERED_UPLOADS | Pass | Not referenced (no_unfiltered_uploads check passed). | None. |
| Safe uploads | Pass with note | Blocked extension list including double extensions (Uploads.php:54-57, 330). wp_check_filetype_and_ext (:237). Random extension-less names (:171). .htaccess, index.php and web.config deny files (:788-790). Admin-only download with nonce. On nginx the random names keep files private. But move_uploaded_file, rename, readfile and chmod are used directly (Uploads.php:174,179,424,573). The common-issues page asks for wp_handle_upload. | Use wp_handle_upload with `test_form => false` and an `upload_dir` filter that points at the protected folder, and WP_Filesystem for the move. Otherwise expect this review comment. |
| Saving data in plugin folder | Pass | write_file check passed. | None. |
| Changes other plugins' activation | Pass | Only deactivates itself on failed activation (Activator.php:25,40,219). | None. |
| Calling files remotely | Pass | No Google Fonts, CDN or remote images in build, assets or src. The CAPTCHA scripts are the allowed service exception. | None. |

## 4. Trialware and locked features (guideline 5)

How it works: free's `Capabilities::defaults()` (src/Support/Capabilities.php:20-70) sets flags to false. Pro's PlanCapabilities flips them through the `subtleforms/capabilities` filter. Where the gated code lives in free, any site can unlock it with one filter, and Pro adds no code. Test with Pro absent (unlock.js, using a temporary mu-plugin on my site, now removed):

```
FREE     summary 403 "Form analytics reports are part of SubtleForms Pro."
FREE     csv     403 "CSV export is part of SubtleForms Pro."
FREE     fields  is_pro: 10 locked: 10
UNLOCKED summary 200 {"forms":{"7":{"views":1602,"submissions":191,"conversion":11.9}...
UNLOCKED csv     200 decoded: "ID","Form ID","Status","Submitted At","Name",...
UNLOCKED fields  is_pro: 10 locked: 0
```

| # | Locked feature | Code in free (file:line) | Lock (file:line) | Trialware? | Compliant fix |
|---|---|---|---|---|---|
| T1 | CSV export (Submissions, Tools) | Full exporter: src/Api/SubmissionsApi.php:946-1110; resources/admin/utils/csvDownload.js | SubmissionsApi.php:952 `submissions.export`; Capabilities.php `'submissions.export' => false`; SubmissionsTable.jsx:494 and ToolsPage.jsx:119,224,320 requirePro and lock icon | **Yes** (WP2-01) | A: set `submissions.export` true in free and remove the Pro badge and modal. B: delete the exporter from free and let Pro register the route and the button. |
| T2 | Reports: views, conversion, per-form report | src/Analytics/Stats.php (counts views by default, :113-124, :146); AnalyticsApi.php:216-330 computes summary, series and legacy totals | AnalyticsApi.php:152-165 requireAnalytics, called at :220,263,296; ReportsPage.jsx blurred sample cards | **Yes** (WP2-02). Data is collected by free and hidden. | A: return the reports in free. B: move Stats, the beacon (resources/frontend/utils/viewBeacon.js) and the reports routes into Pro, so free stops counting views. |
| T3 | Advanced conditional logic: "any" match, OR groups, 7 operators, conditional emails, webhooks and confirmations | ConditionalLogic.php:41-49 (operators), :132 (any), :354-356; Pipeline.php:66-72 (step logic); pickConfirmation | UI only: LogicEditor.jsx:117 ("(Pro)" options), ActionsPanel.jsx:190-206, FormBehaviorPanels.jsx:133-209. No server check: `usesAdvancedLogic()` (:154) is never called. | **Yes** (WP2-03). Test: rule `any(starts_with x, in q1,q2)` on free. a=xyz kept b, a=abc dropped b, a=q2 kept b. | A: unlock in the editor (simplest, the engine already runs it). B: move the operators and the group evaluation to Pro through a filter on the operator list. |
| T4 | Picture Choice, Signature, Calculation fields | Definitions in FieldsV2.php (PRO_FIELDS_CAP :29); renderers in build/frontend (field-signature chunk, formula.js); server validation | FieldsApi.php:134-161 `is_pro_locked`; Pro badge in the library (smoke_2_published.png) | **Yes** (WP2-04). A form saved by REST with these fields rendered and calculated on the live page with Pro absent (advfields.js: "Total 14.00", signature canvas, picture options). | A: unlock (`fields.advanced` true). B: register these types, renderers and validators from Pro. |
| T5 | Payment fields: Product, Priced Options, Order Summary, Coupon Code, Custom Amount, Fixed Fee; coupons | CoreFields.php:1571,1629,1704,1740; PaymentFields.php:21; src/Payments/Pricing.php; CouponsRepository.php; Payments page with a working coupon editor | `actions.payment` false. Library lock. The Payments page says "Products, priced options, order summaries and coupons work on every plan" but the fields are locked (contradiction). | **Yes** (WP2-05). The Product field rendered "$10.00" live on free. | A: set `actions.payment` true for the non-card fields. Keep Card Payment (Stripe) in Pro and have Pro register the `payment_card` type. B: move pricing, coupons and the Payments page to Pro. |
| T6 | Several files per upload field, drag and drop | Uploads.php:348-353 maxFiles; :605 limitPublicSchema strips `multiple` | Uploads.php:121-122 `fields.advanced` | **Yes** (WP2-06). The code is present and actively disabled. | A: allow `multiple` in free. B: move multi-file handling to Pro through a filter. |
| T7 | Integrations settings for Webhooks (retries, default signing secret) and Analytics (on/off, view tracking) | Free implements webhook retries (AsyncDispatcher.php:384-403) and HMAC signing (WebhookAction.php:85-94) and reads ext_webhooks_* and ext_analytics_*. | Settings, Integrations: "Included with SubtleForms Pro. You can look around. Settings unlock as soon as your license is active." (smoke_settings_Integrations.png) | **Yes** for Webhooks and Analytics (WP2-07). | A: show the Webhooks and Analytics panels unlocked in free. Pro adds its own panels (Email Marketing, CRM, WooCommerce, PDF, Multilanguage, Payments) through a slot or filter, so free ships no locked settings UI. |
| T8 | Pro templates (47 cards) | Stubs only: name and description, no schema (FormTemplates.php:576-646). Server refuses them (FormsApi.php:767). | Card shows "Pro". | No. Upsell only (allowed, guideline 11). | Optional: show a count such as "47 more with Pro" instead of 47 locked cards. |
| T9 | Extensions page, License tab, Branding tab, "Upgrade to Pro" button | No feature code: filters only (AdminMenu.php:569-617 `subtleforms/admin_branding`, `subtleforms/license_data`). | Upsell UI. | No, but the copy is a problem (WP2-09). | Keep it as a plain add-on page. Remove "locked fields and actions light up the moment your license is active". |
| T10 | `sf_is_feature_enabled` / `subtleforms_feature_enabled`, FeatureGate::isPro/hasFeature | functions.php:43, FeatureGate.php:95-110 | A general gating API in free. | Indirect. The API itself is fine. What it gates is the issue. | Keep the filter API. Use it only to let Pro add code, never to switch off free code. |
| T11 | AI assistant tab | UI only. No PHP backend in free or Pro 2.3.3. | Shown unlocked, but cannot save. | Not trialware, but misleading (WP2-08). | Remove the tab from free until a real AI feature ships, with an External services entry. |

Recommendation for this week: Option A (unlock in free) is the fastest compliant path. It changes capability defaults and removes the UI locks, and needs no Pro release. Pro would keep Stripe card checkout, WooCommerce checkout, the CRM and email-marketing integrations, PDFs, Pro templates, white label and multilingual, because that code lives in Pro. Option B keeps the current Pro value, but needs a Pro release that ships the moved code before free can be submitted. My corrected readme draft is written for Option A. If you choose B, change the "Can I export entries?" answer, the Pro paragraph and the Entries list to match.

## 5. External calls and assets (guideline 7)

| Call | Where | When | Consent | Documented in readme |
|---|---|---|---|---|
| reCAPTCHA script and siteverify (google.com) | RecaptchaProvider.php:90,98,137,140 | Only when reCAPTCHA is enabled (default false, Settings.php:69) | Admin configuration (service exception) | No. Fix in draft. |
| hCaptcha script and siteverify | HCaptchaProvider.php:66,74,110 | Only when enabled | Same | No. Fix in draft. |
| Cloudflare Turnstile script and siteverify | TurnstileProvider.php:67,75,112 | Only when enabled | Same | No. Fix in draft. |
| Webhooks | AsyncDispatcher.php:301 | URL entered by the admin per form | Admin configuration | No. Fix in draft. |
| View beacon | resources/frontend/utils/viewBeacon.js to /wp-json/subtleforms/v1/forms/{id}/view on the same site | On every form render (default on) | Local only, IP hashed for rate limit | Not mentioned. Fix in draft. |
| Gravatar | WP core admin bar | n/a | n/a | n/a |
| Links to subtleforms.com (pricing, pro, account) | functions.php:61, proCatalog.js | Links only, no requests | n/a | Allowed. |

The admin crawl (9 pages) and the guest page made no request to any non-local host except core Gravatar. No fonts, CDN or analytics.

## 6. Name, slug, assets

| Item | Status | Evidence | Fix |
|---|---|---|---|
| Slug "subtleforms" free | Not verified | wordpress.org/plugins and api.wordpress.org are robots-blocked for WebFetch, and the proxy returned 403 for curl. A web search for "subtleforms" WordPress plugin found only the GitHub repo. subtleforms.com links to wordpress.org/plugins/subtleforms/ as if already listed. | The owner checks https://wordpress.org/plugins/subtleforms/ (it should 404) before submitting. The slug comes from "Plugin Name: SubtleForms". |
| Trademarks | Pass | No WordPress, WooCommerce or competitor term in the name, slug or tags. Plugin Check trademarks passed. | None. |
| Banner 772x250 and 1544x500 | **Missing** | Only assets/banner-772x250.svg, a 530-byte placeholder. SVG banners are not accepted. | Make banner-772x250.png (or jpg) and banner-1544x500.png and put them in SVN /assets. |
| Icon 128 and 256 | **Missing** | Only assets/icon-256x256.svg, a 344-byte placeholder with the wrong name. | Make icon-128x128.png and icon-256x256.png (or a single icon.svg) in SVN /assets. |
| Screenshots | **Missing** | No screenshot-N.png. | Make screenshot-1.png to screenshot-6.png matching the draft captions, in SVN /assets. |
| Remove placeholders from zip | Fail | See WP2-15. | Exclude them. |

## 7. Free-only smoke test

| Step | Result | Evidence |
|---|---|---|
| All 9 admin pages load (Dashboard, All Forms, Add New, Submissions, Tools, Reports, Payments, Extensions, Settings) | Works. No PHP notice in the HTML, no JS error from SubtleForms (only core Gravatar blocked by the sandbox network). Same after uninstall and reactivate (fresh install). | crawl.js output; /home/claude/shots/qa238/wporg/admin_php_page_*.png |
| New form from template (Contact Form) | Works. The modal names the 4 fields. Create form opened the builder (form 2294). | smoke_1_builder.png, smoke_2_published.png |
| Publish | Works (status published). | smoke2.js "status published" |
| Guest submit | Works. Entry 5930 stored with 4 answers (REST GET /submissions/5930). | guest.js, entry.js |
| Entry in inbox and reading pane | Works. | smoke_7_submissions.png, smoke_8_entry.png |
| CSV export | Locked. It opens the "Export Your Submissions" Pro modal ("Your data is currently trapped inside SubtleForms.") | smoke_9_csv.png |
| JSON export (Tools) | Works. Downloaded subtleforms-forms.json. | smoke3.js |
| Builder logic editor | Basic operators work. 7 operators, "Any of these rules" and "Add or group" are shown as (Pro). | smoke_3_logic.png |
| Confusing without Pro | Partial. The AI assistant tab does not save and fakes a connection test. The Payments page says products and coupons work on every plan, but the fields are locked. The Integrations Webhooks panel is locked although webhooks are free. "59 templates" includes 47 Pro stubs. | smoke_settings_AI_assistant.png, admin_php_page_subtleforms_payments.png, smoke_settings_Integrations.png |
| Autosave | One console error "[useDraftAutosave] Save failed: Could not get a valid response from the server" happened once while my script moved between tabs. I could not reproduce it in a second clean run (autosave.js). | Not reported as a bug. |

## 8. New bugs (WP2-NN)

| ID | Sev | Summary | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|---|
| WP2-01 | P1 | CSV export code ships in free but is locked (trialware) | Free only: POST /submissions/export as admin; then add filter `subtleforms/capabilities` setting submissions.export=true and repeat | Feature either works in free or is not in free | 403 "CSV export is part of SubtleForms Pro.", then 200 with full CSV | unlock.js output | SubmissionsApi.php:952, Capabilities.php `submissions.export => false` |
| WP2-02 | P1 | Analytics reports computed in free and hidden; views counted by default | Same, GET /analytics/summary | Same | 403, then 200 with views/conversion per form | unlock.js | AnalyticsApi.php:152-165,220,263,296; Settings.php:108-109; Stats.php:113-124 |
| WP2-03 | P1 | Advanced logic runs in free, only editor locks it | Save a field rule `match:any`, `starts_with`, `in` by REST on free; submit a=xyz, abc, q2 | Same | Rules applied correctly on free | advlogic.js output | LogicEditor.jsx:117, ActionsPanel.jsx:190-206, FormBehaviorPanels.jsx:133-209; ConditionalLogic.php:41-49 |
| WP2-04 | P1 | Picture Choice, Signature, Calculation render in free but locked in library | Save a form with those fields by REST on free, open the page | Same | Live form shows "Total 14.00", signature canvas, picture options | advfields.js, advfields_live.png | FieldsV2.php:29, FieldsApi.php:134-161 |
| WP2-05 | P1 | Payment fields and coupons in free, locked; Payments page says they work on every plan | Open Payments page and the field library | Consistent and unlocked, or absent | Coupon editor works, Product etc. locked, page text contradicts | admin_php_page_subtleforms_payments.png | CoreFields.php:1571,1629,1704,1740; Capabilities.php `actions.payment => false` |
| WP2-06 | P1 | Multi-file uploads implemented and stripped in free | Field with multiple=true on free | Same | Server limits to 1 file and strips `multiple` from public schema | code | Uploads.php:121-122,348-353,605 |
| WP2-07 | P2 | Webhooks and Analytics settings locked in free though free uses them; free user cannot turn off view counting | Settings, Integrations, Webhooks or Analytics | Editable | "Settings unlock as soon as your license is active" | smoke_settings_Integrations.png | resources/admin/components/settings/ExtensionsSettings.jsx (pro lock), Settings.php:90,108-109 |
| WP2-08 | P1 | AI assistant tab is non-functional and fakes success | Settings, AI assistant: Test Connection; or PUT /settings {ai_provider, ai_api_key} | Real test or no tab | Always "Connection successful! AI services are ready." after 1.5 s; save returns 422 "Unknown field" | ai.js; smoke_settings_AI_assistant.png | AISettings.jsx:31-44 ("Simulate API test"), SettingsPage.jsx:54-56,248 |
| WP2-09 | P1 | Upsell copy implies paying to unlock included features | Click Export CSV; open Extensions | Neutral upsell | "Your data is currently trapped inside SubtleForms."; "locked fields and actions light up the moment your license is active" | smoke_9_csv.png, admin_php_page_subtleforms_extensions.png | resources/admin/ui/UpgradeModal.jsx copy; ExtensionsPage.jsx |
| WP2-10 | P1 | No External services section in readme | Read readme | Section with services, data, ToS and privacy links | Missing | readme.txt | readme.txt |
| WP2-11 | P1 | Contributors names another person's account | profiles.wordpress.org/smhussain | Owner's username | smhussain (Kolkata, joined April 2026); owner is smhz101 | WebFetch of both profiles | readme.txt:2 |
| WP2-12 | P2 | Requires at least 6.0 but build needs 6.6 | Install on WP 6.5 | Admin loads | Scripts depending on react-jsx-runtime are not printed (missing dependency) | asset.php files; dev note | subtleforms.php:7, readme.txt:4, Activator.php:38 |
| WP2-13 | P2 | readme too long and inaccurate | Plugin Check | Validates cleanly | Changelog truncated warning; 42.7 KB; /docs missing; 7 screenshots missing; contradictory CSV FAQ; GDPR "Yes" | pcp.csv | readme.txt |
| WP2-14 | P2 | 2-letter global prefix and sf_ transients, hidden by phpcs:disable | phpcs --ignore-annotations | subtleforms_ prefix | sf_is_pro_active, sf_is_feature_enabled, sf_show_upgrade_notice; sf_upload_*, sf_rl_view_* | phpcs output | functions.php:26,43,60; Uploads.php:135; AnalyticsApi.php:185 |
| WP2-15 | P2 | Dev and placeholder files in the zip | unzip -l | Runtime files only | EXAMPLES.php, assets/README.md, 3 screenshot SVGs, banner and icon SVGs, 39 .map files (6.06 MB), dev composer metadata | zip listing | gulpfile.js file list, .distignore |
| WP2-16 | P2 | Uninstall leaves data | `wp plugin uninstall subtleforms --deactivate --skip-delete` | Nothing of free left | 3 tables, 3 options, 2 cron hooks left | command output in this run | uninstall.php:22-29,39-54,92-106 |
| WP2-17 | P3 | Direct request to main file causes fatal (wp_die undefined); class files fatal with path | GET /wp-content/plugins/subtleforms/subtleforms.php and src/Api/FormsApi.php | Blank exit | 500, "Call to undefined function wp_die()", "Trait ... not found" with path | phpserver-wporg.log | subtleforms.php:27-29; src/* without guard |
| WP2-18 | P3 | Raw upload and filesystem functions | phpcs --ignore-annotations | wp_handle_upload / WP_Filesystem | move_uploaded_file, chmod, rename, readfile | phpcs output | Uploads.php:174,179,424,573 |
| WP2-19 | P3 | Inline style printed directly on every admin page | View admin HTML | wp_add_inline_style | `<style id="subtleforms-menu-icon">` echoed | inline.js | AdminMenu.php:149,1181 |
| WP2-20 | P3 | Plugin fires core hook wp_enqueue_scripts in admin and swaps core globals | Plugin Check | No core hook firing | Warning | pcp.csv | AdminMenu.php:475-495 |
| WP2-21 | P3 | No wp_set_script_translations | grep | JS strings translatable via language packs | None | grep | AdminMenu.php enqueue, FrontendAssets.php, block registration |
| WP2-22 | P3 | Error log noise | Send a REST call without nonce; submit a form with WP_DEBUG | Debug-level only | error_log on every bad nonce; "Email job scheduled" logged as ERROR | debug.log 22:19:37 and 22:23:27 UTC | ApiGuards.php:130,139; AsyncDispatcher.php log level |

## 9. Blocking for submission (priority order)

1. Trialware (WP2-01 to WP2-07): for each of T1 to T7, unlock in free or move the code to Pro. Remove the matching Pro badges, modals and "unlock" panels from free.
2. Remove the AI assistant tab from free (WP2-08).
3. Rewrite the upsell copy that says data is "trapped" or that locked features "light up" (WP2-09). Keep upsells factual and on plugin pages only.
4. readme: add External services (WP2-10), set Contributors to smhz101 (WP2-11), set Requires at least 6.6 in readme and header (WP2-12), shorten the changelog and move history to changelog.txt, fix the docs link, the FAQ and the screenshots list (WP2-13). Use /home/claude/work/qa238/wporg-readme.txt.
5. Rename the `sf_*` global functions and transient keys to `subtleforms_*` (WP2-14).
6. Clean the zip: drop src/Validation/EXAMPLES.php, assets/README.md, the placeholder SVGs and the .map files. Run composer with --no-dev (WP2-15).
7. Complete uninstall.php (WP2-16).
8. Bump the version (for example 2.3.9), rebuild, rerun Plugin Check, and submit that zip.

## 10. Recommended before submission

1. ABSPATH guard with `exit;` in every PHP file, and `exit` instead of `wp_die` in subtleforms.php (WP2-17).
2. Use wp_handle_upload and WP_Filesystem in Uploads.php, or prepare a short explanation for the reviewer (WP2-18).
3. Move the printed `<style>` blocks to wp_add_inline_style (WP2-19). Replace or explain `do_action( 'wp_enqueue_scripts' )` (WP2-20).
4. Add wp_set_script_translations for the admin, frontend and block scripts (WP2-21).
5. Replace the SQL suppressions with `%i` identifiers, unslash and sanitize `$_GET['page']` and `$_GET['_wpnonce']` (AdminMenu.php:787,825), escape Activator.php:45 and :221, and remove unconditional error_log (WP2-22).
6. Do not create the Pro table subtleforms_license_meta from free (Activator.php:156-171).
7. Make the Pro upsells fewer: one Upgrade button and the Extensions page are enough. Say "12 templates, 47 more with Pro" instead of "59".
8. Remove `composer.json` from .distignore, because the review team wants it shipped.
9. Fix the permalink notice wording (AdminNotices.php). The REST API works with plain permalinks.

## 11. Owner actions (account, SVN, assets)

1. Confirm the WordPress.org account that will own the plugin. smhz101 exists (Muzammil Hussain, Lahore). Put it in Contributors. Enable two-factor on it (wp.org asks plugin committers to).
2. Check that https://wordpress.org/plugins/subtleforms/ is free (it should show "not found") before submitting. I could not reach it from here.
3. Submit at https://wordpress.org/plugins/developers/add/ with the fixed zip. Reply to the review email from the same account.
4. After approval, use SVN: put the code in /trunk, copy to /tags/2.3.9 (or your version), and set Stable tag to match. Put the banner, icon and screenshots in /assets (not in the zip): banner-772x250.png, banner-1544x500.png, icon-128x128.png, icon-256x256.png (or icon.svg), screenshot-1.png to screenshot-6.png matching the readme captions.
5. Add changelog.txt with the full history removed from the readme.
6. Keep https://github.com/smhz101/subtleforms public, since the readme points there for the build source.
7. Decide Option A or B for trialware (section 4), and if B, plan the matching Pro release first.

## 12. Missing features (for wp.org readiness only)

| Priority | Feature | Free or Pro | Reason |
|---|---|---|---|
| Must | A way to turn off view counting in free | Free | Free counts views by default and the switch is locked. |
| Must | changelog.txt in the plugin | Free | Needed once the readme changelog is trimmed. |
| Should | JS translations loaded (wp_set_script_translations) | Free | Language packs from translate.wordpress.org will not reach the React admin without it. |
| Should | "Keep data on uninstall" option | Free | Uninstall deletes all entries without asking. A common user request, not a wp.org rule. |
| Nice | Readme "Privacy" text generated from Settings | Free | So the privacy policy suggestion matches the enabled CAPTCHA and webhooks. |

## 13. Not tested and why

- Slug availability: not testable here. wordpress.org/plugins and api.wordpress.org are robots-blocked for WebFetch, and curl got proxy 403.
- Official readme validator page: it returns only the form to the fetch tool. I used the Plugin Check readme parser (the same rules) on both readmes. The draft passes with no errors.
- WordPress 6.0 to 6.5 install: not run (only 7.1.3 available). The 6.6 minimum comes from the react-jsx-runtime dependency in the asset files and the core dev note.
- Plugin Check runtime and performance checks: produced no output from the CLI. I checked asset scope by hand (no SubtleForms assets on the home page, enqueued only on the form page).
- nginx upload protection: no nginx here. By code the files have random extension-less names and are only served through admin-post with capability and nonce checks.
- CAPTCHA live calls: no network to Google, hCaptcha or Cloudflare. Code paths only.

## Sources

- Detailed Plugin Guidelines: https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/
- How your readme.txt works: https://developer.wordpress.org/plugins/wordpress-org/how-your-readme-txt-works/
- Common issues (review team): https://developer.wordpress.org/plugins/wordpress-org/common-issues/
- Header requirements: https://developer.wordpress.org/plugins/plugin-basics/header-requirements/
- Best practices (prefix, direct access): https://developer.wordpress.org/plugins/plugin-basics/best-practices/
- Security chapter: https://developer.wordpress.org/plugins/security/ (capabilities, data validation, nonces, securing output, securing input)
- Releases (current major 7.1): https://wordpress.org/download/releases/
- JSX in WordPress 6.6: https://make.wordpress.org/core/2024/06/06/jsx-in-wordpress-6-6/
- Readme validator: https://wordpress.org/plugins/developers/readme-validator/
- Profiles: https://profiles.wordpress.org/smhussain/ and https://profiles.wordpress.org/smhz101/
- GitHub repo (public): https://github.com/smhz101/subtleforms
- Owner site: https://subtleforms.com/

## Cleanup

Deleted my forms 2294, 2295, 2296 and 2297, entries 5930 to 5933, and pages 6780, 6781 and 6782. Removed the temporary mu-plugin qa238-wporg-unlock.php and the temporary subtleforms-rc folder. Note: on my own site (8933) I ran the uninstall test, which dropped the SubtleForms data cloned into it. I then reactivated free, so the site has fresh empty SubtleForms tables (plus the leftover tables listed in WP2-16). No other site was touched.
