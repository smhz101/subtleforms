import { __ } from '@wordpress/i18n';

/**
 * Translatable labels for the appearance contract.
 *
 * The contract in `shared/appearance.js` is imported by the public bundle too,
 * so it carries plain English strings and no i18n dependency. Translation
 * happens here, where every string is a literal and therefore extractable -
 * `__( variable )` produces no POT entry and silently ships untranslated.
 */

export const TOKEN_LABELS = {
  // Colour
  colorPrimary: __( 'Accent', 'subtleforms' ),
  colorPrimaryHover: __( 'Accent (hover)', 'subtleforms' ),
  colorText: __( 'Text', 'subtleforms' ),
  colorTextLight: __( 'Muted text', 'subtleforms' ),
  colorBackground: __( 'Background', 'subtleforms' ),
  colorSurface: __( 'Field background', 'subtleforms' ),
  colorBorder: __( 'Border', 'subtleforms' ),
  colorError: __( 'Error', 'subtleforms' ),
  colorLabel: __( 'Labels', 'subtleforms' ),
  colorInputText: __( 'Input text', 'subtleforms' ),
  colorFocus: __( 'Focus ring', 'subtleforms' ),
  colorButtonText: __( 'Button text', 'subtleforms' ),
  buttonRadius: __( 'Button radius', 'subtleforms' ),

  // Typography
  fontFamily: __( 'Font', 'subtleforms' ),
  fontSize: __( 'Base size', 'subtleforms' ),
  labelWeight: __( 'Label weight', 'subtleforms' ),
  lineHeight: __( 'Line height', 'subtleforms' ),

  // Shape and spacing
  radius: __( 'Corner radius', 'subtleforms' ),
  borderWidth: __( 'Border width', 'subtleforms' ),
  fieldGap: __( 'Space between fields', 'subtleforms' ),
  inputPaddingY: __( 'Input height', 'subtleforms' ),
};

export const VARIANT_LABELS = {
  input: __( 'Input style', 'subtleforms' ),
  button: __( 'Button style', 'subtleforms' ),
  buttonAlign: __( 'Button alignment', 'subtleforms' ),
  width: __( 'Form width', 'subtleforms' ),
  layout: __( 'Field layout', 'subtleforms' ),
};

export const OPTION_LABELS = {
  // Input styles
  outlined: __( 'Outlined', 'subtleforms' ),
  filled: __( 'Filled', 'subtleforms' ),
  underlined: __( 'Underlined', 'subtleforms' ),

  // Button styles
  solid: __( 'Solid', 'subtleforms' ),
  outline: __( 'Outline', 'subtleforms' ),
  ghost: __( 'Ghost', 'subtleforms' ),

  // Alignment
  left: __( 'Left', 'subtleforms' ),
  center: __( 'Centre', 'subtleforms' ),
  right: __( 'Right', 'subtleforms' ),
  full: __( 'Full width', 'subtleforms' ),

  // Field layout
  stacked: __( 'Stacked', 'subtleforms' ),
  inherit: __( 'Inherit from theme', 'subtleforms' ),
  inline: __( 'Inline', 'subtleforms' ),
  theme: __( 'Inherit from theme', 'subtleforms' ),

  // Widths
  narrow: __( 'Narrow', 'subtleforms' ),
  standard: __( 'Standard', 'subtleforms' ),
  wide: __( 'Wide', 'subtleforms' ),

  // Weights
  400: __( 'Regular', 'subtleforms' ),
  500: __( 'Medium', 'subtleforms' ),
  600: __( 'Semibold', 'subtleforms' ),
  700: __( 'Bold', 'subtleforms' ),

  // Field widths
  100: __( 'Full', 'subtleforms' ),
  75: __( 'Three quarters', 'subtleforms' ),
  66: __( 'Two thirds', 'subtleforms' ),
  50: __( 'Half', 'subtleforms' ),
  33: __( 'One third', 'subtleforms' ),
  25: __( 'One quarter', 'subtleforms' ),
};

export const PRESET_LABELS = {
  theme: {
    label: __( 'Inherit from theme', 'subtleforms' ),
    description: __( 'Uses the active theme\'s type, colours and content width. Nothing here overrides the theme unless you set it.', 'subtleforms' ),
  },
  default: {
    label: __( 'Clean', 'subtleforms' ),
    description: __( 'The plugin defaults. Neutral outlined fields and a solid button.', 'subtleforms' ),
  },
  soft: {
    label: __( 'Soft', 'subtleforms' ),
    description: __( 'Filled fields with no border, rounded corners and a pill button.', 'subtleforms' ),
  },
  bordered: {
    label: __( 'Bordered', 'subtleforms' ),
    description: __( 'Heavy square outlines and an outlined button. Reads as a form.', 'subtleforms' ),
  },
  editorial: {
    label: __( 'Editorial', 'subtleforms' ),
    description: __( 'Serif type, light labels and underlined fields. Suits writing and service sites.', 'subtleforms' ),
  },
  compact: {
    label: __( 'Compact', 'subtleforms' ),
    description: __( 'Small type and tight rows in teal. Suits long forms.', 'subtleforms' ),
  },
  rounded: {
    label: __( 'Rounded', 'subtleforms' ),
    description: __( 'Large corners, tall fields and a sky blue accent. Friendly and modern.', 'subtleforms' ),
  },
  classic: {
    label: __( 'Classic', 'subtleforms' ),
    description: __( 'Bold labels, square-ish fields and a blue button. Familiar and clear.', 'subtleforms' ),
  },
  dark: {
    label: __( 'Dark', 'subtleforms' ),
    description: __( 'For dark pages. Light text on deep blue with a soft blue button.', 'subtleforms' ),
  },
  contrast: {
    label: __( 'High contrast', 'subtleforms' ),
    description: __( 'Black on white with heavy borders and bold labels. Easiest to read.', 'subtleforms' ),
  },
};

export const FONT_LABELS = {
  '': __( 'System', 'subtleforms' ),
  "Georgia, 'Iowan Old Style', 'Times New Roman', serif": __( 'Serif', 'subtleforms' ),
  inherit: __( 'Inherit from theme', 'subtleforms' ),
};

/**
 * Translate a token label, falling back to the contract's English.
 *
 * @param {string} key      Token key.
 * @param {string} fallback English label from the contract.
 * @return {string} Translated label.
 */
export const tokenLabel = ( key, fallback ) => TOKEN_LABELS[ key ] || fallback;

/**
 * Translate an option label, falling back to the contract's English.
 *
 * @param {string} value    Option value.
 * @param {string} fallback English label from the contract.
 * @return {string} Translated label.
 */
export const optionLabel = ( value, fallback ) =>
  OPTION_LABELS[ value ] || fallback;
