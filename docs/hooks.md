# Hooks for add-ons

This page lists the hooks an add-on such as SubtleForms Pro uses to add field types, prices and computed values. Everything the free plugin ships works without any of them.

## Field types (PHP)

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/fields/register` | action `( FieldRegistry $registry )` | Register a `FieldDefinition`. Fires before the free types are added, so an add-on can also replace one. |
| `subtleforms/fields/validate_value` | filter `( ?string $error, string $type, mixed $value, array $field )` | Return an error message for a bad value of your type, or null. |
| `subtleforms/fields/non_input_types` | filter `( string[] $types )` | Types that never collect an answer, so they cannot be required. |
| `subtleforms/fields/addon_types` | filter `( string[] $types )` | Types that exist only while an add-on registers them. Default: `signature`, `calculation`, `payment_card`. When the type is not registered, the live form leaves those fields out and the builder shows a note. |
| `subtleforms/public_schema` | filter `( array $schema, int $formId )` | The schema sent to the browser to render a form. |

## Computed values and prices (PHP)

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/submission/computed_values` | filter `( array $payload, array $schema )` | Work out computed fields (Pro Calculation) from the submitted values. Runs before conditional logic, validation, pricing and storage, and before payment quotes. Use `PublicSubmitApi::COMPUTE_ERROR` for a value that cannot be worked out; it is never stored. |
| `subtleforms/payments/is_priced` | filter `( bool $priced, array $schema )` | Return true when your field type makes the form take money. |
| `subtleforms/payments/line_items` | filter `( array $items, array $schema, array $payload )` | Add order lines for your field type. Each line: `key`, `label`, `qty`, `unit`, `amount`. |
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

## Capabilities

`subtleforms/capabilities` filters the capability map. The free plugin only reads capabilities that are on by default. Keys such as `fields.advanced`, `actions.payment`, `extensions.*`, `templates.pro` and `branding.white_label` belong to SubtleForms Pro: Pro adds them and only Pro code reads them.
