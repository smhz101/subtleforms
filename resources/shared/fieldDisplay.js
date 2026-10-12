/**
 * Per-field display settings with form-level defaults (2.3.2).
 *
 * - Field label visibility: 'visible' (top aligned) or 'hidden'. A hidden
 *   label is only hidden visually: it stays in the page for screen readers,
 *   so the field keeps its accessible name. The older Style tab option
 *   (appearance.hideLabel) is read as 'hidden'; the new setting replaces it.
 * - Help text placement: 'below' (default) or 'above' the input.
 * - Admin label: the name used in entries, emails, exports and integrations
 *   instead of the public label.
 *
 * Shared by the builder canvas and the live form so both look the same.
 */

import { fieldConfig } from './fieldConfig';

/**
 * Form-level defaults from schema metadata.
 *
 * @param {Object} metadata schema.metadata
 * @return {{labelVisibility: string, descriptionPlacement: string, requiredMessage: string, validationMessage: string}}
 */
export function formFieldDefaults(metadata) {
  const m = metadata && typeof metadata === 'object' ? metadata : {};
  return {
    labelVisibility: m.labelVisibility === 'hidden' ? 'hidden' : 'visible',
    descriptionPlacement: m.descriptionPlacement === 'above' ? 'above' : 'below',
    requiredMessage: typeof m.requiredMessage === 'string' ? m.requiredMessage.trim() : '',
    validationMessage: typeof m.validationMessage === 'string' ? m.validationMessage.trim() : '',
  };
}

/**
 * Effective display settings of one field.
 *
 * @param {Object} field    Schema node (flat or wrapped).
 * @param {Object} defaults formFieldDefaults() result (or metadata-like object).
 * @return {{labelHidden: boolean, descriptionAbove: boolean}}
 */
export function fieldDisplay(field, defaults = {}) {
  const config = fieldConfig(field);
  let visibility = config.labelVisibility;
  if (visibility !== 'visible' && visibility !== 'hidden') {
    visibility = config.appearance?.hideLabel ? 'hidden' : defaults.labelVisibility || 'visible';
  }
  let placement = config.descriptionPlacement;
  if (placement !== 'below' && placement !== 'above') {
    placement = defaults.descriptionPlacement || 'below';
  }
  return {
    labelHidden: visibility === 'hidden',
    descriptionAbove: placement === 'above',
  };
}

/**
 * The name of a field in entries, emails, exports and integrations.
 *
 * @param {Object} field Schema node.
 * @return {string}
 */
export function adminLabel(field) {
  const config = fieldConfig(field);
  const own = typeof config.adminLabel === 'string' ? config.adminLabel.trim() : '';
  if (own) return own;
  const label = typeof config.label === 'string' ? config.label.trim() : '';
  return label || config.key || field?.key || '';
}
