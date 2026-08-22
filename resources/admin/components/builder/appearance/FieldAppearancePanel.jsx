import { Button, SelectControl, ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import {
  FIELD_TOKENS,
  FIELD_LAYOUT,
} from '../../../../shared/appearance';
import AppearanceControls from './AppearanceControls';
import { optionLabel } from './labels';
import './FieldAppearancePanel.scss';

/**
 * Per-field style overrides.
 *
 * Every control here is an override: leaving one unset means the field takes
 * the form's value. That is why nothing has a default — an empty control is
 * information, not an omission, and clearing one returns the field to the form.
 *
 * Values are written to `field.config.appearance`, which the renderer turns
 * into custom properties on the field wrapper. Because they are the same
 * property names the form sets, the field's contents inherit the override with
 * no field-specific CSS.
 */

const GROUPS = [
  { id: 'color', title: __( 'Colour', 'subtleforms' ) },
  { id: 'type', title: __( 'Typography', 'subtleforms' ) },
  { id: 'shape', title: __( 'Shape', 'subtleforms' ) },
];

const SPACING = [
  { label: __( 'None', 'subtleforms' ), value: '0' },
  { label: __( 'Small', 'subtleforms' ), value: '8px' },
  { label: __( 'Medium', 'subtleforms' ), value: '16px' },
  { label: __( 'Large', 'subtleforms' ), value: '32px' },
];

export default function FieldAppearancePanel( {
  field,
  onUpdate,
  isReadOnly = false,
} ) {
  const appearance = field?.config?.appearance || field?.appearance || {};

  const hasOverrides = Object.values( appearance ).some(
    ( v ) => v !== '' && v !== undefined && v !== null && v !== false
  );

  const setValue = ( key, value ) => {
    if ( isReadOnly ) {
      return;
    }

    const next = { ...appearance };

    // Unset rather than store an empty value: absence is what makes the field
    // fall back to the form, and an empty string would emit a broken property.
    if ( value === '' || value === undefined || value === null || value === false ) {
      delete next[ key ];
    } else {
      next[ key ] = value;
    }

    onUpdate( { appearance: next } );
  };

  const clearAll = () => {
    if ( ! isReadOnly ) {
      onUpdate( { appearance: {} } );
    }
  };

  return (
    <div className='sf-field-appearance'>
      <p className='sf-field-appearance__intro'>
        { __(
          'Anything left unset follows the form’s appearance.',
          'subtleforms'
        ) }
      </p>

      <section className='sf-field-appearance__section'>
        <h4 className='sf-field-appearance__title'>
          { __( 'Layout', 'subtleforms' ) }
        </h4>

        <div className='sf-appearance-group__controls'>
          <div className='sf-appearance-control'>
            <SelectControl
              label={ __( 'Width', 'subtleforms' ) }
              value={ appearance.width ?? '' }
              options={ [
                { label: __( 'Follow form', 'subtleforms' ), value: '' },
                ...FIELD_LAYOUT.widths.map( ( w ) => ( {
                  value: w.value,
                  label: optionLabel( w.value, w.label ),
                } ) ),
              ] }
              help={ __(
                'Fields narrower than full width sit side by side, and go full width on small screens.',
                'subtleforms'
              ) }
              disabled={ isReadOnly }
              onChange={ ( v ) => setValue( 'width', v ) }
              __next40pxDefaultSize
              __nextHasNoMarginBottom
            />
          </div>

          <div className='sf-appearance-control'>
            <SelectControl
              label={ __( 'Alignment', 'subtleforms' ) }
              value={ appearance.align ?? '' }
              options={ [
                { label: __( 'Follow form', 'subtleforms' ), value: '' },
                ...FIELD_LAYOUT.aligns.map( ( a ) => ( {
                  value: a.value,
                  label: optionLabel( a.value, a.label ),
                } ) ),
              ] }
              disabled={ isReadOnly }
              onChange={ ( v ) => setValue( 'align', v ) }
              __next40pxDefaultSize
              __nextHasNoMarginBottom
            />
          </div>

          <div className='sf-appearance-control'>
            <SelectControl
              label={ __( 'Space above', 'subtleforms' ) }
              value={ appearance.marginTop ?? '' }
              options={ [
                { label: __( 'Follow form', 'subtleforms' ), value: '' },
                ...SPACING,
              ] }
              disabled={ isReadOnly }
              onChange={ ( v ) => setValue( 'marginTop', v ) }
              __next40pxDefaultSize
              __nextHasNoMarginBottom
            />
          </div>

          <div className='sf-appearance-control'>
            <SelectControl
              label={ __( 'Space below', 'subtleforms' ) }
              value={ appearance.marginBottom ?? '' }
              options={ [
                { label: __( 'Follow form', 'subtleforms' ), value: '' },
                ...SPACING,
              ] }
              disabled={ isReadOnly }
              onChange={ ( v ) => setValue( 'marginBottom', v ) }
              __next40pxDefaultSize
              __nextHasNoMarginBottom
            />
          </div>
        </div>

        <div className='sf-appearance-control'>
          <ToggleControl
            label={ __( 'Hide label', 'subtleforms' ) }
            help={ __(
              'The label stays available to screen readers, so the field keeps its name.',
              'subtleforms'
            ) }
            checked={ !! appearance.hideLabel }
            disabled={ isReadOnly }
            onChange={ ( v ) => setValue( 'hideLabel', v ) }
            __nextHasNoMarginBottom
          />
        </div>
      </section>

      { GROUPS.map( ( group ) => {
        const tokens = FIELD_TOKENS.filter( ( t ) => t.group === group.id );

        if ( tokens.length === 0 ) {
          return null;
        }

        return (
          <section className='sf-field-appearance__section' key={ group.id }>
            <AppearanceControls
              title={ group.title }
              tokens={ tokens }
              values={ appearance }
              onChange={ setValue }
              disabled={ isReadOnly }
            />
          </section>
        );
      } ) }

      { hasOverrides && ! isReadOnly && (
        <div className='sf-field-appearance__footer'>
          <Button variant='tertiary' isDestructive onClick={ clearAll }>
            { __( 'Clear field overrides', 'subtleforms' ) }
          </Button>
        </div>
      ) }
    </div>
  );
}
