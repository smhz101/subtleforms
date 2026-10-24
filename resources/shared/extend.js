/**
 * Extension registry for add-ons (2.1).
 *
 * Add-ons ship their own scripts, so field types,
 * priced types, inspector controls and canvas previews are registered on a
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
    priced: {},
    controls: {},
    previews: {},
    settingsTabs: {},
  });
// Stores created by an older bundle may miss newer keys.
store.pricedWhen = store.pricedWhen || {};
store.computers = store.computers || [];
store.settingsTabs = store.settingsTabs || {};
store.overrides = store.overrides || {};
store.logic = store.logic || [];
store.logicEditor = store.logicEditor || null;
store.slots = store.slots || {};
store.mountHooks = store.mountHooks || [];

/**
 * Register a public field renderer.
 *
 * @param {string} type Field type.
 * @param {Object} def  { component, input = true, isAnswerable }. `component` receives
 *                      { field, config, value, onChange, inputId, error, formId, payment, preview }.
 *                      `isAnswerable(config)` returns false when a field of this
 *                      type has nothing to show (it is then not drawn or required).
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
 * Register a priced field type for the live order summary.
 *
 * @param {string}   type    Field type.
 * @param {Function} fn      (config, value, { currency }) => Array<{ label, qty, unit }>,
 *                           or { error: true } when the amount cannot be worked out.
 * @param {Object}   options { isPriced: (config) => boolean } when only some
 *                           fields of this type charge money (default: all).
 */
export function registerPricedType(type, fn, options = {}) {
  if (type && typeof fn === 'function') {
    store.priced[type] = fn;
    if (options && typeof options.isPriced === 'function') {
      store.pricedWhen[type] = options.isPriced;
    }
  }
}

/** Whether a field of an add-on priced type charges money. */
export function chargesMoney(type, config) {
  if (!store.priced[type]) return false;
  const when = store.pricedWhen[type];
  return when ? !!when(config || {}) : true;
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

export function getPricedType(type) {
  return store.priced[type] || null;
}

export function pricedTypes() {
  return Object.keys(store.priced);
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
 * `mcp` has a fixed place right after Tools and a default title, so it needs
 * only a component. Any other name adds a tab to the Add-ons group, which
 * then needs `title` and `description`. Nothing is listed for a name until an
 * add-on registers it.
 *
 * The body manages its own data and saving, so the Settings Save button and
 * save bar are not shown for add-on tabs.
 *
 * @param {string} name Tab name: lowercase letters, numbers, dashes. It is the
 *                      value of `#tab=` in the Settings URL.
 * @param {Object} def  { component, title, description, order }.
 *                      `component` takes no props. `order` (number) places a
 *                      new tab among the Add-ons group tabs; the default is the end.
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
 *   form.settings.checkout  Form settings > Payments, below the currency: { component, order }
 *   builder.canvas.notes    Builder, above the canvas: { component, order }
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

root.SubtleFormsExtend = Object.assign(root.SubtleFormsExtend || {}, {
  registerFieldType,
  registerPricedType,
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
});
