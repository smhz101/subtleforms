/**
 * Shared Field Factories
 * Reusable field builders with proper labels and defaults
 */

import { __ } from '@wordpress/i18n';

/**
 * Text field factory
 */
export function textField({ key, label, placeholder, required = false, ...rest }) {
  return {
    type: 'text',
    key,
    label,
    placeholder: placeholder || '',
    required,
    ...rest,
  };
}

/**
 * Email field factory
 */
export function emailField({ key, label, placeholder, required = true, ...rest }) {
  return {
    type: 'email',
    key,
    label,
    placeholder: placeholder || 'your@email.com',
    required,
    ...rest,
  };
}

/**
 * Phone field factory
 */
export function phoneField({ key, label, placeholder, required = false, ...rest }) {
  return {
    type: 'tel',
    key,
    label,
    placeholder: placeholder || '+1 (555) 123-4567',
    required,
    ...rest,
  };
}

/**
 * Textarea field factory
 */
export function textareaField({ key, label, placeholder, required = false, rows = 4, ...rest }) {
  return {
    type: 'textarea',
    key,
    label,
    placeholder: placeholder || '',
    required,
    rows,
    ...rest,
  };
}

/**
 * Select field factory
 */
export function selectField({ key, label, placeholder, options, required = true, ...rest }) {
  return {
    type: 'select',
    key,
    label,
    placeholder: placeholder || __('Select an option', 'subtleforms'),
    options,
    required,
    ...rest,
  };
}

/**
 * Checkbox field factory
 */
export function checkboxField({ key, label, required = false, ...rest }) {
  return {
    type: 'checkbox',
    key,
    label,
    required,
    ...rest,
  };
}

/**
 * Number field factory
 */
export function numberField({ key, label, placeholder, required = false, min, max, ...rest }) {
  return {
    type: 'number',
    key,
    label,
    placeholder: placeholder || '',
    required,
    min,
    max,
    ...rest,
  };
}

/**
 * URL field factory
 */
export function urlField({ key, label, placeholder, required = false, ...rest }) {
  return {
    type: 'url',
    key,
    label,
    placeholder: placeholder || 'https://example.com',
    required,
    ...rest,
  };
}

/**
 * Date field factory
 */
export function dateField({ key, label, placeholder, required = false, ...rest }) {
  return {
    type: 'date',
    key,
    label,
    placeholder: placeholder || '',
    required,
    ...rest,
  };
}

/**
 * File upload field factory
 */
export function fileField({ key, label, required = false, accept, ...rest }) {
  return {
    type: 'file',
    key,
    label,
    required,
    accept: accept || '',
    ...rest,
  };
}
