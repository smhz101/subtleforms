import { useState } from '@wordpress/element';
import {
  Button,
  Notice,
  PanelBody,
  __experimentalToggleGroupControl as ToggleGroupControl,
  __experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import {
  FORM_TOKENS,
  FORM_VARIANTS,
  FORM_PRESETS,
  FONT_STACKS,
  getPreset,
  isPresetModified,
  resolvedToken,
} from '../../../../shared/appearance';
import AppearanceControls from './AppearanceControls';
import { PRESET_LABELS, VARIANT_LABELS, FONT_LABELS, optionLabel } from './labels';
import './FormAppearancePanel.scss';

/**
 * Form-wide appearance.
 *
 * Two modes over one `metadata.appearance` object:
 *  - Presets: complete looks, each drawn as a small live mock-up so the choice
 *    is visual rather than a list of names.
 *  - Custom: every token and variant, grouped the way people think about a
 *    form (colours, text, fields, buttons, layout), starting from whichever
 *    preset is applied.
 */

const CUSTOM_GROUPS = [
  {
    id: 'colours',
    title: __( 'Colours', 'subtleforms' ),
    keys: [ 'colorPrimary', 'colorPrimaryHover', 'colorBackground', 'colorSurface', 'colorText', 'colorLabel', 'colorInputText', 'colorTextLight', 'colorBorder', 'colorFocus', 'colorError' ],
  },
  {
    id: 'text',
    title: __( 'Typography', 'subtleforms' ),
    keys: [ 'fontFamily', 'fontSize', 'labelWeight', 'lineHeight' ],
  },
  {
    id: 'fields',
    title: __( 'Fields', 'subtleforms' ),
    variants: [ 'input' ],
    keys: [ 'radius', 'borderWidth', 'inputPaddingY' ],
  },
  {
    id: 'buttons',
    title: __( 'Buttons', 'subtleforms' ),
    variants: [ 'button', 'buttonAlign' ],
    keys: [ 'buttonRadius', 'colorButtonText' ],
  },
  {
    id: 'layout',
    title: __( 'Layout', 'subtleforms' ),
    variants: [ 'width' ],
    keys: [ 'fieldGap' ],
  },
];

const TOKEN_BY_KEY = Object.fromEntries( FORM_TOKENS.map( ( t ) => [ t.key, t ] ) );
const VARIANT_BY_KEY = Object.fromEntries( FORM_VARIANTS.map( ( v ) => [ v.key, v ] ) );

/**
 * A miniature form drawn with a preset's values.
 */
function PresetMock( { preset } ) {
  const a = { tokens: preset.tokens };
  const v = preset.variants || {};
  const input = v.input || 'outlined';
  const radius = resolvedToken( a, 'radius' );
  const border = resolvedToken( a, 'colorBorder' );
  const surface = resolvedToken( a, 'colorSurface' );
  const bg = resolvedToken( a, 'colorBackground' );
  const primary = resolvedToken( a, 'colorPrimary' );
  const label = resolvedToken( a, 'colorLabel' );
  const borderWidth = resolvedToken( a, 'borderWidth' ) || '1px';

  const inputStyle = {
    borderRadius: input === 'underlined' ? 0 : radius,
    borderColor: input === 'filled' ? 'transparent' : border,
    borderWidth: input === 'underlined' ? `0 0 ${ borderWidth } 0` : borderWidth,
    background: input === 'underlined' ? 'transparent' : surface,
  };
  const solid = ( v.button || 'solid' ) === 'solid';

  return (
    <span
      className='sf-preset-mock'
      style={ { background: bg, fontFamily: preset.tokens.fontFamily || undefined } }
      aria-hidden='true'>
      <span className='sf-preset-mock__label' style={ { background: label } } />
      <span className='sf-preset-mock__input' style={ inputStyle } />
      <span className='sf-preset-mock__label sf-preset-mock__label--short' style={ { background: label } } />
      <span className='sf-preset-mock__input' style={ inputStyle } />
      <span
        className={ `sf-preset-mock__button sf-preset-mock__button--${ v.buttonAlign || 'left' }` }
        style={ {
          background: solid ? primary : 'transparent',
          borderColor: primary,
          borderRadius: resolvedToken( a, 'buttonRadius' ),
        } }
      />
    </span>
  );
}

function PresetTile( { preset, isActive, isModified, onApply, disabled } ) {
  const meta = PRESET_LABELS[ preset.id ] || {};
  return (
    <button
      type='button'
      className={ `sf-preset-tile${ isActive ? ' is-active' : '' }` }
      onClick={ onApply }
      disabled={ disabled }
      aria-pressed={ isActive }
      title={ meta.description || preset.description }>
      <PresetMock preset={ preset } />
      <span className='sf-preset-tile__name'>
        { meta.label || preset.label }
        { isActive && isModified && (
          <span className='sf-preset-tile__badge'>{ __( 'edited', 'subtleforms' ) }</span>
        ) }
      </span>
    </button>
  );
}

export default function FormAppearancePanel( { schema, onChange, isReadOnly = false } ) {
  const metadata = schema?.metadata || {};
  const appearance = metadata.appearance || {};
  const tokens = appearance.tokens || {};
  const variants = appearance.variants || {};
  const modified = isPresetModified( appearance );
  const hasCustomisation = Object.values( tokens ).some( ( v ) => v );

  const [ mode, setMode ] = useState( modified ? 'custom' : 'presets' );
  const [ confirmingPreset, setConfirmingPreset ] = useState( null );

  const writeAppearance = ( next ) => {
    if ( ! isReadOnly ) {
      onChange( { ...schema, metadata: { ...metadata, appearance: next } } );
    }
  };

  const setToken = ( key, value ) => {
    const nextTokens = { ...tokens };
    if ( value === '' || value === undefined || value === null ) {
      delete nextTokens[ key ];
    } else {
      nextTokens[ key ] = value;
    }
    writeAppearance( { preset: appearance.preset || 'default', ...appearance, tokens: nextTokens } );
  };

  const setVariant = ( key, value ) => {
    const nextVariants = { ...variants };
    if ( ! value ) {
      delete nextVariants[ key ];
    } else {
      nextVariants[ key ] = value;
    }
    writeAppearance( { preset: appearance.preset || 'default', ...appearance, variants: nextVariants } );
  };

  const applyPreset = ( preset ) => {
    writeAppearance( { preset: preset.id, tokens: { ...preset.tokens }, variants: { ...preset.variants } } );
    setConfirmingPreset( null );
  };

  const handlePresetClick = ( preset ) => {
    if ( preset.id === appearance.preset && ! modified ) {
      return;
    }
    if ( hasCustomisation && modified ) {
      setConfirmingPreset( preset );
      return;
    }
    applyPreset( preset );
  };

  const fontOptions = FONT_STACKS.map( ( f ) => ( {
    value: f.value,
    label: FONT_LABELS[ f.value ] || f.label,
  } ) );

  const activePreset = getPreset( appearance.preset ) || getPreset( 'default' );
  const activeLabel = PRESET_LABELS[ activePreset.id ]?.label || activePreset.label;

  return (
    <div className='sf-form-appearance'>
      <ToggleGroupControl
        __nextHasNoMarginBottom
        __next40pxDefaultSize
        isBlock
        hideLabelFromVision
        label={ __( 'Styling mode', 'subtleforms' ) }
        value={ mode }
        onChange={ ( next ) => setMode( next ) }>
        <ToggleGroupControlOption value='presets' label={ __( 'Presets', 'subtleforms' ) } />
        <ToggleGroupControlOption value='custom' label={ __( 'Custom', 'subtleforms' ) } />
      </ToggleGroupControl>

      { mode === 'presets' && (
        <div className='sf-form-appearance__presets'>
          { confirmingPreset && (
            <Notice status='warning' isDismissible={ false } className='sf-form-appearance__confirm'>
              <p>
                { sprintf(
                  /* translators: %s: name of the style preset being applied */
                  __( 'Applying “%s” replaces the custom styling on this form.', 'subtleforms' ),
                  PRESET_LABELS[ confirmingPreset.id ]?.label || confirmingPreset.label
                ) }
              </p>
              <div className='sf-form-appearance__confirm-actions'>
                <Button variant='primary' size='small' onClick={ () => applyPreset( confirmingPreset ) }>
                  { __( 'Apply preset', 'subtleforms' ) }
                </Button>
                <Button variant='tertiary' size='small' onClick={ () => setConfirmingPreset( null ) }>
                  { __( 'Keep mine', 'subtleforms' ) }
                </Button>
              </div>
            </Notice>
          ) }

          <div className='sf-preset-gallery'>
            { FORM_PRESETS.map( ( preset ) => (
              <PresetTile
                key={ preset.id }
                preset={ preset }
                isActive={ ( appearance.preset || 'default' ) === preset.id }
                isModified={ modified }
                disabled={ isReadOnly }
                onApply={ () => handlePresetClick( preset ) }
              />
            ) ) }
          </div>

          <button type='button' className='sf-form-appearance__to-custom' onClick={ () => setMode( 'custom' ) }>
            <span>
              <strong>{ __( 'Make it yours', 'subtleforms' ) }</strong>
              { sprintf(
                /* translators: %s: preset name */
                __( 'Fine-tune colours, type, fields and buttons, starting from %s.', 'subtleforms' ),
                activeLabel
              ) }
            </span>
            <span aria-hidden='true'>→</span>
          </button>
        </div>
      ) }

      { mode === 'custom' && (
        <div className='sf-form-appearance__custom'>
          <p className='sf-form-appearance__base'>
            { sprintf(
              /* translators: %s: preset name */
              __( 'Starting from %s.', 'subtleforms' ),
              activeLabel
            ) }{ ' ' }
            { modified && <span className='sf-preset-tile__badge'>{ __( 'edited', 'subtleforms' ) }</span> }
          </p>

          { CUSTOM_GROUPS.map( ( group, index ) => (
            <PanelBody key={ group.id } title={ group.title } initialOpen={ index === 0 } className='sf-form-appearance__panel'>
              { ( group.variants || [] ).map( ( key ) => {
                const variant = VARIANT_BY_KEY[ key ];
                return (
                  <ToggleGroupControl
                    key={ key }
                    __nextHasNoMarginBottom
                    __next40pxDefaultSize
                    isBlock
                    label={ VARIANT_LABELS[ key ] || variant.label }
                    value={ variants[ key ] ?? activePreset.variants?.[ key ] ?? '' }
                    onChange={ ( next ) => setVariant( key, next ) }
                    className='sf-form-appearance__variant'>
                    { variant.options.map( ( o ) => (
                      <ToggleGroupControlOption key={ o.value } value={ o.value } label={ optionLabel( o.value, o.label ) } />
                    ) ) }
                  </ToggleGroupControl>
                );
              } ) }
              <AppearanceControls
                tokens={ group.keys.map( ( k ) => TOKEN_BY_KEY[ k ] ).filter( Boolean ) }
                values={ tokens }
                placeholders={ Object.fromEntries( group.keys.map( ( k ) => [ k, resolvedToken( appearance, k ) ] ) ) }
                onChange={ setToken }
                disabled={ isReadOnly }
                fontOptions={ fontOptions }
                layout={ group.id === 'colours' ? 'swatches' : 'stack' }
              />
            </PanelBody>
          ) ) }

          { ! isReadOnly && (
            <div className='sf-form-appearance__footer'>
              <Button variant='tertiary' onClick={ () => applyPreset( activePreset ) } disabled={ ! modified }>
                { sprintf(
                  /* translators: %s: preset name */
                  __( 'Revert to %s', 'subtleforms' ),
                  activeLabel
                ) }
              </Button>
              <Button variant='tertiary' isDestructive onClick={ () => applyPreset( getPreset( 'default' ) ) }>
                { __( 'Reset all', 'subtleforms' ) }
              </Button>
            </div>
          ) }
        </div>
      ) }
    </div>
  );
}
