/**
 * Field Renderer Registry
 * 
 * Maps field types to their renderer components
 */

import TextFieldRenderer from './TextFieldRenderer';
import ChoiceFieldRenderer from './ChoiceFieldRenderer';

/**
 * Field type to renderer component mapping
 * 
 * Groups:
 * - TEXT_FIELDS: text, email, phone, url, number, textarea
 * - CHOICE_FIELDS: checkbox, radio, multiple_choice, dropdown
 * - SPECIAL_FIELDS: All others use FieldRenderer directly (fallback)
 */
export const FIELD_RENDERERS = {
  // Text-based fields
  text: TextFieldRenderer,
  email: TextFieldRenderer,
  phone: TextFieldRenderer,
  url: TextFieldRenderer,
  number: TextFieldRenderer,
  textarea: TextFieldRenderer,

  // Choice-based fields
  checkbox: ChoiceFieldRenderer,
  radio: ChoiceFieldRenderer,
  multiple_choice: ChoiceFieldRenderer,
  dropdown: ChoiceFieldRenderer,
};

/**
 * Get renderer component for a field type
 * 
 * @param {string} type - Field type
 * @returns {Component|null} Renderer component or null for fallback to full renderer
 */
export function getFieldRenderer(type) {
  return FIELD_RENDERERS[type] || null;
}
