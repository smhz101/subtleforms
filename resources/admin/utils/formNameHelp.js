import { __ } from '@wordpress/i18n';

/**
 * The wording of the form name and description fields. The create dialog, the
 * quick start wizard and Form settings all use these, so the same setting
 * has the same name and the same help wherever it is edited (UX2-14).
 */

/** @return {string} */
export function formNameLabel() {
	return __( 'Form name', 'subtleforms' );
}

/**
 * One sentence for every Form name field. The name is the public title
 * when the form is set to show it.
 *
 * @return {string}
 */
export function formNameHelp() {
	return __( 'The name shown to you and your visitors.', 'subtleforms' );
}

/** @return {string} */
export function formDescriptionLabel() {
	return __( 'Description', 'subtleforms' );
}

/** @return {string} */
export function formDescriptionHelp() {
	return __( 'Shown under the title when the block or shortcode displays it.', 'subtleforms' );
}
