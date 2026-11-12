import {
  FORM_PRESETS,
  PRESET_ALIASES,
  getPreset,
  resolvedToken,
  FONT_STACKS,
  formAppearanceStyle,
} from './appearance';
import { contrastRatio, MIN_CONTRAST } from '../admin/components/builder/appearance/contrast';
import { contrastIssues } from '../admin/components/builder/appearance/themeColors';

const solid = ( value, under ) => ( value && value !== 'transparent' ? value : under );

function pairs( preset ) {
  const a = { preset: preset.id, tokens: preset.tokens, variants: preset.variants };
  const bg = solid( resolvedToken( a, 'colorBackground' ), '#ffffff' );
  const fieldBg = solid( resolvedToken( a, 'colorSurface' ), bg );
  const primary = resolvedToken( a, 'colorPrimary' );
  const solidButton = ( preset.variants.button || 'solid' ) === 'solid';
  return {
    'label on background': [ resolvedToken( a, 'colorLabel' ), bg ],
    'input text on input background': [ resolvedToken( a, 'colorInputText' ), fieldBg ],
    'button text on button': solidButton
      ? [ resolvedToken( a, 'colorButtonText' ), primary ]
      : [ primary, bg ],
    'muted text on background': [ resolvedToken( a, 'colorTextLight' ), bg ],
  };
}

describe( 'the ten themes', () => {
  it( 'are in the agreed order', () => {
    expect( FORM_PRESETS.map( ( p ) => p.id ) ).toEqual( [
      'theme', 'default', 'soft', 'bordered', 'editorial', 'compact', 'rounded', 'classic', 'dark', 'contrast',
    ] );
  } );

  it( 'never set the form width, and only theme sets the field layout', () => {
    FORM_PRESETS.forEach( ( p ) => {
      expect( p.variants.width ).toBeUndefined();
      if ( p.id !== 'theme' ) {
        expect( p.variants.layout ).toBeUndefined();
      }
    } );
  } );

  it( 'keep a backdrop only on Dark', () => {
    FORM_PRESETS.forEach( ( p ) => {
      expect( !! p.backdrop ).toBe( p.id === 'dark' );
    } );
  } );

  it( 'use a serif stack from FONT_STACKS for Editorial', () => {
    expect( FONT_STACKS.map( ( f ) => f.value ) ).toContain( getPreset( 'editorial' ).tokens.fontFamily );
  } );

  FORM_PRESETS.forEach( ( preset ) => {
    describe( preset.id, () => {
      Object.entries( pairs( preset ) ).forEach( ( [ name, [ fg, bg ] ] ) => {
        it( `passes ${ MIN_CONTRAST }:1 for ${ name }`, () => {
          const ratio = contrastRatio( fg, bg );
          expect( ratio ).not.toBeNull();
          expect( ratio ).toBeGreaterThanOrEqual( MIN_CONTRAST );
        } );
      } );

      it( 'raises no contrast warning in the panel', () => {
        expect( contrastIssues( { preset: preset.id, tokens: preset.tokens, variants: preset.variants }, null ) ).toEqual( [] );
      } );
    } );
  } );
} );

describe( 'presets from 2.8', () => {
  const ids28 = [ 'theme', 'default', 'minimal', 'soft', 'bordered', 'dark', 'compact', 'rounded', 'classic', 'bold', 'dark-surface' ];

  it.each( ids28 )( 'resolves %s', ( id ) => {
    expect( getPreset( id ) ).toBeDefined();
  } );

  it( 'maps the removed ids to their replacements', () => {
    expect( PRESET_ALIASES ).toEqual( { minimal: 'default', bold: 'classic', 'dark-surface': 'dark' } );
    expect( getPreset( 'minimal' ).id ).toBe( 'default' );
    expect( getPreset( 'bold' ).id ).toBe( 'classic' );
    expect( getPreset( 'dark-surface' ).id ).toBe( 'dark' );
  } );

  it( 'still returns undefined for an id that never existed', () => {
    expect( getPreset( 'nope' ) ).toBeUndefined();
  } );
} );

describe( 'form padding variable', () => {
  const styleOf = ( id ) => formAppearanceStyle( { preset: id, tokens: getPreset( id ).tokens } );

  it( 'is 0 for a transparent form and 24px for one with its own background', () => {
    expect( styleOf( 'theme' )[ '--subtleforms-form-padding' ] ).toBe( '0' );
    expect( styleOf( 'dark' )[ '--subtleforms-form-padding' ] ).toBe( '24px' );
    expect( styleOf( 'contrast' )[ '--subtleforms-form-padding' ] ).toBe( '24px' );
  } );

  it( 'is not written when no background is set', () => {
    expect( formAppearanceStyle( { tokens: { colorPrimary: '#ff0000' } } ) ).not.toHaveProperty( '--subtleforms-form-padding' );
  } );
} );
