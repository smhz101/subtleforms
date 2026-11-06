# Hooks for add-ons

This page lists the hooks an add-on such as SubtleForms Pro uses to add field types, computed values and its own steps around a submission. Everything the free plugin ships works without any of them, and none of them carries a feature of its own.

## Field types (PHP)

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/fields/register` | action `( FieldRegistry $registry )` | Register a `FieldDefinition`. Fires before the free types are added, so an add-on can also replace one. The registry is the only source of truth for which field types exist: a saved form that uses a type nothing registers (for example because the add-on that provided it is not active) is kept as saved, its unknown fields are left out of the live form, and the form is not shown to visitors ("This form is not available right now.") until a plugin registers the type again. The builder names such fields in a note. Settings stored in the schema do not change this. |
| `subtleforms/fields/validate_value` | filter `( ?string $error, string $type, mixed $value, array $field )` | Return an error message for a bad value of your type, or null. |
| `subtleforms/fields/non_input_types` | filter `( string[] $types )` | Types that never collect an answer, so they cannot be required. |
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

`window.SubtleFormsExtend.getSettingsTab( name )` returns the definition registered under a name, or `null`. An add-on uses it to see whether another script already registered a tab before registering its own. The Settings screen lists tabs through the same registry.

The tab opens at `admin.php?page=subtleforms-settings#tab=<name>`. The body looks after its own data and saving, so Settings shows no Save button or save bar for it. Tools is part of Settings now: `admin.php?page=subtleforms-tools` redirects to `#tab=tools`. The activity, webhook and API logs have their own tab, Logs, between Integrations and Tools: `admin.php?page=subtleforms-tools&section=activity` and `#tab=tools&section=api` (also `webhooks`) open the same section of `#tab=logs`. Tools has two sections, Transfer and Migrate, kept in the address as `#tab=tools&section=transfer` and `#tab=tools&section=migrate`; an add-on adds more in the `settings.tools` slot.

### Section panel and section header (JavaScript)

Settings > Integrations, Settings > Logs and Settings > Tools are built with a section panel: a card with a list of sections on the left, each with a status dot, and the chosen section on the right. Since 2.7.5 `window.SubtleFormsExtend` carries both pieces, so an add-on can draw a screen of its own the same way (check `typeof SubtleFormsExtend.SectionPanel === 'function'` first; the extension level stays 3).

```js
const { SectionPanel, SectionHeader } = window.SubtleFormsExtend;

<SectionPanel
	sections={ [
		{ id: 'one', label: 'One', status: 'on', order: 10, render: () => <>
			<SectionHeader title="One" description="What it does." actions={ <Badge /> } />
			<Body />
		</> },
	] }
	urlParam="section"
/>
```

`SectionPanel` props: `sections` (`{ id, label, status: 'on' | 'off' | 'warn' | null, order, render() }`), `current` (leave out to follow the address), `onChange( id )`, `urlParam` (the address parameter that keeps the choice, default `section`), `keepParams` (parameters kept when another section is chosen, default `['tab']`) and `label`. `SectionHeader` props: `title`, `description` (one line, no icon) and `actions` (an optional node on the right). A section's header is its title and one line; put detail in a help text under the control it explains, not above the content.

`window.SubtleFormsExtend.registerSettingsRedirect( from, to )` sends an old Settings address to a new one before Settings picks a tab, for example `registerSettingsRedirect( { tab: 'ecommerce' }, { tab: 'extensions', ext: 'woocommerce' } )`. Every key of `from` must match (a string or an array of accepted strings); the other parameters of the old address are kept.

## Shared data layer (JavaScript)

The admin app keeps what it reads from the server in one TanStack Query cache. Since 2.7.5 `window.SubtleFormsExtend` hands that cache to add-ons, so an add-on screen is cached too and the add-on does not bundle a second copy of the library (two copies would be two caches). Check `typeof SubtleFormsExtend.useRestQuery === 'function'` first and fall back to `apiFetch` when it is missing (an older plugin).

| Export | What it is |
| --- | --- |
| `queryClient` | The live client. Use it outside a component: `queryClient.invalidateQueries( { queryKey: [ 'pro', 'orders' ] } )`. |
| `useQuery`, `useMutation`, `useQueryClient` | Re-exports of `@tanstack/react-query` 5. |
| `QueryClientProvider` | For an add-on page that mounts its own React root (a page of its own such as SubtleForms > Orders): `<QueryClientProvider client={ SubtleFormsExtend.queryClient }>`. A screen drawn inside this plugin's screens (a slot, a section, a settings tab) already sits in the provider. |
| `useRestQuery( { key, path, staleTime, ...options } )` | A `useQuery` that calls `apiFetch`. `path` starts with `/subtleforms/` or `/wp/` and is used as it is; any other path is relative to `/subtleforms/v1`. `staleTime` is in milliseconds (default 30000). |

Defaults of the client: `staleTime` 30 seconds, one retry, no refetch on window focus. Mutations retry once; pass `retry: false` for an action that must not run twice (a refund, a test email).

```js
const { useRestQuery, useMutation, useQueryClient } = window.SubtleFormsExtend;

function ProSettings() {
	const client = useQueryClient();
	// Cached for 60 seconds: opening the screen again shows the settings at once.
	const settings = useRestQuery( { key: [ 'pro', 'settings' ], path: '/pro/settings', staleTime: 60 * 1000 } );
	const save = useMutation( {
		mutationFn: ( values ) => apiFetch( { path: '/subtleforms/v1/pro/settings', method: 'POST', data: values } ),
		// A save makes the cached copy stale, so the next read asks the server.
		onSuccess: () => client.invalidateQueries( { queryKey: [ 'pro', 'settings' ] } ),
	} );
	if ( settings.isPending ) return null;
	return <Form values={ settings.data } onSave={ save.mutate } />;
}
```

Responses that the server sends in the `{ data, meta }` envelope are already unwrapped to `data` when they come through `apiFetch` while this plugin's admin script is loaded. Use keys that start with your add-on's name, so they cannot meet the plugin's own (`settings`, `forms`, `submissions`, `emailMarketing`, `logs`).

Data the server sends with the page (`subtleforms/admin/preload_paths`) is put in the cache before the first render when the plugin's own screens use it: on `subtleforms-settings` the plugin preloads `/subtleforms/v1/settings` and `/subtleforms/v1/integrations/email-marketing`. An add-on can seed its own key the same way with `queryClient.setQueryData( key, data )` at load.

## Form integration panels (JavaScript)

| Function | Use |
| --- | --- |
| `registerFormIntegration( slug, { component, order } )` | Add a panel to a form's Integrations tab, below the built-in ones. `slug` is `[a-z0-9_-]+`. The panel keeps its settings in `metadata.integrations[ slug ]`. It is the same as `registerSlotItem( 'form.integrations', slug, { component, order } )`, so every panel is drawn in the order of `order`. |

`component` receives `{ schema, integrations, onChange, isReadOnly, fieldOptions, patch, crmProvider }`: `patch( slug, values )` merges values into the panel's settings and `fieldOptions` lists the form's fields for mapping. The panel decides for itself whether to show anything and returns `null` otherwise.

Screen slots for `registerSlotItem( slot, id, { component, order } )` that the admin app draws. This plugin draws nothing of its own in a slot an add-on leaves empty.

| Slot | Where | The component receives |
| --- | --- | --- |
| `submission.panels` | Panels on the entry screen | `{ submission, meta }` |
| `submission.actions` | Buttons on the entry screen | `{ submission }` |
| `builder.canvas.notes` | A note above the builder canvas | `{ schema }` |
| `form.settings.sections` | A section in a form's settings (`title`, `description`, `icon`, `appliesTo( schema )` decide whether and how it is listed) | the section's own props |
| `form.confirmations` | Conditional confirmations in a form's settings | `{ schema, onMetadata, isReadOnly }` |
| `form.integrations` | A form's Integrations tab (see `registerFormIntegration`) | see above |
| `settings.extensions` | The panel of an integration listed through `subtleforms/admin/integrations`; the slot item id is the integration slug. Optional keys on the item: `title` and `description` (Settings then draws the standard section header above the panel, and the panel must not draw its own), `label` (the name in the section list) and `status` (`'on'`, `'warn'` or `'off'`, or a function returning one, for the dot in the list; default: from the integration's `enabled` and `configured`). | none |
| `settings.tools` | A section of Settings > Tools, after Transfer and Migrate. The slot item id is the section id; give `label` (name in the list), `title` and `description` (Settings draws the header) and `order`. Since 2.7.5 | none |
| `settings.logs` | A section of Settings > Logs, after Activity, Webhooks and API. The slot item id is the section id; give `label` (name in the list), `title` and `description` (Settings draws the header) and `order` | none |
| `email_marketing.service.settings` | More controls below a service's connection in Settings > Integrations > Email marketing. An add-on that registers anything here counts as adding extras, so this plugin hides its note about SubtleForms Pro | `{ service, connected }` (`service` is the slug, `connected` is true once the service accepted its key) |
| `email_marketing.service.form` | More controls at the end of a service's block in a form's Email marketing panel (Form settings > Integrations). They keep their values in the form's `metadata.integrations`, under a key of the add-on's own | `{ service, connected, schema, config, patch( values ), isReadOnly, fieldOptions }` (`config` is the service's settings of the form, `patch` merges values into them) |
| `dashboard.panels` | Panels on the Dashboard | `{ forms }` |
| `reports.panels` | Panels on the Reports screen | `{ forms }` |
| `forms.list.column` | One extra column in the forms list; the item sets `header` for the column title | `{ form }` |
| `footer.meta` | An item in the footer of the app screens, between the version and the Documentation link (a short text or link; the footer is one line) | `{ version }` (the SubtleForms version) |

## Preloaded admin data (PHP)

A SubtleForms admin screen can receive the answer of a few REST requests inside the page, so the screen shows its data in the first paint instead of after a request. The answers are computed with the current user, so permissions are the ones a normal request meets. The app registers them with `apiFetch.createPreloadingMiddleware()` before it renders and they show up in `window.subtleformsAdmin.preloaded`, keyed by path.

| Hook | Kind and arguments | What it does |
| --- | --- | --- |
| `subtleforms/admin/preload_paths` | filter `( string[] $paths, string $screen )` | REST paths to preload on a screen. `$screen` is the `page` value of the screen (`subtleforms`, `subtleforms-forms`, `subtleforms-submissions`, `subtleforms-reports`, `subtleforms-settings`). Only GET paths below `/subtleforms/v1/` are kept, at most 12 per screen; anything else is dropped. The plugin adds the first request of its own Forms list on `subtleforms-forms`, and the settings and the email marketing state on `subtleforms-settings` (Settings opens with no loading step). Since 2.7.4. |

Use the exact path string the script requests, query included. A preloaded answer is used once: the first request for that path gets it and later requests (a refetch, another filter) go to the server as usual. The script can read the answer at once from `window.subtleformsAdmin.preloaded[ path ]` (`{ body, headers }`), for a first paint with no loading step.

## Other PHP hooks add-ons use

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/loaded` | action `( Plugin $plugin )` | This plugin finished booting. |
| `subtleforms/register_extensions` | action `( ExtensionManager $manager )` | Add an extension. |
| `subtleforms/register_actions` | action `( ActionRegistry $registry )` | Register a form action (a step that runs after a submission). |
| `subtleforms/templates` | filter `( array $templates )` | Add form templates. A template may set `addon` to true to keep its own fields as they are. |
| `subtleforms/admin_menu` | action `( Capabilities $caps )` | Add your own admin pages. |
| `subtleforms/admin_enqueue_scripts` | action `( string $hook )` | Enqueue add-on scripts on SubtleForms admin pages. |
| `subtleforms/admin_data` | filter `( array $data, string $hook )` | Add keys to `window.subtleformsAdmin`. Add-ons read their own keys from there. |
| `subtleforms/admin_branding` | filter `( array $branding )` | Change what the admin app shows: `name`, `menuName`, `logoUrl` (a custom logo replaces the mark and the wordmark), `menuIcon` (a data URI, `data:image/svg+xml;base64,...`, or an image URL; empty for the default mark; core repaints a data URI in the admin colour scheme and draws a URL as an image) and `markSvg` (inline SVG made of `svg`, `g` and `path` only, which replaces the built-in mark in the app header; empty for the default mark). Invalid values fall back to the default mark. |
| `subtleforms/admin/integrations` | filter `( array $integrations )` | List an integration in Settings, keyed by slug. This plugin lists `webhooks` and `email_marketing` (the Email marketing entry carries `builtin => true`). See "Email marketing" below for what listing an `email_marketing` entry of your own does. |
| `subtleforms/forms/schema_before_save` | filter `( array $schema, int $formId, bool $activate )` | Change a schema before it is saved. |
| `subtleforms/forms/schema_published` | action `( int $formId, array $schema, int $version )` | A schema version was published. |
| `subtleforms/frontend/language` | filter `( string $lang )` | The language code the public form asks its schema in. |
| `subtleforms/submit/confirmation` | filter `( array $confirmation, int $formId, array $payload )` | Change the confirmation shown after a submission. |
| `subtleforms/submission/completed` | action `( int $submissionId, int $formId, array $payload, array $submission, array $schema )` | An entry was stored and its steps finished. Not fired for previews. |
| `subtleforms/submission/trashed` | action `( int $id, array $submission )` | An entry went to the Trash. |
| `subtleforms/submission/untrashed` | action `( int $id, string $status, array $submission )` | An entry came back from the Trash. |
| `subtleforms/submission/updated` | action `( int $id, array $submission )` | An entry's status, meta or payload changed. Add-ons use it to keep an index of the entry. |
| `subtleforms/submission/deleted` | action `( int $id, array $submission )` | An entry was deleted for good. |
| `subtleforms/email/attachments` | filter `( string[] $attachments, array $job )` | Files to attach to an email. |
| `subtleforms/email/after_send` | action `( array $job, string[] $attachments )` | An email was sent. |
| `subtleforms/transfer/entry_meta_keys` | filter `( string[] $keys, array $record )` | Entry meta records that go into the submissions export and come back on import. The default is every record (an array) that another plugin saved on the entry, so an entry keeps what an add-on stored on it even when the add-on is not active. Records this plugin writes itself (the visitor's address and browser, request state, spam checks, consents, notes) never travel, nor do records over 64 KB or keys that name a token, secret, password or API key. An add-on narrows the list to the records it wants to travel. Since 2.7.2. |

## Email marketing

This plugin adds people to Mailchimp, Brevo or Kit after an entry is saved, for forms where the site owner turned a service on (Form settings > Integrations > Email marketing, stored in `metadata.integrations.mailchimp`, `.brevo` and `.kit`). There is one Email marketing entry in Settings > Integrations; the three services live inside it. Each service has its own connection in the non-autoloaded option `subtleforms_<slug>_connection`, with the API key, a switch and the service's own settings. Switching a service off keeps its key and settings. The job runs in the background (`subtleforms_async_email_marketing`, one per service) and writes "Mailchimp: subscribed", "pending (double opt-in)", "skipped (...)" or "failed: ..." to the entry's activity log, with the service name in front. Everything works without an add-on.

Settings of a form, for every service: `enabled`, `list_id`, `fields` (`email`, `first_name`, `last_name`), `merge_fields` (`[ { field, target } ]`), `tags` (comma separated), `double_optin`, `update_existing`, `consent_field`. MailPoet is a plugin on the same site and is reached through its PHP API, so it has no key to connect: its tile shows whether MailPoet is installed, active and set up, and `send_confirmation_email` and `schedule_welcome_email` replace the double opt-in switch. Mailchimp needs a list (audience); Brevo and Kit do not, and Kit's list is one of its forms. Brevo adds people with `updateEnabled`, and Kit with `POST /v4/subscribers`; both create or update by email, so a repeat is an update.

### Taking over

An add-on takes over in one of two ways:

- Listing its own `email_marketing` entry in `subtleforms/admin/integrations`, without `builtin => true`, takes over the whole integration. This plugin then sends nothing to any service (a job that was already queued also steps aside) and draws neither the settings nor the form panel; the add-on draws its own through the `settings.extensions` slot (item id `email_marketing`) and `registerFormIntegration`. Removing the entry has the same effect. SubtleForms Pro 2.8.0 works this way.
- Listing a service slug (`mailchimp`, `mailpoet`, `brevo`, `kit`) in `subtleforms/email/marketing/services`, without `builtin => true`, takes over only that service. A new slug adds a tile, and the add-on draws its screens with `registerEmailMarketingService`.

No other entry has this effect.

### Adding to the built-in services

An add-on that leaves the entry alone adds to it through the filter, the slots and the hooks below. The hooks run in the background job, with a `$context` array of `submission_id`, `form_id`, `payload`, `schema` and `entry` (the stored row), and receive the service slug as the last argument. A feed is a set of the service's settings in the shape of `metadata.integrations.<slug>` with a string `id`; the built-in one has the id `default`. Since 2.8.0.

| Hook | Type | Use |
| --- | --- | --- |
| `subtleforms/email/marketing/services` | filter `( array $services )` | The services listed in the grid, keyed by slug. See "Taking over". |
| `subtleforms/email/marketing/extras` | filter `( string[] $slugs )` | The services an add-on adds options to. While the list is empty this plugin shows its note about SubtleForms Pro. |
| `subtleforms/email/marketing/feeds` | filter `( array $feeds, array $context, string $service )` | The feeds to send for the entry. Add feeds (another list, another mapping) or change the built-in one. Only runs for forms with the service switched on. Each feed gets its own line in the activity log, step `<service>:<id>`. |
| `subtleforms/email/marketing/skip_reason` | filter `( ?string $reason, array $feed, array $context, string $service )` | Return a short plain reason to skip a feed for this entry ("the rule did not match"); the log says "Mailchimp: skipped (reason)". Return null to send. |
| `subtleforms/email/marketing/subscriber` | filter `( Subscriber $subscriber, array $feed, array $context, string $service )` | Change who is sent: tags (`$subscriber->tags`), fields (`->fields`), list (`->listId`). Return the object. |
| `subtleforms/email/marketing/request_body` | filter `( array $body, Subscriber $subscriber, array $feed, array $context, string $service )` | Change the body of the add-or-update request, for example Mailchimp `interests` or `marketing_permissions`. Return the array. |
| `subtleforms/email/marketing/skipped` | action `( string $message, string $reason, array $feed, array $context, string $service )` | A person was left out on purpose, not because of an error. For MailPoet: `previously_unsubscribed` or `bounced`. The log says "Skipped: previously unsubscribed in MailPoet" or "Skipped: email bounced in MailPoet". |
| `subtleforms/email/marketing/delivered` | action `( array $result, array $feed, array $context, string $service )` | A person was added or updated (`service`, `list`, `email`, `status`, `tags`, `member`). |
| `subtleforms/email/marketing/failed` | action `( string $message, array $feed, array $context, bool $willRetry, string $service )` | A request failed. A transport error, a rate limit or a server error is tried again by this plugin up to twice (after 2 and 15 minutes); `$willRetry` says so. |

`SubtleForms\Integrations\EmailMarketing\Sender::process( $service, $submissionId, $retryCount = 0, $onlyFeedIds = [] )` sends one entry again and returns the feed IDs worth another try; an add-on calls it for a manual retry or a resync. `Connection::state()` is a connection without its key.

In the browser, `registerEmailMarketingService( slug, { label, icon, settingsComponent, formComponent } )` adds a service (or replaces a built-in one with the same slug), and the two `email_marketing.service.*` slots add options to a service this plugin draws. A control that needs the service should stay disabled until `connected` is true.

### Older add-ons

The hooks `subtleforms/mailchimp/*` were never released and are gone. An add-on built before this change that sends Mailchimp, Brevo or Kit by itself (SubtleForms Pro 2.8.0) lists its own `email_marketing` entry, so this plugin sends nothing and no one is added twice.

## Capabilities

`subtleforms/capabilities` filters the capability map. This plugin never switches its own code off through the map and does not check add-on keys: an extension, field type, action or template an add-on registers is used. Keys an add-on adds belong to that add-on, and only that add-on reads them.

## Moved to Pro in 2.7.0

Picture choice, several files per upload field, advanced conditional logic and form analytics are provided by an add-on. This plugin holds no code for them and shows no placeholders, badges or upgrade links for them. It keeps the extension points below and a plain fallback for forms that already use them.

`SubtleForms\Support\ExtensionPoints` names the four points (`picture_choice`, `multi_file_uploads`, `advanced_logic`, `analytics`) and its `LEVEL` constant (3) is the contract version. The level changes only when an existing hook changes or is removed, because a released add-on refuses a level above the highest it knows. Additions are detected instead: since 2.7.5 `window.SubtleFormsExtend` has `ServiceTileGrid`, `ServiceDetailHeader`, `SectionPanel`, `SectionHeader`, `queryClient`, `useQuery`, `useMutation`, `useQueryClient`, `QueryClientProvider` and `useRestQuery` (check `typeof SubtleFormsExtend.ServiceTileGrid === 'function'`), and the `subtleforms/email/marketing/skipped` action is available. Level 2 adds the logic, upload and add-on feature hooks of 2.7.0 and the `FeatureGate` setters. An add-on checks `ExtensionPoints::has( $name )` before it registers, so it never registers twice against an older plugin that still ships the feature. It reports what it runs through:

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
| `registerSettingsRedirect( from, to )` | Send an old Settings address (`#tab=...`) to its new place. |
| `SectionPanel`, `SectionHeader` | Components for a list of sections with a header each (see "Section panel and section header"). |
| `queryClient`, `useQuery`, `useMutation`, `useQueryClient`, `QueryClientProvider`, `useRestQuery( { key, path, staleTime } )` | The admin app's TanStack Query client and hooks, so an add-on caches its REST reads in the same cache and bundles no copy of its own (see "Shared data layer"). |
| `registerEmailMarketingService( slug, { label, icon, settingsComponent, formComponent } )` | Add a tile to Settings > Integrations > Email marketing, or replace the one of the same slug. `icon` is a component, `settingsComponent` draws the service's screen and `formComponent` its block in a form's panel. |
| `registerFormMountHook( fn )` | `fn( { container, formId, config } )` runs when a form mounts on a page (view beacon, funnel tracker). |
| `registerFieldType`, `registerInspectorControl`, `registerCanvasPreview` | Existing. |

Slots: `reports.panels` and `dashboard.panels` (props: `forms`), `forms.list.column` (`{ component( form ), header, order }`), `footer.meta` (props: `version`), `settings.extensions` (id is the extension slug), `settings.tools` and `settings.logs` (id is the section id), `form.integrations` (props: `schema`, `integrations`, `patch`, `isReadOnly`, `fieldOptions`), `form.confirmations` (props: `schema`, `onMetadata`, `isReadOnly`), `form.settings.sections` (`{ component, title, description, icon, order, appliesTo( schema ) }`; props: `schema`, `onChange`, `onMetadata`, `isReadOnly`, `fields`), `builder.canvas.notes` (props: `schema`), `submission.panels` (props: `submission`, `meta`), `submission.actions` (props: `submission`), `email_marketing.service.settings` (props: `service`, `connected`) and `email_marketing.service.form` (props: `service`, `connected`, `schema`, `config`, `patch`, `isReadOnly`, `fieldOptions`).

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
