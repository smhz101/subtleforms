import { __ } from '@wordpress/i18n';

/**
 * One sentence for every Form name field. The name is the public title
 * when the form is set to show it.
 *
 * @return {string}
 */
export function formNameHelp() {
	return __( 'The name shown to you and your visitors.', 'subtleforms' );
}
