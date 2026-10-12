/**
 * Field choices for the form builder's Integrations mapping.
 *
 * Mirrors SubtleForms\Support\FieldMapper on the server: containers are walked
 * into, layout-only fields are skipped, and composite name fields offer their
 * first and last name parts as `key.first_name` / `key.last_name`.
 */

import { adminLabel } from '../../../../shared/fieldDisplay';
import { __, sprintf } from '@wordpress/i18n';

const LAYOUT_TYPES = new Set([
  'html',
  'heading',
  'divider',
  'section',
  'section_break',
  'step',
  'form_step',
  'page_break',
  'spacer',
  'paragraph',
  'columns',
  'group',
  'row',
  'disclaimer',
  'recaptcha',
  'hcaptcha',
  'turnstile',
  'action_hook',
  'save_resume',
  'payment_summary',
]);

const NAME_TYPES = new Set(['name_group', 'name']);
const CONSENT_TYPES = new Set(['consent', 'checkbox', 'toggle']);

const isLayout = (type) => LAYOUT_TYPES.has(type) || /_container$/.test(type || '');

/**
 * Flatten a field tree into answer-bearing fields.
 *
 * @param {Array} fields Schema fields.
 * @return {Array<{key:string,label:string,type:string,field:Object}>}
 */
export function flattenFields(fields) {
  const out = [];
  const walk = (list) => {
    (Array.isArray(list) ? list : []).forEach((node) => {
      if (!node || typeof node !== 'object') return;
      const type = node.type || '';
      const key = node.key || node.config?.key || node.name || '';
      if (key && type && !isLayout(type)) {
        // The admin label names the field in integrations and merge tags (2.3.2).
        out.push({ key, label: adminLabel(node) || key, type, field: node });
      }
      if (Array.isArray(node.fields)) walk(node.fields);
      if (Array.isArray(node.children)) walk(node.children);
      if (Array.isArray(node.columns)) {
        node.columns.forEach((col) => {
          if (Array.isArray(col) && col.length && typeof col[0] === 'object') walk(col);
        });
      }
    });
  };
  walk(fields);
  return out;
}

/**
 * Options for "form field" selects.
 *
 * @param {Array} fields Schema fields.
 * @return {Array<{label:string,value:string}>}
 */
export function integrationFieldOptions(fields) {
  const options = [];
  flattenFields(fields).forEach(({ key, label, type }) => {
    if (NAME_TYPES.has(type)) {
      /* translators: %s: field label */
      options.push({ label: sprintf(__('%s: first name', 'subtleforms'), label), value: `${key}.first_name` });
      /* translators: %s: field label */
      options.push({ label: sprintf(__('%s: last name', 'subtleforms'), label), value: `${key}.last_name` });
      /* translators: %s: field label */
      options.push({ label: sprintf(__('%s: full name', 'subtleforms'), label), value: key });
      return;
    }
    options.push({ label, value: key });
  });
  return options;
}

/**
 * Options for the consent condition (checkbox-like fields).
 *
 * @param {Array} fields Schema fields.
 * @return {Array<{label:string,value:string}>}
 */
export function consentFieldOptions(fields) {
  return flattenFields(fields)
    .filter(({ type }) => CONSENT_TYPES.has(type))
    .map(({ key, label }) => ({ label, value: key }));
}
