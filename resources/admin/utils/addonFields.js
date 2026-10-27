/**
 * Add-on field detection.
 *
 * An add-on can register field types. A form keeps its fields when the add-on
 * is not active; the live form does not show them. This module finds them in a
 * schema (a type nothing registers on this site) so the builder can say so. It
 * never changes or locks anything in the builder.
 *
 * @package SubtleForms
 */

import { __ } from '@wordpress/i18n';
import { normalizeLogic, isBasic } from '../../shared/conditions';

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
 * Field types this site understands: the registered ones, from the server.
 * An empty list means the server did not say, so nothing is reported.
 */
function knownTypes() {
  const list = window.subtleformsAdmin?.knownFieldTypes;
  return Array.isArray(list) ? list : [];
}

/**
 * The name the form's author gave a field, or its type key when it has none.
 *
 * @param {Object} node Field node.
 * @return {string} Label.
 */
export function getFieldDisplayName(node) {
  const config = node && typeof node.config === 'object' && node.config ? node.config : {};
  const label = [node?.label, config.label, node?.title].find(
    (value) => typeof value === 'string' && value.trim() !== ''
  );
  return label ? label.trim() : String(node?.type || '');
}

/**
 * Names of the fields in a schema whose type no active plugin registers on
 * this site right now. The names are the ones the form's author gave the
 * fields; a field without a name shows its type key.
 *
 * @param {Object}   schema Form schema.
 * @param {string[]} known  Known field types (default: from the server).
 * @return {string[]} Names, without repeats.
 */
export function getMissingAddonFields(schema, known = knownTypes()) {
  if (!schema || !Array.isArray(known) || known.length === 0) return [];
  const names = [];
  eachNode(schema.fields, (node) => {
    if (typeof node.type !== 'string' || node.type === '' || known.includes(node.type)) return;
    const name = getFieldDisplayName(node);
    if (!names.includes(name)) names.push(name);
  });
  return names;
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
