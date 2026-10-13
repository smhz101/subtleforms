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

/**
 * Register a public field renderer.
 *
 * @param {string} type Field type.
 * @param {Object} def  { component, input = true }. `component` receives
 *                      { field, config, value, onChange, inputId, error, formId, payment, preview }.
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
 * @param {string}   type Field type.
 * @param {Function} fn   (config, value, { currency }) => Array<{ label, qty, unit }>.
 */
export function registerPricedType(type, fn) {
  if (type && typeof fn === 'function') {
    store.priced[type] = fn;
  }
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

root.SubtleFormsExtend = root.SubtleFormsExtend || {
  registerFieldType,
  registerPricedType,
  registerInspectorControl,
  registerCanvasPreview,
};
