/**
 * Frontend field validation — shared by the live form and the builder preview.
 *
 * The builder preview must behave exactly like the frontend (see Part A3),
 * so the rules live here once and both surfaces call them. Composite fields
 * (name_group / address_group) carry an object value at their root key, so a
 * plain "is the value empty" check passes even when every part is blank —
 * this module understands their shape and reports a group-level error when any
 * required part is missing.
 */

import { __, _n, sprintf } from '@wordpress/i18n';
import { getIn } from './valuePaths';
import { fieldConfig } from '../../shared/fieldConfig';

export const COMPOSITE_FIELD_TYPES = new Set(['name_group', 'address_group', 'address']);

export function isCompositeField(field) {
  const t = field?.type;
  return typeof t === 'string' && COMPOSITE_FIELD_TYPES.has(t);
}

/**
 * Whether a submitted value counts as missing.
 *
 * Mirrors FormRenderer.isEmptyValue: numeric zero is a real answer (range
 * slider at 0, NPS 0), but an unchecked checkbox (false) is genuinely missing.
 */
export function isEmptyValue(value) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    value === false ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isBlank(v) {
  return v === undefined || v === null || v === '';
}

/**
 * Whether a field is drawn as something a visitor can answer.
 *
 * @param {string} type   Field type.
 * @param {Object} config Merged field settings.
 * @return {boolean}
 */
export function isAnswerable(type, config = {}) {
  if (type === 'calculation') return !!String(config.formula || '').trim();
  if (type === 'checkbox_grid') {
    return (
      Array.isArray(config.rows) &&
      config.rows.length > 0 &&
      Array.isArray(config.columns) &&
      config.columns.length > 0
    );
  }
  return true;
}

/**
 * Validate a single field and return an error string (or undefined).
 *
 * @param {object} field Field node (config or flat shape).
 * @param {*}      value The value stored at the field's key.
 * @return {string|undefined}
 */
export function validateField(field, value) {
  const config = fieldConfig(field);
  const type = field?.type;
  // Fields that are not drawn cannot be answered: a matrix with no rows or
  // columns, or a calculation with no formula.
  if (!isAnswerable(type, config)) {
    return undefined;
  }
  const required = config?.required === true;
  const requiredMessage =
    (typeof config?.requiredMessage === 'string' && config.requiredMessage.trim()) ||
    __('This field is required.', 'subtleforms');

  if (required) {
    if (isCompositeField(field)) {
      const err = getCompositeRequiredError(type, value);
      if (err) return err;
    } else if (type === 'toggle') {
      const onValue = config.onValue ?? 'yes';
      if (value !== true && value !== onValue) return requiredMessage;
    } else if (isEmptyValue(value)) {
      return requiredMessage;
    }
  }

  if (isCompositeField(field) || isEmptyValue(value)) {
    return undefined;
  }

  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return __('Invalid email address.', 'subtleforms');
  }
  if (type === 'url' && !/^https?:\/\/.+/.test(value)) {
    return __('Invalid URL.', 'subtleforms');
  }

  const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

  if (typeof value === 'string' && ['text', 'textarea', 'password'].includes(type)) {
    const minLength = num(config.minLength);
    const maxLength = num(config.maxLength);
    if (minLength && value.length < minLength) {
      return sprintf(
        /* translators: %d: minimum number of characters */
        __('Must be at least %d characters.', 'subtleforms'),
        minLength
      );
    }
    if (maxLength && value.length > maxLength) {
      return sprintf(
        /* translators: %d: maximum number of characters */
        __('Must be %d characters or fewer.', 'subtleforms'),
        maxLength
      );
    }
    if (type === 'text' && config.pattern) {
      try {
        if (!new RegExp(config.pattern, 'u').test(value)) {
          return config.patternMessage || __('Please match the requested format.', 'subtleforms');
        }
      } catch (e) {
        // An invalid admin regex must never block a visitor.
      }
    }
  }

  if (type === 'number') {
    const n = Number(value);
    if (Number.isNaN(n)) return __('Please enter a number.', 'subtleforms');
    const min = num(config.min);
    const max = num(config.max);
    if (min !== null && n < min) {
      /* translators: %s: minimum value */
      return sprintf(__('Must be at least %s.', 'subtleforms'), min);
    }
    if (max !== null && n > max) {
      /* translators: %s: maximum value */
      return sprintf(__('Must be no more than %s.', 'subtleforms'), max);
    }
  }

  if ((type === 'multiple_choice' || type === 'picture_choice') && Array.isArray(value)) {
    const minChoices = num(config.minChoices);
    const maxChoices = num(config.maxChoices);
    if (minChoices && value.length < minChoices) {
      return sprintf(
        /* translators: %d: minimum number of selections */
        _n('Select at least %d option.', 'Select at least %d options.', minChoices, 'subtleforms'),
        minChoices
      );
    }
    if (maxChoices && value.length > maxChoices) {
      return sprintf(
        /* translators: %d: maximum number of selections */
        _n('Select no more than %d option.', 'Select no more than %d options.', maxChoices, 'subtleforms'),
        maxChoices
      );
    }
  }

  return undefined;
}

/**
 * Required-check for a composite (object-valued) field.
 *
 * name_group is invalid when first or last name is blank (the non-toggleable
 * parts). address_group is invalid when any of its core parts is blank.
 *
 * @param {string} type  Field type.
 * @param {*}      value Stored object value.
 * @return {string|undefined}
 */
function getCompositeRequiredError(type, value) {
  const v =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  if (type === 'name_group' || type === 'address') {
    if (isBlank(v.first_name) || isBlank(v.last_name)) {
      return __('Please enter your first and last name.', 'subtleforms');
    }
    return undefined;
  }

  if (type === 'address_group') {
    if (
      isBlank(v.street_address ?? v.street) ||
      isBlank(v.city) ||
      isBlank(v.state) ||
      isBlank(v.postal_code ?? v.postal) ||
      isBlank(v.country)
    ) {
      return __('Please enter your full address.', 'subtleforms');
    }
    return undefined;
  }

  return undefined;
}

/**
 * Validate a whole field tree, returning a { key: message } map.
 *
 * Walks children/fields/columns so nested fields inside steps, containers and
 * columns are all checked. Hidden fields are skipped.
 *
 * @param {Array}    fields      Field nodes.
 * @param {object}   values      Submitted values.
 * @param {Set}      hiddenFields Keys to skip.
 * @return {Object} Errors keyed by field key.
 */
export function validateFields(fields, values, hiddenFields) {
  const errors = {};

  const visit = (nodes) => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((field) => {
      if (!field || typeof field !== 'object') return;
      if (field.type === 'step') return;

      const key = field.config?.key || field.key;
      if (key && hiddenFields && hiddenFields.has(key)) return;

      if (key) {
        const value = getIn(values, key);
        const err = validateField(field, value);
        if (err) errors[key] = err;
      }

      const children =
        field.children && field.children.length > 0
          ? field.children
          : field.fields;
      if (Array.isArray(children)) visit(children);

      if (Array.isArray(field.columns)) {
        field.columns.forEach((col) => {
          if (Array.isArray(col)) visit(col);
        });
      }
    });
  };

  visit(fields);
  return errors;
}

/**
 * Keys of the empty required parts of a composite field, for aria-invalid.
 *
 * Returns the child keys that are blank so the renderer can mark only those
 * inputs as invalid (not every part of the group).
 *
 * @param {object} field Field node.
 * @param {*}      value Stored object value.
 * @return {string[]} Blank required part keys.
 */
export function getCompositeEmptyParts(field, value) {
  const type = field?.type;
  const v =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  if (type === 'name_group' || type === 'address') {
    const out = [];
    if (isBlank(v.first_name)) out.push('first_name');
    if (isBlank(v.last_name)) out.push('last_name');
    return out;
  }

  if (type === 'address_group') {
    const out = [];
    if (isBlank(v.street_address ?? v.street)) out.push('street_address');
    if (isBlank(v.city)) out.push('city');
    if (isBlank(v.state)) out.push('state');
    if (isBlank(v.postal_code ?? v.postal)) out.push('postal_code');
    if (isBlank(v.country)) out.push('country');
    return out;
  }

  return [];
}
