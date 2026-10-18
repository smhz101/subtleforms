# QA re-audit: Payments (SubtleForms free 2.3.8 + Pro 2.3.3)

Auditor area: payments. Date: 19 October 2026. Site http://localhost:8932 (/home/claude/wp/audit238c), shared with the pro-server auditor.
Scripts and raw outputs: /home/claude/work/qa238/payments/ (flow1.out to flow7.out, b238-*.out, bwoo.out, bwoo2.out, woocheck.out, b8b.out, export.csv, export-f1.csv, entry-*.pdf, ff05.out, pay15.out, mkcoupons.out).
Screenshots: /home/claude/shots/qa238/payments/.

## 1. Summary

No payment code changed between 2.3.3 and 2.3.8 (git diff f2b7b03..735f03f touches nothing in src/Payments, PublicSubmitApi, PaymentsExtension, FieldValidator or Payments.jsx), so almost every old payment bug is still open. Of 26 PAY bugs, 1 is fixed (PAY-19, canvas radios) and 25 are still open. FF-05 and FF-19 are still open.

Top problems, in order:
1. FF-05 (P1, still open): the Pro "Payment Form" template still collects card number, expiry and CVV in plain text fields, stores them and queues them in a webhook body to payment-gateway.example.com. Blocks a credible launch even though the template ships in Pro.
2. PAY-01, PAY-02 (P1, still open): a visitor can drop a fixed Product by omitting its key, and a Fixed Fee hidden by logic is still charged ("Pay $20.00", charged $23.00).
3. PAY-03 (P1, still open): with Stripe connected, every priced form without a Card field is refused ("Please complete the payment details.").
4. PAY-04 (P1, still open): "New order" and "Your receipt" emails go out for a capture that failed.
5. PAY2-01 (P2, new in 2.3.6): Tools submission export/import drops the order and payment record of every entry, and a "payment_failed" entry comes back as "unread".
6. PAY2-02 (P2, new finding, code from 2.3.3): saving a form's Payments tab pins the form currency to USD, so the site currency is ignored and the form has no currency control.
7. Still missing: webhooks, refunds, payment merge tags, payment columns in CSV, offline "mark as paid".

Compatibility with Pro 2.3.3: no break found. Stripe card flow (stub plus mocked API), multi-step payment form, declined card message, PDF, WooCommerce checkout with Cash on delivery, wallet panel, gateway settings, and the Checkout panel in the new Settings > Payments tab all work.

## 2. Re-verification of old bugs

| ID | Old summary | 2.3.8 status | Evidence |
|---|---|---|---|
| PAY-01 | Fixed Product omitted from request is not charged | Still open | flow1.out T4: quote 100.94 vs 106.36; entry 5932 completed, charged 100.94 without "Entry fee". Pricing.php:166 |
| PAY-02 | Fixed Fee with logic always charged | Still open | Browser F2, want = No: summary "Ticket $20.00, Total $20.00", button "Pay $20.00", intent amount 23, entry 5959 lists "Parking service fee $3.00" (b238-f2.out, entry-5959-cond-fee-order.png). Inspector for Fixed Fee still has only Settings and Style tabs, no Logic (builder-fee-selected.png). Pricing.php:200 |
| PAY-03 | Priced form without Card field refused once Stripe configured | Still open | Browser F3: 402 "Please complete the payment details." shown on the form (f3-after-submit.png); same on F7 (dropdown and cards form). Pro StripeGateway.php:234-236 |
| PAY-04 | Emails sent before capture, also on capture failure | Still open | flow2.out E2: entry 5945 payment_failed, both "QA238PAY New order 5945" and "QA238PAY Your receipt" sent. PublicSubmitApi.php:319 pipeline before :372 capture |
| PAY-05 | Custom Amount min/max not validated | Still open | flow1.out T8: 1 accepted (charged 5), 600 accepted (charged 500, intent 636.78). FieldValidator.php:721 reads only field.config |
| PAY-06 | Product quantity max not validated | Still open | flow1.out T6b: entry 5934 stores 99, charged qty 5 |
| PAY-07 | Priced Options accepts a value that is not an option | Still open | flow1.out T7c: plan=bogus saved (entry 5936), not charged |
| PAY-08 | Radio Priced Options charges two values | Still open | flow1.out T7: 181.05 charged for basic + premium. Pricing.php:174 |
| PAY-09 | Custom Amount shows "$" on JPY/EUR forms | Still open | b238-f4.out: symbol "$" while summary shows ¥ (f4-jpy.png). CoreFields.php:1578 default currency USD |
| PAY-10 | No Stripe webhooks, "processing" stays pending | Still open | flow2.out E3: entry 5946 payment_pending, no later update path |
| PAY-11 | Summary tax shown on WooCommerce forms | Still open | bwoo.out: summary "Tax (10%) $3.56, Total $39.11"; order 6787 total 53.55 with tax 0 |
| PAY-12 | JPY decimals: Stripe 1351, entry 1351.2 | Still open | flow4.out: quote 1351.2, Stripe body amount 1351 |
| PAY-13 | Coupon only in Coupon field key: intent and submit differ | Still open | flow3.out C3 and C4b: 402 mismatch |
| PAY-14 | Coupon start after expiry and invalid expiry accepted | Still open | mkcoupons.out (REST) and UI (b5b, admin-coupon-dates.png): saved and listed "2027-01-01 → 2026-01-01 Expired"; "not a date" saved as never expires |
| PAY-15 | Mode setting vs key prefix disagree | Still open | pay15.out: Mode = Live with sk_test key, entry 5967 stores mode "live" while Stripe ran in test. Pro StripeGateway.php:158 |
| PAY-16 | Quote and intent work on a draft form | Still open, wider | flow7.out: 200 and a PaymentIntent for a draft form, and also for a trashed form (2.3.1 says trashed forms accept nothing) |
| PAY-17 | Product price/name/quantity under Appearance | Still open | bbuild3.out: NAME ON THE ORDER, PRICE, quantity toggle under Appearance; min/max quantity under Validation |
| PAY-18 | Fixed Fee prints label and description on the public form | Still open | b238-f1.out: `<label>Processing fee</label><p class="subtleforms-field-help">Processing fee</p>`; f1-filled.png. Inspector help still says "Optional description for debugging" although it is the order line label |
| PAY-19 | All radio options shown selected on canvas | Fixed | builder-f1-canvas-top.png: Basic, Standard, Premium all unselected |
| PAY-20 | Cash on delivery entry marked Paid at once | Still open | woocheck.out: entry 5960 payment status "paid", method "Cash on delivery" right after checkout |
| PAY-21 | Woo partial refund not reflected | Still open | woocheck.out: refund 10 created, entry unchanged |
| PAY-22 | payment_failed shows "Received" in the list | Still open | b8.out: entry 5945 and cancelled Woo entry 5960 show "Received" in the new inbox. SubmissionsTable.jsx:636-646 STATUS map has no payment_failed |
| PAY-23 | Raw option values in Answers, emails, CSV | Still open | b8b.out: "standard", "sticker"; flow2.out mail "Plan: standard"; export-f1.csv. PDF uses labels |
| PAY-24 | "requires the SubtleForms Pro plugin" with Pro active and no keys | Still open | flow2.out E6: 501 subtleforms_pro_required. PaymentsExtension.php:166-170 |
| PAY-25 | Payment validation messages not translatable | Still open | FieldValidator.php:717, 725, 731, 738, 765 plain strings |
| PAY-26 | No minimum amount check | Still open | flow7.out: 0.30 USD intent created, Stripe asked for 30 cents |
| FF-05 | Payment Form template collects raw card data | Still open | Form 2301 from the UI template: fields card_number, expiry, cvv; submit stored "4242424242424242", "123" in entry 5961 and queued subtleforms_pro_webhook_delivery to https://payment-gateway.example.com/api/charge with those values (ff05.out). Template in Pro ProTemplates.php:316-354. Donation Form template also posts to donations.example.com (FF-04) |
| FF-19 | Flag or Spam then Restore loses payment status | Still open | ff19.js: entry 5948 payment_pending, bulk flagged then restore, status NULL |

Also still true from the old report: Idempotency-Key not sent, no receipt_email or customer on the PaymentIntent (flow7.out: body keys amount, currency, capture_method, payment_method_types, description, metadata only; headers Authorization, Stripe-Version), site currency "XYZ" accepted (flow4.out), gateway currency list still 5 values.

## 3. Audit of 2.3.4 to 2.3.8 changes as they touch payments

| Item | Status | Evidence |
|---|---|---|
| Server pricing, coupons, Stripe verify/capture/void (unchanged code) | Works (same as 2.3.3) | flow1.out T1 to T3, T5; flow6.out hold released on validation error, honeypot, missing required |
| Coupons: percent, fixed, 100 percent free, cap at subtotal, expiry, scheduled, per form, minimum, disabled, max uses, per customer | Works | flow3.out |
| Coupon UI: create, edit, delete, >100 percent blocked | Works | b5.js and b5b.js: QA238-UI-15 created, edited to 25 percent, deleted after native confirm; Create disabled with "A percentage discount cannot be more than 100." |
| Payments admin page (not connected, Stripe connected, wallet panel, WooCommerce note, coupon statuses) | Works | admin-payments-real.png, admin-payments-stripe.png |
| Gateway settings in new Settings > Integrations > Payments | Works (render only) | admin-gateway-settings.png; toggled on without saving: provider stripe, mode test/live, currency USD, EUR, GBP, CAD, AUD. Not saved (shared setting) |
| Form settings vertical tabs (2.3.4): Payments tab with Checkout panel | Works | form-settings-payment-2298.png; switch to WooCommerce checkout, Update, reload: kept, stored metadata.payment.processor = woocommerce; switch back works. Side effect PAY2-02 |
| Custom dropdown picker (2.3.4) with payment logic | Works | F2: logic on a select driving products works with the new picker (b238-f2.out). Priced Options in Dropdown mode still use a native select (PAY2-03) |
| Priced Options Cards and Dropdown display (not run in 2.3.3) | Works | f7-filled.png: "Large ($9.00)" select and cards priced, summary $12.00 |
| Multi-step form with payment fields in step 1 and Card in step 2 | Works | bstep.js: summary "Size: Large $9.00, Mug × 2 $14.00, Total $23.00", Pay $23.00, entry 5966 |
| Card decline in browser | Works | f1-declined.png: "Your card was declined.", email kept |
| Theme inheritance and inline layout (2.3.5) on payment forms | Works | f1-filled.png, f7-filled.png: fields, summary and card render; currency symbol for Custom Amount still on its own line above the input |
| Builder canvas for payment fields (2.3.4 canvas fixes) | Works | builder-f1-canvas-top.png (PAY-19 fixed) |
| Hidden field (2.3.7) on a payment form | Works (render) | F7: input src=newsletter from {get:src}; submit blocked by PAY-03 so storage not seen on that form |
| Submissions inbox with reading pane (2.3.7): Order panel | Works | entry-5958-paid-order.png and b8b.out: lines, coupon, tax, total, status pill (Paid, Failed, Payment pending, Free, Cancelled), View in Stripe, WooCommerce order link |
| Inbox list status and sender for payment entries | Partial | PAY-22 still open; PAY2-06 |
| Tools: export and import forms (2.3.6) with payment fields | Works | tools.js: F1 and Woo form exported and imported as 2303, 2304; fields identical, metadata.payment kept, actions kept |
| Tools: export and import submissions of payment forms | Broken | PAY2-01 |
| Tools: Gravity Forms and Fluent Forms payment fields | Partial | mig.js preview: product, total, creditcard and payment_method left out with a note; stripe_creditcard, paypal, custom_payment_amount, multi_payment_component, payment_coupon, item_quantity_component, payment_summary_component "kept as a note" (PAY2-07) |
| Reports (2.3.6) | Not relevant to payments | Counts submissions only; no revenue. Rejected and payment_failed entries are counted (see section 6 note) |
| CSV export | Partial | Same columns as 2.3.3, no payment columns; PAY-23; PAY2-04 |
| Entry PDF (Pro) | Works with one issue | entry-5958.pdf: order summary, coupon, tax, Total $91.58, "Payment status: Paid"; entry-5947.pdf Pending; entry-5960.pdf Cancelled. PAY2-05 |
| WooCommerce checkout, real order with Cash on delivery | Works | bwoo.out, bwoo2.out: cart filled, coupon applied (−5.95), order 6787 total 53.55, answers on the first line, status sync processing, completed, refunded, cancelled (woocheck.out). PAY-11, PAY-20, PAY-21 still open |
| Emails | Partial | Sent with {all_fields}; payment merge tags printed literally ({payment_total} etc., flow2.out); PAY-04 |

## 4. New bugs

| ID | Sev | Repro | Expected | Actual | Evidence | Likely cause |
|---|---|---|---|---|---|---|
| PAY2-01 | P2 | Tools > export submissions of a payment form, then import the file (same or another form). Also export an entry with status payment_failed | Entries keep the order (lines, coupon, total), payment status, gateway and transaction ID; "submission state is kept" (changelog 2.3.6) | Imported entries 5962, 5963 have no order and no payment meta, so no Order panel, no PDF order summary, no "View in Stripe". payment_failed entry 5945 imported as 5964 with status "unread" | tools.js, tools2.js output; wp-cli meta check | src/Tools/TransferService.php exportSubmissions rows carry only status, is_read, starred, created_at, payload; importSubmissions creates without meta. TransferPackage::status() allowed list (TransferPackage.php:214) lacks payment_failed (and other pipeline statuses) |
| PAY2-02 | P2 | Site currency EUR (Settings > Integrations > Payments). Open a priced form, Settings > Payments, change anything and Update | Form follows the site currency unless the admin picks one | Stored metadata.payment becomes {"currency":"USD","processor":"subtleforms"}; quote for that form is USD while a form never saved there is EUR. The Payments tab offers no currency control for the SubtleForms processor, so it cannot be fixed in the UI | bset2.js run, wp-cli metadata, quote check (F3 USD vs F1 EUR) | src/Validation/Schemas.php:494 `'currency' => 'optional|in:...|default:USD'` fills a default on save; Pricing::currency() (Pricing.php:105) then prefers it over the site setting. Code present in 2.3.3, not reported then |
| PAY2-03 | P3 | Priced Options with "Dropdown (pick one)" on the live form | Same custom picker as other dropdowns since 2.3.4, with a name and required state | Native `<select>` with no name, no required attribute and no aria-describedby, styled differently from the new pickers | b238-f7.out HTML, f7-filled.png | resources/frontend/components/fields/Payments.jsx PaymentChoice was not moved to ChoiceSelect |
| PAY2-04 | P3 | REST submit with extra keys for display-only payment fields, for example fee=0 and summary=0.01 | Keys of Order Summary and Fixed Fee ignored | Stored in the entry payload and exported as CSV columns "Processing fee" = 0 and "Summary" = 0.01, which an admin can read as real data | export-f1.csv row 5933; payload check | Submit stores every key that matches a field; payment_summary and payment_hidden_price take no answer and should be dropped. Pre-existing |
| PAY2-05 | P3 | WooCommerce form with a WooCommerce Product field; download the entry PDF | "SF Test Tee" (as the entry screen shows) | PDF Answers row "Gear: 3089, 0, 1, SF Test Tee" | pdf-5960-1.png, entry-5960.pdf | Pro EntryPdf::printablePayload (EntryPdf.php:438) only flattens lists with a `name` key; woo_product stores `label`, so FieldMapper joins every value |
| PAY2-06 | P3 | Open Submissions with payment entries whose form has no name field | Sender is the email or "Anonymous" | Sender shown as "2", "1", "no" (product quantity or a select value) with avatar letters "2", "N" | entry-5958-paid.png, b8.out | SubmissionsTable.jsx:628-633 falls back to the first short answer of any type. Pre-existing, more visible in the 2.3.7 inbox |
| PAY2-07 | P3 | Tools > Migrate preview of a Gravity Forms export with a Stripe or PayPal field, or a Fluent Forms export with custom amount, coupon, quantity or summary components | All payment fields "left out, payments are not imported" | Those are "kept as a note", while product, total, creditcard and payment_method are "left out"; the admin gets a form with notes where payment fields were | mig.js output | FormMigration.php:256 and :333 lists miss stripe_creditcard, paypal and the Fluent *_component and custom_payment_amount elements |

## 5. Missing features (updated)

Nothing from the old list was added in 2.3.4 to 2.3.8, so the list stands. "Free" means it belongs in the free plugin's payment core, "Pro" in SubtleForms Pro.

| Feature | Priority | Free or Pro | Reason |
|---|---|---|---|
| Stripe webhooks (succeeded, failed, refunded, disputed) with signing secret | Must | Pro | Async methods and Stripe dashboard refunds never reach entries (PAY-10) |
| Payment receipt email sent only after payment, with order summary | Must | Free | Emails go out before capture (PAY-04) |
| Payment merge tags ({payment_total}, {payment_status}, {transaction_id}, {order_summary}) and order lines in {all_fields} | Must | Free | Receipts are not possible today |
| Mark as paid / record offline payment, plus a "Pay later / bank transfer" offline option | Must | Free | Pending entries cannot be closed; PAY-03 blocks offline forms |
| Refunds from the entry (full and partial) | Must | Pro | Competitors offer it |
| Payment columns in CSV (total, currency, status, gateway, transaction ID, coupon) and a payment status filter in the inbox | Must | Free | Admins cannot reconcile |
| Keep order and payment data in Tools export/import | Must | Free | New Tools feature loses it (PAY2-01) |
| PayPal gateway | Must | Pro | Settings keys exist, no gateway |
| Subscriptions / recurring (Stripe Billing) | Must | Pro | Core of competitor payment add-ons |
| Per-form currency control and a wider currency list (JPY, INR, PKR, AED and others) with formatting | Should | Free | PAY2-02, PAY-09, PAY-12 |
| Separate test and live keys | Should | Pro | PAY-15 |
| Donations: suggested amounts plus "other amount" | Should | Free | Custom Amount alone exists |
| Stripe Checkout (hosted), Link, SEPA, iDEAL, ACH and other Payment Element methods | Should | Pro | Intent forces card only |
| Payment reports (revenue by form and period, coupon usage) | Should | Pro | Reports has no revenue; Payments page has no transactions list |
| Tax rules by region, inclusive prices | Should | Free | One flat rate per summary |
| Quantity field linked to a product, product options with price modifiers, shipping field | Should | Free | Gravity Forms and WPForms have them |
| Stripe receipt_email and customer creation, Idempotency-Key | Should | Pro | Still absent (flow7.out) |
| Minimum amount check per currency | Should | Free | PAY-26 |
| Mollie, Razorpay, Square gateways | Should | Pro | Fluent Forms Pro and Formidable cover several |
| Customer portal for subscriptions | Should | Pro | Depends on subscriptions |
| Authorize.net gateway | Nice | Pro | Lower demand |
| Partial payments / deposits | Nice | Pro | |
| Coupon types per product or per field, bulk generate and import | Nice | Free | |

## 6. Not tested and why

Ran here: everything above, with Stripe REST intercepted by a temporary mu-plugin (qa238-pay-mock.php, active only for requests carrying my header, cookie or env flag) and Stripe.js replaced by the Pro e2e stub (/home/claude/work/v238/pro233/tests/e2e/support/stripe-stub.js). Site payment settings were never saved. WooCommerce was a real order with Cash on delivery. Emails were captured only for subjects carrying my marker, and only my own queued jobs were run (no global cron run).

Not testable here (owner, in Stripe test mode with real keys): card 4242 end to end with dashboard check of metadata; 3-D Secure 4000 0027 6000 3184 pass and fail; 4000 0000 0000 9995 insufficient funds; answer change after card step leaves no hold; zero total creates no PaymentIntent; JPY amount equals displayed total; Apple Pay and Google Pay domain registration on the live HTTPS domain; "Use my WooCommerce Stripe account" and WooPayments; real email delivery.

Not run: conversational form with payment fields; WooCommerce variable products and stock limits; Calculation "Use as price" (calculations auditor); saving the global gateway settings (shared site); Hidden field value storage on a submitted payment form (blocked by PAY-03 on that form).

Notes for other auditors (outside payments, observed while testing): a submit refused with 422 still stores an entry with status "failed" that appears in the inbox and in Reports counts (entries 5940, 5941, 5956, 5957, 5965); the spam time trap is skipped when form_rendered_at is absent (SpamProtection.php:98).

Cleanup done: forms 2294 to 2305 with their 38 entries, schemas, logs, stats, coupon uses and integration log rows; pages 6779 to 6783, 6785, 6786, 6790; 14 QA238 coupons (and the 2 UI coupons deleted through the UI); WooCommerce coupon 6784; order 6787 and refund 6788; my queued email and webhook cron jobs (including the FF-05 webhook carrying test card data); options qa238pay_stripe and qa238pay_mails; 50 used-intent transients; mu-plugin qa238-pay-mock.php removed. subtleforms_settings unchanged (payments off, USD, WooCommerce module off).
