import {
  ColorPicker,
  Dropdown,
  Button,
  SelectControl,
  RangeControl,
  __experimentalUnitControl as UnitControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { tokenLabel, optionLabel } from './labels';
import './AppearanceControls.scss';

/**
 * Renders one control per token definition.
 *
 * Shared by the form panel and the field inspector so a colour behaves the same
 * in both places, and adding a token to the contract adds it to both surfaces
 * without further work.
 */

/**
 * A colour swatch that opens a picker, with a control to clear back to inherited.
 */
function ColorToken( { label, value, placeholder, onChange, disabled } ) {
  return (
    <div className='sf-appearance-control sf-appearance-control--color'>
      <span className='sf-appearance-control__label'>{ label }</span>
      <div className='sf-appearance-control__color-row'>
        <Dropdown
          className='sf-appearance-control__swatch-wrap'
          contentClassName='sf-appearance-control__popover'
          popoverProps={ { placement: 'left-start', offset: 12 } }
          renderToggle={ ( { isOpen, onToggle } ) => (
            <button
              type='button'
              className='sf-appearance-control__swatch'
              aria-expanded={ isOpen }
              aria-label={
                value
                  ? /* translators: %s: control name */ `${ label }: ${ value }`
                  : `${ label }: ${ __( 'inherited', 'subtleforms' ) }`
              }
              disabled={ disabled }
              onClick={ onToggle }
              style={ {
                // No value means inherited; show the effective colour faintly
                // rather than an empty box that reads as "white".
                background: value || placeholder || 'transparent',
              } }>
              { ! value && <span className='sf-appearance-control__swatch-empty' /> }
            </button>
          ) }
          renderContent={ () => (
            <div className='sf-appearance-control__picker'>
              <ColorPicker
                color={ value || placeholder || '#000000' }
                onChange={ onChange }
                enableAlpha={ false }
              />
            </div>
          ) }
        />
        { value && ! disabled && (
          <Button
            variant='tertiary'
            size='small'
            onClick={ () => onChange( '' ) }
            className='sf-appearance-control__clear'>
            { __( 'Reset', 'subtleforms' ) }
          </Button>
        ) }
      </div>
    </div>
  );
}

/**
 * Render the control matching a token's declared type.
 */
function TokenControl( { token, value, onChange, disabled } ) {
  const label = tokenLabel( token.key, token.label );

  if ( token.type === 'color' ) {
    return (
      <ColorToken
        label={ label }
        value={ value }
        onChange={ onChange }
        disabled={ disabled }
      />
    );
  }

  if ( token.type === 'size' ) {
    return (
      <div className='sf-appearance-control'>
        <UnitControl
          label={ label }
          value={ value ?? '' }
          units={ ( token.units || [ 'px' ] ).map( ( u ) => ( {
            value: u,
            label: u,
            default: 0,
          } ) ) }
          min={ token.min }
          max={ token.max }
          disabled={ disabled }
          placeholder={ __( 'Auto', 'subtleforms' ) }
          onChange={ ( next ) => onChange( next ?? '' ) }
          __next40pxDefaultSize
        />
      </div>
    );
  }

  if ( token.type === 'number' ) {
    return (
      <div className='sf-appearance-control'>
        <RangeControl
          label={ label }
          value={ value === '' || value === undefined ? undefined : Number( value ) }
          min={ token.min }
          max={ token.max }
          step={ token.step || 1 }
          disabled={ disabled }
          allowReset
          onChange={ ( next ) =>
            onChange( next === undefined ? '' : String( next ) )
          }
          __next40pxDefaultSize
          __nextHasNoMarginBottom
        />
      </div>
    );
  }

  if ( token.type === 'select' || token.type === 'font' ) {
    return (
      <div className='sf-appearance-control'>
        <SelectControl
          label={ label }
          value={ value ?? '' }
          options={ [
            { label: __( 'Inherit', 'subtleforms' ), value: '' },
            ...( token.options || [] ).map( ( o ) => ( {
              ...o,
              label: optionLabel( o.value, o.label ),
            } ) ),
          ] }
          disabled={ disabled }
          onChange={ onChange }
          __next40pxDefaultSize
          __nextHasNoMarginBottom
        />
      </div>
    );
  }

  return null;
}

/**
 * A titled group of token controls.
 *
 * @param {Object}   props
 * @param {string}   props.title      Group heading.
 * @param {Array}    props.tokens     Token definitions in this group.
 * @param {Object}   props.values     Current values keyed by token key.
 * @param {Function} props.onChange   Called with (key, value).
 * @param {boolean}  props.disabled   Read-only mode.
 * @param {Array}    [props.extra]    Extra controls appended to the group.
 */
export default function AppearanceControls( {
  title,
  tokens,
  values = {},
  onChange,
  disabled = false,
  fontOptions,
} ) {
  return (
    <div className='sf-appearance-group'>
      { title && <h4 className='sf-appearance-group__title'>{ title }</h4> }
      <div className='sf-appearance-group__controls'>
        { tokens.map( ( token ) => (
          <TokenControl
            key={ token.key }
            token={
              token.type === 'font' && fontOptions
                ? { ...token, options: fontOptions }
                : token
            }
            value={ values[ token.key ] }
            disabled={ disabled }
            onChange={ ( next ) => onChange( token.key, next ) }
          />
        ) ) }
      </div>
    </div>
  );
}
