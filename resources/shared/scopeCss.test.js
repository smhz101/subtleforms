import { scopeCustomCss } from './scopeCss';
import { formAppearanceStyle, formScopeClass, isPureTheme, getPreset } from './appearance';

describe( 'scopeCustomCss', () => {
  it( 'puts the form class in front of every selector', () => {
    expect( scopeCustomCss( '.a, .b > .c:hover{color:red}', 12 ) ).toBe(
      '.subtleforms-form-12 .a,.subtleforms-form-12 .b > .c:hover{color:red}'
    );
  } );

  it( 'turns :root, html and body into the form itself', () => {
    expect( scopeCustomCss( ':root{--x:1} body{margin:0} html .a{b:c}', 3 ) ).toBe(
      '.subtleforms-form-3{--x:1}.subtleforms-form-3{margin:0}.subtleforms-form-3 .a{b:c}'
    );
  } );

  it( 'scopes rules inside media queries and keeps keyframes', () => {
    const out = scopeCustomCss( '@media (max-width:600px){.a{color:blue}} @keyframes k{from{opacity:0}to{opacity:1}}', 5 );
    expect( out ).toBe( '@media (max-width:600px){.subtleforms-form-5 .a{color:blue}}@keyframes k{from{opacity:0}to{opacity:1}}' );
  } );

  it( 'does not split on commas inside functions or strings', () => {
    expect( scopeCustomCss( '.e:is(.f,.g){x:y} .d::after{content:"a,b{"}', 1 ) ).toBe(
      '.subtleforms-form-1 .e:is(.f,.g){x:y}.subtleforms-form-1 .d::after{content:"a,b{"}'
    );
  } );

  it( 'moves @import to the front and drops other statements', () => {
    expect( scopeCustomCss( '.a{color:red} @import url("https://x.test/a.css"); @charset "utf-8";', 2 ) ).toBe(
      '@import url("https://x.test/a.css");.subtleforms-form-2 .a{color:red}'
    );
  } );

  it( 'leaves a selector that already starts with the form class', () => {
    expect( scopeCustomCss( '.subtleforms-form-9 .a{x:y}', 9 ) ).toBe( '.subtleforms-form-9 .a{x:y}' );
  } );

  it( 'cannot be escaped by a stray brace', () => {
    const out = scopeCustomCss( '.a{color:red}} body{display:none}', 4 );
    expect( out.startsWith( '.subtleforms-form-4 .a{color:red}' ) ).toBe( true );
  } );
} );

describe( 'tokens become variables', () => {
  it( 'names a 2.7.2 token after its key', () => {
    const style = formAppearanceStyle( { tokens: { labelSize: '14px', colorLink: 'var(--wp--preset--color--primary)', buttonPaddingX: '30px' } } );
    expect( style[ '--subtleforms-label-size' ] ).toBe( '14px' );
    expect( style[ '--subtleforms-color-link' ] ).toBe( 'var(--wp--preset--color--primary)' );
    expect( style[ '--subtleforms-button-padding-x' ] ).toBe( '30px' );
  } );

  it( 'turns shadow and focus words into CSS', () => {
    const style = formAppearanceStyle( { tokens: { fieldShadow: 'subtle', focusStyle: 'ring', buttonShadow: 'none' } } );
    expect( style[ '--subtleforms-field-shadow' ] ).toMatch( /^0 1px 2px/ );
    expect( style[ '--subtleforms-focus-style' ] ).toMatch( /^0 0 0 3px/ );
    expect( style[ '--subtleforms-button-shadow' ] ).toBe( 'none' );
  } );

  it( 'a width and centring set the root', () => {
    const style = formAppearanceStyle( { tokens: { formMaxWidth: '640px', formAlign: 'center' }, variants: { width: 'narrow' } } );
    expect( style.maxWidth ).toBe( '640px' );
    expect( style.marginLeft ).toBe( 'auto' );
  } );

  it( 'a form with no tokens has no variables, as before', () => {
    expect( formAppearanceStyle( { preset: 'default' } ) ).toEqual( {} );
  } );

  it( 'any new token touches a theme form', () => {
    const theme = getPreset( 'theme' );
    const base = { preset: 'theme', tokens: { ...theme.tokens }, variants: { ...theme.variants } };
    expect( isPureTheme( base ) ).toBe( true );
    expect( isPureTheme( { ...base, tokens: { ...base.tokens, labelSize: '14px' } } ) ).toBe( false );
    // The form's own CSS is printed with the form and does not change that.
    expect( isPureTheme( { ...base, customCss: '.a{b:c}' } ) ).toBe( true );
    expect( formScopeClass( 7 ) ).toBe( 'subtleforms-form-7' );
  } );
} );
