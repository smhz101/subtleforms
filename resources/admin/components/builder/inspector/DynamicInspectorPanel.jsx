/**
 * DynamicInspectorPanel.jsx
 *
 * Renders inspector controls driven by the field definition's `inspectorControls`
 * array from PHP `FieldDefinition::toArray()`. No hardcoded fields — all controls
 * are declared on the PHP side and rendered generically here.
 *
 * Supports optional grouping: if a control has a `section` string property,
 * consecutive controls sharing the same section are grouped under a PanelSection.
 */

import { useMemo, memo } from '@wordpress/element';
import { Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useConfig } from '../context/ConfigContext';
import { getControlComponent } from './controlRegistry';
import { PanelSection } from '../../ui';

import './DynamicInspectorPanel.scss';

/**
 * Groups a flat controls array into sections.
 * Controls without a `section` property are placed in anonymous flat groups.
 *
 * @param {Array} controls - inspectorControls from PHP FieldDefinition
 * @returns {Array<{isSectioned: boolean, section: string|null, controls: Array}>}
 */
function groupControls( controls ) {
	const groups = [];

	controls.forEach( ( ctrl ) => {
		const sectionName = ctrl.section || null;
		const isSectioned = sectionName !== null;
		const last = groups[ groups.length - 1 ];
		const canAppend =
			last &&
			last.isSectioned === isSectioned &&
			last.section === sectionName;

		if ( canAppend ) {
			last.controls.push( ctrl );
		} else {
			groups.push( { isSectioned, section: sectionName, controls: [ ctrl ] } );
		}
	} );

	return groups;
}

/**
 * Renders a single inspector control bound to a field value.
 */
function ControlRenderer( { ctrl, field, onUpdate, isReadOnly } ) {
	// PHP uses `name` as the schema key; support `key` as a future alias
	const fieldKey = ctrl.key ?? ctrl.name;
	const ControlComponent = getControlComponent( ctrl.type );

	if ( ! ControlComponent || ! fieldKey ) {
		return null;
	}

	const value = field[ fieldKey ] ?? '';

	const props = {
		label: ctrl.label || fieldKey,
		help: ctrl.help || undefined,
		placeholder: ctrl.placeholder || undefined,
		disabled: isReadOnly,
		value,
		onChange: ( newValue ) => onUpdate( { [ fieldKey ]: newValue } ),
	};

	// Pass type-specific extra props from the PHP control definition
	if ( ctrl.type === 'number' ) {
		if ( ctrl.min !== undefined ) props.min = ctrl.min;
		if ( ctrl.max !== undefined ) props.max = ctrl.max;
		if ( ctrl.step !== undefined ) props.step = ctrl.step;
	}
	if ( ctrl.type === 'select' || ctrl.type === 'radio' ) {
		props.options = ctrl.options || [];
	}
	if ( ctrl.type === 'textarea' ) {
		if ( ctrl.rows !== undefined ) props.rows = ctrl.rows;
	}
	if ( ctrl.type === 'subfield' ) {
		props.subfields = Array.isArray( ctrl.subfields ) ? ctrl.subfields : [];
	}

	return <ControlComponent { ...props } />;
}

/**
 * DynamicInspectorPanel
 *
 * @param {Object}   props.field      - The selected field (flat config object from nodeToField)
 * @param {Function} props.onUpdate   - Callback: (changes: Object) => void
 * @param {boolean}  props.isReadOnly - Whether editing is disabled
 */
function DynamicInspectorPanel( { field, onUpdate, isReadOnly = false } ) {
	const { fieldDefinitions } = useConfig();

	const isLayout = useMemo( () => {
		const def = fieldDefinitions?.[ field?.type ];
		return def?.meta?.category === 'layout';
	}, [ fieldDefinitions, field?.type ] );

	const controls = useMemo( () => {
		const def = fieldDefinitions?.[ field?.type ];
		const source = isLayout ? def?.layoutControls : def?.inspectorControls;
		return Array.isArray( source ) ? source : [];
	}, [ fieldDefinitions, field?.type, isLayout ] );

	const groups = useMemo( () => groupControls( controls ), [ controls ] );

	if ( ! field ) {
		return null;
	}

	if ( controls.length === 0 ) {
		return (
			<Notice
				status="info"
				isDismissible={ false }
				className="sf-dynamic-inspector__empty"
			>
				{ isLayout
					? __( 'Layout field — configure via canvas', 'subtleforms' )
					: __( 'No configurable settings for this field type.', 'subtleforms' ) }
			</Notice>
		);
	}

	return (
		<div className="sf-dynamic-inspector">
			{ groups.map( ( group, idx ) => {
				if ( group.isSectioned ) {
					return (
						<PanelSection
							key={ `${ group.section }-${ idx }` }
							title={ group.section }
							initialOpen={ true }
						>
							{ group.controls.map( ( ctrl ) => (
								<ControlRenderer
									key={ ctrl.key ?? ctrl.name }
									ctrl={ ctrl }
									field={ field }
									onUpdate={ onUpdate }
									isReadOnly={ isReadOnly }
								/>
							) ) }
						</PanelSection>
					);
				}

				return group.controls.map( ( ctrl ) => (
					<ControlRenderer
						key={ ctrl.key ?? ctrl.name }
						ctrl={ ctrl }
						field={ field }
						onUpdate={ onUpdate }
						isReadOnly={ isReadOnly }
					/>
				) );
			} ) }
		</div>
	);
}

export default memo( DynamicInspectorPanel );
