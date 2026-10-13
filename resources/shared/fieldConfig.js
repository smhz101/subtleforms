/**
 * One view of a field's settings, whatever shape the node was saved in.
 *
 * Schemas reach the renderer in two shapes:
 *  - flat (what the builder saves today): settings sit on the node itself,
 *    e.g. { key, type, label, required, options, appearance };
 *  - wrapped (older builder and some imports): settings sit under `config`.
 *
 * Some saved forms carry both: a flat node plus a partial `config` that only
 * holds, say, `{ appearance: { width: '50' } }`. Reading `field.config ?? field`
 * then picked the partial object and silently lost `required`, `options`,
 * `placeholder` and the help text (2.2.1, bug 1). This merges the two so width
 * and other appearance settings only ever affect layout.
 *
 * Rules: a value under `config` wins, except an empty one ('' / null /
 * undefined / []) never hides a real value on the node. `appearance` objects
 * are merged key by key.
 *
 * @param {Object} field Schema node.
 * @return {Object} Merged settings (the node itself when there is no `config`).
 */
export function fieldConfig(field) {
  if (!field || typeof field !== 'object') {
    return {};
  }
  const nested = field.config;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
    return field;
  }

  const { config: _ignored, ...flat } = field;
  const merged = { ...flat };
  Object.keys(nested).forEach((name) => {
    const value = nested[name];
    if (isBlank(value) && !isBlank(flat[name])) {
      return;
    }
    merged[name] = value;
  });

  const flatAppearance = isObject(flat.appearance) ? flat.appearance : null;
  const nestedAppearance = isObject(nested.appearance) ? nested.appearance : null;
  if (flatAppearance || nestedAppearance) {
    merged.appearance = { ...(flatAppearance || {}), ...(nestedAppearance || {}) };
  }

  return merged;
}

/**
 * The key a node's value is stored under.
 *
 * @param {Object} field Schema node.
 * @return {string|undefined}
 */
export function fieldKey(field) {
  if (!field || typeof field !== 'object') return undefined;
  return (isObject(field.config) && field.config.key) || field.key || undefined;
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isBlank(value) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}
