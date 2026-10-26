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
