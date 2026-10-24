import {
  supportsAppearance,
  formAppearanceStyle,
  formAppearanceClasses,
  fieldAppearanceStyle,
  fieldAppearanceClasses,
  isPresetModified,
  getPreset,
  previewBreakpoints,
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
    expect( formAppearanceStyle( { variants: { width: 'theme' } } ).maxWidth ).toBe(
      '100%'
    );
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
    // 2.0: a field's "Text" colour is the input text; labels have their own token.
    const style = fieldAppearanceStyle( { colorText: '#123456', colorLabel: '#654321', colorBorder: '#111111' } );
    expect( style[ '--subtleforms-input-text' ] ).toBe( '#123456' );
    expect( style[ '--subtleforms-label-color' ] ).toBe( '#654321' );
    expect( style[ '--subtleforms-color-border' ] ).toBe( '#111111' );
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

describe( 'supportsAppearance', () => {
  it( 'excludes the types that render no element', () => {
    // A saved value that cannot show up is worse than an absent control, so the
    // inspector hides the tab for these rather than accepting dead input.
    expect( supportsAppearance( 'action_hook' ) ).toBe( false );
    expect( supportsAppearance( 'step' ) ).toBe( false );
  } );

  it( 'includes structural types that do render a wrapper', () => {
    [ 'section_break', 'html', 'group_container', 'repeat_container' ].forEach(
      ( type ) => {
        expect( supportsAppearance( type ) ).toBe( true );
      }
    );
  } );

  it( 'includes ordinary input types', () => {
    [ 'text', 'email', 'select', 'signature' ].forEach( ( type ) => {
      expect( supportsAppearance( type ) ).toBe( true );
    } );
  } );
} );

describe('2.3.0 inline layout and dark surface', () => {
  const { formAppearanceClasses, getPreset } = require('./appearance');
  test('inline layout adds its class', () => {
    expect(formAppearanceClasses({ variants: { layout: 'inline' } })).toContain('subtleforms--layout-inline');
    expect(formAppearanceClasses({ variants: { layout: 'stacked' } })).not.toContain('layout-inline');
  });
  test('dark surface preset exists and drops the card', () => {
    const preset = getPreset('dark-surface');
    expect(preset.tokens.colorBackground).toBe('#1b1d24');
    expect(formAppearanceClasses({ preset: 'dark-surface', variants: {} })).toContain('subtleforms--preset-dark-surface');
  });
});

describe( 'previewBreakpoints', () => {
  it( 'uses standard sizes when the theme does not name any', () => {
    expect( previewBreakpoints() ).toEqual( { desktop: 1280, tablet: 768, mobile: 390 } );
  } );

  it( 'reads theme layout sizes and keeps desktop wider than tablet', () => {
    expect( previewBreakpoints( {
      layout: { wideSize: '1100px', contentSize: '680px' },
    } ) ).toEqual( { desktop: 1100, tablet: 680, mobile: 390 } );

    expect( previewBreakpoints( {
      custom: { breakpoints: { desktop: '900px', tablet: '900px', mobile: '400px' } },
    } ).desktop ).toBeGreaterThan( 900 );

    const raised = previewBreakpoints( {
      custom: { breakpoints: { desktop: '1000px', tablet: '800px', mobile: '900px' } },
    } );
    expect( raised.desktop ).toBeGreaterThan( raised.tablet );
    expect( raised.tablet ).toBeGreaterThan( raised.mobile );
  } );

  it( 'offers an inherit-from-theme preset', () => {
    expect( getPreset( 'theme' ).variants.width ).toBeUndefined();
    expect( formAppearanceClasses( { preset: 'theme' } ) ).toContain( 'subtleforms--inherit-theme' );
  } );

  it( 'presets do not set form width', () => {
    FORM_PRESETS.forEach( ( preset ) => {
      expect( preset.variants.width ).toBeUndefined();
      expect( formAppearanceStyle( { variants: { ...preset.variants } } ).maxWidth ).toBeUndefined();
    } );
  } );
} );

function contrast( hex, other ) {
  const lin = ( channel ) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ( ( c + 0.055 ) / 1.055 ) ** 2.4;
  };
  const lum = ( value ) => {
    const h = value.replace( '#', '' );
    const r = parseInt( h.slice( 0, 2 ), 16 );
    const g = parseInt( h.slice( 2, 4 ), 16 );
    const b = parseInt( h.slice( 4, 6 ), 16 );
    return ( 0.2126 * lin( r ) ) + ( 0.7152 * lin( g ) ) + ( 0.0722 * lin( b ) );
  };
  const hi = Math.max( lum( hex ), lum( other ) );
  const lo = Math.min( lum( hex ), lum( other ) );
  return ( hi + 0.05 ) / ( lo + 0.05 );
}

describe( 'preset contrast', () => {
  test( 'dark, dark surface and bold stay at 4.5:1', () => {
    const dark = getPreset( 'dark' );
    const surface = getPreset( 'dark-surface' );
    const bold = getPreset( 'bold' );
    expect( contrast( dark.tokens.colorButtonText, dark.tokens.colorPrimary ) ).toBeGreaterThanOrEqual( 4.5 );
    expect( contrast( surface.tokens.colorText, surface.tokens.colorBackground ) ).toBeGreaterThanOrEqual( 4.5 );
    expect( contrast( '#ffffff', bold.tokens.colorPrimary ) ).toBeGreaterThanOrEqual( 4.5 );
    expect( formAppearanceClasses( { preset: 'dark' } ) ).toContain( 'subtleforms--preset-dark' );
  } );
} );

describe( 'buttonThemeClass (2.4.1)', () => {
  const { buttonThemeClass } = require( './appearance' );
  test( 'a theme form uses the theme button class', () => {
    expect( buttonThemeClass( { preset: 'theme' } ) ).toBe( 'wp-element-button' );
  } );
  test( 'other presets keep the plugin button', () => {
    expect( buttonThemeClass( { preset: 'default' } ) ).toBe( '' );
    expect( buttonThemeClass( undefined ) ).toBe( '' );
  } );
} );

describe( 'pure theme forms (2.4.1)', () => {
  const { formAppearanceClasses, isPureTheme, buttonThemeClass, getPreset } = require( './appearance' );
  const theme = getPreset( 'theme' );
  const untouched = { preset: 'theme', tokens: { ...theme.tokens }, variants: { ...theme.variants } };

  test( 'an untouched theme preset is a pure theme form', () => {
    expect( isPureTheme( untouched ) ).toBe( true );
    expect( formAppearanceClasses( untouched ) ).toContain( 'subtleforms--inherit-theme' );
    expect( formAppearanceClasses( untouched ) ).not.toContain( 'subtleforms--theme-tuned' );
  } );

  test( 'alignment, width and layout keep it pure', () => {
    const a = { ...untouched, variants: { ...theme.variants, buttonAlign: 'center', width: 'narrow', layout: 'inline' } };
    expect( isPureTheme( a ) ).toBe( true );
  } );

  test( 'a changed colour or input style makes it a tuned theme form', () => {
    for ( const a of [
      { ...untouched, tokens: { ...theme.tokens, colorPrimary: '#ff0000' } },
      { ...untouched, variants: { ...theme.variants, input: 'filled' } },
    ] ) {
      expect( isPureTheme( a ) ).toBe( false );
      expect( formAppearanceClasses( a ) ).toContain( 'subtleforms--theme-tuned' );
      expect( formAppearanceClasses( a ) ).not.toContain( 'subtleforms--inherit-theme' );
      expect( buttonThemeClass( a ) ).toBe( '' );
    }
  } );

  test( 'other presets are never theme forms', () => {
    expect( isPureTheme( { preset: 'default' } ) ).toBe( false );
    expect( formAppearanceClasses( { preset: 'minimal', variants: {} } ) ).not.toMatch( /inherit-theme|theme-tuned/ );
  } );
} );

describe( 'transparent form root defaults', () => {
  const { TOKEN_DEFAULTS, getPreset } = require( './appearance' );
  it( 'defaults colorBackground to transparent and keeps intentional surfaces', () => {
    expect( TOKEN_DEFAULTS.colorBackground ).toBe( 'transparent' );
    expect( getPreset( 'soft' ).tokens.colorBackground ).toBe( '#ffffff' );
    expect( getPreset( 'bordered' ).tokens.colorBackground ).toBe( '#fbfbfc' );
    expect( getPreset( 'dark-surface' ).tokens.colorBackground ).toBe( '#1b1d24' );
    expect( getPreset( 'minimal' ).tokens.colorBackground ).toBe( 'transparent' );
    expect( getPreset( 'compact' ).tokens.colorBackground ).toBe( 'transparent' );
    expect( getPreset( 'rounded' ).tokens.colorBackground ).toBe( 'transparent' );
  } );
} );
