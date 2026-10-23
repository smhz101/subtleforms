# Hooks for add-ons

This page lists the hooks an add-on such as SubtleForms Pro uses to add field types, prices and computed values. Everything the free plugin ships works without any of them.

## Field types (PHP)

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/fields/register` | action `( FieldRegistry $registry )` | Register a `FieldDefinition`. Fires before the free types are added, so an add-on can also replace one. |
| `subtleforms/fields/validate_value` | filter `( ?string $error, string $type, mixed $value, array $field )` | Return an error message for a bad value of your type, or null. |
| `subtleforms/fields/non_input_types` | filter `( string[] $types )` | Types that never collect an answer, so they cannot be required. |
| `subtleforms/fields/addon_types` | filter `( string[] $types )` | Types that exist only while an add-on registers them. Default: `signature`, `calculation`, `payment_card`, `payment_product`, `payment_choice`, `payment_amount`, `payment_summary`, `payment_coupon`, `payment_hidden_price`. When the type is not registered, the live form leaves those fields out and the builder shows a note. A payment type makes the whole form unavailable instead. |
| `subtleforms/public_schema` | filter `( array $schema, int $formId )` | The schema sent to the browser to render a form. |

## Computed values and prices (PHP)

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/submission/computed_values` | filter `( array $payload, array $schema )` | Work out computed fields (Pro Calculation) from the submitted values. Runs before conditional logic, validation, pricing and storage, and before payment quotes. Use `PublicSubmitApi::COMPUTE_ERROR` for a value that cannot be worked out; it is never stored. |
| `subtleforms/payments/is_priced` | filter `( bool $priced, array $schema )` | Return true when your field type makes the form take money. |
| `subtleforms/payments/line_items` | filter `( array $items, array $schema, array $payload )` | Add order lines for your field type. Each line: `key`, `label`, `qty`, `unit`, `amount`. |
| `subtleforms/payments/card_minimum` | filter `( float $min, string $currency )` | The smallest card charge for a currency. Defaults to Stripe's published figure; raise it when the account settles in another currency. |
| `subtleforms/payments/quote` | filter `( array $quote, array $schema, array $payload )` | The final order. Set `formula_error` to true when a charged amount cannot be worked out; the submission is then refused and nothing is charged. |
| `subtleforms/payment/verify` | filter `( array\|WP_Error\|null $result, array $quote, array $payload, int $formId, array $schema )` | Gateways confirm the payment here. |

## Field types (JavaScript)

Add-on scripts call these on `window.SubtleFormsExtend`. Load your script after the `subtleforms-frontend` (or admin) script.

| Function | Use |
| --- | --- |
| `registerFieldType( type, { component, input, isAnswerable } )` | The live form renderer for your type. `isAnswerable( config )` returns false when a field has nothing to show. |
| `registerPricedType( type, fn, { isPriced } )` | Order lines for the live summary: `fn( config, value, { currency } )` returns `[ { label, qty, unit } ]`, or `{ error: true }`. `isPriced( config )` says whether a field charges money (default: always). |
| `registerValueComputer( fn )` | `fn( fields, values )` returns the values with computed fields filled in, or the same object when nothing changed. Runs whenever an answer changes. |
| `registerCanvasPreview( type, Component )` | The builder canvas preview. |
| `registerInspectorControl( type, Component )` | A builder settings control for a PHP `inspectorControls` type (for example `formula`). |

## Settings tabs (JavaScript)

The Settings screen lists Tools and MCP. Add-ons register the body of a tab on `window.SubtleFormsExtend` from a script that loads after the `subtleforms-admin` script on SubtleForms admin pages:

```js
window.SubtleFormsExtend.registerSettingsTab( 'mcp', {
	component: McpSettings, // takes no props
	title: 'MCP', // optional, overrides the Free title
	description: '...', // optional, overrides the Free description
} );
```

| Name | Result |
| --- | --- |
| `mcp` | Replaces the note that Free shows (what MCP is, with an upgrade link) in the existing MCP tab. |
| any other `[a-z0-9-]+` name | Adds a tab to the Pro group. `title` is required; `description` and `order` (a number, default last) are optional. |

The tab opens at `admin.php?page=subtleforms-settings#tab=<name>`. The body looks after its own data and saving, so Settings shows no Save button or save bar for it. Tools is part of Settings now: `admin.php?page=subtleforms-tools` redirects to `#tab=tools`.

## Capabilities

`subtleforms/capabilities` filters the capability map. The free plugin only reads capabilities that are on by default. Keys such as `fields.advanced`, `actions.payment`, `extensions.*`, `templates.pro` and `branding.white_label` belong to SubtleForms Pro: Pro adds them and only Pro code reads them.

## Moved to Pro in 2.7.0

Picture choice, several files per upload field, advanced conditional logic and form analytics are part of SubtleForms Pro. The free plugin holds no working code for them. It keeps the extension points below, a plain fallback for forms that already use them, and Pro placeholders in the screens.

`SubtleForms\Support\ExtensionPoints` names the four points (`picture_choice`, `multi_file_uploads`, `advanced_logic`, `analytics`) and its `LEVEL` constant (2) is the contract version. Level 2 adds the logic, upload and add-on feature hooks of 2.7.0 and the `FeatureGate` setters. An add-on checks `ExtensionPoints::has( $name )` before it registers, so it never registers twice against an older plugin that still ships the feature. It reports what it runs through:

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/addon/features` | filter `( string[] $names )` | Return the extension point names the add-on runs. The admin script reads them as `subtleformsAdmin.addonFeatures`. |
| `subtleforms/extensions/enabled` | filter `( bool $enabled, string $slug )` | Whether an extension (for example `analytics`) is available in Settings. |

### Field types and uploads (PHP)

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/fields/register` | action `( FieldRegistry $registry )` | Register `picture_choice` with a `FieldDefinition`. Existing hook. |
| `subtleforms/fields/validate_value` | filter | Validate the type. Existing hook. |
| `subtleforms/uploads/max_files` | filter `( int $max, array $field )` | Files accepted for one upload field. Default 1. Pro returns the field's own limit. |
| `subtleforms/fields/inspector_controls` | filter `( array $controls, string $type )` | Change the settings controls of a field type. Free ships a `pro_notice` control named `multiple` on file uploads; Pro replaces it with the real toggle and a `maxFiles` number. |

Without Pro, a saved `picture_choice` is shown, checked and stored as a radio group, or as a multiple choice when `allowMultiple` is true. A saved multi-file upload accepts one file, and a request that posts more is refused with "You can attach up to 1 file". Nothing in the saved form JSON is changed.

### Conditional logic (PHP)

Free evaluates one group, all rules must match, with `equals`, `not_equals`, `contains`, `not_contains`, `empty`, `not_empty`, `greater_than` and `less_than`, on fields. Anything else (groups, "any", `starts_with`, `ends_with`, `in`, `not_in`, `between`, `before`, `after`, logic on steps, actions and confirmations) is ignored: the field is shown, the step is shown, the action runs and the default confirmation is used. The server never refuses a form because of rules it does not know.

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/logic/supports` | filter `( bool $supported, array $logic, string $scope )` | Return true when the add-on can evaluate this logic. |
| `subtleforms/logic/passes` | filter `( ?bool $result, array $logic, array $values, array $fields_by_key, string $scope, $engine )` | Return the outcome for logic Free cannot evaluate, or null to use the default. |
| `subtleforms/logic/evaluate_condition` | filter `( ?bool $result, mixed $value, string $operator, mixed $compare, mixed $compare2, array $field, $engine )` | Evaluate one operator Free does not know. |

Scopes are `field`, `step`, `action` and `confirmation`. `ConditionalLogic::logicPasses`, `hasLogic`, `isBasic`, `isSupported` and the value helpers are public for add-ons.

### Analytics (PHP)

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/submission/imported` | action `( int $id, int $formId, string $status, string $created_at )` | A submission was imported, so a counter can include it. |
| `subtleforms/form/deleted` | action `( int $id )` | A form was deleted, so the add-on removes its own rows. |
| `subtleforms/frontend/enqueued` | action | Enqueue the add-on front-end script. Existing hook. |

Counts already stored in the `subtleforms_stats` and `subtleforms_funnel` tables stay when the plugin is updated, and the add-on adopts them. `Settings::update` keeps stored keys it has no rule for, so the old `ext_analytics_*` values survive.

### JavaScript (`window.SubtleFormsExtend`)

| Function | Use |
| --- | --- |
| `registerFieldOverride( type, { applies( field, config ), component } )` | Replace the live renderer of a core type for some fields (Pro uses it for multi-file uploads). |
| `registerLogicExtension( { supports, passes, evaluateCondition } )` | Browser side of the logic hooks. Functions get a helpers object: `toText`, `listOf`, `norm`, `isNumeric`, `isEmptyValue`, `textEquals`, `countryEquals`, `readValue`, `today`, `evaluateCondition`. |
| `registerLogicEditor( Component )` | Replace the builder logic editor. It gets the editor props (`logic`, `availableFields`, `onChange`, `scope`, `disabled`, ...) plus `countries` (the country list for country rules) and `Fallback`, the free editor. |
| `registerSlotItem( slot, id, { component, order } )` | Add an item to a screen slot. |
| `registerFormMountHook( fn )` | `fn( { container, formId, config } )` runs when a form mounts on a page (view beacon, funnel tracker). |
| `registerFieldType`, `registerInspectorControl`, `registerCanvasPreview` | Existing. |

Slots: `reports.panels` and `dashboard.panels` (props: `forms`), `forms.list.column` (`{ component( form ), header, order }`), `settings.extensions` (id is the extension slug), `form.integrations` (props: `schema`, `integrations`, `patch`, `isReadOnly`) and `form.confirmations` (props: `schema`, `onMetadata`, `isReadOnly`).

The front end dispatches the `subtleforms:submitted` event on `document` with `detail.formId` after a successful send. Field wrappers carry `data-sf-key` and steps carry `data-sf-step`, which Pro reads for the funnel.

Upgrade keys used by the placeholders: `fields.picture_choice`, `uploads.multiple`, `logic.conditional.advanced`, `extensions.analytics`.

## Add-on boot and gate (PHP)

`SubtleForms\Support\FeatureGate` is the one gate in the container. An add-on sets its own pieces on it instead of replacing the container entry, so every service that already holds the gate sees them.

| Method | Use |
| --- | --- |
| `FeatureGate::setLicenseManager( ?object $manager )` | Give the gate a license manager: any object with `isValid()` and `hasFeature( string )`. Pass null to remove it. An object without both methods throws `InvalidArgumentException`. Since 2.7.1. |
| `FeatureGate::setCapabilities( Capabilities $caps )` | Swap the capability map, for example after the add-on has added its `subtleforms/capabilities` filter. Since 2.7.1. |

## Orders (PHP, 2.8.0)

Payments are part of SubtleForms Pro. The free submit route keeps two hooks where the order is priced and finished, and does nothing else with money.

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/submit/price_order` | filter `( array\|WP_REST_Response $order, int $formId, mixed $schema, array $payload, WP_REST_Request $request, ?array $logicValues )` | Price the order, check the coupon and confirm payment. The start value is an empty order (`quote`, `coupon`, `payment`, `customer` all empty). Return the order array, or a `WP_REST_Response` to refuse the submission. Anything else is ignored. |
| `subtleforms/submit/finish_order` | action `( int $submissionId, array $submission, array $order, string $status, ?SubmissionContext $context )` | Fires at each step of a priced order. Status `saved`: the entry is stored and the order has a `payment`; settle it and report with `$context->setMeta( 'order_result', array( 'error' => string ) )` (the visitor gets HTTP 402) or `array( 'payment' => array )`. Status `abandoned` (ID 0): the order will not be stored, release what it holds. Any other status is the final status of the entry; store the order on it and count the coupon. |

The free plugin has no other payment hook. Gateways are the add-on's business: how it confirms, captures or voids money is not part of this plugin.

A form with a payment field and no add-on that registers it is not shown to visitors ("This form is not available right now.") and does not accept entries.

## Spam time token (PHP)

The page carries a render ticket (`t1.<time>.<form id>.<signature>`), the same for every visitor of a cached page. It is never accepted for a submission. On first interaction the browser trades it with `POST /forms/{id}/spam-token` (rate limited per client address) for a single-use submit token (`s1.<time>.<form id>.<nonce>.<signature>`) that keeps the render time, so the minimum-time check still applies. `s2` is the same for a visitor whose page was open longer than two hours. A submit token is claimed on use; a replay is dropped like any other spam.

## Visitor IP (PHP and settings)

`SubtleForms\Security\ClientIp::get()` is the only place that reads `REMOTE_ADDR`. The rate limiter, the CAPTCHA check, uploads and the address stored on an entry all call it, so they agree. By default it returns `REMOTE_ADDR` and ignores forwarding headers, because a visitor can send any header. Two settings (Settings, Advanced, Visitor IP behind a proxy) let the site owner say which proxies to believe:

| Setting | Type | Use |
| --- | --- | --- |
| `trusted_proxy_cidrs` | array of strings | IP addresses or CIDR ranges (for example `10.0.0.0/8`). Only a request from one of these may name the visitor in `X-Forwarded-For`; the header is read from the right and skips trusted hops. Invalid entries are refused when saving. Default: empty. |
| `trust_cloudflare` | bool | Trust Cloudflare's published ranges and read `CF-Connecting-IP` from them. Default: false. |

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/client_ip/trusted_proxies` | filter `( string[] $trusted )` | Change the trusted addresses and ranges, for example to read them from a host's configuration. |

## Time token route

A form page that stays open or is cached for hours holds an expired time token. The front end trades it for a fresh one just before it submits.

`POST /wp-json/subtleforms/v1/forms/{id}/spam-token` with `token` (the old token). It is public and rate limited. It answers `{ "data": { "spam_token": "..." } }` only for a validly signed token of that published form; a missing or forged token, or an unknown or unpublished form, gets 404, so a token can never be created from nothing.
