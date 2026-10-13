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

function matrixRowKey(row) {
  if (row && typeof row === 'object') {
    if (row.value !== undefined && row.value !== null && row.value !== '') return row.value;
    if (row.label !== undefined && row.label !== null && row.label !== '') return row.label;
    return '';
  }
  return row;
}

function matrixRowLabel(row) {
  if (row && typeof row === 'object') {
    if (row.label !== undefined && row.label !== null && row.label !== '') return String(row.label);
    if (row.value !== undefined && row.value !== null && row.value !== '') return String(row.value);
    return '';
  }
  return String(row);
}

/** A row is answered by a column key, or by at least one checked cell. */
function matrixRowAnswered(answer) {
  if (typeof answer === 'number') return Number.isFinite(answer);
  if (typeof answer === 'string') return answer.trim() !== '';
  if (answer && typeof answer === 'object') {
    return Object.values(answer).some((cell) => cell === true || cell === 1 || cell === '1');
  }
  return false;
}

/** Label of the first row with no answer, or null when every row is filled. */
function firstUnansweredMatrixRow(rows, value) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const grid = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  for (const row of rows) {
    if (!matrixRowAnswered(grid[matrixRowKey(row)])) {
      return matrixRowLabel(row);
    }
  }
  return null;
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
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
export function validateField(field, value, defaults = {}) {
  const error = checkField(field, value, defaults);
  if (!error || error.required) {
    return error ? error.message : undefined;
  }
  // The field's own Custom validation message replaces every format, range
  // and pattern message (2.3.2), then the form default.
  const config = fieldConfig(field);
  const custom =
    (typeof config.validationMessage === 'string' && config.validationMessage.trim()) ||
    (typeof defaults.validationMessage === 'string' && defaults.validationMessage.trim()) ||
    '';
  return custom || error.message;
}

/** Required error, or a format error, as { message, required }. */
function checkField(field, value, defaults) {
  const err = rawValidateField(field, value, defaults);
  if (!err) return undefined;
  return typeof err === 'object' ? err : { message: err, required: false };
}

function rawValidateField(field, value, defaults = {}) {
  const config = fieldConfig(field);
  const type = field?.type;
  // Fields that are not drawn cannot be answered: a matrix with no rows or
  // columns, or a calculation with no formula.
  if (!isAnswerable(type, config)) {
    return undefined;
  }
  const required = config?.required === true;
  const requiredText =
    (typeof config?.requiredMessage === 'string' && config.requiredMessage.trim()) ||
    (typeof defaults?.requiredMessage === 'string' && defaults.requiredMessage.trim()) ||
    __('This field is required.', 'subtleforms');
  const requiredMessage = { message: requiredText, required: true };

  if (required) {
    if (isCompositeField(field)) {
      const err = getCompositeRequiredError(type, value);
      if (err) return { message: err, required: true };
    } else if (type === 'toggle') {
      const onValue = config.onValue ?? 'yes';
      if (value !== true && value !== onValue) return requiredMessage;
    } else if (type === 'checkbox_grid') {
      // Required means every row, not a single filled cell.
      const missing = firstUnansweredMatrixRow(config.rows, value);
      if (missing) {
        return {
          message: sprintf(
            /* translators: %s: matrix row label */
            __('Please answer the "%s" row.', 'subtleforms'),
            missing
          ),
          required: true,
        };
      }
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
          // validationMessage (2.3.2) replaces patternMessage; older forms keep theirs.
          return config.validationMessage || config.patternMessage || __('Please match the requested format.', 'subtleforms');
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
    const step = num(config.step);
    if (step !== null && Number.isFinite(step) && step > 0) {
      const base = min !== null && Number.isFinite(min) ? min : 0;
      const quot = (n - base) / step;
      if (Math.abs(quot - Math.round(quot)) > 1e-8) {
        return sprintf(
          /* translators: %s: step increment */
          __('Must match the step of %s.', 'subtleforms'),
          step
        );
      }
    }
  }

  if (type === 'date' && isIsoDate(value)) {
    const minDate = config.minDate;
    const maxDate = config.maxDate;
    if (isIsoDate(minDate) && value < minDate) {
      return sprintf(
        /* translators: %s: earliest allowed date */
        __('Date must be on or after %s.', 'subtleforms'),
        minDate
      );
    }
    if (isIsoDate(maxDate) && value > maxDate) {
      return sprintf(
        /* translators: %s: latest allowed date */
        __('Date must be on or before %s.', 'subtleforms'),
        maxDate
      );
    }
  }

  // Same character rule as FieldValidator::validatePhone. Preview never
  // reaches the server, so letters must fail here too.
  if ((type === 'phone' || type === 'tel') && typeof value === 'string') {
    if (!/^[\d\s\-\+\(\)]+$/.test(value)) {
      return __('Invalid phone number.', 'subtleforms');
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
export function validateFields(fields, values, hiddenFields, defaults = {}) {
  const errors = {};

  // `prefix` is set inside a Repeater group: `items.0.` (2.3.1). Each group's
  // children are checked on their own and report under their group path.
  const visit = (nodes, prefix = '') => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((field) => {
      if (!field || typeof field !== 'object') return;
      if (field.type === 'step') return;

      const rawKey = field.config?.key || field.key;
      const key = rawKey ? `${prefix}${rawKey}` : rawKey;
      if (key && hiddenFields && hiddenFields.has(key)) return;

      const children =
        field.children && field.children.length > 0
          ? field.children
          : field.fields;

      if (field.type === 'repeat_container') {
        if (!key) return;
        const { min, max } = repeaterLimits(field);
        const stored = getIn(values, key);
        const count = Math.max(Array.isArray(stored) ? stored.length : 0, min);
        if (Array.isArray(stored) && stored.length > max) {
          errors[key] = sprintf(
            /* translators: %d: maximum number of entries */
            _n('Add no more than %d entry.', 'Add no more than %d entries.', max, 'subtleforms'),
            max
          );
        }
        for (let i = 0; i < count; i++) {
          visit(children, `${key}.${i}.`);
        }
        return;
      }

      if (key) {
        const value = getIn(values, key);
        const err = validateField(field, value, defaults);
        if (err) errors[key] = err;
      }

      if (Array.isArray(children)) visit(children, prefix);

      if (Array.isArray(field.columns)) {
        field.columns.forEach((col) => {
          if (Array.isArray(col)) visit(col, prefix);
        });
      }
    });
  };

  visit(fields);
  return errors;
}

/**
 * Minimum and maximum groups of a Repeater (defaults 1 and 5, as the
 * server: src/Support/Repeater.php).
 */
export function repeaterLimits(field) {
  const cfg = { ...(field?.config || {}), ...(field || {}) };
  const rawMin = parseInt(cfg.min, 10);
  const rawMax = parseInt(cfg.max, 10);
  const min = Number.isFinite(rawMin) ? Math.max(0, rawMin) : 1;
  let max = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 5;
  max = Math.min(100, Math.max(max, min, 1));
  return { min, max };
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
