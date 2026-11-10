import { memo } from '@wordpress/element';
import { SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * "Tab shown first" (2.9.0): picks one of a Tabs container's panels by title.
 * The setting is stored as the panel's position (0 is the first).
 */
const PanelSelectInspectorControl = memo( function PanelSelectInspectorControl( {
	value,
	onChange,
	label,
	help,
	disabled,
	field,
} ) {
	const panels = Array.isArray( field?.children ) ? field.children : [];
	const options = panels.map( ( panel, index ) => ( {
		value: String( index ),
		label: panel.label || panel.config?.label || __( 'Untitled tab', 'subtleforms' ),
	} ) );
	const current = Math.max( 0, Math.min( parseInt( value, 10 ) || 0, panels.length - 1 ) );

	return (
		<SelectControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ label }
			value={ String( current ) }
			options={ options }
			onChange={ ( next ) => onChange( parseInt( next, 10 ) || 0 ) }
			help={ help }
			disabled={ disabled || options.length === 0 }
		/>
	);
} );

export default PanelSelectInspectorControl;
