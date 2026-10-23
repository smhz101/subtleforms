/**
 * 2.7.2: the Custom styling panel uses the theme's colours and fonts first,
 * stores palette colours as the theme's variable, resets one control at a time,
 * warns about low contrast and hides custom CSS from people who may not edit it.
 */
import { createRoot } from '@wordpress/element';
import { act, useState } from 'react';
import FormAppearancePanel from './FormAppearancePanel';
import { getPreset } from '../../../../shared/appearance';
import { setThemeStylesForTests } from '../../../data/themeStyles';
import { contrastRatio, parseColor } from './contrast';
import { contrastIssues } from './themeColors';
import { clampSize } from './tokenDefs';

jest.mock( './AppearanceControls.scss', () => ( {} ) );
jest.mock( './FormAppearancePanel.scss', () => ( {} ) );
jest.mock( '../../../data/apiClient', () => ( { apiClient: { get: jest.fn( () => Promise.reject( new Error( 'offline' ) ) ) } } ) );

global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const THEME = {
  isBlockTheme: true,
  palette: [
    { slug: 'base', name: 'Base', color: '#ffffff' },
    { slug: 'contrast', name: 'Contrast', color: '#111111' },
    { slug: 'accent-3', name: 'Accent 3', color: '#503aa8' },
  ],
  fontFamilies: [ { slug: 'manrope', name: 'Manrope', fontFamily: 'Manrope, sans-serif' } ],
  fontSizes: [ { slug: 'large', name: 'Large', size: '1.38rem' } ],
  bodyFont: 'var(--wp--preset--font-family--manrope)',
  headingFont: 'var(--wp--preset--font-family--manrope)',
  colors: { text: 'var(--wp--preset--color--contrast)', background: 'var(--wp--preset--color--base)', link: '' },
  buttonStyles: { background: 'var(--wp--preset--color--contrast)', text: 'var(--wp--preset--color--base)', radius: '', fontFamily: '', fontSize: '' },
};

let latest;
function Harness( { initial, canCustomCss = true } ) {
  const [ schema, setSchema ] = useState( { metadata: { appearance: initial }, fields: [] } );
  latest = schema.metadata.appearance;
  return <FormAppearancePanel schema={ schema } onChange={ setSchema } canCustomCss={ canCustomCss } formId={ 12 } />;
}

function mount( initial, props = {} ) {
  const container = document.createElement( 'div' );
  document.body.appendChild( container );
  const root = createRoot( container );
  act( () => root.render( <Harness initial={ initial } { ...props } /> ) );
  const click = ( el ) => act( () => el.click() );
  const byText = ( text, selector = 'button' ) => [ ...document.querySelectorAll( selector ) ].find( ( b ) => b.textContent.trim() === text );
  return { container, click, byText, unmount: () => { act( () => root.unmount() ); container.remove(); } };
}

const themeForm = () => {
  const preset = getPreset( 'theme' );
  return { preset: 'theme', tokens: { ...preset.tokens }, variants: { ...preset.variants } };
};

function openCustom( ui ) {
  ui.click( [ ...ui.container.querySelectorAll( 'button, [role="radio"]' ) ].find( ( b ) => b.textContent === 'Custom' ) );
}

function openGroup( ui, title ) {
  const toggle = [ ...document.querySelectorAll( '.components-panel__body-toggle' ) ].find( ( b ) => b.textContent.includes( title ) );
  if ( toggle && toggle.getAttribute( 'aria-expanded' ) === 'false' ) {
    ui.click( toggle );
  }
}

beforeEach( () => setThemeStylesForTests( THEME ) );
afterEach( () => {
  setThemeStylesForTests( null );
  document.body.innerHTML = '';
} );

describe( 'theme colours and fonts first', () => {
  it( 'the colour picker lists the theme palette before other swatches and stores a variable', () => {
    const ui = mount( themeForm() );
    openCustom( ui );
    openGroup( ui, 'Colours' );
    ui.click( document.querySelector( '.sf-color-token__toggle[aria-label^="Label:"]' ) );
    const names = [ ...document.querySelectorAll( '.components-color-palette__item-wrapper, .components-circular-option-picker__option-wrapper' ) ]
      .map( ( el ) => el.querySelector( 'button' )?.getAttribute( 'aria-label' ) || '' );
    const firstTheme = names.findIndex( ( n ) => /Accent 3/.test( n ) );
    const firstOther = names.findIndex( ( n ) => /Ink|Indigo|Teal/.test( n ) );
    expect( firstTheme ).toBeGreaterThan( -1 );
    expect( firstTheme ).toBeLessThan( firstOther );
    const swatch = [ ...document.querySelectorAll( 'button' ) ].find( ( b ) => /Accent 3/.test( b.getAttribute( 'aria-label' ) || '' ) );
    ui.click( swatch );
    expect( latest.tokens.colorLabel ).toBe( 'var(--wp--preset--color--accent-3)' );
    ui.unmount();
  } );

  it( 'a custom colour is stored as hex', () => {
    const ui = mount( { ...themeForm(), tokens: { ...themeForm().tokens, colorLabel: '#123456' } } );
    openCustom( ui );
    openGroup( ui, 'Colours' );
    expect( latest.tokens.colorLabel ).toBe( '#123456' );
    ui.unmount();
  } );

  it( 'the font list shows the theme fonts first, then system fonts', () => {
    const ui = mount( themeForm() );
    openCustom( ui );
    const select = [ ...ui.container.querySelectorAll( 'select' ) ].find( ( s ) => s.closest( '.components-base-control' )?.textContent.includes( 'Form font' ) );
    const labels = [ ...select.options ].map( ( o ) => o.textContent );
    expect( labels.indexOf( 'Manrope' ) ).toBeGreaterThan( -1 );
    expect( labels.indexOf( 'Manrope' ) ).toBeLessThan( labels.indexOf( 'System fonts' ) );
    expect( labels.indexOf( 'System fonts' ) ).toBeLessThan( labels.indexOf( 'Serif' ) );
    expect( [ ...select.options ].find( ( o ) => o.textContent === 'Manrope' ).value ).toBe( 'var(--wp--preset--font-family--manrope)' );
    ui.unmount();
  } );

  it( 'says so when the theme does not share its fonts', () => {
    setThemeStylesForTests( { ...THEME, isBlockTheme: false, fontFamilies: [], bodyFont: '' } );
    const ui = mount( themeForm() );
    openCustom( ui );
    expect( ui.container.textContent ).toContain( 'Your theme does not share its fonts with WordPress; the preview uses your site\'s stylesheet.' );
    ui.unmount();
  } );
} );

describe( 'reset buttons', () => {
  it( 'every control has one; it clears only that control', () => {
    const ui = mount( { ...themeForm(), tokens: { ...themeForm().tokens, labelSize: '18px', radius: '12px' } } );
    openCustom( ui );
    openGroup( ui, 'Fields' );
    const reset = document.querySelector( 'button[aria-label="Reset Label size to theme"]' );
    expect( reset ).not.toBeNull();
    expect( reset.disabled ).toBe( false );
    ui.click( reset );
    expect( latest.tokens.labelSize ).toBeUndefined();
    expect( latest.tokens.radius ).toBe( '12px' );
    expect( document.querySelector( 'button[aria-label="Reset Label size to theme"]' ).disabled ).toBe( true );
    ui.unmount();
  } );

  it( 'Reset all to theme asks first, then restores the theme preset', () => {
    const ui = mount( { ...themeForm(), tokens: { ...themeForm().tokens, labelSize: '18px' }, customCss: '.a{b:c}' } );
    openCustom( ui );
    ui.click( ui.byText( 'Reset all to theme' ) );
    expect( latest.tokens.labelSize ).toBe( '18px' );
    expect( document.body.textContent ).toContain( 'puts every colour' );
    const confirm = [ ...document.querySelectorAll( '.sf-form-appearance__confirm button' ) ].find( ( b ) => b.textContent === 'Reset all to theme' );
    ui.click( confirm );
    expect( latest.tokens ).toEqual( getPreset( 'theme' ).tokens );
    expect( latest.customCss ).toBeUndefined();
    ui.unmount();
  } );
} );

describe( 'contrast warning', () => {
  it( 'maths', () => {
    expect( contrastRatio( '#000', '#fff' ) ).toBeCloseTo( 21, 0 );
    expect( contrastRatio( '#777777', '#ffffff' ) ).toBeLessThan( 4.5 );
    expect( parseColor( 'hsl(0, 100%, 50%)' ) ).toEqual( { r: 255, g: 0, b: 0, a: 1 } );
    expect( parseColor( 'rgb(10 20 30 / 50%)' ).a ).toBe( 0.5 );
    expect( parseColor( 'nonsense' ) ).toBeNull();
  } );

  it( 'resolves theme variables through the palette', () => {
    const form = { preset: 'theme', tokens: { colorLabel: 'var(--wp--preset--color--base)', colorBackground: 'var(--wp--preset--color--base)' } };
    expect( contrastIssues( form, THEME ).map( ( i ) => i.id ) ).toContain( 'label' );
    const fine = { preset: 'theme', tokens: { colorLabel: 'var(--wp--preset--color--contrast)', colorBackground: 'var(--wp--preset--color--base)' } };
    expect( contrastIssues( fine, THEME ) ).toEqual( [] );
  } );

  it( 'shows in the colours group for button text on its background', () => {
    const ui = mount( { ...themeForm(), tokens: { ...themeForm().tokens, colorPrimary: '#ffee58', colorButtonText: '#ffffff' } } );
    openCustom( ui );
    openGroup( ui, 'Colours' );
    expect( document.querySelector( '.sf-form-appearance__contrast' ).textContent ).toMatch( /button text and the button background have a contrast of 1\.\d:1/ );
    ui.unmount();
  } );
} );

describe( 'custom CSS', () => {
  it( 'is editable for someone who can post unfiltered HTML', () => {
    const ui = mount( themeForm(), { canCustomCss: true } );
    openCustom( ui );
    ui.click( ui.container.querySelector( '.sf-form-appearance__advanced-toggle input' ) );
    const area = document.querySelector( 'textarea' );
    expect( area ).not.toBeNull();
    expect( document.body.textContent ).toContain( '.subtleforms-form-12' );
    ui.unmount();
  } );

  it( 'is hidden without unfiltered_html', () => {
    const ui = mount( { ...themeForm(), customCss: '.a{b:c}' }, { canCustomCss: false } );
    openCustom( ui );
    ui.click( ui.container.querySelector( '.sf-form-appearance__advanced-toggle input' ) );
    expect( document.querySelector( 'textarea' ) ).toBeNull();
    expect( document.body.textContent ).toContain( 'Custom CSS is available to people who can post unfiltered HTML' );
    ui.unmount();
  } );
} );

describe( 'sizes stay inside what the server accepts', () => {
  it( 'clamps', () => {
    expect( clampSize( 'labelSize', '400px' ) ).toBe( '48px' );
    expect( clampSize( 'labelSize', '1rem' ) ).toBe( '1rem' );
    expect( clampSize( 'formMaxWidth', '5000px' ) ).toBe( '1920px' );
    expect( clampSize( 'formMaxWidth', '150%' ) ).toBe( '100%' );
    expect( clampSize( 'labelSize', '50%' ) ).toBe( '' );
    expect( clampSize( 'labelSize', 'abc' ) ).toBe( '' );
  } );
} );
