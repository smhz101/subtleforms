/**
 * Extension registry for add-ons (2.1).
 *
 * Add-ons such as SubtleForms Pro ship their own scripts, so field types,
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
  });
// Stores created by an older bundle may miss newer keys.
store.pricedWhen = store.pricedWhen || {};
store.computers = store.computers || [];

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
 * Register a function that works out computed values (such as Pro
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

root.SubtleFormsExtend = Object.assign(root.SubtleFormsExtend || {}, {
  registerFieldType,
  registerPricedType,
  registerValueComputer,
  registerInspectorControl,
  registerCanvasPreview,
});
