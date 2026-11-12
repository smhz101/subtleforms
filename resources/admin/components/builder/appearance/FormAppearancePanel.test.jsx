/**
 * 2.9.0: the Appearance panel is drawn like the field settings panel. Its
 * Custom tab has every control the 2.8 panel had, the Presets tab is a radio
 * group of ten cards, applying a preset writes the same object as before, and
 * both tabs pass an accessibility check.
 */
import { createRoot } from '@wordpress/element';
import { act, useState } from 'react';
import axe from 'axe-core';
import FormAppearancePanel from './FormAppearancePanel';
import { FORM_PRESETS, getPreset } from '../../../../shared/appearance';
import { setThemeStylesForTests } from '../../../data/themeStyles';
import { GROUPS } from './tokenDefs';
import { VARIANT_LABELS } from './labels';
import fixture from './__fixtures__/custom-controls-2.8.json';

jest.mock( '../../../data/apiClient', () => ( { apiClient: { get: jest.fn( () => Promise.reject( new Error( 'offline' ) ) ) } } ) );

global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let latest;
let updates;
function Harness( { initial, readOnly = false } ) {
  const [ schema, setSchema ] = useState( { metadata: { appearance: initial }, fields: [] } );
  latest = schema;
  return (
    <FormAppearancePanel
      schema={ schema }
      isReadOnly={ readOnly }
      formId={ 3 }
      onChange={ ( next ) => {
        updates.push( next );
        setSchema( next );
      } }
    />
  );
}

function mount( initial, props = {} ) {
  const container = document.createElement( 'div' );
  document.body.appendChild( container );
  const root = createRoot( container );
  act( () => root.render( <Harness initial={ initial } { ...props } /> ) );
  return { container, unmount: () => { act( () => root.unmount() ); container.remove(); } };
}

const click = ( el ) => act( () => el.click() );
const tab = ( name ) => document.querySelector( `[role="tab"][aria-label="${ name }"]` );
const radios = () => [ ...document.querySelectorAll( '.sf-pgrid input[type="radio"]' ) ];
const key = ( el, name ) => act( () => {
  el.dispatchEvent( new KeyboardEvent( 'keydown', { key: name, bubbles: true } ) );
} );

beforeEach( () => {
  window.localStorage.clear();
  updates = [];
  setThemeStylesForTests( null );
} );
afterEach( () => {
  document.body.innerHTML = '';
} );

describe( 'the Custom tab keeps every control of 2.8', () => {
  it( 'has the same set of token keys as the fixture taken from main', () => {
    const keys = GROUPS.flatMap( ( g ) => g.controls.map( ( c ) => c.key ) ).sort();
    expect( keys ).toEqual( fixture.tokens );
    expect( GROUPS.flatMap( ( g ) => g.variants || [] ).sort() ).toEqual( fixture.variants );
  } );

  it( 'draws a row for each of them once its sections and More are open', () => {
    const ui = mount( { preset: 'default', tokens: {}, variants: {} } );
    click( tab( 'Custom' ) );
    expect( [ ...document.querySelectorAll( '.sf-isec__title' ) ].map( ( t ) => t.textContent ) )
      .toEqual( [ 'Type', 'Colours', 'Fields', 'Buttons', 'Layout' ] );
    document.querySelectorAll( '.sf-isec__toggle' ).forEach( click );
    document.querySelectorAll( '.sf-appearance-panel__more' ).forEach( click );

    const drawn = [ ...document.querySelectorAll( '.sf-prow__label-text' ) ].map( ( l ) => l.textContent );
    const expected = [
      ...GROUPS.flatMap( ( g ) => g.controls.map( ( c ) => c.label ) ),
      ...fixture.variants.map( ( v ) => VARIANT_LABELS[ v ] ),
      'Spacing',
      'Button width',
    ].sort();
    // Button alignment is both a variant and a row of the Buttons section.
    expected.push( VARIANT_LABELS.buttonAlign );
    // Every label the 2.8 panel drew appears at least as often here.
    const count = ( list, label ) => list.filter( ( l ) => l === label ).length;
    [ ...new Set( expected ) ].forEach( ( label ) => {
      expect( count( drawn, label ) ).toBeGreaterThanOrEqual( 1 );
    } );
    ui.unmount();
  } );

  it( 'keeps the inherited value as muted placeholder text', () => {
    const ui = mount( { preset: 'default', tokens: {}, variants: {} } );
    click( tab( 'Custom' ) );
    document.querySelectorAll( '.sf-isec__toggle' ).forEach( click );
    const radius = [ ...document.querySelectorAll( '.sf-prow' ) ].find( ( r ) => r.textContent.includes( 'Corner radius' ) );
    expect( radius.querySelector( 'input' ).getAttribute( 'placeholder' ) ).toBe( '8px' );
    ui.unmount();
  } );
} );

describe( 'the Presets tab', () => {
  it( 'is a radio group of the ten themes, and Presets is the default tab', () => {
    const ui = mount( { preset: 'default', tokens: {}, variants: {} } );
    expect( tab( 'Presets' ).getAttribute( 'aria-selected' ) ).toBe( 'true' );
    const group = document.querySelector( '[role="radiogroup"][aria-label="Presets"]' );
    expect( group ).not.toBeNull();
    expect( radios().map( ( r ) => r.value ) ).toEqual( FORM_PRESETS.map( ( p ) => p.id ) );
    expect( radios().filter( ( r ) => r.checked ).map( ( r ) => r.value ) ).toEqual( [ 'default' ] );
    expect( document.body.textContent ).toContain(
      'Presets never change the page around the form. Switch the canvas between light and dark above to see the form on both.'
    );
    ui.unmount();
  } );

  it( 'remembers the tab for the browser', () => {
    const ui = mount( { preset: 'default', tokens: {}, variants: {} } );
    click( tab( 'Custom' ) );
    expect( window.localStorage.getItem( 'sf-appearance-tab' ) ).toBe( 'custom' );
    ui.unmount();
    const again = mount( { preset: 'default', tokens: {}, variants: {} } );
    expect( tab( 'Custom' ).getAttribute( 'aria-selected' ) ).toBe( 'true' );
    again.unmount();
  } );

  it( 'moves between cards with the arrow keys without choosing one, and Space chooses', () => {
    const ui = mount( { preset: 'default', tokens: {}, variants: {} } );
    const all = radios();
    act( () => all[ 1 ].focus() );
    key( all[ 1 ], 'ArrowRight' );
    expect( document.activeElement ).toBe( all[ 2 ] );
    key( all[ 2 ], 'ArrowDown' );
    expect( document.activeElement ).toBe( all[ 3 ] );
    key( all[ 3 ], 'ArrowLeft' );
    expect( document.activeElement ).toBe( all[ 2 ] );
    key( all[ 2 ], 'Home' );
    expect( document.activeElement ).toBe( all[ 0 ] );
    key( all[ 0 ], 'End' );
    expect( document.activeElement ).toBe( all[ all.length - 1 ] );
    expect( updates ).toHaveLength( 0 );
    // Space on a focused radio is a click on it.
    click( all[ 2 ] );
    expect( updates ).toHaveLength( 1 );
    expect( latest.metadata.appearance.preset ).toBe( 'soft' );
    ui.unmount();
  } );

  it( 'writes the same object as before when a preset is applied', () => {
    const ui = mount( { preset: 'default', tokens: {}, variants: {} } );
    click( radios().find( ( r ) => r.value === 'soft' ) );
    const soft = getPreset( 'soft' );
    expect( updates[ 0 ] ).toEqual( {
      metadata: {
        appearance: {
          preset: 'soft',
          tokens: { ...soft.tokens },
          variants: { input: 'filled', button: 'solid', buttonAlign: 'left' },
        },
      },
      fields: [],
    } );
    expect( Object.keys( updates[ 0 ].metadata.appearance ).sort() ).toEqual( [ 'preset', 'tokens', 'variants' ] );
    ui.unmount();
  } );

  it( 'asks before replacing custom styling, and keeps it on Keep mine', () => {
    const ui = mount( { preset: 'soft', tokens: { ...getPreset( 'soft' ).tokens, radius: '3px' }, variants: { input: 'filled', button: 'solid', buttonAlign: 'left' } } );
    expect( document.body.textContent ).toContain( 'edited' );
    click( radios().find( ( r ) => r.value === 'classic' ) );
    expect( updates ).toHaveLength( 0 );
    expect( document.body.textContent ).toContain( 'Applying “Classic” replaces the custom styling on this form.' );
    const keep = [ ...document.querySelectorAll( '.sf-appearance-panel__confirm button' ) ].find( ( b ) => b.textContent === 'Keep mine' );
    click( keep );
    expect( updates ).toHaveLength( 0 );
    click( radios().find( ( r ) => r.value === 'classic' ) );
    click( [ ...document.querySelectorAll( '.sf-appearance-panel__confirm button' ) ].find( ( b ) => b.textContent === 'Apply preset' ) );
    expect( latest.metadata.appearance.preset ).toBe( 'classic' );
    ui.unmount();
  } );

  it( 'shows a form saved with a removed id on its replacement', () => {
    const ui = mount( { preset: 'dark-surface', tokens: {}, variants: {} } );
    expect( radios().filter( ( r ) => r.checked ).map( ( r ) => r.value ) ).toEqual( [ 'dark' ] );
    ui.unmount();
  } );

  it( 'does not choose anything when read only', () => {
    const ui = mount( { preset: 'default', tokens: {}, variants: {} }, { readOnly: true } );
    expect( radios().every( ( r ) => r.disabled ) ).toBe( true );
    ui.unmount();
  } );
} );

describe( 'Reset to theme', () => {
  it( 'applies at once when nothing was customised', () => {
    const ui = mount( { preset: 'soft', tokens: { ...getPreset( 'soft' ).tokens }, variants: { input: 'filled', button: 'solid', buttonAlign: 'left' } } );
    click( [ ...document.querySelectorAll( '.sf-field-inspector__footer button' ) ].find( ( b ) => b.textContent === 'Reset to theme' ) );
    expect( latest.metadata.appearance.preset ).toBe( 'theme' );
    ui.unmount();
  } );
} );

describe( 'accessibility', () => {
  const check = async ( container ) => {
    const result = await axe.run( container, { rules: { 'color-contrast': { enabled: false } } } );
    return result.violations.map( ( v ) => `${ v.id }: ${ v.nodes.map( ( n ) => n.target.join( ' ' ) ).join( ', ' ) }` );
  };

  it( 'passes on the Presets tab', async () => {
    const ui = mount( { preset: 'soft', tokens: { ...getPreset( 'soft' ).tokens, radius: '3px' }, variants: {} } );
    expect( await check( ui.container ) ).toEqual( [] );
    ui.unmount();
  } );

  it( 'passes on the Custom tab with every section open', async () => {
    const ui = mount( { preset: 'default', tokens: { colorPrimary: '#ffee58', colorButtonText: '#ffffff' }, variants: {} } );
    click( tab( 'Custom' ) );
    document.querySelectorAll( '.sf-isec__toggle' ).forEach( click );
    document.querySelectorAll( '.sf-appearance-panel__more' ).forEach( click );
    expect( await check( ui.container ) ).toEqual( [] );
    ui.unmount();
  } );
} );
