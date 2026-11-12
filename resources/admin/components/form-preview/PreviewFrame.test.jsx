/**
 * 2.9.0: the preview document is built from what a page of the theme loads and
 * wraps the form the way the theme's templates do.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import PreviewFrame from './PreviewFrame';
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
  window.subtleformsAdmin = { frontendStyles: [ 'https://site.test/build/frontend/index.jsx.css' ] };
  const container = document.createElement( 'div' );
  document.body.appendChild( container );
  const root = createRoot( container );
  act( () => root.render( <PreviewFrame { ...props }><p id='child'>form</p></PreviewFrame> ) );
  const doc = container.querySelector( 'iframe' ).contentDocument;
  return { doc, unmount: () => { act( () => root.unmount() ); container.remove(); } };
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
