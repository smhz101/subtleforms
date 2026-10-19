/**
 * Readable text for a stored answer in the entry view.
 *
 * Choice fields store the option value; the entry shows its label, the same
 * way emails do. Yes/no fields (consent, single checkbox, toggle) store 1 or 0.
 */
import { __ } from '@wordpress/i18n';

const YES_NO_TYPES = [ 'consent', 'checkbox', 'toggle' ];

/**
 * @param {*}      value   One stored value.
 * @param {Object} field   Schema field node, if known.
 * @return {string} Text to show.
 */
export function answerText( value, field ) {
  const type = field?.type;
  const options = field?.options || field?.config?.options;
  if ( Array.isArray( options ) && options.length ) {
    const match = options.find(
      ( o ) => o && typeof o === 'object' && String( o.value ?? o.label ) === String( value )
    );
    if ( match && match.label ) {
      return String( match.label );
    }
  }
  if ( YES_NO_TYPES.includes( type ) && ! ( Array.isArray( options ) && options.length ) ) {
    if ( value === true || value === 1 || value === '1' || value === 'true' || value === 'yes' ) {
      return __( 'Yes', 'subtleforms' );
    }
    if ( value === false || value === 0 || value === '0' || value === 'false' ) {
      return __( 'No', 'subtleforms' );
    }
  }
  return String( value );
}
