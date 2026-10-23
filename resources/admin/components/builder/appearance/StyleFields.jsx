import {
  Button,
  SelectControl,
  RangeControl,
  __experimentalUnitControl as UnitControl,
  __experimentalToggleGroupControl as ToggleGroupControl,
  __experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { undo } from '@wordpress/icons';
import { FONT_STACKS } from '../../../../shared/appearance';
import { ColorToken } from './AppearanceControls';
import { FONT_LABELS } from './labels';
import { clampSize } from './tokenDefs';
import { fontVar, sizeVar } from './themeColors';

/**
 * The controls of the Custom styling panel (2.7.2).
 *
 * Every control has a reset button. It puts the token back to "not set", which
 * means the form takes the theme's value (on a theme form) or the preset's.
 */

/**
 * A control with its reset button.
 *
 * @param {Object}   props
 * @param {string}   props.label     Name of the control, for the reset button.
 * @param {boolean}  props.isSet     Whether the control has a value of its own.
 * @param {string}   props.resetWord "theme", "preset" or "default": what reset goes back to.
 * @param {Function} props.onReset   Called to clear the value.
 * @param {boolean}  [props.disabled]
 */
export function ControlRow( { label, isSet, resetWord, onReset, disabled, children } ) {
  return (
    <div className={ `sf-style-control${ isSet ? ' is-set' : '' }` }>
      <div className='sf-style-control__body'>{ children }</div>
      <Button
        className='sf-style-control__reset'
        icon={ undo }
        size='small'
        label={ sprintf(
          /* translators: %s: name of a styling control */
          resetWord === 'theme'
            ? __( 'Reset %s to theme', 'subtleforms' )
            : resetWord === 'preset'
              ? __( 'Reset %s to preset', 'subtleforms' )
              : __( 'Reset %s to default', 'subtleforms' ),
          label
        ) }
        disabled={ disabled || ! isSet }
        onClick={ onReset }
      />
    </div>
  );
}

/**
 * The font choices: the theme's fonts first, then the system fonts.
 *
 * @param {Object|null} theme        Theme data.
 * @param {string}      inheritLabel Label of the "not set" choice.
 * @param {string}      value        Stored value.
 * @return {Array} Options for SelectControl.
 */
export function fontOptions( theme, inheritLabel, value ) {
  const themeFonts = ( theme?.fontFamilies || [] ).map( ( f ) => ( { label: f.name, value: fontVar( f.slug ) } ) );
  const system = FONT_STACKS.filter( ( f ) => f.value !== '' && f.value !== 'inherit' ).map( ( f ) => ( {
    label: FONT_LABELS[ f.value ] || f.label,
    value: f.value,
  } ) );
  const options = [ { label: inheritLabel, value: '' } ];
  if ( themeFonts.length ) {
    options.push( { label: __( 'Theme fonts', 'subtleforms' ), value: '__theme', disabled: true }, ...themeFonts );
  }
  options.push( { label: __( 'System fonts', 'subtleforms' ), value: '__system', disabled: true }, ...system );
  if ( value && ! options.some( ( o ) => o.value === value ) ) {
    options.push( { label: __( 'Custom font', 'subtleforms' ), value } );
  }
  return options;
}

export function FontField( { def, value, onChange, theme, inheritLabel, disabled } ) {
  return (
    <SelectControl
      label={ def.label }
      value={ value || '' }
      options={ fontOptions( theme, inheritLabel, value ) }
      disabled={ disabled }
      onChange={ onChange }
      __next40pxDefaultSize
      __nextHasNoMarginBottom
    />
  );
}

export function SizeField( { def, value, onChange, theme, placeholder, disabled } ) {
  const themeSizes = def.themeSizes ? theme?.fontSizes || [] : [];
  const isVar = typeof value === 'string' && value.startsWith( 'var(' );
  return (
    <>
      <UnitControl
        label={ def.label }
        value={ isVar ? '' : value ?? '' }
        units={ def.units.map( ( u ) => ( { value: u, label: u, default: 0 } ) ) }
        disabled={ disabled }
        placeholder={ isVar ? __( 'Theme size', 'subtleforms' ) : placeholder || __( 'Auto', 'subtleforms' ) }
        onChange={ ( next ) => onChange( next === undefined || next === '' ? '' : clampSize( def.key, String( next ) ) ) }
        __next40pxDefaultSize
      />
      { themeSizes.length > 0 && (
        <div className='sf-style-control__sizes' role='group' aria-label={ __( 'Theme font sizes', 'subtleforms' ) }>
          { themeSizes.map( ( s ) => (
            <Button
              key={ s.slug }
              size='small'
              variant={ value === sizeVar( s.slug ) ? 'primary' : 'secondary' }
              disabled={ disabled }
              onClick={ () => onChange( sizeVar( s.slug ) ) }>
              { s.name }
            </Button>
          ) ) }
        </div>
      ) }
    </>
  );
}

export function NumberField( { def, value, onChange, disabled } ) {
  return (
    <RangeControl
      label={ def.label }
      value={ value === '' || value === undefined ? undefined : Number( value ) }
      min={ def.min }
      max={ def.max }
      step={ def.step || 1 }
      disabled={ disabled }
      onChange={ ( next ) => onChange( next === undefined ? '' : String( next ) ) }
      __next40pxDefaultSize
      __nextHasNoMarginBottom
    />
  );
}

export function SelectField( { def, value, onChange, inheritLabel, disabled } ) {
  return (
    <SelectControl
      label={ def.label }
      value={ value || '' }
      options={ [ { label: inheritLabel, value: '' }, ...def.options ] }
      disabled={ disabled }
      onChange={ onChange }
      __next40pxDefaultSize
      __nextHasNoMarginBottom
    />
  );
}

export function ChoiceField( { def, value, onChange, disabled } ) {
  return (
    <ToggleGroupControl
      __nextHasNoMarginBottom
      __next40pxDefaultSize
      isBlock
      isDeselectable
      label={ def.label }
      value={ value || undefined }
      onChange={ ( next ) => onChange( next || '' ) }
      disabled={ disabled }>
      { def.options.map( ( o ) => (
        <ToggleGroupControlOption key={ o.value } value={ o.value } label={ o.label } />
      ) ) }
    </ToggleGroupControl>
  );
}

/**
 * Render the control a definition asks for.
 */
export function StyleField( { def, value, inherited, onChange, theme, inheritLabel, disabled } ) {
  switch ( def.type ) {
    case 'color':
      return (
        <ColorToken
          label={ def.label }
          value={ value }
          inherited={ inherited }
          onChange={ onChange }
          disabled={ disabled }
          inheritLabel={ inheritLabel }
        />
      );
    case 'font':
      return <FontField def={ def } value={ value } onChange={ onChange } theme={ theme } inheritLabel={ inheritLabel } disabled={ disabled } />;
    case 'size':
      return <SizeField def={ def } value={ value } onChange={ onChange } theme={ theme } placeholder={ inherited } disabled={ disabled } />;
    case 'number':
      return <NumberField def={ def } value={ value } onChange={ onChange } disabled={ disabled } />;
    case 'select':
      return <SelectField def={ def } value={ value } onChange={ onChange } inheritLabel={ inheritLabel } disabled={ disabled } />;
    case 'choice':
      return <ChoiceField def={ def } value={ value } onChange={ onChange } disabled={ disabled } />;
    default:
      return null;
  }
}
