import { __ } from '@wordpress/i18n';

/**
 * Translatable labels for the appearance contract.
 *
 * The contract in `shared/appearance.js` is imported by the public bundle too,
 * so it carries plain English strings and no i18n dependency. Translation
 * happens here, where every string is a literal and therefore extractable —
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

  // Widths
  narrow: __( 'Narrow', 'subtleforms' ),
  standard: __( 'Standard', 'subtleforms' ),
  wide: __( 'Wide', 'subtleforms' ),

  // Weights
  400: __( 'Regular', 'subtleforms' ),
  500: __( 'Medium', 'subtleforms' ),
  600: __( 'Semibold', 'subtleforms' ),

  // Field widths
  100: __( 'Full', 'subtleforms' ),
  75: __( 'Three quarters', 'subtleforms' ),
  66: __( 'Two thirds', 'subtleforms' ),
  50: __( 'Half', 'subtleforms' ),
  33: __( 'One third', 'subtleforms' ),
  25: __( 'One quarter', 'subtleforms' ),
};

export const PRESET_LABELS = {
  default: {
    label: __( 'Default', 'subtleforms' ),
    description: __( 'Inherits the plugin defaults. Neutral and unopinionated.', 'subtleforms' ),
  },
  minimal: {
    label: __( 'Minimal', 'subtleforms' ),
    description: __( 'Underlined inputs, generous spacing, no chrome.', 'subtleforms' ),
  },
  soft: {
    label: __( 'Soft', 'subtleforms' ),
    description: __( 'Filled fields, rounded corners, gentle contrast.', 'subtleforms' ),
  },
  bordered: {
    label: __( 'Bordered', 'subtleforms' ),
    description: __( 'Strong outlines and tight spacing. Reads as a form.', 'subtleforms' ),
  },
  dark: {
    label: __( 'Dark', 'subtleforms' ),
    description: __( 'For dark page backgrounds. Light text on deep ink.', 'subtleforms' ),
  },
  compact: {
    label: __( 'Compact', 'subtleforms' ),
    description: __( 'Small type and tight rows. Suits long forms.', 'subtleforms' ),
  },
};

export const FONT_LABELS = {
  '': __( 'System', 'subtleforms' ),
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
