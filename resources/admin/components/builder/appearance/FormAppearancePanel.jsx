import { useState } from '@wordpress/element';
import {
  Button,
  Notice,
  PanelBody,
  TextareaControl,
  ToggleControl,
  __experimentalToggleGroupControl as ToggleGroupControl,
  __experimentalToggleGroupControlOption as ToggleGroupControlOption,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import {
  FORM_VARIANTS,
  FORM_PRESETS,
  getPreset,
  isPresetModified,
  isPureTheme,
  resolvedToken,
} from '../../../../shared/appearance';
import { PRESET_LABELS, VARIANT_LABELS, optionLabel } from './labels';
import { useThemeStyles } from '../../../data/themeStyles';
import { GROUPS, DENSITIES } from './tokenDefs';
import { ControlRow, StyleField } from './StyleFields';
import { contrastIssues, inheritedValue } from './themeColors';
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

const VARIANT_BY_KEY = Object.fromEntries( FORM_VARIANTS.map( ( v ) => [ v.key, v ] ) );

const DENSITY_KEYS = Object.keys( DENSITIES.compact );

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
      className={ `sf-preset-mock${ preset.id === 'theme' ? ' sf-preset-mock--theme' : '' }` }
      style={ { background: bg === 'transparent' && preset.backdrop ? preset.backdrop : bg, fontFamily: preset.tokens.fontFamily || undefined } }
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

export default function FormAppearancePanel( {
  schema,
  onChange,
  isReadOnly = false,
  formId = null,
  canCustomCss = !! window.subtleformsAdmin?.canCustomCss,
} ) {
  const theme = useThemeStyles();
  const metadata = schema?.metadata || {};
  const appearance = metadata.appearance || {};
  const tokens = appearance.tokens || {};
  const variants = appearance.variants || {};
  const modified = isPresetModified( appearance );
  const hasCustomisation = Object.values( tokens ).some( ( v ) => v );

  const [ mode, setMode ] = useState( modified ? 'custom' : 'presets' );
  const [ confirmingPreset, setConfirmingPreset ] = useState( null );
  const [ showAdvanced, setShowAdvanced ] = useState( false );
  const [ confirmingReset, setConfirmingReset ] = useState( false );
  const [ lastAlign, setLastAlign ] = useState( 'left' );

  const writeAppearance = ( next ) => {
    if ( ! isReadOnly ) {
      onChange( { ...schema, metadata: { ...metadata, appearance: next } } );
    }
  };

  // Change several tokens in one step, so the preview and Undo see one change.
  const setTokens = ( patch ) => {
    const nextTokens = { ...tokens };
    Object.entries( patch ).forEach( ( [ key, value ] ) => {
      if ( value === '' || value === undefined || value === null ) {
        delete nextTokens[ key ];
      } else {
        nextTokens[ key ] = value;
      }
    } );
    writeAppearance( { preset: appearance.preset || 'default', ...appearance, tokens: nextTokens } );
  };
  const setToken = ( key, value ) => setTokens( { [ key ]: value } );

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
    // The form's own CSS is not part of a preset, so it stays.
    writeAppearance( {
      preset: preset.id,
      tokens: { ...preset.tokens },
      variants: { ...preset.variants },
      ...( appearance.customCss ? { customCss: appearance.customCss } : {} ),
    } );
    setConfirmingPreset( null );
  };

  // Back to the theme, everything (2.7.2). The form's own CSS goes too, unless
  // this person may not change it.
  const resetAllToTheme = () => {
    const base = getPreset( 'theme' );
    writeAppearance( {
      preset: base.id,
      tokens: { ...base.tokens },
      variants: { ...base.variants },
      ...( ! canCustomCss && appearance.customCss ? { customCss: appearance.customCss } : {} ),
    } );
    setConfirmingReset( false );
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

  const activePreset = getPreset( appearance.preset ) || getPreset( 'default' );
  const activeLabel = PRESET_LABELS[ activePreset.id ]?.label || activePreset.label;
  const isTheme = appearance.preset === 'theme';
  const resetWord = isTheme ? 'theme' : activePreset.id === 'default' ? 'default' : 'preset';
  const inheritLabel = isTheme ? __( 'Theme', 'subtleforms' ) : __( 'Default', 'subtleforms' );
  const issues = contrastIssues( appearance, theme );

  // What a token is before the owner changes it: the preset's value.
  const baseline = ( key ) => activePreset.tokens?.[ key ] ?? '';
  const readValue = ( def ) => {
    const own = tokens[ def.key ] ?? ( def.legacyKey ? tokens[ def.legacyKey ] : undefined ) ?? '';
    // A theme form's "inherit" font is the theme's font: shown as not set.
    return isTheme && own === baseline( def.key ) && def.type === 'font' ? '' : own;
  };
  const isChanged = ( def ) => {
    const own = tokens[ def.key ] ?? ( def.legacyKey ? tokens[ def.legacyKey ] : undefined ) ?? '';
    return own !== '' && own !== baseline( def.key );
  };
  const resetControl = ( def ) => {
    const patch = { [ def.key ]: baseline( def.key ) };
    if ( def.legacyKey ) {
      patch[ def.legacyKey ] = '';
    }
    setTokens( patch );
  };

  const densityNow = Object.keys( DENSITIES ).find( ( name ) =>
    DENSITY_KEYS.every( ( k ) => tokens[ k ] === DENSITIES[ name ][ k ] )
  ) || '';
  const setDensity = ( name ) => {
    const patch = {};
    DENSITY_KEYS.forEach( ( k ) => {
      patch[ k ] = name ? DENSITIES[ name ][ k ] : baseline( k );
    } );
    setTokens( patch );
  };

  const buttonAlign = variants.buttonAlign ?? activePreset.variants?.buttonAlign ?? 'left';
  const buttonWidth = buttonAlign === 'full' ? 'full' : 'auto';
  const noFontsNote = theme && ! theme.isBlockTheme && ! ( theme.fontFamilies || [] ).length;

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
          { isTheme && (
            <p className='components-base-control__help sf-form-appearance__theme-note'>
              { isPureTheme( appearance )
                ? __( 'Your theme styles this form. Changing colours, type, or the field and button style below switches to SubtleForms styling that starts from your theme.', 'subtleforms' )
                : __( 'SubtleForms styles this form, starting from your theme. Revert to let your theme style it again.', 'subtleforms' ) }
            </p>
          ) }
          { ! isReadOnly && (
            <Button
              variant='secondary'
              className='sf-form-appearance__inherit'
              disabled={ isTheme && ! modified }
              onClick={ () => applyPreset( getPreset( 'theme' ) ) }>
              { __( 'Inherit from theme', 'subtleforms' ) }
            </Button>
          ) }

          <ToggleControl
            __nextHasNoMarginBottom
            className='sf-form-appearance__advanced-toggle'
            label={ __( 'Show advanced', 'subtleforms' ) }
            checked={ showAdvanced }
            onChange={ setShowAdvanced }
          />

          { GROUPS.map( ( group, index ) => (
            <PanelBody key={ group.id } title={ group.title } initialOpen={ index === 0 } className={ `sf-form-appearance__panel sf-form-appearance__panel--${ group.id }` }>
              { group.id === 'typography' && noFontsNote && (
                <p className='components-base-control__help sf-form-appearance__fonts-note'>
                  { __( 'Your theme does not share its fonts with WordPress; the preview uses your site\'s stylesheet.', 'subtleforms' ) }
                </p>
              ) }
              { group.density && (
                <ToggleGroupControl
                  __nextHasNoMarginBottom
                  __next40pxDefaultSize
                  isBlock
                  isDeselectable
                  label={ __( 'Spacing', 'subtleforms' ) }
                  value={ densityNow || undefined }
                  onChange={ ( next ) => setDensity( next || '' ) }
                  disabled={ isReadOnly }
                  className='sf-form-appearance__variant sf-form-appearance__density'>
                  <ToggleGroupControlOption value='compact' label={ __( 'Compact', 'subtleforms' ) } />
                  <ToggleGroupControlOption value='comfortable' label={ __( 'Comfortable', 'subtleforms' ) } />
                </ToggleGroupControl>
              ) }
              { ( group.variants || [] ).filter( ( key ) => showAdvanced || key === 'input' || key === 'button' ).map( ( key ) => {
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
                    disabled={ isReadOnly }
                    className='sf-form-appearance__variant'>
                    { variant.options.map( ( o ) => (
                      <ToggleGroupControlOption key={ o.value } value={ o.value } label={ optionLabel( o.value, o.label ) } />
                    ) ) }
                  </ToggleGroupControl>
                );
              } ) }
              { group.buttonPlacement && (
                <>
                  <ToggleGroupControl
                    __nextHasNoMarginBottom
                    __next40pxDefaultSize
                    isBlock
                    label={ __( 'Button width', 'subtleforms' ) }
                    value={ buttonWidth }
                    onChange={ ( next ) => {
                      if ( next === 'full' ) {
                        if ( buttonAlign !== 'full' ) {
                          setLastAlign( buttonAlign );
                        }
                        setVariant( 'buttonAlign', 'full' );
                      } else {
                        setVariant( 'buttonAlign', lastAlign );
                      }
                    } }
                    disabled={ isReadOnly }
                    className='sf-form-appearance__variant sf-form-appearance__button-width'>
                    <ToggleGroupControlOption value='auto' label={ __( 'Auto', 'subtleforms' ) } />
                    <ToggleGroupControlOption value='full' label={ __( 'Full width', 'subtleforms' ) } />
                  </ToggleGroupControl>
                  <ToggleGroupControl
                    __nextHasNoMarginBottom
                    __next40pxDefaultSize
                    isBlock
                    label={ __( 'Button alignment', 'subtleforms' ) }
                    value={ buttonWidth === 'full' ? undefined : buttonAlign }
                    onChange={ ( next ) => {
                      setLastAlign( next );
                      setVariant( 'buttonAlign', next );
                    } }
                    disabled={ isReadOnly || buttonWidth === 'full' }
                    className='sf-form-appearance__variant sf-form-appearance__button-align'>
                    <ToggleGroupControlOption value='left' label={ __( 'Left', 'subtleforms' ) } />
                    <ToggleGroupControlOption value='center' label={ __( 'Centre', 'subtleforms' ) } />
                    <ToggleGroupControlOption value='right' label={ __( 'Right', 'subtleforms' ) } />
                  </ToggleGroupControl>
                </>
              ) }
              <div className={ `sf-appearance-group sf-appearance-group--${ group.id === 'colours' ? 'swatches' : 'stack' }` }>
                <div className='sf-appearance-group__controls'>
                  { group.controls.filter( ( def ) => showAdvanced || ! def.advanced ).map( ( def ) => (
                    <ControlRow
                      key={ def.key }
                      label={ def.label }
                      isSet={ isChanged( def ) }
                      resetWord={ resetWord }
                      disabled={ isReadOnly }
                      onReset={ () => resetControl( def ) }>
                      <StyleField
                        def={ def }
                        value={ readValue( def ) }
                        inherited={ def.type === 'color' || def.type === 'font' ? inheritedValue( def.key, appearance, theme ) || resolvedToken( appearance, def.key ) : '' }
                        onChange={ ( next ) => setToken( def.key, next ) }
                        theme={ theme }
                        inheritLabel={ def.key === 'labelFont' || def.key === 'inputFont' ? __( 'Same as form font', 'subtleforms' ) : inheritLabel }
                        disabled={ isReadOnly }
                      />
                    </ControlRow>
                  ) ) }
                </div>
              </div>
              { group.id === 'colours' && issues.map( ( issue ) => (
                <p key={ issue.id } className='sf-form-appearance__contrast' role='status'>
                  { sprintf(
                    /* translators: 1: which colours, 2: contrast ratio such as 3.2 */
                    __( '%1$s have a contrast of %2$s:1. Aim for at least 4.5:1 so everyone can read them.', 'subtleforms' ),
                    issue.id === 'label'
                      ? __( 'The label and the form background', 'subtleforms' )
                      : issue.id === 'input'
                        ? __( 'The input text and the input background', 'subtleforms' )
                        : __( 'The button text and the button background', 'subtleforms' ),
                    issue.ratio.toFixed( 1 )
                  ) }
                </p>
              ) ) }
            </PanelBody>
          ) ) }

          { showAdvanced && (
            <PanelBody title={ __( 'Advanced', 'subtleforms' ) } initialOpen className='sf-form-appearance__panel sf-form-appearance__panel--advanced'>
              { canCustomCss ? (
                <TextareaControl
                  __nextHasNoMarginBottom
                  className='sf-form-appearance__css'
                  label={ __( 'Custom CSS', 'subtleforms' ) }
                  help={ sprintf(
                    /* translators: %s: the CSS class of this form, such as subtleforms-form-12 */
                    __( 'Applies to this form only. Every rule starts with .%s automatically. Shown in the preview.', 'subtleforms' ),
                    `subtleforms-form-${ Number( formId ) || 0 }`
                  ) }
                  value={ appearance.customCss || '' }
                  rows={ 8 }
                  maxLength={ 20000 }
                  spellCheck={ false }
                  disabled={ isReadOnly }
                  onChange={ ( css ) => {
                    const next = { preset: appearance.preset || 'default', ...appearance };
                    if ( css ) {
                      next.customCss = css;
                    } else {
                      delete next.customCss;
                    }
                    writeAppearance( next );
                  } }
                />
              ) : (
                <p className='components-base-control__help sf-form-appearance__css-note'>
                  { __( 'Custom CSS is available to people who can post unfiltered HTML, usually administrators.', 'subtleforms' ) }
                </p>
              ) }
            </PanelBody>
          ) }

          { ! isReadOnly && (
            <div className='sf-form-appearance__footer'>
              <Button variant='tertiary' onClick={ () => applyPreset( activePreset ) } disabled={ ! modified }>
                { sprintf(
                  /* translators: %s: preset name */
                  __( 'Revert to %s', 'subtleforms' ),
                  activeLabel
                ) }
              </Button>
              <Button variant='tertiary' isDestructive onClick={ () => setConfirmingReset( true ) }>
                { __( 'Reset all to theme', 'subtleforms' ) }
              </Button>
            </div>
          ) }
          { confirmingReset && (
            <Notice status='warning' isDismissible={ false } className='sf-form-appearance__confirm'>
              <p>
                { __( 'This puts every colour, font, size and shape on this form back to your theme. It cannot be undone after you save.', 'subtleforms' ) }
              </p>
              <div className='sf-form-appearance__confirm-actions'>
                <Button variant='primary' isDestructive size='small' onClick={ resetAllToTheme }>
                  { __( 'Reset all to theme', 'subtleforms' ) }
                </Button>
                <Button variant='tertiary' size='small' onClick={ () => setConfirmingReset( false ) }>
                  { __( 'Keep my styling', 'subtleforms' ) }
                </Button>
              </div>
            </Notice>
          ) }
        </div>
      ) }
    </div>
  );
}
