import {
  formAppearanceStyle,
  formAppearanceClasses,
  fieldAppearanceStyle,
  fieldAppearanceClasses,
  isPresetModified,
  getPreset,
  FORM_PRESETS,
} from './appearance';

describe( 'formAppearanceStyle', () => {
  it( 'returns nothing for a form with no appearance', () => {
    expect( formAppearanceStyle( undefined ) ).toEqual( {} );
    expect( formAppearanceStyle( {} ) ).toEqual( {} );
  } );

  it( 'maps tokens onto the custom properties the stylesheet reads', () => {
    const style = formAppearanceStyle( {
      tokens: { colorPrimary: '#ff0000', radius: '8px' },
    } );

    expect( style[ '--subtleforms-color-primary' ] ).toBe( '#ff0000' );
    expect( style[ '--subtleforms-radius-md' ] ).toBe( '8px' );
  } );

  it( 'omits empty values rather than emitting an empty declaration', () => {
    const style = formAppearanceStyle( {
      tokens: { colorPrimary: '', colorText: null, colorBorder: undefined },
    } );

    expect( style ).toEqual( {} );
  } );

  it( 'keeps a zero, which is a real value', () => {
    const style = formAppearanceStyle( { tokens: { radius: '0px' } } );
    expect( style[ '--subtleforms-radius-md' ] ).toBe( '0px' );
  } );

  it( 'translates the width variant to a max width', () => {
    expect( formAppearanceStyle( { variants: { width: 'narrow' } } ).maxWidth ).toBe( '30rem' );
    expect( formAppearanceStyle( { variants: { width: 'full' } } ).maxWidth ).toBe( '100%' );
  } );

  it( 'ignores an unknown width', () => {
    expect( formAppearanceStyle( { variants: { width: 'enormous' } } ).maxWidth ).toBeUndefined();
  } );
} );

describe( 'formAppearanceClasses', () => {
  it( 'is empty when no variants are set', () => {
    expect( formAppearanceClasses( undefined ) ).toBe( '' );
    expect( formAppearanceClasses( { variants: {} } ) ).toBe( '' );
  } );

  it( 'emits a class per structural variant', () => {
    const classes = formAppearanceClasses( {
      variants: { input: 'filled', button: 'ghost', buttonAlign: 'center' },
    } );

    expect( classes ).toContain( 'subtleforms--input-filled' );
    expect( classes ).toContain( 'subtleforms--button-ghost' );
    expect( classes ).toContain( 'subtleforms--buttons-center' );
  } );

  it( 'does not emit a class for width, which is a style not a variant', () => {
    expect( formAppearanceClasses( { variants: { width: 'wide' } } ) ).toBe( '' );
  } );
} );

describe( 'fieldAppearanceStyle', () => {
  it( 'returns nothing for a field with no overrides', () => {
    expect( fieldAppearanceStyle( undefined ) ).toEqual( {} );
  } );

  it( 'redeclares the form-level properties so contents inherit the override', () => {
    const style = fieldAppearanceStyle( { colorText: '#123456' } );
    expect( style[ '--subtleforms-color-text' ] ).toBe( '#123456' );
  } );

  it( 'leaves a full-width field to the default flex basis', () => {
    const style = fieldAppearanceStyle( { width: '100' } );
    expect( style.flexBasis ).toBeUndefined();
  } );

  it( 'sizes a partial-width field allowing for the row gap', () => {
    const style = fieldAppearanceStyle( { width: '50' } );
    expect( style.flexBasis ).toBe( 'calc(50% - var(--subtleforms-field-gap, 16px))' );
    expect( style.maxWidth ).toBe( style.flexBasis );
  } );

  it( 'passes margins through', () => {
    const style = fieldAppearanceStyle( { marginTop: '8px', marginBottom: '0' } );
    expect( style.marginTop ).toBe( '8px' );
    expect( style.marginBottom ).toBe( '0' );
  } );
} );

describe( 'fieldAppearanceClasses', () => {
  it( 'emits alignment and hidden-label classes', () => {
    expect( fieldAppearanceClasses( { align: 'right' } ) ).toContain(
      'subtleforms-field--align-right'
    );
    expect( fieldAppearanceClasses( { hideLabel: true } ) ).toContain(
      'subtleforms-field--no-label'
    );
  } );

  it( 'is empty when nothing is set', () => {
    expect( fieldAppearanceClasses( {} ) ).toBe( '' );
    expect( fieldAppearanceClasses( undefined ) ).toBe( '' );
  } );
} );

describe( 'presets', () => {
  it( 'every preset has a unique id and a full swatch', () => {
    const ids = FORM_PRESETS.map( ( p ) => p.id );
    expect( new Set( ids ).size ).toBe( ids.length );

    FORM_PRESETS.forEach( ( preset ) => {
      expect( preset.swatch.length ).toBeGreaterThanOrEqual( 3 );
    } );
  } );

  it( 'reports an untouched preset as unmodified', () => {
    const preset = getPreset( 'soft' );
    const appearance = {
      preset: 'soft',
      tokens: { ...preset.tokens },
      variants: { ...preset.variants },
    };

    expect( isPresetModified( appearance ) ).toBe( false );
  } );

  it( 'reports a changed token as modified', () => {
    const preset = getPreset( 'soft' );
    const appearance = {
      preset: 'soft',
      tokens: { ...preset.tokens, colorPrimary: '#000000' },
      variants: { ...preset.variants },
    };

    expect( isPresetModified( appearance ) ).toBe( true );
  } );

  it( 'reports a changed variant as modified', () => {
    const preset = getPreset( 'soft' );
    const appearance = {
      preset: 'soft',
      tokens: { ...preset.tokens },
      variants: { ...preset.variants, button: 'ghost' },
    };

    expect( isPresetModified( appearance ) ).toBe( true );
  } );

  it( 'is not modified when no preset is recorded', () => {
    expect( isPresetModified( { tokens: { colorPrimary: '#fff' } } ) ).toBe( false );
  } );
} );
