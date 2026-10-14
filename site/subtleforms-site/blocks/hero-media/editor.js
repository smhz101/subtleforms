( function ( wp ) {
	const { registerBlockType } = wp.blocks;
	const { InspectorControls, useBlockProps, MediaUpload, MediaUploadCheck } = wp.blockEditor;
	const { PanelBody, Button, RangeControl, ToggleControl, TextControl, TextareaControl } = wp.components;
	const { createElement: el, Fragment } = wp.element;
	const { __ } = wp.i18n;

	registerBlockType( 'subtleforms/hero-media', {
		edit: function ( props ) {
			const { attributes: a, setAttributes } = props;
			const blockProps = useBlockProps( {
				className: 'sf-hero-media sf-hero-media--editor' + ( a.grain ? ' has-grain' : '' ) + ( a.posterUrl ? ' has-poster' : ' is-atmosphere' ),
				style: { '--sf-dim': a.dim / 100 },
			} );
			return el(
				Fragment,
				null,
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Poster image', 'subtleforms-site' ), initialOpen: true },
						el(
							MediaUploadCheck,
							null,
							el( MediaUpload, {
								onSelect: ( m ) => setAttributes( { posterId: m.id, posterUrl: m.url, posterAlt: m.alt || '' } ),
								allowedTypes: [ 'image' ],
								value: a.posterId,
								render: ( { open } ) => el( Button, { variant: 'secondary', onClick: open }, a.posterUrl ? __( 'Replace poster', 'subtleforms-site' ) : __( 'Choose poster', 'subtleforms-site' ) ),
							} )
						),
						a.posterUrl ? el( Button, { variant: 'link', isDestructive: true, onClick: () => setAttributes( { posterId: 0, posterUrl: '', posterAlt: '' } ) }, __( 'Remove poster (use CSS atmosphere)', 'subtleforms-site' ) ) : null,
						el( ToggleControl, { label: __( 'Decorative (hidden from screen readers)', 'subtleforms-site' ), checked: !! a.decorative, onChange: ( v ) => setAttributes( { decorative: v } ) } ),
						! a.decorative ? el( TextareaControl, { label: __( 'Alt text', 'subtleforms-site' ), value: a.posterAlt, onChange: ( v ) => setAttributes( { posterAlt: v } ) } ) : null
					),
					el(
						PanelBody,
						{ title: __( 'Video loop (optional)', 'subtleforms-site' ), initialOpen: true },
						el(
							MediaUploadCheck,
							null,
							el( MediaUpload, {
								onSelect: ( m ) => setAttributes( { mp4Url: m.url } ),
								allowedTypes: [ 'video' ],
								render: ( { open } ) => el( Button, { variant: 'secondary', onClick: open }, __( 'Choose MP4', 'subtleforms-site' ) ),
							} )
						),
						el( TextControl, { label: __( 'MP4 URL', 'subtleforms-site' ), value: a.mp4Url, onChange: ( v ) => setAttributes( { mp4Url: v } ) } ),
						el( TextControl, { label: __( 'WebM URL (optional)', 'subtleforms-site' ), value: a.webmUrl, onChange: ( v ) => setAttributes( { webmUrl: v } ) } ),
						el( 'p', { className: 'components-base-control__help' }, __( 'Muted, looping, plays inline. Visitors with reduced motion or data saver only get the poster.', 'subtleforms-site' ) )
					),
					el(
						PanelBody,
						{ title: __( 'Look', 'subtleforms-site' ), initialOpen: false },
						el( RangeControl, { label: __( 'Darken (%)', 'subtleforms-site' ), value: a.dim, min: 0, max: 90, onChange: ( v ) => setAttributes( { dim: v } ) } ),
						el( ToggleControl, { label: __( 'Film grain', 'subtleforms-site' ), checked: !! a.grain, onChange: ( v ) => setAttributes( { grain: v } ) } )
					)
				),
				el(
					'div',
					blockProps,
					a.posterUrl ? el( 'img', { className: 'sf-hero-media__poster', src: a.posterUrl, alt: '' } ) : null,
					el( 'div', { className: 'sf-hero-media__atmosphere' } ),
					el( 'div', { className: 'sf-hero-media__dim' } ),
					el( 'span', { className: 'sf-hero-media__hint' }, a.mp4Url ? __( 'Hero media: poster + video loop', 'subtleforms-site' ) : a.posterUrl ? __( 'Hero media: poster', 'subtleforms-site' ) : __( 'Hero media: CSS atmosphere (add a poster or video in the sidebar)', 'subtleforms-site' ) )
				)
			);
		},
		save: function () {
			return null;
		},
	} );
} )( window.wp );
