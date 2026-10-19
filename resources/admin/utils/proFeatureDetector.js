/**
 * Add-on field detection.
 *
 * Signature, Calculation and Card Payment fields come from SubtleForms Pro.
 * A form keeps them when Pro is not active; the live form leaves them out
 * until Pro is back. This module finds them in a schema. It never locks the
 * builder: everything in the free plugin stays editable.
 *
 * @package SubtleForms
 */

import { __ } from '@wordpress/i18n';

/** Field types provided by SubtleForms Pro. */
export const ADDON_FIELD_TYPES = ['signature', 'calculation', 'payment_card'];

const LABELS = {
  signature: () => __('Signature', 'subtleforms'),
  calculation: () => __('Calculation', 'subtleforms'),
  payment_card: () => __('Card Payment', 'subtleforms'),
};

/**
 * Every field type used in a list of fields, at any depth.
 *
 * @param {Array} fields Field nodes.
 * @param {Set}   out    Collected types.
 * @return {Set} Types.
 */
function collectTypes(fields, out = new Set()) {
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    if (!field || typeof field !== 'object') return;
    if (field.type) out.add(field.type);
    collectTypes(field.children || field.fields, out);
    if (Array.isArray(field.columns)) {
      field.columns.forEach((column) => {
        collectTypes(Array.isArray(column) ? column : column?.fields || column?.children, out);
      });
    }
  });
  return out;
}

/**
 * Whether a schema contains fields that SubtleForms Pro provides.
 *
 * @param {Object} schema Form schema.
 * @return {boolean} True when it does.
 */
export function formUsesProFeatures(schema) {
  if (!schema) return false;
  const types = collectTypes(schema.fields);
  return ADDON_FIELD_TYPES.some((type) => types.has(type));
}

/**
 * Labels of the Pro field types a schema uses.
 *
 * @param {Object} schema Form schema.
 * @return {string[]} Labels.
 */
export function getProFeaturesUsed(schema) {
  if (!schema) return [];
  const types = collectTypes(schema.fields);
  return ADDON_FIELD_TYPES.filter((type) => types.has(type)).map((type) => LABELS[type]());
}

/**
 * Labels of add-on fields in a schema that no active plugin provides on
 * this site right now.
 *
 * @param {Object}   schema  Form schema.
 * @param {string[]} missing Missing types (default: from the server).
 * @return {string[]} Labels.
 */
export function getMissingAddonFields(
  schema,
  missing = window.subtleformsAdmin?.missingFieldTypes || []
) {
  if (!schema || !Array.isArray(missing) || missing.length === 0) return [];
  const types = collectTypes(schema.fields);
  return missing
    .filter((type) => types.has(type))
    .map((type) => (LABELS[type] ? LABELS[type]() : type));
}
