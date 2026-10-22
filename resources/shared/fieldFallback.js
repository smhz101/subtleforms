import { getFieldType } from './extend';
import { fieldConfig } from './fieldConfig';

/**
 * Types an add-on provides, with the plain type they fall back to when the
 * add-on is not active. The saved form is never changed: only what a visitor
 * (or the builder preview) sees and what the browser checks.
 */
const FALLBACKS = {
  // A picture choice is a radio group, or a checkbox group when it allows
  // several answers. The option labels and values are the same; images are
  // ignored.
  picture_choice: (config) => (config.allowMultiple === true ? 'multiple_choice' : 'radio'),
};

/**
 * The field type to draw and check for a field.
 *
 * A registered add-on type is used as it is. A known add-on type that nobody
 * registered falls back to its plain type. Any other type is returned as is.
 *
 * @param {Object} field Schema field.
 * @return {string} Field type.
 */
export function effectiveFieldType(field) {
  const type = field && field.type;
  if (!type || getFieldType(type) || !FALLBACKS[type]) {
    return type;
  }
  return FALLBACKS[type](fieldConfig(field));
}
