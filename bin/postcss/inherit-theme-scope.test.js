/**
 * "Inherit from theme" scoping of the public stylesheet (2.4.1).
 */
const postcss = require( 'postcss' );
const scope = require( './inherit-theme-scope' );

const run = ( css, from = '/repo/resources/frontend/styles/base.css' ) =>
	postcss( [ scope() ] ).process( css, { from } ).css;

const squash = ( css ) => css.replace( /\}\s*/g, '} ' ).replace( /\s+/g, ' ' ).trim();

describe( 'inherit-theme scope', () => {
	test( 'visual declarations only apply to forms that are not theme forms', () => {
		const out = squash( run( '.subtleforms-input { width: 100%; padding: 10px; border: 1px solid red; }' ) );
		expect( out ).toBe(
			'.subtleforms-input { width: 100%; } :where(.subtleforms:not(.subtleforms--inherit-theme)) .subtleforms-input { padding: 10px; border: 1px solid red; }'
		);
	} );

	test( 'a rule on the form root gets the scope in the same compound', () => {
		const out = squash( run( '.subtleforms.subtleforms--preset-dark input:hover { color: red; }' ) );
		expect( out ).toBe( '.subtleforms.subtleforms--preset-dark:where(:not(.subtleforms--inherit-theme)) input:hover { color: red; }' );
		expect( squash( run( '.subtleforms--type-steps .subtleforms-buttons { margin: 0; }' ) ) ).toBe(
			'.subtleforms--type-steps:where(:not(.subtleforms--inherit-theme)) .subtleforms-buttons { margin: 0; }'
		);
	} );

	test( 'the scope goes before a pseudo-element', () => {
		expect( squash( run( '.subtleforms::before { color: red; }' ) ) ).toBe(
			'.subtleforms:where(:not(.subtleforms--inherit-theme))::before { color: red; }'
		);
	} );

	test( 'a wrapper inside the root that only looks like a modifier is scoped as a descendant', () => {
		expect( squash( run( '.subtleforms--multistep { color: red; }' ) ) ).toBe(
			':where(.subtleforms:not(.subtleforms--inherit-theme)) .subtleforms--multistep { color: red; }'
		);
	} );

	test( 'elements outside the form root are left alone', () => {
		const css = '.subtleforms-form-container { padding: 0; } .subtleforms-loading { color: gray; }';
		expect( squash( run( css ) ) ).toBe( squash( css ) );
		expect( squash( run( '.subtleforms-form-container .subtleforms-input { color: red; }' ) ) ).toBe(
			'.subtleforms-form-container :where(.subtleforms:not(.subtleforms--inherit-theme)) .subtleforms-input { color: red; }'
		);
	} );

	test( 'a selector list mixing outside and inside elements is split', () => {
		const out = squash( run( '.subtleforms-loading, .subtleforms-field-help { color: gray; }' ) );
		expect( out ).toBe(
			'.subtleforms-loading { color: gray; } :where(.subtleforms:not(.subtleforms--inherit-theme)) .subtleforms-field-help { color: gray; }'
		);
	} );

	test( 'custom properties, :root and keyframes are untouched', () => {
		const css = ':root { --a: 1px; color: red; } .subtleforms { --b: 2px; } @keyframes x { from { opacity: 0; margin: 0; } }';
		expect( squash( run( css ) ) ).toBe( squash( css ) );
	} );

	test( 'a marked rule stays whole for every form and the marker is removed', () => {
		const out = squash( run( '.subtleforms-sr-only { /*! inherit: keep */ position: absolute; height: 1px; margin: -1px; }' ) );
		expect( out ).toBe( '.subtleforms-sr-only { position: absolute; height: 1px; margin: -1px; }' );
	} );

	test( 'rules between keep-start and keep-end stay whole, including inside @media', () => {
		const css = '/*! inherit: keep-start (signature pad) */ .a { border: 1px solid; } @media (max-width: 1px) { .b { color: red; } } /*! inherit: keep-end */ .c { color: blue; }';
		expect( squash( run( css ) ) ).toBe(
			'.a { border: 1px solid; } @media (max-width: 1px) { .b { color: red; } } :where(.subtleforms:not(.subtleforms--inherit-theme)) .c { color: blue; }'
		);
	} );

	test( 'a file marked keep-file is left alone', () => {
		const css = '/*! inherit: keep-file */ .x { color: red; }';
		expect( squash( run( css ) ) ).toBe( '.x { color: red; }' );
	} );

	test( 'files outside resources/frontend are not touched', () => {
		const css = '.x { color: red; }';
		expect( run( css, '/repo/resources/admin/a.css' ) ).toBe( css );
	} );

	test( 'specificity of a scoped selector is unchanged', () => {
		// :where() adds nothing, so the scope only filters which forms match.
		expect( scope.scopeSelector( '.subtleforms-input:focus' ) ).toBe(
			':where(.subtleforms:not(.subtleforms--inherit-theme)) .subtleforms-input:focus'
		);
	} );
} );
