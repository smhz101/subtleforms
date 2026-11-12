/**
 * 2.9.0: the Light and Dark canvas switch changes the page around the form
 * and nothing in the form's appearance. A form made for a dark page opens on
 * the dark canvas until the person chooses.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import { withClient } from '../../../../tests/js/queryWrapper';
import PreviewWorkspace, { SCHEME_STORAGE_KEY } from './PreviewWorkspace';
import { getPreset } from '../../../shared/appearance';
import { schemeCss } from '../form-preview/PreviewFrame';

jest.mock( '../form-preview/FormPreviewBody', () => ( {
  __esModule: true,
  default: ( { scheme } ) => <div data-testid='body' data-scheme={ scheme } />,
} ) );
jest.mock( '../../data/apiClient', () => ( { apiClient: { get: jest.fn( () => Promise.reject( new Error( 'offline' ) ) ) } } ) );

global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function mount( appearance ) {
  const schema = { metadata: { appearance }, fields: [ { id: 'a', key: 'a', type: 'text', label: 'A' } ] };
  const before = JSON.stringify( schema );
  const onChange = jest.fn();
  const container = document.createElement( 'div' );
  document.body.appendChild( container );
  const root = createRoot( container );
  act( () => root.render( withClient( <PreviewWorkspace schema={ schema } formId={ 4 } onChange={ onChange } /> ) ) );
  return {
    container,
    onChange,
    schema,
    unchanged: () => JSON.stringify( schema ) === before,
    unmount: () => { act( () => root.unmount() ); container.remove(); },
  };
}

const stage = () => document.querySelector( '.sf-preview-workspace__stage' );
const button = ( name ) => document.querySelector( `button[aria-label="${ name } canvas"]` );

beforeEach( () => window.localStorage.clear() );
afterEach( () => {
  document.body.innerHTML = '';
} );

describe( 'canvas switch', () => {
  it( 'starts light, switches the stage class, and leaves the appearance alone', () => {
    const ui = mount( { preset: 'soft', tokens: { ...getPreset( 'soft' ).tokens }, variants: {} } );
    expect( stage().classList.contains( 'is-light' ) ).toBe( true );
    expect( button( 'Light' ).getAttribute( 'aria-pressed' ) ).toBe( 'true' );

    act( () => button( 'Dark' ).click() );
    expect( stage().classList.contains( 'is-dark' ) ).toBe( true );
    expect( stage().classList.contains( 'is-light' ) ).toBe( false );
    expect( document.querySelector( '[data-testid="body"]' ).dataset.scheme ).toBe( 'dark' );
    expect( button( 'Dark' ).getAttribute( 'aria-pressed' ) ).toBe( 'true' );

    expect( ui.onChange ).not.toHaveBeenCalled();
    expect( ui.unchanged() ).toBe( true );
    ui.unmount();
  } );

  it( 'remembers the choice for the browser, not the form', () => {
    const ui = mount( { preset: 'soft', tokens: {}, variants: {} } );
    act( () => button( 'Dark' ).click() );
    expect( window.localStorage.getItem( SCHEME_STORAGE_KEY ) ).toBe( 'dark' );
    ui.unmount();
    const other = mount( { preset: 'default', tokens: {}, variants: {} } );
    expect( stage().classList.contains( 'is-dark' ) ).toBe( true );
    other.unmount();
  } );

  it( 'opens a form with a backdrop preset on the dark canvas until the person flips it', () => {
    const ui = mount( { preset: 'dark', tokens: { ...getPreset( 'dark' ).tokens }, variants: {} } );
    expect( stage().classList.contains( 'is-dark' ) ).toBe( true );
    expect( window.localStorage.getItem( SCHEME_STORAGE_KEY ) ).toBeNull();
    act( () => button( 'Light' ).click() );
    expect( stage().classList.contains( 'is-light' ) ).toBe( true );
    expect( ui.onChange ).not.toHaveBeenCalled();
    ui.unmount();
  } );

  it( 'sets only the frame root, never a form token', () => {
    expect( schemeCss( 'light' ) ).toBe( 'html{background:#ffffff;color:#1f2937}' );
    expect( schemeCss( 'dark' ) ).toContain( 'html{background:#1f1f1f;color:#e5e7eb;color-scheme:dark}' );
    expect( schemeCss( 'dark' ) ).not.toMatch( /--subtleforms/ );
  } );
} );
