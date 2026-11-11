import {
  Button,
  ToggleControl,
  __experimentalToggleGroupControl as ToggleGroupControl,
  __experimentalToggleGroupControlOption as ToggleGroupControlOption,
  __experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
} from '@wordpress/components';
import { __, sprintf, _n } from '@wordpress/i18n';
import { FIELD_TOKENS, FIELD_LAYOUT, resolvedToken } from '../../../../shared/appearance';
import InspectorSection from '../inspector/InspectorSection';
import AppearanceControls from './AppearanceControls';
import { optionLabel } from './labels';
import './FieldAppearancePanel.scss';

/**
 * Per-field style overrides.
 *
 * Everything here overrides the form's Appearance for this one field. Unset
 * controls show the value inherited from the form. The field itself is on the
 * canvas and in Preview, so the panel draws no sample of it.
 */

const SPACING = [
  { label: __( 'None', 'subtleforms' ), value: '0' },
  { label: __( 'S', 'subtleforms' ), value: '8px' },
  { label: __( 'M', 'subtleforms' ), value: '16px' },
  { label: __( 'L', 'subtleforms' ), value: '32px' },
];

const ALIGN_ICONS = {
  left: <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'><path d='M4 6h16M4 12h10M4 18h13' stroke='currentColor' strokeWidth='1.8' fill='none' strokeLinecap='round' /></svg>,
  center: <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'><path d='M4 6h16M7 12h10M5.5 18h13' stroke='currentColor' strokeWidth='1.8' fill='none' strokeLinecap='round' /></svg>,
  right: <svg viewBox='0 0 24 24' width='20' height='20' aria-hidden='true'><path d='M4 6h16M10 12h10M7 18h13' stroke='currentColor' strokeWidth='1.8' fill='none' strokeLinecap='round' /></svg>,
};

const ALIGN_LABELS = {
  left: __( 'Left', 'subtleforms' ),
  center: __( 'Centre', 'subtleforms' ),
  right: __( 'Right', 'subtleforms' ),
};

export const FRACTIONS = { 100: __( 'Full', 'subtleforms' ), 75: '¾', 66: '⅔', 50: '½', 33: '⅓', 25: '¼' };

/**
 * The appearance object after one setting changes: an empty value clears the
 * key. Shared by this panel and the Width quick row of the settings sheet, so
 * both save the same shape.
 *
 * @param {Object} appearance Current appearance overrides.
 * @param {string} key        Setting.
 * @param {*}      value      New value.
 * @return {Object} Next appearance.
 */
export function nextAppearance( appearance, key, value ) {
  const next = { ...appearance };
  if ( value === '' || value === undefined || value === null || value === false ) {
    delete next[ key ];
  } else {
    next[ key ] = value;
  }
  return next;
}

function WidthPicker( { value, onChange, disabled } ) {
  const options = [ { value: '', label: __( 'Auto', 'subtleforms' ) }, ...FIELD_LAYOUT.widths ];
  return (
    <div className='sf-width-picker' role='radiogroup' aria-label={ __( 'Width', 'subtleforms' ) }>
      { options.map( ( o ) => {
        const pct = o.value ? Number( o.value ) : 100;
        const active = ( value ?? '' ) === o.value;
        return (
          <button
            key={ o.value || 'auto' }
            type='button'
            role='radio'
            aria-checked={ active }
            disabled={ disabled }
            className={ `sf-width-picker__option${ active ? ' is-active' : '' }` }
            title={ o.value ? optionLabel( o.value, o.label ) : __( 'Follow the form', 'subtleforms' ) }
            onClick={ () => onChange( o.value ) }>
            <span className='sf-width-picker__track' aria-hidden='true'>
              <span className={ `sf-width-picker__fill${ o.value ? '' : ' is-auto' }` } style={ { width: `${ pct }%` } } />
            </span>
            <span className='sf-width-picker__label'>{ FRACTIONS[ o.value ] ?? __( 'Auto', 'subtleforms' ) }</span>
          </button>
        );
      } ) }
    </div>
  );
}

export default function FieldAppearancePanel( { field, onUpdate, formAppearance, isReadOnly = false, hideWidth = false } ) {
  const appearance = field?.config?.appearance || field?.appearance || {};
  const overrideCount = Object.values( appearance ).filter(
    ( v ) => v !== '' && v !== undefined && v !== null && v !== false
  ).length;

  const setValue = ( key, value ) => {
    if ( isReadOnly ) {
      return;
    }
    const next = nextAppearance( appearance, key, value );
    onUpdate( { appearance: next } );
  };

  // What each colour currently resolves to on the form, for the "Form" chips.
  const inherited = {
    colorLabel: resolvedToken( formAppearance, 'colorLabel' ),
    colorText: resolvedToken( formAppearance, 'colorInputText' ),
    colorSurface: resolvedToken( formAppearance, 'colorSurface' ),
    colorBorder: resolvedToken( formAppearance, 'colorBorder' ),
    colorPrimary: resolvedToken( formAppearance, 'colorPrimary' ),
    radius: resolvedToken( formAppearance, 'radius' ),
    borderWidth: resolvedToken( formAppearance, 'borderWidth' ),
  };

  return (
    <div className='sf-field-appearance'>
      { overrideCount > 0 && (
        <div className='sf-field-appearance__status'>
          <span>
            { sprintf(
              /* translators: %d: number of overrides */
              _n( '%d override on this field', '%d overrides on this field', overrideCount, 'subtleforms' ),
              overrideCount
            ) }
          </span>
          { ! isReadOnly && (
            <Button variant='link' size='small' onClick={ () => onUpdate( { appearance: {} } ) }>
              { __( 'Clear', 'subtleforms' ) }
            </Button>
          ) }
        </div>
      ) }

      {(field?.type === 'phone' || field?.type === 'tel') && field?.enableCountryCode && (
        <InspectorSection id='style-phone' title={ __( 'Phone', 'subtleforms' ) }>
          <ToggleControl
            label={ __( 'Show flags', 'subtleforms' ) }
            help={ __( 'Show or hide the flag beside each country in the dial-code list.', 'subtleforms' ) }
            checked={ appearance.showFlags !== false }
            disabled={ isReadOnly }
            onChange={ (on) => onUpdate( { appearance: { ...appearance, showFlags: on } } ) }
          />
        </InspectorSection>
      )}

      <InspectorSection id='style-layout' title={ __( 'Layout', 'subtleforms' ) }>
        { ! hideWidth && (
          <>
            <p className='sf-field-appearance__label'>{ __( 'Width', 'subtleforms' ) }</p>
            <WidthPicker value={ appearance.width } onChange={ ( v ) => setValue( 'width', v ) } disabled={ isReadOnly } />
            <p className='sf-field-appearance__help'>
              { __( 'Narrower fields sit side by side and stack on phones.', 'subtleforms' ) }
            </p>
          </>
        ) }

        <ToggleGroupControl
          __nextHasNoMarginBottom
          __next40pxDefaultSize
          isBlock
          label={ __( 'Alignment', 'subtleforms' ) }
          value={ appearance.align || 'auto' }
          onChange={ ( v ) => setValue( 'align', v === 'auto' ? '' : v ) }>
          <ToggleGroupControlOption value='auto' label={ __( 'Auto', 'subtleforms' ) } />
          { FIELD_LAYOUT.aligns.map( ( a ) => (
            <ToggleGroupControlOptionIcon key={ a.value } value={ a.value } icon={ ALIGN_ICONS[ a.value ] } label={ ALIGN_LABELS[ a.value ] } />
          ) ) }
        </ToggleGroupControl>

        <div className='sf-field-appearance__stack'>
          <ToggleGroupControl
            __nextHasNoMarginBottom
            __next40pxDefaultSize
            isBlock
            label={ __( 'Space above', 'subtleforms' ) }
            value={ appearance.marginTop ?? 'auto' }
            onChange={ ( v ) => setValue( 'marginTop', v === 'auto' ? '' : v ) }>
            <ToggleGroupControlOption value='auto' label={ __( 'Auto', 'subtleforms' ) } />
            { SPACING.map( ( s ) => <ToggleGroupControlOption key={ s.value } value={ s.value } label={ s.label } /> ) }
          </ToggleGroupControl>
          <ToggleGroupControl
            __nextHasNoMarginBottom
            __next40pxDefaultSize
            isBlock
            label={ __( 'Space below', 'subtleforms' ) }
            value={ appearance.marginBottom ?? 'auto' }
            onChange={ ( v ) => setValue( 'marginBottom', v === 'auto' ? '' : v ) }>
            <ToggleGroupControlOption value='auto' label={ __( 'Auto', 'subtleforms' ) } />
            { SPACING.map( ( s ) => <ToggleGroupControlOption key={ s.value } value={ s.value } label={ s.label } /> ) }
          </ToggleGroupControl>
        </div>

        { /* 2.3.2: hiding the label is the Field label visibility setting
             under Label (one setting, also used by the form default). */ }
        <p className='sf-field-appearance__note'>
          { __( 'To hide the label, use Field label visibility under Label.', 'subtleforms' ) }
        </p>
      </InspectorSection>

      <InspectorSection id='style-colours' title={ __( 'Colours', 'subtleforms' ) }>
        <AppearanceControls
          tokens={ FIELD_TOKENS.filter( ( t ) => t.group === 'color' ) }
          values={ appearance }
          placeholders={ inherited }
          onChange={ setValue }
          disabled={ isReadOnly }
          layout='swatches'
          inheritLabel={ __( 'Form', 'subtleforms' ) }
        />
      </InspectorSection>

      <InspectorSection id='style-text-shape' title={ __( 'Text & shape', 'subtleforms' ) }>
        <AppearanceControls
          tokens={ FIELD_TOKENS.filter( ( t ) => t.group === 'type' || t.group === 'shape' ) }
          values={ appearance }
          placeholders={ inherited }
          onChange={ setValue }
          disabled={ isReadOnly }
          inheritLabel={ __( 'Form', 'subtleforms' ) }
        />
      </InspectorSection>
    </div>
  );
}
