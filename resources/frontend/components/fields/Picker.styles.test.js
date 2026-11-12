const fs = require( 'fs' );
const path = require( 'path' );

const scss = fs.readFileSync( path.join( __dirname, 'Picker.scss' ), 'utf8' );
const frontendScss = fs.readFileSync( path.join( __dirname, '../../styles/frontend.scss' ), 'utf8' );

describe( 'Picker.scss contract', () => {
  it( 'is plugin UI: kept whole for every form, built to its own file', () => {
    expect( scss.startsWith( '/*! inherit: keep-file */' ) ).toBe( true );
    expect( frontendScss ).not.toMatch( /@use\s+['"][^'"]*Picker['"]/ );
    const pkg = JSON.parse( fs.readFileSync( path.join( __dirname, '../../../../package.json' ), 'utf8' ) );
    expect( pkg.scripts[ 'build:picker' ] ).toContain( 'Picker.scss' );
    expect( pkg.scripts[ 'build:frontend' ] ).toContain( 'build:picker' );
  } );

  it( 'defines the picker tokens, each with a fallback that reads well on any page', () => {
    const tokens = {
      '--subtleforms-picker-surface': 'var(--subtleforms-color-surface, #fff)',
      '--subtleforms-picker-text': 'var(--subtleforms-color-text,',
      '--subtleforms-picker-muted': 'var(--subtleforms-color-text-light,',
      '--subtleforms-picker-border': 'var(--subtleforms-color-border,',
      '--subtleforms-picker-accent': 'var(--subtleforms-color-primary,',
      '--subtleforms-picker-on-accent': 'var(--subtleforms-button-text, #fff)',
      '--subtleforms-picker-radius': 'var(--subtleforms-radius-md, 8px)',
      '--subtleforms-picker-shadow': '0 8px 24px rgba(0, 0, 0, 0.12)',
    };
    Object.entries( tokens ).forEach( ( [ name, value ] ) => {
      expect( scss ).toContain( `${ name }: ${ value }` );
    } );
  } );

  it( 'sets the popover type size regardless of the theme body size', () => {
    expect( scss ).toMatch( /\.subtleforms-picker__menu\s*\{[^}]*font-size: 14px;[^}]*line-height: 20px/ );
    expect( scss ).toMatch( /\.subtleforms-picker__menu\s*\{[^}]*font-family: inherit/ );
    expect( scss ).not.toMatch( /color-scheme/ );
  } );

  it( 'resets the buttons inside the popover so a theme cannot paint them', () => {
    expect( scss ).toMatch( /@mixin picker-reset\s*\{\s*all: unset;/ );
    [ 'option', 'tick', 'day', 'nav', 'text-button' ].forEach( ( name ) => {
      expect( scss ).toContain( `.subtleforms-picker .subtleforms-picker__${ name }` );
    } );
  } );

  it( 'has no rule that targets input, select, button or label by element name', () => {
    const css = scss.replace( /\/\*[\s\S]*?\*\//g, '' ).replace( /\/\/.*$/gm, '' );
    const heads = ( css.match( /[^{};]+(?=\{)/g ) || [] ).map( ( head ) => head.trim() ).filter( ( head ) => ! head.startsWith( '@' ) );
    expect( heads.length ).toBeGreaterThan( 20 );
    heads.forEach( ( head ) => {
      head.split( ',' ).forEach( ( selector ) => {
        expect( selector ).not.toMatch( /(^|[\s>+~])(input|select|button|label|textarea|a)(?![\w-])/ );
      } );
    } );
  } );

  it( 'scopes every rule under .subtleforms-picker', () => {
    const css = scss.replace( /\/\*[\s\S]*?\*\//g, '' ).replace( /\/\/.*$/gm, '' );
    // Top level selector lists: each selector starts with .subtleforms-picker.
    const rules = css.match( /^[^\s@}/][^{;]*\{/gm ) || [];
    rules.forEach( ( rule ) => {
      const head = rule.slice( 0, -1 );
      if ( /^(@|\.subtleforms-picker|\.subtleforms-picker\.)/.test( head.trim() ) ) {
        return;
      }
      throw new Error( `Rule not scoped under .subtleforms-picker: ${ head.trim() }` );
    } );
  } );

  it( 'lays out the weekday header and every week as a seven column row', () => {
    expect( scss ).toMatch( /\.subtleforms-picker__week\s*\{[^}]*grid-template-columns: repeat\( ?7/ );
    expect( scss ).toMatch( /\.subtleforms-picker__weekdays,\s*\.subtleforms-picker \.subtleforms-picker__week/ );
  } );

  it( 'does not hard-code a 42px trigger min-height', () => {
    expect( scss ).not.toContain( 'min-height: 42px' );
  } );

  it( 'keeps the input padding tokens on the trigger', () => {
    expect( scss ).toContain( '--subtleforms-input-padding-y' );
  } );
} );
