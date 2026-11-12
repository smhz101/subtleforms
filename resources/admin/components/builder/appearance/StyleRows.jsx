import { useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { undo } from '@wordpress/icons';
import PropertyRow, { useRowIds } from '../inspector/PropertyRow';
import Segmented from '../inspector/controls/Segmented';
import ChipSelect from '../inspector/controls/ChipSelect';
import { ColorToken } from './AppearanceControls';
import { fontOptions } from './StyleFields';
import { clampSize } from './tokenDefs';
import { sizeVar } from './themeColors';

/**
 * The rows of the Custom tab: each control the form styling has, drawn as one
 * property row of the field settings panel (label above, a 36px control
 * below). Every row keeps the reset that puts its token back to "not set",
 * which means the form takes the theme's value (on a theme form) or the
 * preset's. The reset only shows once the row has a value of its own.
 */

/** Two to four choices are pills; more are a select. */
const fitsPills = ( options ) => options.length >= 2 && options.length <= 4;

/** A size typed as "14", "14px" or "1rem", kept inside what the server accepts. */
function SizeInput( { id, def, value, placeholder, disabled, onCommit, describedBy } ) {
  const isVar = typeof value === 'string' && value.startsWith( 'var(' );
  const [ draft, setDraft ] = useState( null );
  const commit = () => {
    if ( draft === null ) {
      return;
    }
    onCommit( draft.trim() === '' ? '' : clampSize( def.key, draft.trim() ) );
    setDraft( null );
  };
  return (
    <input
      type='text'
      id={ id }
      className='sf-prow__input'
      value={ draft ?? ( isVar ? '' : value ?? '' ) }
      placeholder={ isVar ? __( 'Theme size', 'subtleforms' ) : placeholder || __( 'Auto', 'subtleforms' ) }
      disabled={ disabled }
      aria-describedby={ describedBy }
      onChange={ ( event ) => setDraft( event.target.value ) }
      onBlur={ commit }
      onKeyDown={ ( event ) => {
        if ( event.key === 'Enter' ) {
          commit();
        }
      } }
    />
  );
}

/**
 * One token of the form, as a property row.
 *
 * @param {Object}   props
 * @param {Object}   props.def          Control definition from tokenDefs.js.
 * @param {string}   props.value        Stored value, '' when not set.
 * @param {string}   props.inherited    What the control shows while it is not set.
 * @param {Function} props.onChange     Called with the new value ('' clears it).
 * @param {Object}   props.theme        Theme data.
 * @param {string}   props.inheritLabel Word for the "not set" choice.
 * @param {boolean}  props.isSet        Whether the control has a value of its own.
 * @param {string}   props.resetWord    "theme", "preset" or "default".
 * @param {Function} props.onReset      Puts the token back.
 * @param {string}   props.error        A line shown under the control in the error colour.
 * @param {boolean}  props.disabled     Read only.
 */
export function TokenRow( { def, value, inherited, onChange, theme, inheritLabel, isSet, resetWord, onReset, error, disabled } ) {
  const ids = useRowIds();
  const errorId = error ? `${ ids.id }-error` : undefined;
  let composite = false;
  let control = null;

  switch ( def.type ) {
    case 'color':
      control = (
        <ColorToken
          id={ ids.id }
          label={ def.label }
          hideLabel
          value={ value }
          inherited={ inherited }
          onChange={ onChange }
          disabled={ disabled }
          inheritLabel={ inheritLabel }
          describedBy={ errorId }
        />
      );
      break;
    case 'font':
      control = (
        <ChipSelect
          id={ ids.id }
          options={ fontOptions( theme, inheritLabel, value ) }
          value={ value || '' }
          onChange={ onChange }
          disabled={ disabled }
        />
      );
      break;
    case 'size':
      control = (
        <SizeInput id={ ids.id } def={ def } value={ value } placeholder={ inherited } disabled={ disabled } onCommit={ onChange } describedBy={ errorId } />
      );
      break;
    case 'number':
      control = (
        <input
          type='number'
          id={ ids.id }
          className='sf-prow__input'
          value={ value === '' || value === undefined ? '' : value }
          placeholder={ __( 'Auto', 'subtleforms' ) }
          min={ def.min }
          max={ def.max }
          step={ def.step || 1 }
          disabled={ disabled }
          onChange={ ( event ) => onChange( event.target.value === '' ? '' : String( event.target.value ) ) }
        />
      );
      break;
    case 'select':
      control = (
        <ChipSelect
          id={ ids.id }
          options={ [ { label: inheritLabel, value: '' }, ...def.options ] }
          value={ value || '' }
          onChange={ onChange }
          disabled={ disabled }
        />
      );
      break;
    case 'choice':
      if ( fitsPills( def.options ) ) {
        composite = true;
        control = <Segmented options={ def.options } value={ value || '' } onChange={ onChange } labelId={ ids.labelId } disabled={ disabled } />;
      } else {
        control = <ChipSelect id={ ids.id } options={ [ { label: inheritLabel, value: '' }, ...def.options ] } value={ value || '' } onChange={ onChange } disabled={ disabled } />;
      }
      break;
    default:
      return null;
  }

  const themeSizes = def.type === 'size' && def.themeSizes ? theme?.fontSizes || [] : [];

  return (
    <PropertyRow label={ def.label } ids={ ids } stacked composite={ composite } className='sf-arow'>
      <div className='sf-arow__line'>
        <div className='sf-arow__control'>{ control }</div>
        { isSet && ! disabled && (
          <Button
            className='sf-arow__reset'
            icon={ undo }
            size='small'
            label={ sprintf(
              /* translators: %s: name of a styling control */
              resetWord === 'theme'
                ? __( 'Reset %s to theme', 'subtleforms' )
                : resetWord === 'preset'
                  ? __( 'Reset %s to preset', 'subtleforms' )
                  : __( 'Reset %s to default', 'subtleforms' ),
              def.label
            ) }
            onClick={ onReset }
          />
        ) }
      </div>
      { themeSizes.length > 0 && (
        <div className='sf-arow__sizes' role='group' aria-label={ __( 'Theme font sizes', 'subtleforms' ) }>
          { themeSizes.map( ( s ) => (
            <button
              key={ s.slug }
              type='button'
              className={ `sf-chip${ value === sizeVar( s.slug ) ? ' is-on' : '' }` }
              aria-pressed={ value === sizeVar( s.slug ) }
              disabled={ disabled }
              onClick={ () => onChange( sizeVar( s.slug ) ) }>
              { s.name }
            </button>
          ) ) }
        </div>
      ) }
      { error && (
        <p className='sf-arow__error' id={ errorId } role='status'>
          { error }
        </p>
      ) }
    </PropertyRow>
  );
}

/**
 * A structural choice (input style, button style, form width): pills for two
 * to four short options, a select for the rest.
 *
 * @param {Object}   props
 * @param {string}   props.label    Row label.
 * @param {Array}    props.options  [{ value, label }].
 * @param {string}   props.value    Selected value.
 * @param {Function} props.onChange Called with the chosen value.
 * @param {boolean}  props.disabled Read only.
 * @param {string}   props.className Extra class names for the row.
 */
export function ChoiceRow( { label, options, value, onChange, disabled, className = '' } ) {
  const ids = useRowIds();
  const pills = fitsPills( options ) && options.reduce( ( n, o ) => n + String( o.label ).length, 0 ) <= 26;
  return (
    <PropertyRow label={ label } ids={ ids } stacked composite={ pills } className={ `sf-arow ${ className }`.trim() }>
      <div className='sf-arow__line'>
        <div className='sf-arow__control'>
          { pills ? (
            <Segmented options={ options } value={ value ?? '' } onChange={ onChange } labelId={ ids.labelId } disabled={ disabled } />
          ) : (
            <ChipSelect id={ ids.id } options={ options } value={ value ?? '' } onChange={ onChange } disabled={ disabled } />
          ) }
        </div>
      </div>
    </PropertyRow>
  );
}
