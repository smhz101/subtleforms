/**
 * Extension registry for add-ons (2.1).
 *
 * Add-ons ship their own scripts, so field types, inspector controls, canvas
 * previews and the other extensions below are registered on a
 * store that lives on `window`. The admin and the frontend bundles each
 * import this module, and both read the same store.
 *
 * Add-on scripts call `window.SubtleFormsExtend.registerFieldType(...)` etc.
 * They load after the SubtleForms bundle and before forms mount
 * (forms mount on DOMContentLoaded).
 */

const root = typeof window !== 'undefined' ? window : globalThis;

const store =
  root.__subtleformsExtend ||
  (root.__subtleformsExtend = {
    fields: {},
    controls: {},
    previews: {},
    settingsTabs: {},
  });
// Stores created by an older bundle may miss newer keys.
store.computers = store.computers || [];
store.settingsTabs = store.settingsTabs || {};
store.overrides = store.overrides || {};
store.logic = store.logic || [];
store.logicEditor = store.logicEditor || null;
store.slots = store.slots || {};
store.mountHooks = store.mountHooks || [];
store.wrappers = store.wrappers || {};
store.choiceTypes = store.choiceTypes || {};
store.fieldIcons = store.fieldIcons || {};
store.fieldCategories = store.fieldCategories || {};
store.payloadGroups = store.payloadGroups || {};

/**
 * Register a public field renderer.
 *
 * @param {string} type Field type.
 * @param {Object} def  { component, input = true, isAnswerable }. `component` receives
 *                      { field, config, value, onChange, inputId, error, formId, preview }.
 *                      `isAnswerable(config)` returns false when a field of this
 *                      type has nothing to show (it is then not drawn or required).
 *                      `validate(value, config)` returns an error message for a
 *                      non-empty answer, or null (it runs in the browser; check
 *                      on the server too, through `subtleforms/fields/validate_value`).
 */
export function registerFieldType(type, def) {
  if (type && def && def.component) {
    store.fields[type] = { input: true, ...def };
  }
}

export function getFieldType(type) {
  return store.fields[type] || null;
}

/** Whether an add-on field type collects a value. */
export function isRegisteredInputType(type) {
  const def = store.fields[type];
  return !!def && def.input !== false;
}

/**
 * Register a function that works out computed values (such as
 * Calculation fields) whenever an answer changes. The server recomputes them
 * on submit, so these values are for display.
 *
 * @param {Function} fn (fields, values) => values. Return the same object when
 *                      nothing changed.
 */
export function registerValueComputer(fn) {
  if (typeof fn === 'function' && !store.computers.includes(fn)) {
    store.computers.push(fn);
  }
}

/**
 * Run every registered value computer.
 *
 * @param {Array}  fields Flattened fields.
 * @param {Object} values Current values.
 * @return {Object} Values, the same object when nothing changed.
 */
export function computeValues(fields, values) {
  let next = values;
  store.computers.forEach((fn) => {
    try {
      const out = fn(fields, next);
      if (out && typeof out === 'object') next = out;
    } catch (e) {
      // A broken add-on must not stop the form.
    }
  });
  return next;
}

/**
 * Register a builder inspector control for a PHP `inspectorControls` type.
 * The component receives the usual control props plus `control` (the PHP
 * definition) and `field` (the selected field).
 */
export function registerInspectorControl(type, Component) {
  if (type && Component) {
    store.controls[type] = Component;
  }
}

export function getInspectorControl(type) {
  return store.controls[type] || null;
}

/** Register a builder canvas preview: Component receives { field }. */
export function registerCanvasPreview(type, Component) {
  if (type && Component) {
    store.previews[type] = Component;
  }
}

export function getCanvasPreview(type) {
  return store.previews[type] || null;
}

/**
 * Register a Settings tab (Settings screen, left list).
 *
 * A tab joins the Add-ons group, or with `group: 'site'` the site group right
 * after Tools. It needs a `title` and a `description`. Nothing is listed for
 * a name until an add-on registers it.
 *
 * The body manages its own data and saving, so the Settings Save button and
 * save bar are not shown for add-on tabs.
 *
 * @param {string} name Tab name: lowercase letters, numbers, dashes. It is the
 *                      value of `#tab=` in the Settings URL.
 * @param {Object} def  { component, title, description, order, group, icon }.
 *                      `component` takes no props. `order` (number) places the
 *                      tab among the other add-on tabs of its group; the
 *                      default is the end. `icon` is a component drawn in the
 *                      tab list (default: a puzzle piece).
 */
export function registerSettingsTab(name, def) {
  if (typeof name === 'string' && /^[a-z0-9-]+$/.test(name) && def && def.component) {
    store.settingsTabs[name] = { ...def };
  }
}

/** The tab registered under a name, or null. */
export function getSettingsTab(name) {
  return store.settingsTabs[name] || null;
}

/** Every registered Settings tab as { name, ...def }. */
export function settingsTabs() {
  return Object.keys(store.settingsTabs).map((name) => ({ name, ...store.settingsTabs[name] }));
}

/**
 * Replace how a built-in field type is drawn on the public form when a
 * condition holds. An add-on can use this to draw an upload field that
 * takes several files. The built-in renderer stays the fallback, so a form
 * is always usable without the add-on.
 *
 * @param {string} type Built-in field type, for example `file_upload`.
 * @param {Object} def  { applies(field, config) => boolean, component }.
 *                      `component` takes the same props as a registered
 *                      field type (see registerFieldType).
 */
export function registerFieldOverride(type, def) {
  if (type && def && def.component && typeof def.applies === 'function') {
    store.overrides[type] = store.overrides[type] || [];
    store.overrides[type].push(def);
  }
}

/** The override that applies to a field, or null. */
export function getFieldOverride(field, config) {
  const list = (field && store.overrides[field.type]) || [];
  for (const def of list) {
    try {
      if (def.applies(field, config || {})) return def;
    } catch (e) {
      // A broken add-on must not stop the form.
    }
  }
  return null;
}

/**
 * Register a conditional logic extension. Without one, only the basic logic
 * (one group, all rules, the basic operators, on fields) is evaluated and
 * anything else is ignored, exactly like the server (see
 * ConditionalLogic::isSupported).
 *
 * @param {Object} def {
 *   supports(logic, scope) => boolean         Take on a normalised logic object.
 *   passes(logic, values, helpers, opts, scope) => boolean|null
 *                                             Evaluate it (groups, "any", scopes).
 *   evaluateCondition(value, operator, compare, compare2, opts, helpers) => boolean|null
 *                                             Evaluate an operator the plugin does not know.
 * }
 *   `scope` is field, step, action or confirmation. `helpers` are the
 *   evaluator's own text, list, number and country helpers.
 */
export function registerLogicExtension(def) {
  if (def && typeof def === 'object' && !store.logic.includes(def)) {
    store.logic.push(def);
  }
}

export function getLogicExtensions() {
  return store.logic;
}

/**
 * Replace the builder's logic editor. The component receives the props of the
 * built-in editor and may render it by calling `Fallback`.
 */
export function registerLogicEditor(Component) {
  store.logicEditor = Component || null;
}

export function getLogicEditor() {
  return store.logicEditor;
}

/**
 * Register an item in a named admin slot. This plugin defines the slots and
 * shows nothing in a slot where nothing is registered:
 *
 *   reports.panels       Reports screen, below the totals. { component, order }
 *   dashboard.panels     Dashboard, below the totals.
 *   forms.list.column    Forms list, extra cell: { component, header, order }
 *   settings.extensions  Extension switches: { component, title, order }
 *   form.settings.sections  Builder > Form settings, a section of its own:
 *                           { component, title, order, icon }. `component` receives
 *                           { schema, onChange, onMetadata, isReadOnly, fields }.
 *   builder.canvas.notes    Builder, above the canvas: { component, order }
 *   submission.panels       Entry screen, below the answers: { component, order }.
 *                           `component` receives { submission, meta }.
 *   submission.actions      Entry screen header, extra buttons: { component, order }.
 *                           `component` receives { submission }.
 *
 * @param {string} slot Slot name.
 * @param {string} id   Unique id within the slot.
 * @param {Object} def  { component, order, ...slot specific keys }.
 */
export function registerSlotItem(slot, id, def) {
  if (slot && id && def && def.component) {
    store.slots[slot] = store.slots[slot] || {};
    store.slots[slot][id] = { ...def };
  }
}

/** Items in a slot as [{ id, ...def }], ordered by `order` then id. */
export function getSlotItems(slot) {
  const items = store.slots[slot] || {};
  return Object.keys(items)
    .map((id) => ({ id, ...items[id] }))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || (a.id < b.id ? -1 : 1));
}

/**
 * Run when a form is mounted on a public page (once per form container).
 * Add-ons use it for view counting and funnel tracking.
 *
 * @param {Function} fn ({ container, formId, schema, config }) => void.
 */
export function registerFormMountHook(fn) {
  if (typeof fn === 'function' && !store.mountHooks.includes(fn)) {
    store.mountHooks.push(fn);
  }
}

export function runFormMountHooks(context) {
  store.mountHooks.forEach((fn) => {
    try {
      fn(context);
    } catch (e) {
      // A broken add-on must not stop the form.
    }
  });
}

/**
 * Features an active add-on provides (names from the PHP ExtensionPoints
 * class), as sent to the admin in `subtleformsAdmin.addonFeatures`.
 */
export function addonProvides(feature) {
  const list = root.subtleformsAdmin && root.subtleformsAdmin.addonFeatures;
  return Array.isArray(list) && list.includes(feature);
}

/**
 * Register a per-form integration panel (builder > Form settings > Integrations).
 *
 * This is a shortcut for registerSlotItem('form.integrations', slug, def), so
 * there is one mechanism: every panel, whichever way it is registered, is
 * drawn below the built-in integrations in the order of `order`.
 *
 * The panel decides for itself whether to show anything (an add-on checks its
 * own plan and connection) and returns null otherwise.
 *
 * @param {string} slug Lowercase letters, numbers, dashes and underscores. The
 *                      panel keeps its settings in `metadata.integrations[slug]`.
 * @param {Object} def  { component, order }. `component` receives
 *                      { schema, integrations, onChange, isReadOnly, fieldOptions, patch, crmProvider }:
 *                      `patch(slug, values)` merges values into the panel's settings and
 *                      `fieldOptions` is the list of form fields for mapping.
 */
export function registerFormIntegration(slug, def) {
  if (typeof slug === 'string' && /^[a-z0-9_-]+$/.test(slug) && def && def.component) {
    registerSlotItem('form.integrations', slug, def);
  }
}

/** Every panel in the form.integrations slot as { slug, id, ...def }, in order. */
export function formIntegrations() {
  return getSlotItems('form.integrations').map((item) => ({ slug: item.id, ...item }));
}

/**
 * Wrap every public form in a component of your own. A wrapper can keep
 * state for the whole form (and share it with its own fields through its own
 * React context), check or add to the answers before they are sent, and name
 * the submit button.
 *
 * The component receives { form, children } and must render `children`.
 * `form` is {
 *   formId, preview, schema,
 *   fields         Every field of the form, flattened.
 *   values         Current answers.
 *   hidden         Set of keys hidden by conditional logic.
 *   hiddenNodes    Set of the schema's own field objects that logic hides, in
 *                  a skipped step or container too, fields without a key included.
 *   submitCount    Raised after each successful submit (reset your state).
 *   onBeforeSubmit(fn)  Register `async ({ payload, formId, restUrl, nonce }) => result`.
 *                  It may change `payload`. Return { stop: true, message } to
 *                  stop the submit (message may be empty when your own field
 *                  shows the reason). Returns a function that unregisters.
 *   setSubmitLabel(label)  Name the submit button, or null for the default.
 * }
 *
 * @param {string}   id        Unique id.
 * @param {Function} Component Wrapper component.
 */
export function registerFormWrapper(id, Component) {
  if (typeof id === 'string' && id && Component) {
    store.wrappers[id] = Component;
  }
}

/** Every registered form wrapper, outermost first (in id order). */
export function getFormWrappers() {
  return Object.keys(store.wrappers)
    .sort()
    .map((id) => store.wrappers[id]);
}

/**
 * Give an add-on field type the builder's options editor (the list of
 * choices with drag to reorder, defaults and bulk edit), with optional extra
 * inputs on each option.
 *
 * @param {string} type Field type.
 * @param {Object} def  {
 *   multiple(field) => boolean   Whether several options may be the default.
 *   attributes: [{ key, label, inputType = 'text', placeholder, step, min, defaultValue }]
 *                                Extra inputs; the value is stored on each option
 *                                as `option[key]` (a number input stores a number).
 *                                Bulk edit adds each as one more `|` part, in order.
 *   bulkHelp                     Help text for bulk edit.
 * }
 */
export function registerChoiceType(type, def = {}) {
  if (typeof type === 'string' && type) {
    const attributes = (Array.isArray(def.attributes) ? def.attributes : [])
      .filter((a) => a && typeof a.key === 'string' && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(a.key) && !['label', 'value'].includes(a.key))
      .map((a) => ({ inputType: 'text', ...a }));
    store.choiceTypes[type] = { ...def, attributes };
  }
}

/** The choice type an add-on registered, or null. */
export function getChoiceType(type) {
  return store.choiceTypes[type] || null;
}

/**
 * Builder icon for an add-on field type (library, canvas and outline).
 *
 * @param {string}   type      Field type.
 * @param {Function} Component Icon component; it receives { size, className }.
 */
export function registerFieldIcon(type, Component) {
  if (typeof type === 'string' && type && Component) {
    store.fieldIcons[type] = Component;
  }
}

/** The icon an add-on registered for a field type, or null. */
export function getFieldIconOverride(type) {
  return store.fieldIcons[type] || null;
}

/**
 * Name of a field library section an add-on's field types use (the PHP
 * definition's `category`).
 *
 * @param {string} key   Category key.
 * @param {string} label Section name.
 */
export function registerFieldCategory(key, label) {
  if (typeof key === 'string' && key && typeof label === 'string' && label) {
    store.fieldCategories[key] = label;
  }
}

/** The section name an add-on registered for a category, or null. */
export function getFieldCategoryLabel(key) {
  return store.fieldCategories[key] || null;
}

/**
 * Add a group to the "selected" data of the Webhook action. The PHP side
 * sends it through the `subtleforms/webhooks/payload_groups` and
 * `subtleforms/webhooks/entry_values` filters.
 *
 * @param {string} id  Group name (lowercase letters, numbers, underscores).
 * @param {Object} def { title, keys: [{ key, label, sample }], appliesTo(fields) => boolean }.
 *                     Every key starts with `${id}_` and is sent under the
 *                     group name without that prefix.
 */
export function registerPayloadGroup(id, def) {
  if (typeof id === 'string' && /^[a-z0-9_]+$/.test(id) && def && Array.isArray(def.keys)) {
    store.payloadGroups[id] = {
      ...def,
      keys: def.keys.filter((k) => k && typeof k.key === 'string' && k.key.startsWith(`${id}_`)),
    };
  }
}

/** Registered payload groups as [{ id, title, keys, appliesTo }]. */
export function payloadGroups() {
  return Object.keys(store.payloadGroups).map((id) => ({ id, ...store.payloadGroups[id] }));
}

root.SubtleFormsExtend = Object.assign(root.SubtleFormsExtend || {}, {
  registerFieldType,
  registerValueComputer,
  registerInspectorControl,
  registerCanvasPreview,
  registerSettingsTab,
  registerFieldOverride,
  registerLogicExtension,
  registerLogicEditor,
  registerSlotItem,
  registerFormMountHook,
  registerFormIntegration,
  registerFormWrapper,
  registerChoiceType,
  registerFieldIcon,
  registerFieldCategory,
  registerPayloadGroup,
});
