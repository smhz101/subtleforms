import { __ } from '@wordpress/i18n';

/**
 * Help text for a secret field whose saved value cannot be read (the site's
 * salts changed). Empty when the value is readable or a new one is being typed.
 *
 * @param {Object} settings Current settings values.
 * @param {string} key      Setting key.
 * @param {string} what     'secret key' or 'signing secret'.
 * @return {string|undefined} Message, or undefined.
 */
export function secretUnreadable( settings, key, what = 'secret key' ) {
	const flagged = window.subtleformsData?.secretsUnreadable;
	if ( ! Array.isArray( flagged ) || ! flagged.includes( key ) || settings?.[ key ] ) {
		return undefined;
	}
	return what === 'signing secret'
		? __( 'Your signing secret could not be read. Please enter it again.', 'subtleforms' )
		: __( 'Your secret key could not be read. Please enter it again.', 'subtleforms' );
}
