import { __ } from '@wordpress/i18n';

/**
 * The form styling controls, grouped the way people think about a form (2.7.2).
 *
 * Each control writes one token into `metadata.appearance.tokens`. The public
 * bundle turns every token into a CSS custom property (resources/shared/appearance.js)
 * and the server checks every value (src/Support/Appearance.php); the ranges
 * here match the ones the server accepts, so a value the panel lets through is
 * a value the server keeps.
 *
 * `advanced` controls stay hidden until "Show advanced" is on.
 * Strings are written out in full so they are extracted for translation.
 */

const WEIGHTS = [
  { value: '300', label: __( 'Light', 'subtleforms' ) },
  { value: '400', label: __( 'Regular', 'subtleforms' ) },
  { value: '500', label: __( 'Medium', 'subtleforms' ) },
  { value: '600', label: __( 'Semibold', 'subtleforms' ) },
  { value: '700', label: __( 'Bold', 'subtleforms' ) },
  { value: '800', label: __( 'Extra bold', 'subtleforms' ) },
];

const only = ( ...values ) => WEIGHTS.filter( ( w ) => values.includes( w.value ) );

const CASES = [
  { value: 'none', label: __( 'As typed', 'subtleforms' ) },
  { value: 'uppercase', label: __( 'UPPER', 'subtleforms' ) },
  { value: 'capitalize', label: __( 'Title', 'subtleforms' ) },
  { value: 'lowercase', label: __( 'lower', 'subtleforms' ) },
];

const SHADOWS = [
  { value: 'none', label: __( 'None', 'subtleforms' ) },
  { value: 'subtle', label: __( 'Subtle', 'subtleforms' ) },
  { value: 'medium', label: __( 'Medium', 'subtleforms' ) },
];

/**
 * Size ranges in pixels (rem and em count as 16). Same table as
 * RANGED_SIZE_TOKENS in src/Support/Appearance.php for the tokens added in
 * 2.7.2; older tokens keep their own limits.
 */
export const SIZE_RANGES = {
  fontSize: [ 10, 40 ],
  labelSize: [ 8, 48 ],
  inputSize: [ 8, 48 ],
  helpSize: [ 8, 40 ],
  titleSize: [ 10, 96 ],
  buttonSize: [ 8, 48 ],
  labelLetterSpacing: [ -4, 12 ],
  radius: [ 0, 64 ],
  buttonRadius: [ 0, 999 ],
  borderWidth: [ 0, 8 ],
  fieldGap: [ 0, 96 ],
  columnGap: [ 0, 96 ],
  inputPaddingY: [ 0, 48 ],
  inputPaddingX: [ 0, 64 ],
  labelGap: [ 0, 48 ],
  buttonPaddingY: [ 0, 48 ],
  buttonPaddingX: [ 0, 96 ],
  formMaxWidth: [ 240, 1920 ],
  choiceSize: [ 12, 40 ],
};

export const GROUPS = [
  {
    id: 'typography',
    title: __( 'Typography', 'subtleforms' ),
    controls: [
      { key: 'fontFamily', type: 'font', label: __( 'Form font', 'subtleforms' ) },
      { key: 'fontSize', type: 'size', label: __( 'Base size', 'subtleforms' ), units: [ 'px', 'rem' ], themeSizes: true },
      { key: 'labelFont', type: 'font', label: __( 'Label font', 'subtleforms' ) },
      { key: 'labelSize', type: 'size', label: __( 'Label size', 'subtleforms' ), units: [ 'px', 'rem' ], themeSizes: true },
      { key: 'labelWeight', type: 'select', label: __( 'Label weight', 'subtleforms' ), options: only( '300', '400', '500', '600', '700', '800' ) },
      { key: 'labelLetterSpacing', type: 'size', label: __( 'Label letter spacing', 'subtleforms' ), units: [ 'px', 'em' ], advanced: true },
      { key: 'labelLineHeight', type: 'number', label: __( 'Label line height', 'subtleforms' ), min: 0.8, max: 3, step: 0.05, advanced: true },
      { key: 'labelTransform', type: 'choice', label: __( 'Label case', 'subtleforms' ), options: CASES, advanced: true },
      { key: 'inputFont', type: 'font', label: __( 'Input text font', 'subtleforms' ), advanced: true },
      { key: 'inputSize', type: 'size', label: __( 'Input text size', 'subtleforms' ), units: [ 'px', 'rem' ], themeSizes: true },
      { key: 'inputWeight', type: 'select', label: __( 'Input text weight', 'subtleforms' ), options: only( '300', '400', '500', '600', '700' ), advanced: true },
      { key: 'helpSize', type: 'size', label: __( 'Help text size', 'subtleforms' ), units: [ 'px', 'rem' ], advanced: true },
      { key: 'titleSize', type: 'size', label: __( 'Title size', 'subtleforms' ), units: [ 'px', 'rem' ], themeSizes: true, advanced: true },
      { key: 'titleWeight', type: 'select', label: __( 'Title weight', 'subtleforms' ), options: only( '400', '500', '600', '700', '800' ), advanced: true },
      { key: 'lineHeight', type: 'number', label: __( 'Line height', 'subtleforms' ), min: 1, max: 2.4, step: 0.05, advanced: true },
    ],
  },
  {
    id: 'colours',
    title: __( 'Colours', 'subtleforms' ),
    controls: [
      { key: 'colorBackground', type: 'color', label: __( 'Form background', 'subtleforms' ) },
      { key: 'colorText', type: 'color', label: __( 'Text', 'subtleforms' ) },
      { key: 'colorLabel', type: 'color', label: __( 'Label', 'subtleforms' ) },
      { key: 'colorInputText', type: 'color', label: __( 'Input text', 'subtleforms' ) },
      { key: 'colorPlaceholder', type: 'color', label: __( 'Placeholder', 'subtleforms' ), advanced: true },
      { key: 'colorSurface', type: 'color', label: __( 'Input background', 'subtleforms' ) },
      { key: 'colorBorder', type: 'color', label: __( 'Input border', 'subtleforms' ) },
      { key: 'colorFocusRing', type: 'color', label: __( 'Focus ring', 'subtleforms' ), legacyKey: 'colorFocus' },
      { key: 'colorPrimary', type: 'color', label: __( 'Button background', 'subtleforms' ) },
      { key: 'colorButtonText', type: 'color', label: __( 'Button text', 'subtleforms' ) },
      { key: 'colorPrimaryHover', type: 'color', label: __( 'Button hover background', 'subtleforms' ) },
      { key: 'colorButtonHoverText', type: 'color', label: __( 'Button hover text', 'subtleforms' ), advanced: true },
      { key: 'colorTextLight', type: 'color', label: __( 'Muted text', 'subtleforms' ), advanced: true },
      { key: 'colorHelp', type: 'color', label: __( 'Help text', 'subtleforms' ), advanced: true },
      { key: 'colorError', type: 'color', label: __( 'Error', 'subtleforms' ) },
      { key: 'colorSuccess', type: 'color', label: __( 'Success', 'subtleforms' ), advanced: true },
      { key: 'colorLink', type: 'color', label: __( 'Link', 'subtleforms' ), advanced: true },
    ],
  },
  {
    id: 'fields',
    title: __( 'Fields', 'subtleforms' ),
    variants: [ 'input' ],
    controls: [
      { key: 'borderWidth', type: 'size', label: __( 'Border width', 'subtleforms' ), units: [ 'px' ] },
      {
        key: 'borderStyle',
        type: 'choice',
        label: __( 'Border style', 'subtleforms' ),
        advanced: true,
        options: [
          { value: 'solid', label: __( 'Solid', 'subtleforms' ) },
          { value: 'dashed', label: __( 'Dashed', 'subtleforms' ) },
          { value: 'dotted', label: __( 'Dotted', 'subtleforms' ) },
        ],
      },
      { key: 'radius', type: 'size', label: __( 'Corner radius', 'subtleforms' ), units: [ 'px' ] },
      { key: 'inputPaddingY', type: 'size', label: __( 'Input height (vertical padding)', 'subtleforms' ), units: [ 'px' ] },
      { key: 'inputPaddingX', type: 'size', label: __( 'Input side padding', 'subtleforms' ), units: [ 'px' ], advanced: true },
      { key: 'fieldGap', type: 'size', label: __( 'Space between fields', 'subtleforms' ), units: [ 'px', 'rem' ] },
      { key: 'labelGap', type: 'size', label: __( 'Space between label and input', 'subtleforms' ), units: [ 'px' ], advanced: true },
      { key: 'fieldShadow', type: 'choice', label: __( 'Field shadow', 'subtleforms' ), options: SHADOWS, advanced: true },
      {
        key: 'focusStyle',
        type: 'choice',
        label: __( 'Focus style', 'subtleforms' ),
        advanced: true,
        options: [
          { value: 'ring', label: __( 'Ring', 'subtleforms' ) },
          { value: 'border', label: __( 'Border', 'subtleforms' ) },
        ],
      },
    ],
  },
  {
    id: 'buttons',
    title: __( 'Buttons', 'subtleforms' ),
    variants: [ 'button' ],
    buttonPlacement: true,
    controls: [
      { key: 'buttonRadius', type: 'size', label: __( 'Button radius', 'subtleforms' ), units: [ 'px' ] },
      { key: 'buttonPaddingY', type: 'size', label: __( 'Button vertical padding', 'subtleforms' ), units: [ 'px' ], advanced: true },
      { key: 'buttonPaddingX', type: 'size', label: __( 'Button side padding', 'subtleforms' ), units: [ 'px' ], advanced: true },
      { key: 'buttonSize', type: 'size', label: __( 'Button text size', 'subtleforms' ), units: [ 'px', 'rem' ], themeSizes: true, advanced: true },
      { key: 'buttonWeight', type: 'select', label: __( 'Button text weight', 'subtleforms' ), options: only( '400', '500', '600', '700', '800' ), advanced: true },
      { key: 'buttonTransform', type: 'choice', label: __( 'Button text case', 'subtleforms' ), options: CASES, advanced: true },
      { key: 'buttonShadow', type: 'choice', label: __( 'Button shadow', 'subtleforms' ), options: SHADOWS, advanced: true },
    ],
  },
  {
    id: 'layout',
    title: __( 'Layout', 'subtleforms' ),
    density: true,
    variants: [ 'width', 'layout' ],
    controls: [
      { key: 'formMaxWidth', type: 'size', label: __( 'Form maximum width', 'subtleforms' ), units: [ 'px', '%' ] },
      {
        key: 'formAlign',
        type: 'choice',
        label: __( 'Form alignment', 'subtleforms' ),
        options: [
          { value: 'left', label: __( 'Left', 'subtleforms' ) },
          { value: 'center', label: __( 'Centre', 'subtleforms' ) },
        ],
      },
      { key: 'columnGap', type: 'size', label: __( 'Space between columns', 'subtleforms' ), units: [ 'px', 'rem' ], advanced: true },
    ],
  },
  {
    id: 'choices',
    title: __( 'Choices (radio, checkbox, toggle)', 'subtleforms' ),
    controls: [
      { key: 'choiceAccent', type: 'color', label: __( 'Accent colour', 'subtleforms' ) },
      { key: 'choiceSize', type: 'size', label: __( 'Size', 'subtleforms' ), units: [ 'px' ], advanced: true },
    ],
  },
];

/** Settings of the Compact and Comfortable density presets. */
export const DENSITIES = {
  compact: { fieldGap: '10px', inputPaddingY: '6px', labelGap: '4px', buttonPaddingY: '8px' },
  comfortable: { fieldGap: '26px', inputPaddingY: '14px', labelGap: '8px', buttonPaddingY: '14px' },
};

/**
 * Keep a size the server will accept: inside the range for its token.
 *
 * @param {string} key   Token key.
 * @param {string} value Value from the control, such as "14px".
 * @return {string} The value, moved into range; '' for something unreadable.
 */
export function clampSize( key, value ) {
  const range = SIZE_RANGES[ key ];
  const m = typeof value === 'string' ? value.trim().match( /^(-?(?:\d+|\d*\.\d+))(px|rem|em|%)?$/ ) : null;
  if ( ! m ) {
    return '';
  }
  const unit = m[ 2 ] || 'px';
  let n = parseFloat( m[ 1 ] );
  if ( ! range ) {
    return `${ n }${ unit }`;
  }
  if ( unit === '%' ) {
    n = Math.min( 100, Math.max( 10, n ) );
    return key === 'formMaxWidth' ? `${ n }%` : '';
  }
  const scale = unit === 'px' ? 1 : 16;
  const px = Math.min( range[ 1 ], Math.max( range[ 0 ], n * scale ) );
  return `${ Math.round( ( px / scale ) * 100 ) / 100 }${ unit }`;
}
