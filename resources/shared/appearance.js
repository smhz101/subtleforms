/**
 * Form appearance contract.
 *
 * Shared by the builder, the preview and the public renderer so all three agree
 * on what a form's styling means. Anything that styles a form is expressed as a
 * CSS custom property on the form's root element, which is why the public
 * stylesheet already reads `--subtleforms-*` for every colour, size and radius:
 * theming a form is overriding those on one element, not shipping new CSS.
 *
 * Schema shape:
 *
 *   metadata.appearance = {
 *     preset: 'minimal',            // last preset applied, for the UI only
 *     tokens: { colorPrimary: '#…', radius: '8px', … },
 *     variants: { input: 'outlined', button: 'solid', buttonAlign: 'left' },
 *   }
 *
 *   field.config.appearance = {
 *     width: '50', align: 'left', marginTop: '…', colorText: '#…', …
 *   }
 *
 * Everything is optional. An absent value falls through to the form, and an
 * absent form value falls through to the stylesheet default — so a form with no
 * appearance object renders exactly as it did before this existed.
 */

/* ------------------------------------------------------------------ *
 * Form-level tokens
 * ------------------------------------------------------------------ */

/**
 * Each token maps one control to one CSS custom property.
 *
 * `group` drives the panel layout, `type` drives which control renders, and
 * `cssVar` is the only place the property name is written down.
 */
export const FORM_TOKENS = [
  // Colour
  { key: 'colorPrimary', cssVar: '--subtleforms-color-primary', type: 'color', group: 'color', label: 'Accent' },
  { key: 'colorPrimaryHover', cssVar: '--subtleforms-color-primary-hover', type: 'color', group: 'color', label: 'Accent (hover)' },
  { key: 'colorText', cssVar: '--subtleforms-color-text', type: 'color', group: 'color', label: 'Text' },
  { key: 'colorTextLight', cssVar: '--subtleforms-color-text-light', type: 'color', group: 'color', label: 'Muted text' },
  { key: 'colorBackground', cssVar: '--subtleforms-color-bg', type: 'color', group: 'color', label: 'Background' },
  { key: 'colorSurface', cssVar: '--subtleforms-color-bg-subtle', type: 'color', group: 'color', label: 'Field background' },
  { key: 'colorBorder', cssVar: '--subtleforms-color-border', type: 'color', group: 'color', label: 'Border' },
  { key: 'colorError', cssVar: '--subtleforms-color-error', type: 'color', group: 'color', label: 'Error' },
  { key: 'colorLabel', cssVar: '--subtleforms-label-color', type: 'color', group: 'color', label: 'Labels' },
  { key: 'colorInputText', cssVar: '--subtleforms-input-text', type: 'color', group: 'color', label: 'Input text' },
  { key: 'colorFocus', cssVar: '--subtleforms-color-border-focus', type: 'color', group: 'color', label: 'Focus ring' },
  { key: 'colorButtonText', cssVar: '--subtleforms-button-text', type: 'color', group: 'button', label: 'Button text' },

  // Typography
  { key: 'fontFamily', cssVar: '--subtleforms-font-family', type: 'font', group: 'type', label: 'Font' },
  { key: 'fontSize', cssVar: '--subtleforms-font-size-base', type: 'size', group: 'type', label: 'Base size', units: ['px', 'rem'], min: 12, max: 24 },
  { key: 'labelWeight', cssVar: '--subtleforms-label-weight', type: 'select', group: 'type', label: 'Label weight',
    options: [ { label: 'Regular', value: '400' }, { label: 'Medium', value: '500' }, { label: 'Semibold', value: '600' } ] },
  { key: 'lineHeight', cssVar: '--subtleforms-line-height', type: 'number', group: 'type', label: 'Line height', min: 1, max: 2.4, step: 0.05 },

  // Shape and spacing
  { key: 'radius', cssVar: '--subtleforms-radius-md', type: 'size', group: 'shape', label: 'Corner radius', units: ['px'], min: 0, max: 32 },
  { key: 'borderWidth', cssVar: '--subtleforms-border-width', type: 'size', group: 'shape', label: 'Border width', units: ['px'], min: 0, max: 4 },
  { key: 'fieldGap', cssVar: '--subtleforms-field-gap', type: 'size', group: 'shape', label: 'Space between fields', units: ['px', 'rem'], min: 0, max: 64 },
  { key: 'inputPaddingY', cssVar: '--subtleforms-input-padding-y', type: 'size', group: 'shape', label: 'Input height', units: ['px'], min: 4, max: 28 },
  { key: 'buttonRadius', cssVar: '--subtleforms-button-radius', type: 'size', group: 'button', label: 'Button radius', units: ['px'], min: 0, max: 999 },
];

/** Variants are classes rather than properties — they change structure, not values. */
export const FORM_VARIANTS = [
  {
    key: 'input',
    label: 'Input style',
    options: [
      { label: 'Outlined', value: 'outlined' },
      { label: 'Filled', value: 'filled' },
      { label: 'Underlined', value: 'underlined' },
    ],
  },
  {
    key: 'button',
    label: 'Button style',
    options: [
      { label: 'Solid', value: 'solid' },
      { label: 'Outline', value: 'outline' },
      { label: 'Ghost', value: 'ghost' },
    ],
  },
  {
    key: 'buttonAlign',
    label: 'Button alignment',
    options: [
      { label: 'Left', value: 'left' },
      { label: 'Centre', value: 'center' },
      { label: 'Right', value: 'right' },
      { label: 'Full width', value: 'full' },
    ],
  },
  {
    key: 'layout',
    label: 'Field layout',
    options: [
      { label: 'Inherit from theme', value: 'inherit' },
      { label: 'Stacked', value: 'stacked' },
      { label: 'Inline', value: 'inline' },
    ],
  },
  {
    key: 'width',
    label: 'Form width',
    options: [
      { label: 'Inherit from theme', value: 'theme' },
      { label: 'Narrow', value: 'narrow' },
      { label: 'Standard', value: 'standard' },
      { label: 'Wide', value: 'wide' },
      { label: 'Full', value: 'full' },
    ],
  },
];

/* ------------------------------------------------------------------ *
 * Per-field tokens
 * ------------------------------------------------------------------ */

/**
 * Field overrides reuse the form's property names, so a field simply redeclares
 * the custom property on itself and everything inside inherits the new value.
 */
export const FIELD_TOKENS = [
  { key: 'colorLabel', cssVar: '--subtleforms-label-color', type: 'color', group: 'color', label: 'Label' },
  { key: 'colorText', cssVar: '--subtleforms-input-text', type: 'color', group: 'color', label: 'Input text' },
  { key: 'colorSurface', cssVar: '--subtleforms-color-bg-subtle', type: 'color', group: 'color', label: 'Field background' },
  { key: 'colorBorder', cssVar: '--subtleforms-color-border', type: 'color', group: 'color', label: 'Border' },
  { key: 'colorPrimary', cssVar: '--subtleforms-color-primary', type: 'color', group: 'color', label: 'Accent' },
  { key: 'fontSize', cssVar: '--subtleforms-font-size-base', type: 'size', group: 'type', label: 'Font size', units: ['px', 'rem'], min: 10, max: 32 },
  { key: 'labelWeight', cssVar: '--subtleforms-label-weight', type: 'select', group: 'type', label: 'Label weight',
    options: [ { label: 'Regular', value: '400' }, { label: 'Medium', value: '500' }, { label: 'Semibold', value: '600' }, { label: 'Bold', value: '700' } ] },
  { key: 'radius', cssVar: '--subtleforms-radius-md', type: 'size', group: 'shape', label: 'Corner radius', units: ['px'], min: 0, max: 32 },
  { key: 'borderWidth', cssVar: '--subtleforms-border-width', type: 'size', group: 'shape', label: 'Border width', units: ['px'], min: 0, max: 4 },
];

/** Layout controls that are inline styles rather than custom properties. */
export const FIELD_LAYOUT = {
  widths: [
    { label: 'Full', value: '100' },
    { label: 'Three quarters', value: '75' },
    { label: 'Two thirds', value: '66' },
    { label: 'Half', value: '50' },
    { label: 'One third', value: '33' },
    { label: 'One quarter', value: '25' },
  ],
  aligns: [
    { label: 'Left', value: 'left' },
    { label: 'Centre', value: 'center' },
    { label: 'Right', value: 'right' },
  ],
};

/* ------------------------------------------------------------------ *
 * Presets
 * ------------------------------------------------------------------ */

/**
 * One-click looks.
 *
 * Each is a complete set, not a patch: applying a preset replaces the token
 * object outright so switching between them is predictable and never leaves a
 * value behind from the previous choice.
 */
export const FORM_PRESETS = [
  {
    id: 'theme',
    label: 'Inherit from theme',
    description: 'Uses the active theme\'s type, colours and content width. Nothing here overrides the theme unless you set it.',
    swatch: ['currentColor', 'transparent', 'transparent'],
    tokens: { fontFamily: 'inherit', colorBackground: 'transparent' },
    variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', layout: 'inherit', width: 'theme' },
  },
  {
    id: 'default',
    label: 'Default',
    description: 'Inherits the plugin defaults. Neutral and unopinionated.',
    swatch: ['#4f5bd5', '#131417', '#ffffff'],
    tokens: {},
    variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', width: 'standard' },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Underlined inputs, generous spacing, no chrome.',
    swatch: ['#131417', '#6b7382', '#ffffff'],
    tokens: {
      colorPrimary: '#131417',
      colorPrimaryHover: '#3b4150',
      colorText: '#131417',
      colorTextLight: '#6b7382',
      colorBackground: '#ffffff',
      colorSurface: '#ffffff',
      colorBorder: '#d8dbe2',
      radius: '0px',
      borderWidth: '1px',
      fieldGap: '28px',
      inputPaddingY: '10px',
      labelWeight: '500',
      fontSize: '1rem',
    },
    variants: { input: 'underlined', button: 'solid', buttonAlign: 'left', width: 'narrow' },
  },
  {
    id: 'soft',
    label: 'Soft',
    description: 'Filled fields, rounded corners, gentle contrast.',
    swatch: ['#4f5bd5', '#f4f5f7', '#ffffff'],
    tokens: {
      colorPrimary: '#4f5bd5',
      colorPrimaryHover: '#4048b8',
      colorText: '#262b37',
      colorTextLight: '#6b7382',
      colorBackground: '#ffffff',
      colorSurface: '#f4f5f7',
      colorBorder: '#e9ebef',
      radius: '12px',
      borderWidth: '1px',
      fieldGap: '20px',
      inputPaddingY: '12px',
      labelWeight: '500',
    },
    variants: { input: 'filled', button: 'solid', buttonAlign: 'full', width: 'standard' },
  },
  {
    id: 'bordered',
    label: 'Bordered',
    description: 'Strong outlines and tight spacing. Reads as a form.',
    swatch: ['#343a95', '#131417', '#fbfbfc'],
    tokens: {
      colorPrimary: '#343a95',
      colorPrimaryHover: '#2a2f75',
      colorText: '#131417',
      colorTextLight: '#515869',
      colorBackground: '#fbfbfc',
      colorSurface: '#ffffff',
      colorBorder: '#b9bec9',
      radius: '4px',
      borderWidth: '2px',
      fieldGap: '14px',
      inputPaddingY: '9px',
      labelWeight: '600',
    },
    variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', width: 'standard' },
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'For dark page backgrounds. Light text on deep ink.',
    swatch: ['#7683d9', '#e9ebef', '#131417'],
    tokens: {
      colorPrimary: '#7683d9',
      colorPrimaryHover: '#a3adde',
      colorText: '#e9ebef',
      colorTextLight: '#8c94a3',
      colorBackground: '#131417',
      colorSurface: '#1d1f26',
      colorBorder: '#3b4150',
      colorError: '#e08a80',
      radius: '8px',
      borderWidth: '1px',
      fieldGap: '18px',
      inputPaddingY: '11px',
      labelWeight: '500',
    },
    variants: { input: 'filled', button: 'solid', buttonAlign: 'left', width: 'standard' },
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Small type and tight rows. Suits long forms.',
    swatch: ['#4f5bd5', '#3b4150', '#ffffff'],
    tokens: {
      colorPrimary: '#4f5bd5',
      colorPrimaryHover: '#4048b8',
      colorText: '#262b37',
      colorTextLight: '#6b7382',
      colorBackground: '#ffffff',
      colorSurface: '#ffffff',
      colorBorder: '#d8dbe2',
      radius: '4px',
      borderWidth: '1px',
      fieldGap: '10px',
      inputPaddingY: '6px',
      fontSize: '0.875rem',
      labelWeight: '500',
    },
    variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', width: 'standard' },
  },
  {
    id: 'rounded',
    label: 'Rounded',
    description: 'Pill buttons and soft rounded fields. Friendly and modern.',
    swatch: ['#0f766e', '#f0f7f6', '#ffffff'],
    tokens: {
      colorPrimary: '#0f766e',
      colorPrimaryHover: '#0b5e58',
      colorText: '#14211f',
      colorTextLight: '#5b6b68',
      colorBackground: '#ffffff',
      colorSurface: '#f0f7f6',
      colorBorder: '#d5e4e1',
      colorFocus: '#0f766e',
      radius: '22px',
      buttonRadius: '999px',
      borderWidth: '1px',
      fieldGap: '18px',
      inputPaddingY: '12px',
      labelWeight: '500',
    },
    variants: { input: 'filled', button: 'solid', buttonAlign: 'left', width: 'standard' },
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Serif type on warm paper. Suits editorial and service sites.',
    swatch: ['#8a3b12', '#2b2118', '#fbf8f3'],
    tokens: {
      colorPrimary: '#8a3b12',
      colorPrimaryHover: '#6e2f0e',
      colorText: '#2b2118',
      colorTextLight: '#6f6255',
      colorBackground: '#fbf8f3',
      colorSurface: '#ffffff',
      colorBorder: '#d9cfc2',
      colorFocus: '#8a3b12',
      fontFamily: "Georgia, 'Iowan Old Style', 'Times New Roman', serif",
      fontSize: '1.0625rem',
      radius: '2px',
      buttonRadius: '2px',
      borderWidth: '1px',
      fieldGap: '22px',
      inputPaddingY: '11px',
      labelWeight: '600',
    },
    variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', width: 'standard' },
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'High-contrast accent and heavy labels. Built to convert.',
    swatch: ['#e5484d', '#111111', '#fff7f5'],
    tokens: {
      colorPrimary: '#e5484d',
      colorPrimaryHover: '#c93a3f',
      colorText: '#111111',
      colorTextLight: '#5f5f5f',
      colorBackground: '#fff7f5',
      colorSurface: '#ffffff',
      colorBorder: '#111111',
      colorFocus: '#e5484d',
      radius: '10px',
      buttonRadius: '10px',
      borderWidth: '2px',
      fieldGap: '18px',
      inputPaddingY: '12px',
      labelWeight: '700',
    },
    variants: { input: 'outlined', button: 'solid', buttonAlign: 'full', width: 'standard' },
  },
  {
    id: 'dark-surface',
    label: 'Dark surface',
    description: 'Sits on a dark footer or hero without a card of its own.',
    swatch: ['#ffffff', '#f4f5f7', '#1b1d24'],
    // What the form is expected to sit on; previews draw it behind the form.
    backdrop: '#1b1d24',
    tokens: {
      colorPrimary: '#ffffff',
      colorPrimaryHover: '#dfe3ea',
      colorButtonText: '#111318',
      colorText: '#f4f5f7',
      colorLabel: '#f4f5f7',
      colorTextLight: '#b8bfcc',
      colorBackground: 'transparent',
      colorSurface: 'rgba(255, 255, 255, 0.08)',
      colorInputText: '#ffffff',
      colorBorder: 'rgba(255, 255, 255, 0.28)',
      colorFocus: '#ffffff',
      colorError: '#ffb4a8',
      radius: '8px',
      borderWidth: '1px',
      fieldGap: '14px',
      inputPaddingY: '11px',
      labelWeight: '500',
    },
    variants: { input: 'outlined', button: 'solid', buttonAlign: 'left', width: 'full' },
  },
];

export const FONT_STACKS = [
  { label: 'System', value: '' },
  { label: 'Sans serif', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: 'Serif', value: "Georgia, 'Iowan Old Style', 'Times New Roman', serif" },
  { label: 'Monospace', value: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
  { label: 'Rounded', value: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Quicksand', sans-serif" },
  { label: 'Humanist', value: "'Seravek', 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif" },
  { label: 'Inherit from theme', value: 'inherit' },
];

export const FORM_WIDTHS = {
  narrow: '30rem',
  standard: '40rem',
  wide: '52rem',
  full: '100%',
  // The theme's own content column, when it publishes one.
  theme: 'var(--wp--style--global--content-size, 40rem)',
};

/**
 * Preview widths. A theme can name these in theme.json under
 * settings.custom.breakpoints (or breakpoint), in pixels. Wide and content
 * sizes fill in desktop and tablet when those names are absent. Anything
 * still missing uses a standard width, and the three stay in order so
 * desktop is never the same size as tablet.
 *
 * @param {Object} settings theme.json settings.
 * @return {{desktop: number, tablet: number, mobile: number}} Widths in px.
 */
export function previewBreakpoints( settings = {} ) {
  const standard = { desktop: 1280, tablet: 768, mobile: 390 };
  const custom = settings.custom || {};
  const layout = settings.layout || {};
  const px = ( value ) => {
    if ( typeof value === 'number' && Number.isFinite( value ) ) {
      return Math.round( value );
    }
    const match = typeof value === 'string' ? value.trim().match( /^(\d+(?:\.\d+)?)px$/ ) : null;
    return match ? Math.round( Number( match[ 1 ] ) ) : null;
  };
  const usable = ( value ) => {
    const n = px( value );
    return n !== null && n >= 280 && n <= 2400 ? n : null;
  };
  const found = {};
  [ custom.breakpoint, custom.breakpoints ].forEach( ( bag ) => {
    if ( ! bag || typeof bag !== 'object' ) {
      return;
    }
    [ 'desktop', 'tablet', 'mobile' ].forEach( ( name ) => {
      if ( found[ name ] ) {
        return;
      }
      const n = usable( bag[ name ] );
      if ( n ) {
        found[ name ] = n;
      }
    } );
  } );
  if ( ! found.desktop ) {
    const wide = usable( layout.wideSize );
    if ( wide ) {
      found.desktop = wide;
    }
  }
  if ( ! found.tablet ) {
    const content = usable( layout.contentSize );
    if ( content ) {
      found.tablet = content;
    }
  }
  const widths = {
    desktop: found.desktop || standard.desktop,
    tablet: found.tablet || standard.tablet,
    mobile: found.mobile || standard.mobile,
  };
  if ( widths.desktop <= widths.tablet ) {
    widths.desktop = Math.max( widths.tablet + 240, standard.desktop );
  }
  if ( widths.tablet <= widths.mobile ) {
    widths.tablet = Math.max( widths.mobile + 200, standard.tablet );
  }
  return widths;
}

/**
 * Plugin defaults, mirrored from the public stylesheet. Used by the builder to
 * show what an unset control currently resolves to.
 */
export const TOKEN_DEFAULTS = {
  colorPrimary: '#4f5bd5',
  colorPrimaryHover: '#4048b8',
  colorText: '#131417',
  colorTextLight: '#6b7382',
  colorBackground: '#ffffff',
  colorSurface: '#f4f5f7',
  colorBorder: '#d8dbe2',
  colorError: '#b3261e',
  colorButtonText: '#ffffff',
  radius: '8px',
  buttonRadius: '4px',
  borderWidth: '1px',
};

/**
 * The value a token resolves to for a form: its own value, then the
 * built-in default. Labels and input text fall back to the text colour.
 *
 * @param {Object} appearance metadata.appearance
 * @param {string} key        Token key.
 * @return {string} Resolved value or ''.
 */
export function resolvedToken( appearance, key ) {
  const tokens = appearance?.tokens || {};
  if ( isSet( tokens[ key ] ) ) {
    return String( tokens[ key ] );
  }
  if ( key === 'colorLabel' || key === 'colorInputText' ) {
    return resolvedToken( appearance, 'colorText' );
  }
  if ( key === 'colorFocus' ) {
    return resolvedToken( appearance, 'colorPrimary' );
  }
  if ( key === 'buttonRadius' ) {
    return resolvedToken( appearance, 'radius' );
  }
  return TOKEN_DEFAULTS[ key ] || '';
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

const isSet = ( value ) =>
  value !== undefined && value !== null && value !== '';

/**
 * Turn a token map into a style object of CSS custom properties.
 *
 * @param {Object} tokens     Token values keyed by token key.
 * @param {Array}  definition Token definitions to resolve against.
 * @return {Object} React style object.
 */
export function tokensToStyle( tokens, definition ) {
  const style = {};

  if ( ! tokens ) {
    return style;
  }

  definition.forEach( ( { key, cssVar } ) => {
    if ( isSet( tokens[ key ] ) ) {
      style[ cssVar ] = String( tokens[ key ] );
    }
  } );

  return style;
}

/**
 * Full style object for a form root, including width.
 *
 * @param {Object} appearance metadata.appearance
 * @return {Object} React style object.
 */
export function formAppearanceStyle( appearance ) {
  const style = tokensToStyle( appearance?.tokens, FORM_TOKENS );
  const width = appearance?.variants?.width;

  if ( width && FORM_WIDTHS[ width ] ) {
    style.maxWidth = FORM_WIDTHS[ width ];
  }

  return style;
}

/**
 * Class names carrying the structural variants.
 *
 * @param {Object} appearance metadata.appearance
 * @return {string} Space-separated class names.
 */
export function formAppearanceClasses( appearance ) {
  const v = appearance?.variants || {};
  const classes = [];

  if ( v.input ) {
    classes.push( `subtleforms--input-${ v.input }` );
  }
  if ( v.button ) {
    classes.push( `subtleforms--button-${ v.button }` );
  }
  if ( v.buttonAlign ) {
    classes.push( `subtleforms--buttons-${ v.buttonAlign }` );
  }
  // Presets that change the form's chrome, not only its colours.
  if ( appearance?.preset === 'dark-surface' ) {
    classes.push( 'subtleforms--preset-dark-surface' );
  }
  if ( appearance?.preset === 'theme' ) {
    classes.push( 'subtleforms--inherit-theme' );
  }
  if ( v.layout === 'inline' ) {
    classes.push( 'subtleforms--layout-inline' );
  }

  return classes.join( ' ' );
}

/**
 * Style object for one field wrapper.
 *
 * Redeclaring the same custom properties the form set means everything inside
 * the field inherits the override without any field-specific CSS.
 *
 * @param {Object} appearance field.config.appearance
 * @return {Object} React style object.
 */
export function fieldAppearanceStyle( appearance ) {
  const style = tokensToStyle( appearance, FIELD_TOKENS );

  if ( ! appearance ) {
    return style;
  }

  if ( isSet( appearance.width ) && appearance.width !== '100' ) {
    // Percentage of the row, leaving the gap intact.
    style.flexBasis = `calc(${ appearance.width }% - var(--subtleforms-field-gap, 16px))`;
    style.maxWidth = `calc(${ appearance.width }% - var(--subtleforms-field-gap, 16px))`;
  }

  if ( isSet( appearance.marginTop ) ) {
    style.marginTop = appearance.marginTop;
  }
  if ( isSet( appearance.marginBottom ) ) {
    style.marginBottom = appearance.marginBottom;
  }

  return style;
}

/**
 * Class names for one field wrapper.
 *
 * @param {Object} appearance field.config.appearance
 * @return {string} Space-separated class names.
 */
export function fieldAppearanceClasses( appearance ) {
  const classes = [];

  if ( ! appearance ) {
    return '';
  }

  if ( appearance.align ) {
    classes.push( `subtleforms-field--align-${ appearance.align }` );
  }
  if ( appearance.hideLabel ) {
    classes.push( 'subtleforms-field--no-label' );
  }

  return classes.join( ' ' );
}

/**
 * Look up a preset by id.
 *
 * @param {string} id Preset id.
 * @return {Object|undefined} The preset.
 */
export function getPreset( id ) {
  return FORM_PRESETS.find( ( p ) => p.id === id );
}

/**
 * Whether the appearance has been changed from the preset it claims.
 *
 * Used to label the preset as edited rather than silently implying the form
 * still matches it.
 *
 * @param {Object} appearance metadata.appearance
 * @return {boolean} True when tokens or variants diverge from the preset.
 */
export function isPresetModified( appearance ) {
  const preset = getPreset( appearance?.preset );

  if ( ! preset ) {
    return false;
  }

  const tokens = appearance?.tokens || {};
  const variants = appearance?.variants || {};

  const sameTokens =
    Object.keys( { ...preset.tokens, ...tokens } ).every(
      ( k ) => ( preset.tokens[ k ] ?? '' ) === ( tokens[ k ] ?? '' )
    );

  const sameVariants =
    Object.keys( { ...preset.variants, ...variants } ).every(
      ( k ) => ( preset.variants[ k ] ?? '' ) === ( variants[ k ] ?? '' )
    );

  return ! ( sameTokens && sameVariants );
}

/**
 * Field types that render nothing, so styling them would have no effect.
 *
 * `action_hook` is a server-side extension point and `step` is a boundary the
 * form renderer consumes to slice pages; neither draws an element. Every other
 * type — including section breaks, HTML blocks and containers — has a wrapper
 * that carries appearance.
 *
 * @param {string} type Field type.
 * @return {boolean} True when the field can be styled.
 */
export function supportsAppearance( type ) {
  return type !== 'action_hook' && type !== 'step';
}

/**
 * The page colour a form's preset expects to sit on, for previews.
 *
 * @param {Object} appearance metadata.appearance
 * @return {string} A colour, or '' when the form brings its own background.
 */
export function appearanceBackdrop( appearance ) {
  const preset = appearance?.preset ? getPreset( appearance.preset ) : null;
  const bg = appearance?.tokens?.colorBackground;
  if ( preset?.backdrop && ( ! bg || bg === 'transparent' ) ) {
    return preset.backdrop;
  }
  return '';
}
