/**
 * 2.4.1: the appearance panel says who styles a theme form.
 */
import { createRoot } from '@wordpress/element';
import { act } from 'react';
import FormAppearancePanel from './FormAppearancePanel';
import { getPreset } from '../../../../shared/appearance';

jest.mock( './AppearanceControls.scss', () => ( {} ) );
jest.mock( './FormAppearancePanel.scss', () => ( {} ) );

global.IS_REACT_ACT_ENVIRONMENT = true;
// ToggleGroupControl measures itself; jsdom has no ResizeObserver.
global.ResizeObserver = global.ResizeObserver || class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function render( appearance ) {
  const container = document.createElement( 'div' );
  document.body.appendChild( container );
  const root = createRoot( container );
  const schema = { metadata: { appearance }, fields: [] };
  act( () => root.render( <FormAppearancePanel schema={ schema } onChange={ () => {} } /> ) );
  return { container, unmount: () => act( () => root.unmount() ) };
}

function openCustom( container ) {
  const custom = [ ...container.querySelectorAll( 'button' ) ].find( ( b ) => b.textContent === 'Custom' );
  if ( custom ) {
    act( () => custom.click() );
  }
}

describe( 'theme form note', () => {
  const theme = getPreset( 'theme' );

  it( 'an untouched theme form says the theme styles it', () => {
    const { container, unmount } = render( { preset: 'theme', tokens: { ...theme.tokens }, variants: { ...theme.variants } } );
    openCustom( container );
    expect( container.querySelector( '.sf-form-appearance__theme-note' ).textContent ).toContain( 'Your theme styles this form' );
    unmount();
  } );

  it( 'a changed theme form says SubtleForms styles it', () => {
    const { container, unmount } = render( { preset: 'theme', tokens: { ...theme.tokens, colorPrimary: '#aa0000' }, variants: { ...theme.variants } } );
    openCustom( container );
    expect( container.querySelector( '.sf-form-appearance__theme-note' ).textContent ).toContain( 'SubtleForms styles this form' );
    unmount();
  } );

  it( 'other presets have no note', () => {
    const { container, unmount } = render( { preset: 'default', tokens: {}, variants: {} } );
    openCustom( container );
    expect( container.querySelector( '.sf-form-appearance__theme-note' ) ).toBeNull();
    unmount();
  } );
} );
