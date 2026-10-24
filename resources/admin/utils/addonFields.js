/**
 * Add-on field detection.
 *
 * Signature, Calculation and Card Payment fields come from an add-on. A form
 * keeps them when the add-on is not active; the live form leaves them out.
 * This module finds them in a schema so the builder can say so. It never
 * changes or locks anything in the builder.
 *
 * @package SubtleForms
 */

import { __ } from '@wordpress/i18n';
import { normalizeLogic, isBasic } from '../../shared/conditions';

/** Field types provided by an add-on. */
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
 * Whether a schema has a payment field that no active plugin provides. Such a
 * form is not shown to visitors.
 *
 * @param {Object}   schema  Form schema.
 * @param {string[]} missing Missing types (default: from the server).
 * @return {boolean} True when it does.
 */
export function needsMissingPayment(
  schema,
  missing = window.subtleformsAdmin?.missingFieldTypes || []
) {
  if (!schema || !Array.isArray(missing)) return false;
  const types = collectTypes(schema.fields);
  return missing.some((type) => String(type).startsWith('payment_') && types.has(type));
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

/** Walk every node of a field tree, at any depth. */
function eachNode(fields, visit) {
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    if (!field || typeof field !== 'object') return;
    visit(field);
    eachNode(field.children || field.fields, visit);
    if (Array.isArray(field.columns)) {
      field.columns.forEach((column) => {
        eachNode(Array.isArray(column) ? column : column?.fields || column?.children, visit);
      });
    }
  });
}

/**
 * Settings a form uses that an add-on provides and no active plugin provides
 * now. The form still works: this only says how. Nothing is removed from it.
 *
 * - Picture Choice: shown as a plain choice, images ignored.
 * - Several files per upload field: one file is accepted.
 * - Advanced conditional logic: ignored (groups, "any", extra operators, and
 *   conditions on steps, emails, webhooks and confirmations).
 *
 * @param {Object}   schema   Form schema.
 * @param {string[]} provided Features an active add-on provides (default: from the server).
 * @return {string[]} Short labels.
 */
export function getLimitedFeatures(schema, provided = window.subtleformsAdmin?.addonFeatures || []) {
  if (!schema) return [];
  const has = (name) => Array.isArray(provided) && provided.includes(name);
  const out = [];
  let picture = false;
  let multiple = false;
  let advanced = false;

  const checkLogic = (logic, scope) => {
    const l = normalizeLogic(logic);
    if (l && !isBasic(l, scope)) advanced = true;
  };

  eachNode(schema.fields, (node) => {
    const config = node.config && typeof node.config === 'object' ? { ...node, ...node.config } : node;
    if (node.type === 'picture_choice') picture = true;
    if ((node.type === 'file_upload' || node.type === 'image_upload') && config.multiple === true) multiple = true;
    checkLogic(config.logic, node.type === 'step' ? 'step' : 'field');
  });
  (Array.isArray(schema.actions) ? schema.actions : []).forEach((action) => {
    checkLogic(action?.settings?.logic, 'action');
  });
  const confirmations = schema.metadata && Array.isArray(schema.metadata.confirmations) ? schema.metadata.confirmations : [];
  confirmations.forEach((c) => checkLogic(c?.logic, 'confirmation'));

  if (picture && !has('picture_choice')) out.push(__('Picture Choice (shown without pictures)', 'subtleforms'));
  if (multiple && !has('multi_file_uploads')) out.push(__('Several files per upload (one file is accepted)', 'subtleforms'));
  if (advanced && !has('advanced_logic')) out.push(__('Advanced conditional logic (ignored)', 'subtleforms'));
  return out;
}
