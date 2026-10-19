/**
 * Name and Address parts: which are drawn, with what label, and which a
 * required field demands.
 *
 * The settings live in `fields`, a map keyed by part (`first_name`,
 * `street2`), written by the builder's sub-field control. Forms saved before
 * 2.3.9 may hold that map as a list without keys, or only the older
 * `enable_*` flags; both are read here. Mirrors
 * SubtleForms\Fields\CompositeParts on the server (FB-01, FB-02, FB-10).
 */
import { __ } from '@wordpress/i18n';

/*
 * One entry per part, in the order the builder lists them (the order a list
 * saved without keys came in). `value` is the key in the submitted answer,
 * `alias` an older key read for it, `optional` parts are never demanded.
 */
const PARTS = {
  name_group: [
    { part: 'first_name', value: 'first_name', label: 'First Name', toggleable: false, on: true, auto: 'given-name' },
    { part: 'last_name', value: 'last_name', label: 'Last Name', toggleable: false, on: true, auto: 'family-name' },
    { part: 'middle_name', value: 'middle_name', label: 'Middle Name', toggleable: true, on: false, optional: true, auto: 'additional-name' },
    { part: 'suffix', value: 'suffix', label: 'Suffix', toggleable: true, on: false, optional: true, auto: 'honorific-suffix' },
  ],
  address_group: [
    { part: 'street', value: 'street_address', alias: 'street', label: 'Street Address', toggleable: false, on: true, auto: 'address-line1', full: true, flags: ['enable_street1', 'enable_street'] },
    { part: 'street2', value: 'street_address_2', alias: 'street2', label: 'Street Address Line 2', toggleable: true, on: false, optional: true, auto: 'address-line2', full: true, placeholder: 'Apt, Suite, etc.' },
    { part: 'city', value: 'city', label: 'City', toggleable: false, on: true, auto: 'address-level2' },
    { part: 'state', value: 'state', label: 'State / Province', toggleable: true, on: true, auto: 'address-level1' },
    { part: 'postal', value: 'postal_code', alias: 'postal', label: 'Postal Code', toggleable: true, on: true, auto: 'postal-code', flags: ['enable_postal', 'enable_postal_code'] },
    { part: 'country', value: 'country', label: 'Country', toggleable: true, on: true, auto: 'country' },
  ],
};

// Drawing order: middle name sits between first and last.
const ORDER = {
  name_group: ['first_name', 'middle_name', 'last_name', 'suffix'],
  address_group: ['street', 'street2', 'city', 'state', 'postal', 'country'],
};

const LABELS = {
  'First Name': __('First Name', 'subtleforms'),
  'Last Name': __('Last Name', 'subtleforms'),
  'Middle Name': __('Middle Name', 'subtleforms'),
  Suffix: __('Suffix', 'subtleforms'),
  'Street Address': __('Street Address', 'subtleforms'),
  'Street Address Line 2': __('Street Address Line 2', 'subtleforms'),
  City: __('City', 'subtleforms'),
  'State / Province': __('State / Province', 'subtleforms'),
  'Postal Code': __('Postal Code', 'subtleforms'),
  Country: __('Country', 'subtleforms'),
  'Apt, Suite, etc.': __('Apt, Suite, etc.', 'subtleforms'),
};

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const norm = (s) => String(s ?? '').trim().toLowerCase();

/** Whether a type is drawn from parts here. */
export const hasParts = (type) => !!PARTS[type];

/**
 * The `fields` settings as a map keyed by part, repairing a list saved
 * without keys (matched by label, else by position).
 *
 * @param {string}       type   Field type.
 * @param {Object|Array} fields Stored `fields`.
 * @return {Object|null} Map, or null when nothing usable is stored.
 */
export function partSettingsMap(type, fields) {
  const defs = PARTS[type];
  if (!defs) return null;
  if (isObject(fields)) return fields;
  if (!Array.isArray(fields) || !fields.length) return null;
  const out = {};
  const used = new Set();
  fields.forEach((item) => {
    if (!isObject(item)) return;
    const named = item.part || item.key;
    const byKey = defs.find((d) => d.part === named && !used.has(d.part));
    const byLabel = defs.find((d) => norm(d.label) === norm(item.label) && !used.has(d.part));
    const match = byKey || byLabel;
    if (match) {
      used.add(match.part);
      out[match.part] = item;
    }
  });
  fields.forEach((item, index) => {
    if (!isObject(item) || Object.values(out).includes(item)) return;
    const next = defs.slice(index).concat(defs).find((d) => !used.has(d.part));
    if (next) {
      used.add(next.part);
      out[next.part] = item;
    }
  });
  return out;
}

function legacyFlag(config, def) {
  const names = def.flags || [`enable_${def.part}`];
  for (const n of names) {
    if (config[n] !== undefined) return config[n] !== false;
  }
  return def.on;
}

/**
 * The parts a field draws, in order.
 *
 * @param {string} type   Field type.
 * @param {Object} config Merged field settings.
 * @return {Array<{part:string,value:string,alias?:string,label:string,placeholder:string,optional:boolean,auto:string,full:boolean}>}
 */
export function compositeParts(type, config = {}) {
  const defs = PARTS[type];
  if (!defs) return [];
  const map = partSettingsMap(type, config.fields);
  return ORDER[type]
    .map((name) => defs.find((d) => d.part === name))
    .filter((def) => {
      if (!def.toggleable) return true;
      if (map) {
        const s = map[def.part];
        return isObject(s) && s.enabled !== undefined ? s.enabled !== false : def.on;
      }
      return legacyFlag(config, def);
    })
    .map((def) => {
      const s = (map && isObject(map[def.part]) && map[def.part]) || {};
      const label = typeof s.label === 'string' && s.label.trim() ? s.label : LABELS[def.label] || def.label;
      const placeholder =
        typeof s.placeholder === 'string' && s.placeholder.trim()
          ? s.placeholder
          : def.placeholder
          ? LABELS[def.placeholder] || def.placeholder
          : label;
      return {
        part: def.part,
        value: def.value,
        alias: def.alias,
        label,
        placeholder,
        optional: !!def.optional,
        auto: def.auto,
        full: !!def.full,
      };
    });
}

/** A part's answer, reading the older key when the new one is not set. */
export function partValue(value, part) {
  const v = isObject(value) ? value : {};
  const own = v[part.value];
  if (own !== undefined && own !== null && own !== '') return own;
  return part.alias ? v[part.alias] : own;
}

/**
 * The answer keys a required field still needs: every drawn part that is
 * not optional.
 *
 * @param {string} type   Field type.
 * @param {Object} config Merged field settings.
 * @param {*}      value  Answer.
 * @return {string[]} Missing answer keys.
 */
export function missingParts(type, config, value) {
  return compositeParts(type, config)
    .filter((p) => !p.optional)
    .filter((p) => {
      const v = partValue(value, p);
      return v === undefined || v === null || String(v).trim() === '';
    })
    .map((p) => p.value);
}
