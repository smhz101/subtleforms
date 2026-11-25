import { __ } from '@wordpress/i18n';
import { fieldConfig } from '../../../../shared/fieldConfig';
import { chainedSelectLevels } from '../../../../shared/chainedOptions';

/**
 * Note for a Chained Select that has no dropdowns yet. Visitors do not see
 * such a field, so the author is told (RFUN-02). Not blocking.
 *
 * @param {Object} field Schema node.
 * @return {string} The note, or an empty string.
 */
export function chainedNotSetUpWarning(field) {
  if (field?.type !== 'chained_select' || chainedSelectLevels(fieldConfig(field)).length > 0) {
    return '';
  }
  return __(
    'The dropdowns are not set up yet. Visitors will not see this field until you add them.',
    'subtleforms'
  );
}

/** Field types the front end does not draw yet. Keep in step with HIDDEN in src/Fields/FieldSettings.php. */
export const NOT_RENDERED_TYPES = ['dynamic_field', 'post_selection', 'save_resume'];

/**
 * Note for a field type the form does not show yet (#140). Not blocking.
 *
 * @param {Object} field Schema node.
 * @return {string} The note, or an empty string.
 */
export function notShownWarning(field) {
  if (!NOT_RENDERED_TYPES.includes(field?.type)) {
    return '';
  }
  return __(
    'This field is not shown on the form yet. Visitors will not see it, so remove it or use another field.',
    'subtleforms'
  );
}
