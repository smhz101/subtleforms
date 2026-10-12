/**
 * Form Style Taxonomy
 *
 * Maps schema metadata to CSS style variants.
 * This is read-only - no schema migrations required.
 */

import { structuralType, TYPE_MULTI_STEP } from '../../shared/formType';

/**
 * Supported form types and their style mappings
 */
export const FORM_TYPES = {
  DEFAULT: 'default',
  CONVERSATIONAL: 'conversational',
  MULTISTEP: 'multistep',
  STEPS: 'steps',
  COMPACT: 'compact',
  PAYMENT: 'payment',
  SURVEY: 'survey',
};

/**
 * Get form type from schema metadata
 *
 * @param {Object} schema - Form schema
 * @returns {string} Form type identifier
 */
export function getFormType(schema) {
  // A Standard form with Page Breaks renders as Multi-step, and a Multi-step
  // form without one as Standard (2.3.2): the structure decides.
  const type = structuralType(schema || {});

  if (type === TYPE_MULTI_STEP) {
    return FORM_TYPES.STEPS;
  }
  if (!type || type === 'regular') {
    return FORM_TYPES.DEFAULT;
  }

  // Map known types
  if (Object.values(FORM_TYPES).includes(type)) {
    return type;
  }

  return FORM_TYPES.DEFAULT;
}

/**
 * Get layout variant from schema metadata
 *
 * @param {Object} schema - Form schema
 * @returns {string|null} Layout variant or null
 */
export function getFormLayout(schema) {
  return schema?.metadata?.layout || null;
}

/**
 * Get variant modifier from schema metadata
 *
 * @param {Object} schema - Form schema
 * @returns {string|null} Variant modifier or null
 */
export function getFormVariant(schema) {
  return schema?.metadata?.variant || null;
}

/**
 * Generate CSS class names for a form
 *
 * @param {Object} schema - Form schema
 * @returns {string} Space-separated CSS classes
 */
export function getFormClassNames(schema) {
  const classes = ['subtleforms'];

  const type = getFormType(schema);
  classes.push(`subtleforms--type-${type}`);

  const layout = getFormLayout(schema);
  if (layout) {
    classes.push(`subtleforms--layout-${layout}`);
  }

  const variant = getFormVariant(schema);
  if (variant) {
    classes.push(`subtleforms--variant-${variant}`);
  }

  return classes.join(' ');
}
