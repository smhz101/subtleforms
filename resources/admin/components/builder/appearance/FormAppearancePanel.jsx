import { useState } from '@wordpress/element';
import { Button, SelectControl, Notice, PanelBody } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import {
  FORM_TOKENS,
  FORM_VARIANTS,
  FORM_PRESETS,
  FONT_STACKS,
  getPreset,
  isPresetModified,
} from '../../../../shared/appearance';
import AppearanceControls from './AppearanceControls';
import {
  PRESET_LABELS,
  VARIANT_LABELS,
  FONT_LABELS,
  optionLabel,
} from './labels';
import './FormAppearancePanel.scss';

/**
 * Form-wide appearance.
 *
 * Presets are the fast path — one click restyles the whole form. The controls
 * below are the slow path for anything the presets do not cover. Both write to
 * the same `metadata.appearance`, so a preset is a starting point rather than a
 * mode you have to leave.
 */

const GROUPS = [
  { id: 'color', title: __( 'Colour', 'subtleforms' ) },
  { id: 'type', title: __( 'Typography', 'subtleforms' ) },
  { id: 'shape', title: __( 'Shape & spacing', 'subtleforms' ) },
];

function PresetCard( { preset, isActive, isModified, onApply, disabled } ) {
  const meta = PRESET_LABELS[ preset.id ] || {};
  const label = meta.label || preset.label;

  return (
    <button
      type='button'
      className={ `sf-preset-card${ isActive ? ' is-active' : '' }` }
      onClick={ onApply }
      disabled={ disabled }
      aria-pressed={ isActive }>
      <span className='sf-preset-card__swatches' aria-hidden='true'>
        { preset.swatch.map( ( color ) => (
          <span
            key={ color }
            className='sf-preset-card__swatch'
            style={ { background: color } }
          />
        ) ) }
      </span>
      <span className='sf-preset-card__body'>
        <span className='sf-preset-card__label'>
          { label }
          { isActive && isModified && (
            <span className='sf-preset-card__badge'>
              { __( 'edited', 'subtleforms' ) }
            </span>
          ) }
        </span>
        <span className='sf-preset-card__description'>
          { meta.description || preset.description }
        </span>
      </span>
    </button>
  );
}

export default function FormAppearancePanel( {
  schema,
  onChange,
  isReadOnly = false,
} ) {
  const [ confirmingPreset, setConfirmingPreset ] = useState( null );

  const metadata = schema?.metadata || {};
  const appearance = metadata.appearance || {};
  const tokens = appearance.tokens || {};
  const variants = appearance.variants || {};

  const hasCustomisation = Object.values( tokens ).some( ( v ) => v );
  const modified = isPresetModified( appearance );

  const writeAppearance = ( next ) => {
    if ( isReadOnly ) {
      return;
    }
    onChange( {
      ...schema,
      metadata: { ...metadata, appearance: next },
    } );
  };

  const setToken = ( key, value ) => {
    const nextTokens = { ...tokens };

    // An empty value means "inherit", which is the absence of the key rather
    // than an empty string — otherwise it would emit `--var: ;` and break the
    // declaration.
    if ( value === '' || value === undefined || value === null ) {
      delete nextTokens[ key ];
    } else {
      nextTokens[ key ] = value;
    }

    writeAppearance( { ...appearance, tokens: nextTokens } );
  };

  const setVariant = ( key, value ) => {
    const nextVariants = { ...variants };

    if ( ! value ) {
      delete nextVariants[ key ];
    } else {
      nextVariants[ key ] = value;
    }

    writeAppearance( { ...appearance, variants: nextVariants } );
  };

  const applyPreset = ( preset ) => {
    // Presets replace rather than merge, so switching between them never leaves
    // a value behind from the previous choice.
    writeAppearance( {
      preset: preset.id,
      tokens: { ...preset.tokens },
      variants: { ...preset.variants },
    } );
    setConfirmingPreset( null );
  };

  const handlePresetClick = ( preset ) => {
    if ( preset.id === appearance.preset && ! modified ) {
      return;
    }

    // Applying a preset discards hand-tuned values, so say so first.
    if ( hasCustomisation && modified ) {
      setConfirmingPreset( preset );
      return;
    }

    applyPreset( preset );
  };

  const resetAll = () => {
    writeAppearance( { preset: 'default', tokens: {}, variants: {} } );
  };

  const fontOptions = FONT_STACKS.map( ( f ) => ( {
    value: f.value,
    label: FONT_LABELS[ f.value ] || f.label,
  } ) );

  return (
    <div className='sf-form-appearance'>
      <PanelBody
        title={ __( 'Style presets', 'subtleforms' ) }
        initialOpen={ true }
        className='sf-form-appearance__panel'>
        <p className='sf-form-appearance__section-hint'>
          { __(
            'Restyle the whole form in one click. Adjust anything afterwards.',
            'subtleforms'
          ) }
        </p>

        { confirmingPreset && (
          <Notice
            status='warning'
            isDismissible={ false }
            className='sf-form-appearance__confirm'>
            <p>
              { sprintf(
                /* translators: %s: name of the style preset being applied */
                __(
                  'Applying “%s” will replace the styling you have adjusted on this form.',
                  'subtleforms'
                ),
                PRESET_LABELS[ confirmingPreset.id ]?.label ||
                  confirmingPreset.label
              ) }
            </p>
            <div className='sf-form-appearance__confirm-actions'>
              <Button
                variant='primary'
                size='small'
                onClick={ () => applyPreset( confirmingPreset ) }>
                { __( 'Apply preset', 'subtleforms' ) }
              </Button>
              <Button
                variant='tertiary'
                size='small'
                onClick={ () => setConfirmingPreset( null ) }>
                { __( 'Keep my styling', 'subtleforms' ) }
              </Button>
            </div>
          </Notice>
        ) }

        <div className='sf-preset-grid'>
          { FORM_PRESETS.map( ( preset ) => (
            <PresetCard
              key={ preset.id }
              preset={ preset }
              isActive={ appearance.preset === preset.id }
              isModified={ modified }
              disabled={ isReadOnly }
              onApply={ () => handlePresetClick( preset ) }
            />
          ) ) }
        </div>
      </PanelBody>

      <PanelBody
        title={ __( 'Layout', 'subtleforms' ) }
        initialOpen={ true }
        className='sf-form-appearance__panel'>
        <div className='sf-appearance-group__controls'>
          { FORM_VARIANTS.map( ( variant ) => (
            <div className='sf-appearance-control' key={ variant.key }>
              <SelectControl
                label={ VARIANT_LABELS[ variant.key ] || variant.label }
                value={ variants[ variant.key ] ?? '' }
                options={ [
                  { label: __( 'Default', 'subtleforms' ), value: '' },
                  ...variant.options.map( ( o ) => ( {
                    value: o.value,
                    label: optionLabel( o.value, o.label ),
                  } ) ),
                ] }
                disabled={ isReadOnly }
                onChange={ ( value ) => setVariant( variant.key, value ) }
                __next40pxDefaultSize
                __nextHasNoMarginBottom
              />
            </div>
          ) ) }
        </div>
      </PanelBody>

      { GROUPS.map( ( group ) => (
        <PanelBody
          key={ group.id }
          title={ group.title }
          initialOpen={ false }
          className='sf-form-appearance__panel'>
          <AppearanceControls
            tokens={ FORM_TOKENS.filter( ( t ) => t.group === group.id ) }
            values={ tokens }
            onChange={ setToken }
            disabled={ isReadOnly }
            fontOptions={ fontOptions }
          />
        </PanelBody>
      ) ) }

      { ( hasCustomisation || appearance.preset ) && ! isReadOnly && (
        <div className='sf-form-appearance__footer'>
          <Button variant='tertiary' isDestructive onClick={ resetAll }>
            { __( 'Reset appearance', 'subtleforms' ) }
          </Button>
          <p className='sf-form-appearance__footer-hint'>
            { __(
              'Returns every value to the plugin default. Field-level overrides are kept.',
              'subtleforms'
            ) }
          </p>
        </div>
      ) }
    </div>
  );
}
