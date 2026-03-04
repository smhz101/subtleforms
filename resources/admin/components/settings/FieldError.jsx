import { __ } from '@wordpress/i18n';

/**
 * Field Error Display Component
 *
 * Shows inline validation error messages for settings fields.
 *
 * @param {Object}   props
 * @param {string[]} props.errors - Array of error messages
 */
export default function FieldError( { errors } ) {
	if ( ! errors || errors.length === 0 ) {
		return null;
	}

	return (
		<div className="subtleforms-field-error">
			{ errors.map( ( error, index ) => (
				<span key={ index } className="sf-error-text">
					{ error }
				</span>
			) ) }
		</div>
	);
}
