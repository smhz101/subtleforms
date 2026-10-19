# QA audit: Payments (SubtleForms 2.3.3 free + Pro 2.3.3)

Auditor area: payments. Date: 14 October 2026. Test site http://localhost:8899.
Scratch scripts and raw outputs: /home/claude/work/qa/payments/ (flow1.out to flow6.out, b1.out, export.csv, pdf-752.html).
Screenshots: /home/claude/shots/qa/payments/.

## 1. Summary

The core card flow works end to end against a mocked Stripe API: the server prices the order from the stored schema, creates a PaymentIntent with manual capture, checks amount, currency, form and reuse on submit, captures after the entry is saved, and releases the hold on every failure path I tried (validation error, honeypot, mismatch). Coupons (percent, fixed, limits, dates, per customer, per form) work through REST and the admin UI. The WooCommerce checkout path works for real with Cash on delivery: cart filled, coupon applied, answers on the order, order linked to the entry and status changes reflected.

The top problems:
1. PAY-01 (P1): a visitor can lower the price by leaving a fixed Product (no quantity box) out of the request. The server charges without it.
2. PAY-02 (P1): a Fixed Fee (payment_hidden_price) with conditional logic is always charged on the server, while the form hides it. The visitor sees "Pay $20.00" and is charged $23.00.
3. PAY-03 (P1): once Stripe is configured, any priced form without a Card field (pay later, invoice, offline) can no longer be submitted at all ("Please complete the payment details.").
4. PAY-04 (P1/P2): notification and "receipt" emails are queued before capture, so they go out even when the capture fails (entry status payment_failed).
5. No Stripe webhooks: async payments that start as "processing" stay "Awaiting payment" forever, and refunds or disputes done in Stripe never reach the entry. No refund action in the admin.
6. No payment merge tags (total, status, transaction ID, order summary), no payment columns in CSV export, and the Custom Amount min/max validation is never applied to builder-made forms (amount silently clamped, visitor charged a different amount than typed).

## 2. Inventory and status

How tested: test forms built through the repository (same flat field shape the builder stores), published on pages via shortcode; REST calls with a page nonce; browser runs with Playwright and the Pro e2e Stripe.js stub (routed in place of js.stripe.com); Stripe REST mocked by a temporary mu-plugin that intercepted pre_http_request only for requests carrying an X-SFQA-Pay header or sfqa_pay cookie (site settings were never changed; the mu-plugin is removed). Builder inspector read for every payment field on form F1.

### 2.1 Payment field types and their settings

| Field / setting | Status | Evidence / note |
|---|---|---|
| Product (payment_product): Label | Works | Builder inspector, frontend, order line |
| Product: Name on the order | Works | Order line label "QA Tee" in summary, entry, PDF |
| Product: Price | Works | 12.50 priced correctly, server quote matches |
| Product: Let visitors choose a quantity | Works | Stepper on frontend, qty 2 charged 25.00 |
| Product: Minimum / Maximum quantity | Partial | Clamped in price, never validated. qty 99 stored as "99" in the entry but charged 5 (PAY-06) |
| Product without quantity box | Broken (security) | Omit the key and it is not charged (PAY-01) |
| Product: Required, Message when left empty | Not run | Required on a product has no clear meaning; not exercised |
| Product: placement of Price/Name/Quantity under "Appearance" | Partial | Core pricing settings sit in the Appearance section of the inspector (PAY-17) |
| Priced Options (payment_choice): options with price | Works | Choices editor has a price column (builder-Plan.png); priced lines correct |
| Priced Options: Show as Radio / Cards / Dropdown / Checkboxes | Partial | Radio, checkbox rendered and priced in browser; Cards and Dropdown not rendered in browser (Not run). Server accepts two values for a radio field and charges both (PAY-08) |
| Priced Options: Show prices next to options | Works | Prices shown on frontend (f1-filled.png) |
| Priced Options: Required | Partial | Required check passes with a value that is not an option ("bogus"), entry stored with it (PAY-07) |
| Priced Options: builder canvas preview | Partial | All radio options appear selected on the canvas (builder-Plan.png) (PAY-19) |
| Custom Amount (payment_amount): Placeholder, Step | Works | Rendered on frontend |
| Custom Amount: Minimum / Maximum amount | Broken | Server validator reads only field.config, builder stores flat; 1 with min 5 is charged 5, 600 with max 500 is charged 500 (PAY-05) |
| Custom Amount: Show currency symbol | Partial | Symbol comes from a hidden per-field "currency" default USD, so a JPY or EUR form shows "$" (PAY-09); symbol sits on its own line above the input |
| Custom Amount: negative / non numeric | Works | Rejected with 422 and hold released |
| Order Summary (payment_summary): List each item, Show subtotal, Show total | Works | f1-filled.png |
| Order Summary: Show tax + Tax rate + Tax label | Works (Stripe path) / Partial (WooCommerce path) | 8.25 percent on 98.25 = 8.11 server and client. On WooCommerce forms the summary shows tax that WooCommerce never charges (PAY-11) |
| Order Summary: Coupon box + Coupon link text | Works | Applied QAWOO10 and QAPCT10 in browser |
| Coupon Code field (payment_coupon): Placeholder, Button text | Works | Applied QAPCT10 in browser, discount and new total shown |
| Coupon field value typed directly into the request | Partial | Intent endpoint ignores the field value, submit uses it, so the amounts differ and the payment fails (PAY-13). The browser sends _coupon so real visitors are not affected |
| Card Payment (payment_card): Label | Works | Stripe element mounted (stub), amount follows the total live (elements.update calls) |
| Card Payment: Required toggle in Validation tab | Partial | Toggle has no effect and no meaning; should be removed |
| Fixed Fee (payment_hidden_price): Amount, Description | Works | Added to every order as "Processing fee" |
| Fixed Fee: conditional logic | Broken | No Logic tab in the inspector for this field, and the server ignores logic for it (PAY-02) |
| Fixed Fee: frontend output | Partial | The "hidden" field prints its label and the description on the public form (f1-filled.png) (PAY-18) |
| Calculation "Use as price" | Not run | Covered by the calculations auditor; Pricing code path read only |
| WooCommerce Product field (Pro, woo_product) | Partial | Server prices from WooCommerce and the cart line was correct. In my run the live summary did not show the tee line (form had no stored snapshot, which a builder-saved form would have), so not counted as a bug |

### 2.2 Payments admin page and settings

| Item | Status | Evidence |
|---|---|---|
| Payments page cards (Gateway, Currency, Active coupons) | Works | admin-payments-real.png, admin-payments-stripe.png |
| Not connected state message ("entries saved as Payment pending") | Works | Matches observed offline behaviour |
| Apple Pay / Google Pay domain panel | Works (UI) / Not testable (registration) | Needs a public HTTPS domain and Stripe |
| Gateway settings (Settings > Integrations > Payments): enable, provider, mode, currency, pk, sk | Partial | Fields render; I did not save (shared setting). Currency limited to USD, EUR, GBP, CAD, AUD. Mode select is cosmetic: Stripe mode comes from the key prefix, while entries store the selected mode (PAY-15). Provider list has only Stripe though PayPal keys exist in settings |
| Use WooCommerce Stripe account / WooPayments source | Not testable | Neither plugin installed |
| Coupons list (code, discount, applies to, used, valid, status) | Works | Statuses Active, Expired, Scheduled, Used up, Disabled all shown correctly |
| Coupon create (UI) | Works | QA-UI-15 created with min order, total uses, expiry, per customer, form limit |
| Coupon edit (UI) | Works | 15 to 25 percent saved |
| Coupon delete (UI) | Works | Native confirm, row removed (verified in DB) |
| Coupon validation: >100 percent, zero/negative, duplicate code, negative uses | Works | UI error notice and REST 400/409 |
| Coupon validation: start after expiry, invalid date text | Broken | Saved; invalid expiry silently becomes "never expires" (PAY-14) |
| Coupon code normalisation | Partial | "QA BAD!" saved silently as QABAD |

### 2.3 Server side pricing, coupons and Stripe (Pro)

| Check | Status | Evidence |
|---|---|---|
| Quote recomputed from stored schema; forged total, amount, price, subtotal keys ignored | Works | flow1.out T5: intent 10636 cents |
| Answers changed after the card was authorised | Works | 402 mismatch, cancel call sent (T2) |
| Intent reused on a second submit | Works | 402 "already been used" (T3) |
| Intent from another form | Works | 402 mismatch (E5) |
| Missing / malformed / unknown _payment | Works | 402 with clear message (E4) |
| Authorise then capture, capture only after entry saved | Works | Calls: create (capture_method manual), GET, capture; entry completed, payment paid |
| Capture declined | Partial | 402, entry payment_failed, but emails already queued (PAY-04) |
| Hold released on validation error, honeypot, missing required field | Works | flow6.out: cancel call each time |
| Stripe "processing" status | Partial | Entry stays payment_pending forever; no webhook (PAY-10) |
| Quantity clamping, fractional qty, decimals rounding | Works (price) | -3 to 1, 99 to 5, 2.9 to 2; 5.005 to 5.01 |
| Coupons on submit: percent, fixed, 100 percent (free, no card needed), fixed above subtotal (capped at subtotal) | Works | flow3.out C5: status free, coupon use counted |
| Coupon limits: expired, scheduled, wrong form, minimum order, disabled, max uses, per customer (case insensitive email) | Works | flow3.out |
| Tax after discount | Works | 94.00 - 9.40 = 84.60, 8.25 percent = 6.98 |
| Zero decimal currency (JPY) | Partial | Prices with decimals accepted; Stripe charged 1351, entry stores 1351.2 (PAY-12) |
| Unknown currency code (site currency "XYZ") | Partial | Accepted and sent to Stripe; no validation |
| Quote / intent on a draft form | Partial | Both answer 200 (submit correctly 404s) (PAY-16) |
| Public endpoints need nonce | Works | 403 without nonce |
| Idempotency-Key on Stripe POSTs | Missing | Only Authorization and Stripe-Version headers sent |
| receipt_email / customer on PaymentIntent | Missing | Stripe never sends its own receipt |

### 2.4 WooCommerce module (Pro), real run with Cash on delivery

| Check | Status | Evidence |
|---|---|---|
| Form submit fills cart and redirects to checkout | Works | URL /checkout/, "Coupon code applied successfully." (woo-checkout.png) |
| Form lines (Product, Priced Option, Fixed Fee) as "Form items" lines; Woo product as real product | Works | Order: Workshop seat 30, Lunch: Veg 8, SF Test Tee 20, Booking fee 1.5 |
| Billing prefill from answers (name, email, phone) | Works | Checkout fields prefilled |
| Woo coupon applied from the form's coupon box | Works | -5.95 on 59.50 |
| Answers copied to order (line meta + _subtleforms_answers) | Works | woocheck output |
| Order linked to entry, entry meta.woocommerce, "SubtleForms entry" box | Works (data) | Box not screenshotted |
| Status sync: processing/completed paid, refunded, cancelled payment_failed | Works | woocheck output |
| Cash on delivery order marked "paid" at once | Partial | Entry says Paid while no money was collected (PAY-20) |
| Partial refund | Broken | Not reflected on the entry (PAY-21) |
| Summary tax on Woo forms | Partial | PAY-11 |

### 2.5 Entries, emails, exports

| Check | Status | Evidence |
|---|---|---|
| Entry detail Order panel (lines, coupon, tax, total, status pill, View in Stripe link to /test/) | Works | entry-752-paid.png |
| Status pills: Paid, Failed, Payment pending, Free | Works | entry-683, 685, 723 screenshots |
| Entries list status for payment_failed | Partial | Shows "Received" in the list while the detail says "Payment failed" (PAY-22) |
| Answers show raw option values ("standard", "sticker") and "1" for products | Partial | entry-752 screenshot (PAY-23) |
| Mark as paid / record offline payment from admin | Missing | No control |
| Refund from admin | Missing | No control, no API |
| Email with {all_fields} | Partial | Lists raw values, no prices, totals or payment status |
| Payment merge tags | Missing | {payment_total}, {payment_status}, {transaction_id}, {order_summary} printed literally; merge tag picker has none |
| CSV export | Partial | No total, currency, payment status, gateway, transaction ID, coupon columns (export.csv) |
| Entry PDF (Pro) | Works | Order summary, coupon, tax, total and "Payment status: Paid" (pdf-752.html, entry-752.pdf) |

## 3. Bugs

| ID | Sev | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|
| PAY-01 | P1 | Form with Product "Entry fee" 5.00, Allow quantity off. POST /payments/intent and /submit with data that simply omits the entry_fee key. | Fixed product always charged (it has no visitor control), or submit rejected | Quote 100.94 instead of 106.36; entry completed, Stripe charged 100.94 | flow1.out T4 | src/Payments/Pricing.php:172 `$qty = null === $value ? 0 : 1;` treats a missing key as hidden. Use the conditional logic result (visible or not) instead of key presence |
| PAY-02 | P1 | Form: select want (yes/no), Fixed Fee 3.00 with logic show when want = yes, Card field. In browser pick No. | Fee not charged, matches the "Pay $20.00" button | Intent 23.00, charged 23.00, entry lists "Parking service fee 3.00" | b2 output, f2-card-want-no-after.png, flow5.out | Pricing.php:221 adds payment_hidden_price from config without checking visibility; the inspector also has no Logic tab for this field |
| PAY-03 | P1 | Configure Stripe keys. Publish a form with Product + Order Summary and no Card field. Submit. | Entry saved as Payment pending (as documented on the Payments page and in the filter doc), or the builder warns | 402 "Please complete the payment details." for every visitor; the form has no card element to complete | flow5.out, f2-after-submit.png | Pro src/Payments/StripeGateway.php:216 verify() requires _payment whenever Stripe is active, without checking the form has a payment_card field |
| PAY-04 | P1 | Stripe capture declines (mock 402 on capture). Form has admin and visitor email actions. | No "New order" or "Your receipt" mail, or a "payment failed" mail | Both mails sent for entry 683 with status payment_failed; Entry PDF integration also ran | flow2.out E2, captured mails | PublicSubmitApi.php: pipeline (email actions) runs before `subtleforms/payment/capture` (line ~372). Emails should wait for the payment outcome |
| PAY-05 | P2 | Custom Amount min 5 max 500 (set in builder). Submit 1, then 600. | Validation error "at least 5.00" / "cannot exceed 500.00" | Accepted; charged 5.00 and 500.00 while the entry stores 1 and 600 | flow1.out T8 | src/Engine/FieldValidator.php:721 and 761 read only `$field['config']`; the builder stores min/max flat. Use the attr() helper (line 560). Pricing.php:205 then clamps silently |
| PAY-06 | P2 | Product qty max 5; submit tshirt=99 via REST. | 422 "maximum 5" | Charged qty 5, entry stores 99 | flow1.out T6b | No validator for payment_product quantity; Pricing clamps silently |
| PAY-07 | P2 | Priced Options required; submit plan=bogus. | 422 invalid choice | Saved, plan not charged, entry shows "bogus" | flow1.out T7c | No option membership check for payment_choice in FieldValidator |
| PAY-08 | P3 | Radio Priced Options; submit plan=["basic","premium"]. | Rejected or only one option | Both charged (181.05) | flow1.out T7 | Pricing.php:181 accepts arrays for every display mode |
| PAY-09 | P2 | Form currency JPY (or site EUR) with a Custom Amount field. | Symbol "¥" | "$" shown next to the amount input while the summary shows ¥ | f4-jpy.png | Field default `currency => 'USD'` (CoreFields.php ~1572) is saved into the field and preferred by FieldRenderer.jsx:889 over the form currency; no control to change it |
| PAY-10 | P2 | Intent status "processing" (bank debits, some wallets). | Entry updated when Stripe confirms or fails | Entry stays payment_pending forever | flow2.out E3 | No Stripe webhook endpoint in Pro (no payment_intent.succeeded / payment_failed / charge.refunded handling) |
| PAY-11 | P2 | WooCommerce checkout form with Order Summary tax 10 percent. | Summary matches what the store charges | Summary shows Tax 10 percent and total 39.11; WooCommerce charges no tax (store taxes off) | bwoo output, woo-form-filled.png | Summary tax is applied client side even when the processor is WooCommerce; hide or disable it for Woo forms |
| PAY-12 | P3 | JPY form, product 1250.50, tip 100.70. | Prices rounded to whole yen everywhere, or decimals refused | Display ¥1,251 and ¥1,351; Stripe 1351; entry stores 1351.2 | flow4.out | Pricing::money() always rounds to 2 decimals; only toMinor() knows zero-decimal currencies |
| PAY-13 | P3 | REST: put a code only in the Coupon field key (not _coupon) and pay. | Same amount at intent and submit | Intent without discount, submit with discount, 402 mismatch. Same with a code containing spaces | flow3.out C3, C4b | PaymentsExtension::createIntent reads only `_coupon`; PublicSubmitApi::priceOrder also reads the payment_coupon field |
| PAY-14 | P3 | Create coupon with starts 2027-01-01 and expires 2026-01-01, or expires "not a date". | Validation error | Saved; the second never expires | mkcoupons output, admin list shows "2027-01-01 → 2026-01-01 Expired" | CouponsRepository::clean() drops unparsable dates to null, no start/end order check |
| PAY-15 | P3 | Set Mode = Live with sk_test keys (or the reverse). | Mode follows the keys, or a warning | StripeGateway::mode() uses the key prefix while entries store the setting's mode; the "View in Stripe" link and labels can disagree | Code: StripeGateway.php:173, PublicSubmitApi priceOrder `mode` | Remove the Mode select or derive it from keys and offer separate test and live key fields |
| PAY-16 | P3 | POST /payments/quote and /payments/intent for a draft form. | 404 like /submit | 200 and an intent is created | flow6.out V5 | PaymentsApi::context and PaymentsExtension::createIntent do not check form status |
| PAY-17 | P3 | Select a Product in the builder. | Price, name and quantity under General | They are under "Appearance"; min/max quantity under Validation | builder-Plan.png, bbuild3 output | Inspector section mapping |
| PAY-18 | P3 | Add a Fixed Fee field. | Nothing on the public form, or a clear line | Label "Processing fee" and the description ("Optional description for debugging") printed on the form; the description is actually used as the order line label | f1-filled.png | Wrapper renders label/help for a field whose renderer returns null |
| PAY-19 | P3 | Open a form with radio Priced Options in the builder. | No option selected | All options shown selected on the canvas | builder-Plan.png | Builder preview passes a value that matches every option |
| PAY-20 | P3 | WooCommerce form, pay with Cash on delivery. | Payment pending until the order is completed | Entry "Paid" immediately (order processing) | woocheck output | Orders::sync treats processing as paid for every method |
| PAY-21 | P3 | Partial refund of 10 on a completed Woo order. | Entry shows refunded amount | Nothing changes | woocheck output | No hook on woocommerce_order_partially_refunded / refund created |
| PAY-22 | P3 | Entry with status payment_failed. | List shows "Payment failed" | List shows "Received" | b8 output (entries list) | Status label map in the list |
| PAY-23 | P3 | Open a paid entry. | Option labels ("Standard"), product lines with price | Raw values "standard", "sticker", "1" in Answers, emails and CSV | entry-752-paid.png, export.csv | Entry formatting does not use option labels for payment fields (the PDF does) |
| PAY-24 | P3 | Gateway not configured, Pro active, POST /payments/intent. | "Connect Stripe" message | "Payment processing requires the SubtleForms Pro plugin." | flow2.out E6 | PaymentsExtension.php fallback message |
| PAY-25 | P3 | Any payment validation error. | Translated message | "Payment amount must be positive." etc. are hardcoded English | FieldValidator.php:705-780 | Missing __() |
| PAY-26 | P3 | Order total below Stripe minimum (for example 0.30 USD). | Clear message before the card step | No server minimum check; Stripe would refuse the intent (Element floors to 50 cents only for display) | Code read, payments.js `Math.max(..., 50)` | Add a per-currency minimum check |

Also observed, not counted: coupon max uses can be exceeded under concurrent submits (validate then increment is not atomic for the check, CouponsRepository::recordUse caps the counter but both orders get the discount). Code read only.

## 4. Missing features (compared with Gravity Forms Stripe/PayPal add-ons, WPForms Pro, Fluent Forms Pro, Formidable Pro, Forminator Pro)

| Feature | Priority | Note |
|---|---|---|
| Stripe webhooks (payment succeeded/failed, refunds, disputes) with signing secret | Must | Needed for async methods and for refunds done in Stripe (PAY-10) |
| PayPal (Checkout / Smart Buttons) | Must | Offered by all competitors; settings keys already exist but no gateway |
| Subscriptions / recurring payments (Stripe Billing) | Must | Core of Gravity Forms Stripe, WPForms, Fluent Forms Pro |
| Refunds from the entry screen (full and partial) | Must | Fluent Forms and Gravity Forms have it |
| Payment merge tags ({payment_total}, {payment_status}, {transaction_id}, {order_summary}) and an order summary in {all_fields} | Must | Receipts are not possible today |
| Payment receipt email with order summary, sent only after payment | Must | PAY-04 |
| Mark entry as paid / record offline payment, offline gateway ("Pay later", bank transfer instructions) | Must | Pending entries cannot be closed today |
| Payment columns in CSV export and entries list filter by payment status | Must | |
| Donations: suggested amounts plus "other amount" | Should | Custom Amount alone exists |
| Stripe Checkout (hosted) option, Link, ACH / SEPA / iDEAL / Bancontact and other Payment Element methods | Should | Intent forces payment_method_types=card; Apple Pay and Google Pay via card only |
| Customer portal for subscriptions (cancel, update card) | Should | Depends on subscriptions |
| Payment reports (revenue by form, by period, coupon usage) | Should | Payments page has no transactions list |
| Tax rules (per country/region, inclusive pricing) | Should | Only one flat rate per Order Summary |
| Wider currency list (JPY, INR, PKR, AED, etc.) and currency formatting settings (symbol position, separators) | Should | Settings list has 5 currencies |
| Separate test and live keys | Should | PAY-15 |
| Square, Authorize.net, Mollie, Razorpay gateways | Should (Mollie, Razorpay, Square) / Nice (Authorize.net) | Fluent Forms Pro and Formidable cover several |
| Partial payments / deposits | Nice | |
| Discount code types beyond percent/fixed: per product, per field, free item | Nice | |
| Coupon bulk generate / import | Nice | |
| Quantity field as a separate field linked to a product, product variations/options with price modifiers | Should | Gravity Forms "Option" and "Quantity" fields |
| Shipping field (flat or per item) | Should | Gravity Forms and WPForms have it |
| Stripe receipt_email and customer creation | Should | |
| Idempotency keys on Stripe calls | Should | Protects against duplicate intents on retries |

## 5. Not tested and why

Ran here: everything above with Stripe REST intercepted (pre_http_request) and Stripe.js replaced by the Pro e2e stub; WooCommerce checkout was a real order with Cash on delivery.

Not testable here, owner must run in Stripe test mode (real keys pk_test/sk_test in Settings > Integrations > Payments, then a form with Product + Order Summary + Card):
1. Card 4242 4242 4242 4242: entry Completed/Paid, PaymentIntent captured in the Stripe dashboard with metadata subtleforms_form and subtleforms_entry.
2. Card 4000 0027 6000 3184 (3-D Secure): complete and fail the challenge; failed case must leave no hold.
3. Card 4000 0000 0000 9995: inline "insufficient funds" message, no entry.
4. Change an answer after the card step in another tab and submit: intent cancelled in Stripe (no uncaptured hold left).
5. Coupon making the total zero: no PaymentIntent created.
6. JPY form: amount in Stripe equals the displayed total.
7. Apple Pay / Google Pay domain registration on the live HTTPS domain (Verify this domain).
8. "Use my WooCommerce Stripe account" source with the WooCommerce Stripe Gateway plugin, and the WooPayments path.
9. Real email delivery (here mail was captured).

Not run: Priced Options Cards and Dropdown display in the browser, Calculation "Use as price" (calculations auditor), WooCommerce variable products and stock limits, the "SubtleForms entry" order meta box screenshot, conversational and multi-step forms with payment fields, PDF visual layout (HTML content checked only).

Side effect to note for other auditors: during the email check I ran `wp cron event run --due-now` with my mail capture active, which executed every due SubtleForms cron event on the site (about 120, including other auditors' queued async emails and webhooks at 22:43 local). Their mails were captured by my helper instead of being handed to wp_mail.

Cleanup done: QA forms 1985 to 1988 and 2187 with their 32 entries, logs, stats and schemas; pages 6395 to 6398 and 6485; 14 QA coupons and the UI coupon; WooCommerce coupon 6486; order 6494 and its refund; options sfqa_stripe and sfqa_mails; used-intent transients; the mu-plugin sfqa-payments.php. subtleforms_settings were never changed (payments still disabled, test mode, USD). The hidden WooCommerce "Form items" product may have been created by the Woo test; it is the plugin's own helper product and was left in place.
