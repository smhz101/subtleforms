/**
 * 2.9.0: the preview document is built from what a page of the theme loads and
 * wraps the form the way the theme's templates do.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import PreviewFrame, { pluginCssPlan } from './PreviewFrame';
import { isPlainThemeForm } from '../../../shared/appearance';
import { useThemeAssets } from '../../data/themeAssets';

jest.mock( '../../data/themeAssets', () => ( {
  ...jest.requireActual( '../../data/themeAssets' ),
  useThemeAssets: jest.fn(),
} ) );

global.IS_REACT_ACT_ENVIRONMENT = true;

const BLOCK = {
  stylesheets: [ 'https://site.test/wp-content/themes/t/style.css' ],
  inlineCss: '.theme-inline{color:red}',
  globalCss: ':root{--x:1}',
  fontFaces: '@font-face{font-family:X}',
  isBlockTheme: true,
  bodyClasses: [ 'wp-singular', 'page', 'wp-embed-responsive', 'wp-theme-t' ],
  contentClass: 'wp-block-post-content is-layout-constrained has-global-padding entry-content',
};

const CLASSIC = { ...BLOCK, isBlockTheme: false, bodyClasses: [ 'page', 'wp-embed-responsive', 't' ], contentClass: 'entry-content' };

function render( assets, props = {} ) {
  useThemeAssets.mockReturnValue( assets );
  window.subtleformsAdmin = {
    frontendStyles: [ 'https://site.test/build/frontend/index.jsx.css', 'https://site.test/assets/css/conversational.css' ],
    layoutCss: '.subtleforms-fields{display:flex}',
    plainTypes: [ 'text', 'email', 'select' ],
  };
  const container = document.createElement( 'div' );
  document.body.appendChild( container );
  const root = createRoot( container );
  act( () => root.render( <PreviewFrame { ...props }><p id='child'>form</p></PreviewFrame> ) );
  const doc = container.querySelector( 'iframe' ).contentDocument;
  const rerender = ( next ) => act( () => root.render( <PreviewFrame { ...props } { ...next }><p id='child'>form</p></PreviewFrame> ) );
  return { doc, rerender, unmount: () => { act( () => root.unmount() ); container.remove(); } };
}

afterEach( () => {
  document.body.innerHTML = '';
} );

describe( 'PreviewFrame', () => {
  it( 'loads the theme styles first and the plugin stylesheet after them', () => {
    const ui = render( BLOCK );
    const links = [ ...ui.doc.head.querySelectorAll( 'link[rel="stylesheet"]' ) ].map( ( l ) => l.getAttribute( 'href' ) );
    expect( links ).toEqual( [
      'https://site.test/wp-content/themes/t/style.css',
      'https://site.test/build/frontend/index.jsx.css',
    ] );
    const css = [ ...ui.doc.head.querySelectorAll( 'style' ) ].map( ( s ) => s.textContent ).join( '\n' );
    expect( css ).toContain( '@font-face{font-family:X}' );
    expect( css ).toContain( ':root{--x:1}' );
    expect( css ).toContain( '.theme-inline{color:red}' );
    ui.unmount();
  } );

  it( 'wraps the form like a block theme page', () => {
    const ui = render( BLOCK );
    expect( ui.doc.body.className ).toBe( 'wp-singular page wp-embed-responsive wp-theme-t' );
    const main = ui.doc.querySelector( '.wp-site-blocks > main.wp-block-group' );
    expect( main.className ).toContain( 'wp-block-post-content is-layout-constrained has-global-padding entry-content' );
    expect( main.querySelector( '#child' ) ).not.toBeNull();
    ui.unmount();
  } );

  it( 'wraps the form like a classic theme page', () => {
    const ui = render( CLASSIC );
    expect( ui.doc.body.className ).toBe( 'page wp-embed-responsive t' );
    expect( ui.doc.querySelector( '#content.site-content > article.page.type-page > .entry-content #child' ) ).not.toBeNull();
    ui.unmount();
  } );

  it( 'falls back to the page data while the theme assets load', () => {
    window.subtleformsAdmin = {};
    const ui = render( undefined );
    expect( ui.doc.querySelector( '#child' ) ).not.toBeNull();
    ui.unmount();
  } );

  it( 'gives the frame root the Dark page colours when asked', () => {
    const ui = render( CLASSIC, { scheme: 'dark' } );
    expect( ui.doc.getElementById( 'sf-preview-scheme' ).textContent ).toContain( 'color-scheme:dark' );
    ui.unmount();
  } );
} );

describe( 'which plugin CSS the frame loads', () => {
  const pluginNodes = ( doc ) => [ ...doc.head.querySelectorAll( '[data-sf-plugin-css]' ) ].map( ( n ) => ( n.tagName === 'LINK' ? n.getAttribute( 'href' ) : n.textContent ) );

  it( 'plans the layout lines for a plain theme form and the full stylesheet otherwise', () => {
    const admin = {
      frontendStyles: [ 'a/index.jsx.css', 'a/conversational.css' ],
      layoutCss: '.l{}',
    };
    expect( pluginCssPlan( true, false, admin ) ).toEqual( [ { kind: 'style', value: '.l{}' } ] );
    expect( pluginCssPlan( false, false, admin ) ).toEqual( [ { kind: 'link', value: 'a/index.jsx.css' } ] );
    expect( pluginCssPlan( false, true, admin ).map( ( i ) => i.value ) ).toEqual( [ 'a/index.jsx.css', 'a/conversational.css' ] );
  } );

  it( 'injects only the layout CSS for a plain theme form', () => {
    const ui = render( BLOCK, { plain: true } );
    expect( pluginNodes( ui.doc ) ).toEqual( [ '.subtleforms-fields{display:flex}' ] );
    expect( ui.doc.head.querySelector( 'link[href*="index.jsx.css"]' ) ).toBeNull();
    ui.unmount();
  } );

  it( 'injects the full stylesheet for any other form', () => {
    const ui = render( BLOCK, { plain: false } );
    expect( pluginNodes( ui.doc ) ).toEqual( [ 'https://site.test/build/frontend/index.jsx.css' ] );
    ui.unmount();
  } );

  it( 'swaps between the two in place, without rebuilding the frame, and keeps the scheme rule last', () => {
    const ui = render( BLOCK, { plain: true } );
    const child = ui.doc.getElementById( 'child' );
    ui.rerender( { plain: false } );
    expect( pluginNodes( ui.doc ) ).toEqual( [ 'https://site.test/build/frontend/index.jsx.css' ] );
    expect( ui.doc.getElementById( 'child' ) ).toBe( child );
    expect( ui.doc.head.lastElementChild.id ).toBe( 'sf-preview-scheme' );
    ui.rerender( { plain: true } );
    expect( pluginNodes( ui.doc ) ).toEqual( [ '.subtleforms-fields{display:flex}' ] );
    expect( ui.doc.getElementById( 'child' ) ).toBe( child );
    ui.unmount();
  } );
} );

describe( 'isPlainThemeForm decides like the page', () => {
  const types = [ 'text', 'email', 'select' ];
  const theme = { preset: 'theme', tokens: { fontFamily: 'inherit', colorBackground: 'transparent' }, variants: {} };
  const form = ( over = {}, fields = [ { type: 'text' }, { type: 'select' } ] ) => ( { metadata: { appearance: theme, ...over }, fields } );

  it( 'is true for an untouched theme form of plain fields', () => {
    expect( isPlainThemeForm( form(), types ) ).toBe( true );
  } );

  it( 'is false for another preset, a changed token, a phone field, a multi-step or inline form', () => {
    expect( isPlainThemeForm( form( { appearance: { preset: 'soft', tokens: {}, variants: {} } } ), types ) ).toBe( false );
    expect( isPlainThemeForm( form( { appearance: { ...theme, tokens: { ...theme.tokens, colorPrimary: '#f00' } } } ), types ) ).toBe( false );
    expect( isPlainThemeForm( form( {}, [ { type: 'text' }, { type: 'phone' } ] ), types ) ).toBe( false );
    expect( isPlainThemeForm( form( { type: 'conversational' } ), types ) ).toBe( false );
    expect( isPlainThemeForm( form( { appearance: { ...theme, variants: { layout: 'inline' } } } ), types ) ).toBe( false );
  } );

  it( 'is false when the server list is not there', () => {
    expect( isPlainThemeForm( form(), undefined ) ).toBe( false );
  } );
} );
