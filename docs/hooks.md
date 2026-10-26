# Hooks for add-ons

This page lists the hooks an add-on such as SubtleForms Pro uses to add field types, computed values and its own steps around a submission. Everything the free plugin ships works without any of them, and none of them carries a feature of its own.

## Field types (PHP)

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/fields/register` | action `( FieldRegistry $registry )` | Register a `FieldDefinition`. Fires before the free types are added, so an add-on can also replace one. |
| `subtleforms/fields/validate_value` | filter `( ?string $error, string $type, mixed $value, array $field )` | Return an error message for a bad value of your type, or null. |
| `subtleforms/fields/non_input_types` | filter `( string[] $types )` | Types that never collect an answer, so they cannot be required. |
| `subtleforms/fields/addon_types` | filter `( string[] $types )` | Types that exist only while an add-on registers them. The default lists the add-on types that forms saved with earlier versions may contain (`signature`, `calculation` and the `payment_*` types), so those forms keep loading. When the type is not registered, the live form leaves those fields out and the builder shows a note. A saved `payment_*` field makes the whole form unavailable instead ("This form is not available right now."). |
| `subtleforms/fields/no_answer_types` | filter `( string[] $types )` | Add-on types that show something but hold no answer. Entries, emails, webhooks, merge tags, logic rules and the "has an input field" check leave them out. Since 2.7.2. |
| `subtleforms/public_schema` | filter `( array $schema, int $formId )` | The schema sent to the browser to render a form. |

Field definitions an add-on registers may set these `meta` keys, which the builder reads (sent as `subtleformsAdmin.fieldTypeFlags`): `noMessages` (no required or error messages), `logicOnly` (shown or hidden by logic, takes no answer), `notInRepeater` (cannot go inside a Repeater), `logicHelp` (the intro of the Logic tab). Name a library section with `registerFieldCategory` (JavaScript).

## Computed values (PHP)

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/submission/computed_values` | filter `( array $payload, array $schema )` | Work out computed fields (Pro Calculation) from the submitted values, or drop values your display-only types never take. Runs before conditional logic, validation and storage. Use `PublicSubmitApi::COMPUTE_ERROR` for a value that cannot be worked out; it is never stored. |

## Answers on screen, in emails and exports (PHP)

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/format/answer` | filter `( ?string $text, mixed $value, array $field, array $context )` | Format an answer of your field type. Return a string, or null to let the plugin format it. Since 2.7.2. |
| `subtleforms/format/items` | filter `( ?array $items, array $value, array $field, array $context )` | Format a list answer of your field type, one string per item. Since 2.7.2. |
| `subtleforms/format/context` | filter `( array $context, mixed $schema, ?array $submission )` | Add what your formatter needs to the display context. `$context['submission_id']` is set when the answers are one entry's. Since 2.7.2. |

## Webhook data (PHP)

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/webhooks/payload_groups` | filter `( array $groups, array $schema )` | Extra groups of the "selected" payload: group name to keys. Each key starts with the group name and an underscore and is sent under the group without that prefix. Since 2.7.2. |
| `subtleforms/webhooks/entry_values` | filter `( array $values, ?SubmissionContext $context, array $schema )` | Values for those keys (also the `{{entry:key}}` tags). A null context means the sample in the builder. Since 2.7.2. |

## Field types (JavaScript)

Add-on scripts call these on `window.SubtleFormsExtend`. Load your script after the `subtleforms-frontend` (or admin) script.

| Function | Use |
| --- | --- |
| `registerFieldType( type, { component, input, isAnswerable, validate } )` | The live form renderer for your type. `isAnswerable( config )` returns false when a field has nothing to show. `validate( value, config )` returns an error message for a non-empty answer, or null. |
| `registerFormWrapper( id, Component )` | Wrap every public form. `Component` gets `{ form, children }` and renders `children`. `form`: `formId`, `preview`, `schema`, `fields`, `values`, `hidden`, `hiddenNodes` (the field objects logic hides, including fields without a key), `submitCount`, `onBeforeSubmit( fn )` (fn gets `{ payload, formId, restUrl, nonce }`, may change `payload`, and returns `{ stop: true, message }` to stop the submit; returns an unregister function) and `setSubmitLabel( label )`. Since 2.7.2. |
| `registerChoiceType( type, { multiple( field ), attributes, bulkHelp } )` | Give your type the builder's options editor, with extra inputs on each option (`attributes`: `{ key, label, inputType, placeholder, step, min, defaultValue }`). Since 2.7.2. |
| `registerFieldIcon( type, Component )` | The builder icon of your type. Since 2.7.2. |
| `registerFieldCategory( key, label )` | The name of a field library section your types use. Since 2.7.2. |
| `registerPayloadGroup( id, { title, keys: [ { key, label, sample } ], appliesTo( fields ) } )` | An extra group in the Webhook action's "selected" data (see the PHP filters above). Since 2.7.2. |
| `registerValueComputer( fn )` | `fn( fields, values )` returns the values with computed fields filled in, or the same object when nothing changed. Runs whenever an answer changes. |
| `registerCanvasPreview( type, Component )` | The builder canvas preview. |
| `registerInspectorControl( type, Component )` | A builder settings control for a PHP `inspectorControls` type (for example `formula`). |

## Settings tabs (JavaScript)

The Settings screen lists its own tabs, ending with Tools. Add-ons register a tab on `window.SubtleFormsExtend` from a script that loads after the `subtleforms-admin` script on SubtleForms admin pages:

```js
window.SubtleFormsExtend.registerSettingsTab( 'example', {
	component: ExampleSettings, // takes no props
	title: 'Example', // required
	description: '...', // optional
	group: 'site', // optional: after Tools instead of the Add-ons group
	order: 10, // optional, default last
	icon: ExampleIcon, // optional component, default a puzzle piece
} );
```

A `[a-z0-9-]+` name with a title adds a tab to the Add-ons group, or with `group: 'site'` to the site group after Tools. A tab without a title is not listed.

The tab opens at `admin.php?page=subtleforms-settings#tab=<name>`. The body looks after its own data and saving, so Settings shows no Save button or save bar for it. Tools is part of Settings now: `admin.php?page=subtleforms-tools` redirects to `#tab=tools`.

## Capabilities

`subtleforms/capabilities` filters the capability map. This plugin never switches its own code off through the map and does not check add-on keys: an extension, field type, action or template an add-on registers is used. Keys an add-on adds belong to that add-on, and only that add-on reads them.

## Moved to Pro in 2.7.0

Picture choice, several files per upload field, advanced conditional logic and form analytics are provided by an add-on. This plugin holds no code for them and shows no placeholders, badges or upgrade links for them. It keeps the extension points below and a plain fallback for forms that already use them.

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
| `subtleforms/uploads/max_files` | filter `( int $max, array $field )` | How many files the control drawn for an upload field sends (1 to 20). The plugin's own upload field sends one; an add-on that draws the field with its own control (`registerFieldOverride`) returns how many that control sends. |
| `subtleforms/fields/inspector_controls` | filter `( array $controls, string $type )` | Change the settings controls of a field type. Since 2.7.2 this plugin ships no `multiple` control on file uploads; an add-on adds its own toggle and `maxFiles` number here. |

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

Slots: `reports.panels` and `dashboard.panels` (props: `forms`), `forms.list.column` (`{ component( form ), header, order }`), `settings.extensions` (id is the extension slug), `form.integrations` (props: `schema`, `integrations`, `patch`, `isReadOnly`, `fieldOptions`), `form.confirmations` (props: `schema`, `onMetadata`, `isReadOnly`), `form.settings.sections` (`{ component, title, description, icon, order, appliesTo( schema ) }`; props: `schema`, `onChange`, `onMetadata`, `isReadOnly`, `fields`), `builder.canvas.notes` (props: `schema`), `submission.panels` (props: `submission`, `meta`) and `submission.actions` (props: `submission`).

The front end dispatches the `subtleforms:submitted` event on `document` with `detail.formId` after a successful send. Field wrappers carry `data-sf-key` and steps carry `data-sf-step`, which Pro reads for the funnel.

## Add-on boot and gate (PHP)

`SubtleForms\Support\FeatureGate` is the one gate in the container. An add-on sets its own pieces on it instead of replacing the container entry, so every service that already holds the gate sees them.

| Method | Use |
| --- | --- |
| `FeatureGate::setCapabilities( Capabilities $caps )` | Swap the capability map, for example after the add-on has added its `subtleforms/capabilities` filter. Since 2.7.1. |

Since 2.7.2 the gate only reads the capability map. It has no other setter, and an extra constructor argument is ignored. A `Capabilities` map rebuilds itself when callbacks are added to `subtleforms/capabilities` after it was built, so services that hold the gate see an add-on's keys. An add-on decides for itself which of its features are available.

## Submission store hooks (PHP, 2.7.2)

The submit route lets an add-on take part around storing the entry. The plugin reads only the generic keys named here and does nothing else with the add-on's data.

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/submit/before_store` | filter `( array\|WP_REST_Response $hold, int $formId, mixed $schema, array $payload, WP_REST_Request $request, ?array $logicValues )` | The last word before the entry is stored. Return a `WP_REST_Response` to refuse the submission, or an array (the "hold") that is handed back on the hooks below. The plugin reads `defer_actions` (bool: run only the Save step until `after_store` asks for the rest) and `context_meta` (array: values put on the SubmissionContext before the actions run). |
| `subtleforms/submit/after_store` | action `( int $submissionId, array $submission, array $hold, SubmissionContext $context )` | The entry with a hold is stored. Report with `$context->setMeta( 'store_result', array( ... ) )`: `status` (the entry status to store, default `completed`), `response` (a `WP_REST_Response` to answer the visitor with), `run_deferred` (run the actions that waited) and `context_meta` (values for those actions). |
| `subtleforms/submit/store_abandoned` | action `( array $hold, int $formId, int $submissionId )` | The entry with a hold is not stored after all (ID 0), or is stored as spam. Release what the hold keeps. |
| `subtleforms/submit/response` | filter `( array $response, int $submissionId, int $formId, array $hold )` | The JSON the browser gets after a successful submit. Add `redirect` to send the visitor to another page. |
| `subtleforms/submission/request_keys` | filter `( string[] $keys )` | Keys in a submission's `data` that are request values for your add-on, not answers. They are never stored, emailed or sent, and no field can use them as its ID. |
| `subtleforms/rest/public_routes` | filter `( string[] $routes )` | Exact REST routes visitors call while filling in a form (a request with a stale nonce is let through as a visitor). |

Deprecated since 2.7.2: `subtleforms/submit/price_order` (fired after `before_store` with the same arguments) and `subtleforms/submit/finish_order` (fired after `after_store` with status `saved` and after `store_abandoned` with status `abandoned`). They carry the same generic hold and nothing else; use the new names.

Entry statuses `payment_pending` and `payment_failed` stay valid stored values, so entries saved with them keep their labels and filters. The entry screen shows a payment an entry recorded (`meta.payment`) as it was saved when no add-on panel is registered in `submission.panels`.

A form with a saved `payment_*` field and no add-on that registers it is not shown to visitors ("This form is not available right now.") and does not accept entries.

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
