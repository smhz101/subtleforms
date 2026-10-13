import { repeaterLimits } from './fieldValidation';
import { fieldConfig } from '../../shared/fieldConfig';
import { toggleInitialValue } from '../../shared/toggleState';
/**
 * Default values for a form's fields.
 *
 * Fields can carry a `defaultValue`, which may contain tokens:
 *   {date}        today's date (YYYY-MM-DD)
 *   {user_email}  the logged-in user's email
 *   {user_name}   the logged-in user's display name
 *   {get:param}   a query-string parameter from the current URL
 *
 * Opinion scales, sliders and toggles also get sensible starting values.
 */

function resolveTokens(raw) {
  if (typeof raw !== 'string' || raw.indexOf('{') === -1) {
    return raw;
  }
  const user = (typeof window !== 'undefined' && window.subtleformsFrontend?.user) || null;
  let params = null;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (e) {
    params = null;
  }
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  return raw.replace(/\{([a-z_]+)(?::([^}]+))?\}/gi, (match, token, arg) => {
    switch (token.toLowerCase()) {
      case 'date':
        return iso;
      case 'user_email':
        return user?.email || '';
      case 'user_name':
        return user?.name || '';
      case 'get':
        return (arg && params?.get(arg)) || '';
      default:
        return match;
    }
  });
}

/**
 * Starting value for a range slider: its configured default, otherwise the
 * midpoint the input shows before anyone touches it. Numeric zero is kept.
 *
 * @param {Object} config Merged field settings.
 * @return {number}
 */
export function rangeSliderSeed(config = {}) {
  const sliderMin = Number(config.min ?? 0);
  const sliderMax = Number(config.max ?? 100);
  const midpoint = Math.round((sliderMin + sliderMax) / 2);
  const fallback = Number.isFinite(midpoint) ? midpoint : 0;
  const raw = config.defaultValue;
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const resolved = typeof raw === 'string' ? resolveTokens(raw) : raw;
  const n = Number(resolved);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Walk the field tree and collect initial values.
 *
 * @param {Array} fields Field nodes.
 * @return {Object} Values keyed by field key.
 */
export function collectDefaultValues(fields) {
  const out = {};

  const visit = (nodes) => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((field) => {
      if (!field || typeof field !== 'object') return;
      const config = fieldConfig(field);
      const key = config.key || field.key;

      // A Repeater starts with its minimum number of groups, each holding
      // its children's defaults (2.3.1).
      if (field.type === 'repeat_container') {
        if (key) {
          const { min } = repeaterLimits(field);
          const groupDefaults = collectDefaultValues(
            Array.isArray(field.children) && field.children.length ? field.children : field.fields || []
          );
          out[key] = Array.from({ length: Math.max(min, 1) }, () => ({ ...groupDefaults }));
        }
        return;
      }

      if (key && field.type === 'range_slider') {
        // Seed before required checks so an untouched slider submits the
        // number it already shows.
        out[key] = rangeSliderSeed(config);
      } else if (key && field.type === 'toggle') {
        out[key] = toggleInitialValue(config);
      } else if (key) {
        const raw = config.defaultValue;
        if (raw !== undefined && raw !== null && raw !== '') {
          const resolved = resolveTokens(raw);
          if (field.type === 'multiple_choice' || field.type === 'picture_choice') {
            out[key] = String(resolved)
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
          } else {
            out[key] = resolved;
          }
        } else if (field.type === 'country' && config.default_country) {
          out[key] = config.default_country;
        } else if (field.type === 'hidden' && config.value) {
          out[key] = resolveTokens(config.value);
        }
      }

      const children =
        Array.isArray(field.children) && field.children.length > 0
          ? field.children
          : field.fields;
      visit(children);
      if (Array.isArray(field.columns)) {
        field.columns.forEach((col) => visit(col));
      }
    });
  };

  visit(fields);
  return out;
}
