import { useState } from '@wordpress/element';
import { BaseControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { MaskedInput, maskError, maskHint } from '../../../../../frontend/components/fields/maskField';
import { resolveMask } from '../../../../../shared/inputMask';
import PropertyRow, { useRowIds } from '../PropertyRow';

/**
 * A small input that applies the field's mask as the author types, so the
 * setting can be tried before the form is published. Nothing typed here is
 * saved.
 */
export default function MaskTryControl( { field, label, layout } ) {
	const [ text, setText ] = useState( '' );
	const ids = useRowIds();
	const mask = resolveMask( field );
	if ( ! mask ) {
		return null;
	}
	const message = text ? maskError( field, text ) : '';
	const id = `sf-mask-try-${ field?.id || field?.key || 'field' }`;
	if ( layout === 'row' ) {
		return (
			<PropertyRow className="sf-mask-try" label={ label || __( 'Try it', 'subtleforms' ) } ids={ { ...ids, id } } help={ message || maskHint( mask ) } helpAlways={ !! message }>
				<MaskedInput
					id={ id }
					config={ field }
					value={ text }
					onChange={ setText }
					showHint={ false }
					className="sf-prow__input sf-mask-try__input"
					autoComplete="off"
					aria-invalid={ !! message || undefined }
					describedBy={ ids.helpId }
				/>
			</PropertyRow>
		);
	}
	return (
		<BaseControl
			__nextHasNoMarginBottom
			id={ id }
			label={ label || __( 'Try it', 'subtleforms' ) }
			help={ message || maskHint( mask ) }
			className="sf-mask-try"
		>
			<MaskedInput
				id={ id }
				config={ field }
				value={ text }
				onChange={ setText }
				showHint={ false }
				className="components-text-control__input sf-mask-try__input"
				autoComplete="off"
				aria-invalid={ !! message || undefined }
			/>
		</BaseControl>
	);
}
