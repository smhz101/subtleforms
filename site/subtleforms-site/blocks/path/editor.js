( function ( wp ) {
	const { registerBlockType } = wp.blocks;
	const { InspectorControls, useBlockProps } = wp.blockEditor;
	const { PanelBody, SelectControl, RangeControl, ToggleControl, TextControl } = wp.components;
	const { createElement: el, Fragment } = wp.element;
	const ServerSideRender = wp.serverSideRender;
	const { __ } = wp.i18n;

	registerBlockType( 'subtleforms/path', {
		edit: function ( props ) {
			const { attributes, setAttributes } = props;
			const blockProps = useBlockProps( { className: 'sf-path-editor' } );
			return el(
				Fragment,
				null,
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Throughline', 'subtleforms-site' ), initialOpen: true },
						el( SelectControl, {
							label: __( 'Shape', 'subtleforms-site' ),
							value: attributes.preset,
							options: [
								{ label: __( 'Hero fan (form to three outcomes)', 'subtleforms-site' ), value: 'hero' },
								{ label: __( 'Section divider', 'subtleforms-site' ), value: 'divider' },
								{ label: __( 'Line that stops (404, empty states)', 'subtleforms-site' ), value: 'stop' },
								{ label: __( 'Straight with stops (steps)', 'subtleforms-site' ), value: 'steps' },
							],
							onChange: ( v ) => setAttributes( { preset: v } ),
						} ),
						el( SelectControl, {
							label: __( 'Colour', 'subtleforms-site' ),
							value: attributes.color,
							options: [
								{ label: __( 'Lime (on dark)', 'subtleforms-site' ), value: 'lime' },
								{ label: __( 'Mint (on dark)', 'subtleforms-site' ), value: 'mint' },
								{ label: __( 'Forest (on cream)', 'subtleforms-site' ), value: 'forest' },
								{ label: __( 'Sand (on cream, quiet)', 'subtleforms-site' ), value: 'sand' },
							],
							onChange: ( v ) => setAttributes( { color: v } ),
						} ),
						el( RangeControl, {
							label: __( 'Travel time (seconds)', 'subtleforms-site' ),
							value: attributes.speed,
							min: 0.5,
							max: 12,
							step: 0.1,
							onChange: ( v ) => setAttributes( { speed: v } ),
						} ),
						el( ToggleControl, {
							label: __( 'Reverse direction', 'subtleforms-site' ),
							checked: !! attributes.reverse,
							onChange: ( v ) => setAttributes( { reverse: v } ),
						} ),
						el( ToggleControl, {
							label: __( 'Animate the dot', 'subtleforms-site' ),
							help: __( 'Visitors who prefer reduced motion always see the resting state.', 'subtleforms-site' ),
							checked: !! attributes.animate,
							onChange: ( v ) => setAttributes( { animate: v } ),
						} ),
						el( TextControl, {
							label: __( 'Accessible label (leave empty if decorative)', 'subtleforms-site' ),
							value: attributes.label,
							onChange: ( v ) => setAttributes( { label: v } ),
						} )
					)
				),
				el( 'div', blockProps, el( ServerSideRender, { block: 'subtleforms/path', attributes: attributes } ) )
			);
		},
		save: function () {
			return null;
		},
	} );
} )( window.wp );
