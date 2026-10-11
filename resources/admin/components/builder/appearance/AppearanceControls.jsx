import {
  ColorPicker,
  Dropdown,
  Button,
  SelectControl,
  RangeControl,
  __experimentalUnitControl as UnitControl,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { tokenLabel, optionLabel } from './labels';
import './AppearanceControls.scss';

/**
 * One control per token definition, shared by the form and field panels so a
 * colour or size behaves the same in both places.
 *
 * Every control shows what it currently resolves to. An unset control is not
 * blank: it shows the inherited value (from the preset, the form, or the
 * plugin default) in a muted style, so the user always sees the real result.
 */

const SWATCHES = [
  '#131417', '#3c434a', '#ffffff', '#f4f5f7',
  '#3858e9', '#4f5bd5', '#0f766e', '#008a20',
  '#e5484d', '#d63638', '#f0b849', '#8a3b12',
];

function ColorToken( { label, value, inherited, onChange, disabled, inheritLabel } ) {
  const shown = value || inherited || '';
  return (
    <Dropdown
      className='sf-color-token'
      contentClassName='sf-color-token__popover'
      popoverProps={ { placement: 'left-start', offset: 12 } }
      renderToggle={ ( { isOpen, onToggle } ) => (
        <button
          type='button'
          className={ `sf-color-token__toggle${ value ? ' is-set' : '' }` }
          aria-expanded={ isOpen }
          disabled={ disabled }
          onClick={ onToggle }
          aria-label={ sprintf(
            /* translators: 1: control name, 2: colour value */
            __( '%1$s: %2$s', 'subtleforms' ),
            label,
            value || inheritLabel
          ) }>
          <span className='sf-color-token__chip' style={ { background: shown || 'transparent' } }>
            { ! shown && <span className='sf-color-token__none' /> }
          </span>
          <span className='sf-color-token__text'>
            <span className='sf-color-token__label'>{ label }</span>
            <span className='sf-color-token__value'>
              { value ? value.toUpperCase() : inheritLabel }
            </span>
          </span>
        </button>
      ) }
      renderContent={ ( { onClose } ) => (
        <div className='sf-color-token__picker'>
          <div className='sf-color-token__swatches'>
            { SWATCHES.map( ( c ) => (
              <button
                key={ c }
                type='button'
                className={ `sf-color-token__swatch${ c === value ? ' is-active' : '' }` }
                style={ { background: c } }
                aria-label={ c }
                onClick={ () => onChange( c ) }
              />
            ) ) }
          </div>
          <ColorPicker color={ shown || '#000000' } onChange={ onChange } enableAlpha={ false } />
          <div className='sf-color-token__actions'>
            <Button
              variant='tertiary'
              size='small'
              disabled={ ! value }
              onClick={ () => {
                onChange( '' );
                onClose();
              } }>
              { inheritLabel === __( 'Form', 'subtleforms' )
                ? __( 'Use form colour', 'subtleforms' )
                : __( 'Use default', 'subtleforms' ) }
            </Button>
            <Button variant='secondary' size='small' onClick={ onClose }>
              { __( 'Done', 'subtleforms' ) }
            </Button>
          </div>
        </div>
      ) }
    />
  );
}

function TokenControl( { token, value, inherited, onChange, disabled, inheritLabel } ) {
  const label = tokenLabel( token.key, token.label );

  if ( token.type === 'color' ) {
    return (
      <ColorToken
        label={ label }
        value={ value }
        inherited={ inherited }
        onChange={ onChange }
        disabled={ disabled }
        inheritLabel={ inheritLabel }
      />
    );
  }

  if ( token.type === 'size' ) {
    return (
      <div className='sf-appearance-control'>
        <UnitControl
          label={ label }
          value={ value ?? '' }
          units={ ( token.units || [ 'px' ] ).map( ( u ) => ( { value: u, label: u, default: 0 } ) ) }
          min={ token.min }
          max={ token.max }
          disabled={ disabled }
          placeholder={ inherited || __( 'Auto', 'subtleforms' ) }
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
          onChange={ ( next ) => onChange( next === undefined ? '' : String( next ) ) }
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
            { label: inheritLabel, value: '' },
            ...( token.options || [] )
              .filter( ( o ) => o.value !== '' )
              .map( ( o ) => ( { ...o, label: optionLabel( o.value, o.label ) } ) ),
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
 * @param {Object}   props
 * @param {string}   [props.title]        Optional heading.
 * @param {Array}    props.tokens         Token definitions.
 * @param {Object}   props.values         Current values by key.
 * @param {Object}   [props.placeholders] Inherited values by key, shown when unset.
 * @param {Function} props.onChange       Called with (key, value).
 * @param {boolean}  [props.disabled]
 * @param {Array}    [props.fontOptions]
 * @param {string}   [props.layout]       'stack' or 'swatches' (colour grid).
 * @param {string}   [props.inheritLabel] Word for "inherited" (Default / Form).
 */
export default function AppearanceControls( {
  title,
  tokens,
  values = {},
  placeholders = {},
  onChange,
  disabled = false,
  fontOptions,
  layout = 'stack',
  inheritLabel = __( 'Default', 'subtleforms' ),
} ) {
  return (
    <div className={ `sf-appearance-group sf-appearance-group--${ layout }` }>
      { title && <h4 className='sf-appearance-group__title'>{ title }</h4> }
      <div className='sf-appearance-group__controls'>
        { tokens.map( ( token ) => (
          <TokenControl
            key={ token.key }
            token={ token.type === 'font' && fontOptions ? { ...token, options: fontOptions } : token }
            value={ values[ token.key ] }
            inherited={ placeholders[ token.key ] }
            disabled={ disabled }
            inheritLabel={ inheritLabel }
            onChange={ ( next ) => onChange( token.key, next ) }
          />
        ) ) }
      </div>
    </div>
  );
}

