import { useId, useRef, useState } from '@wordpress/element';
import { Button, Notice } from '@wordpress/components';
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
import { TokenRow, ChoiceRow } from './StyleRows';
import { contrastIssues, inheritedValue } from './themeColors';
import Icon from '../../../ui/Icon';
import InspectorSection from '../inspector/InspectorSection';
import InspectorTabs, { useStoredTab } from '../inspector/InspectorTabs';
import HelpTip from '../inspector/HelpTip';
import { CheckGlyph, ContrastGlyph, SwatchGlyph } from '../inspector/glyphs';
import '../FieldInspector.scss';
import './FormAppearancePanel.scss';

/**
 * Form-wide appearance, the right panel of the Preview screen.
 *
 * Drawn like the field settings panel (same header, icon tabs, sections and
 * property rows), over one `metadata.appearance` object:
 *  - Presets: ten complete looks as cards, each with a small drawing of the
 *    preset's own tokens, so the choice is visual rather than a list of names.
 *  - Custom: every token and variant, in closed sections (Type, Colours,
 *    Fields, Buttons, Layout), starting from whichever preset is applied.
 */

export const TAB_STORAGE_KEY = 'sf-appearance-tab';
const TAB_IDS = [ 'presets', 'custom' ];

const VARIANT_BY_KEY = Object.fromEntries( FORM_VARIANTS.map( ( v ) => [ v.key, v ] ) );
const DENSITY_KEYS = Object.keys( DENSITIES.compact );
const GROUP = Object.fromEntries( GROUPS.map( ( g ) => [ g.id, g ] ) );

/** The Custom tab's sections, in order, and the token groups each one draws. */
const SECTIONS = [
  { id: 'type', title: __( 'Type', 'subtleforms' ), groups: [ 'typography' ] },
  { id: 'colours', title: __( 'Colours', 'subtleforms' ), groups: [ 'colours', 'choices:color' ] },
  { id: 'fields', title: __( 'Fields', 'subtleforms' ), groups: [ 'fields', 'choices:size' ] },
  { id: 'buttons', title: __( 'Buttons', 'subtleforms' ), groups: [ 'buttons' ] },
  { id: 'layout', title: __( 'Layout', 'subtleforms' ), groups: [ 'layout' ] },
];

/** The controls of a group name; "choices:color" is the colour half of the choices group. */
function controlsOf( name ) {
  const [ id, kind ] = name.split( ':' );
  const controls = GROUP[ id ].controls;
  return kind ? controls.filter( ( c ) => ( kind === 'color' ? c.type === 'color' : c.type !== 'color' ) ) : controls;
}

const ISSUE_CONTROL = { label: 'colorLabel', input: 'colorInputText', button: 'colorButtonText' };

/** The line under a colour whose pair is hard to read. */
function issueText( issue ) {
  const against =
    issue.id === 'label'
      ? __( 'the form background', 'subtleforms' )
      : issue.id === 'input'
        ? __( 'the input background', 'subtleforms' )
        : __( 'the button background', 'subtleforms' );
  return sprintf(
    /* translators: 1: what the colour is read against, 2: contrast ratio such as 3.2 */
    __( 'Contrast with %1$s is %2$s:1. Aim for at least 4.5:1 so everyone can read it.', 'subtleforms' ),
    against,
    issue.ratio.toFixed( 1 )
  );
}

const px = ( value, fallback ) => {
  const n = parseFloat( value );
  return Number.isFinite( n ) ? n : fallback;
};

/**
 * A miniature form drawn with a preset's own tokens and variants: a label, two
 * inputs and a button. The public stylesheet is not loaded in the admin
 * document (its class names would collide with the admin's), so the pieces are
 * painted here, carrying the input and button variant, radius, border width,
 * background, font and label weight of the preset.
 */
export function PresetMock( { preset } ) {
  const a = { tokens: preset.tokens };
  const v = preset.variants || {};
  const input = v.input || 'outlined';
  const button = v.button || 'solid';
  const isTheme = preset.id === 'theme';

  const bg = resolvedToken( a, 'colorBackground' );
  const surface = resolvedToken( a, 'colorSurface' );
  const border = resolvedToken( a, 'colorBorder' );
  const primary = resolvedToken( a, 'colorPrimary' );
  const label = resolvedToken( a, 'colorLabel' );
  const buttonText = resolvedToken( a, 'colorButtonText' );
  const borderWidth = Math.min( px( resolvedToken( a, 'borderWidth' ), 1 ), 3 );
  const radius = Math.min( px( resolvedToken( a, 'radius' ), 8 ), 12 );
  const buttonRadius = Math.min( px( resolvedToken( a, 'buttonRadius' ), 4 ), 999 );
  const padY = px( resolvedToken( a, 'inputPaddingY' ), 10 );
  const gap = Math.max( 3, Math.min( 5, Math.round( px( resolvedToken( a, 'fieldGap' ), 16 ) / 4 ) ) );
  const inputHeight = Math.min( 18, Math.round( 6 + padY ) );

  const inputStyle = {
    height: inputHeight,
    borderRadius: input === 'underlined' ? 0 : radius,
    background: input === 'underlined' ? 'transparent' : surface,
    borderStyle: 'solid',
    borderColor: border,
    borderWidth: input === 'underlined' ? `0 0 ${ borderWidth || 1 }px 0` : borderWidth,
  };
  const buttonStyle = {
    borderRadius: button === 'ghost' ? 0 : buttonRadius,
    background: button === 'solid' ? primary : 'transparent',
    borderStyle: 'solid',
    borderWidth: button === 'ghost' ? '0 0 1px 0' : 2,
    borderColor: primary,
    color: buttonText,
  };

  return (
    <span
      className={ `sf-pmock${ isTheme ? ' sf-pmock--theme' : '' }` }
      style={ {
        '--sf-pmock-gap': `${ gap }px`,
        background: bg === 'transparent' ? '#ffffff' : bg,
        fontFamily: preset.tokens.fontFamily && preset.tokens.fontFamily !== 'inherit' ? preset.tokens.fontFamily : undefined,
      } }
      aria-hidden='true'>
      <span className='sf-pmock__label' style={ { color: label, fontWeight: resolvedToken( a, 'labelWeight' ) || 500, fontSize: preset.tokens.labelSize ? 14 : 12 } }>
        { __( 'Full name', 'subtleforms' ) }
      </span>
      <span className='sf-pmock__input' style={ inputStyle } />
      <span className='sf-pmock__input' style={ inputStyle } />
      <span className='sf-pmock__button' style={ buttonStyle } />
    </span>
  );
}

/**
 * One preset: a real radio input over a card. The help button sits outside the
 * label so pressing it never selects the card.
 */
function PresetCard( { preset, name, isActive, isModified, onApply, disabled } ) {
  const meta = PRESET_LABELS[ preset.id ] || {};
  const label = meta.label || preset.label;
  return (
    <div className={ `sf-pcard${ isActive ? ' is-active' : '' }` }>
      <label className='sf-pcard__label'>
        <input
          type='radio'
          className='sf-pcard__input'
          name={ name }
          value={ preset.id }
          checked={ isActive }
          disabled={ disabled }
          onChange={ onApply }
        />
        <span className='sf-pcard__face'>
          <PresetMock preset={ preset } />
          <span className='sf-pcard__check' aria-hidden='true'>
            <CheckGlyph size={ 12 } />
          </span>
        </span>
        <span className='sf-pcard__name'>
          { label }
          { isActive && isModified && <span className='sf-pcard__edited'>{ __( 'edited', 'subtleforms' ) }</span> }
        </span>
      </label>
      <span className='sf-pcard__help'>
        <HelpTip label={ label } help={ meta.description || preset.description } />
      </span>
    </div>
  );
}

export default function FormAppearancePanel( {
  schema,
  onChange,
  isReadOnly = false,
  formId = null,
} ) {
  const theme = useThemeStyles();
  const metadata = schema?.metadata || {};
  const appearance = metadata.appearance || {};
  const tokens = appearance.tokens || {};
  const variants = appearance.variants || {};
  const modified = isPresetModified( appearance );
  const hasCustomisation = Object.values( tokens ).some( ( v ) => v );

  const [ tab, setTab ] = useStoredTab( TAB_STORAGE_KEY, TAB_IDS );
  const tabBase = `sf-atab-${ useId().replace( /:/g, '' ) }`;
  const radioName = `sf-preset-${ useId().replace( /:/g, '' ) }`;
  const gridRef = useRef( null );
  // A confirmation that waits for an answer: { kind: 'preset', preset } or { kind: 'reset' }.
  const [ confirming, setConfirming ] = useState( null );
  const [ more, setMore ] = useState( {} );
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
    // Form width is a separate control; presets never set it.
    const { width: _presetWidth, ...presetVariants } = preset.variants || {};
    writeAppearance( {
      preset: preset.id,
      tokens: { ...preset.tokens },
      variants: { ...presetVariants },
    } );
    setConfirming( null );
  };

  const activePreset = getPreset( appearance.preset ) || getPreset( 'default' );
  const activeLabel = PRESET_LABELS[ activePreset.id ]?.label || activePreset.label;
  const isTheme = appearance.preset === 'theme';
  const resetWord = isTheme ? 'theme' : activePreset.id === 'default' ? 'default' : 'preset';
  const inheritLabel = isTheme ? __( 'Theme', 'subtleforms' ) : __( 'Default', 'subtleforms' );
  const issues = contrastIssues( appearance, theme );

  const handlePresetClick = ( preset ) => {
    if ( preset.id === activePreset.id && ! modified ) {
      return;
    }
    if ( hasCustomisation && modified ) {
      setConfirming( { kind: 'preset', preset } );
      return;
    }
    applyPreset( preset );
  };

  const requestReset = () => {
    if ( hasCustomisation && modified ) {
      setConfirming( { kind: 'reset' } );
    } else {
      applyPreset( getPreset( 'theme' ) );
    }
  };

  // Arrow keys move between the cards without choosing one; Space chooses.
  const onGridKeyDown = ( event ) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const inputs = [ ...( gridRef.current?.querySelectorAll( 'input[type="radio"]:not(:disabled)' ) || [] ) ];
    const index = inputs.indexOf( document.activeElement );
    if ( index < 0 ) {
      return;
    }
    let next = null;
    if ( keys[ event.key ] ) {
      next = inputs[ ( index + keys[ event.key ] + inputs.length ) % inputs.length ];
    } else if ( event.key === 'Home' ) {
      next = inputs[ 0 ];
    } else if ( event.key === 'End' ) {
      next = inputs[ inputs.length - 1 ];
    }
    if ( next ) {
      event.preventDefault();
      next.focus();
    }
  };

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

  const variantRow = ( key ) => {
    const variant = VARIANT_BY_KEY[ key ];
    return (
      <ChoiceRow
        key={ key }
        label={ VARIANT_LABELS[ key ] || variant.label }
        options={ variant.options.map( ( o ) => ( { value: o.value, label: optionLabel( o.value, o.label ) } ) ) }
        value={ variants[ key ] ?? activePreset.variants?.[ key ] ?? '' }
        onChange={ ( next ) => setVariant( key, next ) }
        disabled={ isReadOnly }
      />
    );
  };

  const tokenRow = ( def ) => {
    const issue = issues.find( ( i ) => ISSUE_CONTROL[ i.id ] === def.key );
    return (
      <TokenRow
        key={ def.key }
        def={ def }
        value={ readValue( def ) }
        inherited={ inheritedValue( def.key, appearance, theme ) || ( def.type === 'color' || def.type === 'font' ? resolvedToken( appearance, def.key ) : '' ) }
        onChange={ ( next ) => setToken( def.key, next ) }
        theme={ theme }
        inheritLabel={ def.key === 'labelFont' || def.key === 'inputFont' ? __( 'Same as form font', 'subtleforms' ) : inheritLabel }
        isSet={ isChanged( def ) }
        resetWord={ resetWord }
        onReset={ () => resetControl( def ) }
        error={ issue ? issueText( issue ) : '' }
        disabled={ isReadOnly }
      />
    );
  };

  const buttonPlacement = (
    <>
      <ChoiceRow
        label={ __( 'Button width', 'subtleforms' ) }
        options={ [
          { value: 'auto', label: __( 'Auto', 'subtleforms' ) },
          { value: 'full', label: __( 'Full width', 'subtleforms' ) },
        ] }
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
        className='sf-arow--button-width'
      />
      <ChoiceRow
        label={ __( 'Button alignment', 'subtleforms' ) }
        options={ [
          { value: 'left', label: __( 'Left', 'subtleforms' ) },
          { value: 'center', label: __( 'Centre', 'subtleforms' ) },
          { value: 'right', label: __( 'Right', 'subtleforms' ) },
        ] }
        value={ buttonWidth === 'full' ? '' : buttonAlign }
        onChange={ ( next ) => {
          setLastAlign( next );
          setVariant( 'buttonAlign', next );
        } }
        disabled={ isReadOnly || buttonWidth === 'full' }
        className='sf-arow--button-align'
      />
    </>
  );

  const densityRow = (
    <ChoiceRow
      label={ __( 'Spacing', 'subtleforms' ) }
      options={ [
        { value: 'compact', label: __( 'Compact', 'subtleforms' ) },
        { value: 'comfortable', label: __( 'Comfortable', 'subtleforms' ) },
      ] }
      value={ densityNow }
      onChange={ ( next ) => setDensity( next ) }
      disabled={ isReadOnly }
      className='sf-arow--density'
    />
  );

  const renderSection = ( section ) => {
    const defs = section.groups.flatMap( controlsOf );
    const plain = defs.filter( ( d ) => ! d.advanced );
    const advanced = defs.filter( ( d ) => d.advanced );
    const open = !! more[ section.id ];
    const own = GROUP[ section.groups[ 0 ] ];
    return (
      <InspectorSection key={ section.id } id={ `appearance-${ section.id }` } title={ section.title }>
        { section.id === 'type' && noFontsNote && (
          <p className='sf-appearance-panel__caption'>
            { __( 'Your theme does not share its fonts with WordPress; the preview uses your site\'s stylesheet.', 'subtleforms' ) }
          </p>
        ) }
        { section.id === 'layout' && densityRow }
        { ( own.variants || [] ).map( variantRow ) }
        { section.id === 'buttons' && buttonPlacement }
        { plain.map( tokenRow ) }
        { advanced.length > 0 && (
          <>
            <button
              type='button'
              className='sf-appearance-panel__more'
              aria-expanded={ open }
              onClick={ () => setMore( ( m ) => ( { ...m, [ section.id ]: ! open } ) ) }>
              { open ? __( 'Fewer options', 'subtleforms' ) : __( 'More', 'subtleforms' ) }
              <span aria-hidden='true' className='sf-appearance-panel__more-chevron' />
            </button>
            { open && advanced.map( tokenRow ) }
          </>
        ) }
      </InspectorSection>
    );
  };

  const tabItems = [
    { id: 'presets', label: __( 'Presets', 'subtleforms' ), icon: <SwatchGlyph /> },
    { id: 'custom', label: __( 'Custom', 'subtleforms' ), icon: <ContrastGlyph /> },
  ];

  return (
    <div className='sf-field-inspector sf-form-appearance sf-appearance-panel' data-form-id={ formId || undefined }>
      <div className='sf-field-inspector__top'>
        <div className='sf-field-inspector__header'>
          <span className='sf-field-inspector__type-icon' aria-hidden='true'>
            <Icon.Paintbrush size={ 16 } />
          </span>
          <div className='sf-field-inspector__header-info'>
            <strong className='sf-field-inspector__title'>{ __( 'Appearance', 'subtleforms' ) }</strong>
            <span className='sf-field-inspector__description'>{ __( 'How this form looks on the page', 'subtleforms' ) }</span>
          </div>
        </div>
        <InspectorTabs tab={ tab } onChange={ setTab } idBase={ tabBase } items={ tabItems } ariaLabel={ __( 'Appearance sections', 'subtleforms' ) } />
      </div>

      <div className='sf-field-inspector__scroll'>
        { isReadOnly && (
          <div className='sf-field-inspector__notices'>
            <Notice status='info' isDismissible={ false }>
              { __( 'Styling is read-only here.', 'subtleforms' ) }
            </Notice>
          </div>
        ) }
        <div
          className='sf-field-inspector__sheet'
          role='tabpanel'
          id={ `${ tabBase }-panel` }
          aria-labelledby={ `${ tabBase }-tab-${ tab }` }>
          { tab === 'presets' && (
            <div className='sf-appearance-panel__presets'>
              <div
                className='sf-pgrid'
                role='radiogroup'
                aria-label={ __( 'Presets', 'subtleforms' ) }
                ref={ gridRef }
                onKeyDown={ onGridKeyDown }>
                { FORM_PRESETS.map( ( preset ) => (
                  <PresetCard
                    key={ preset.id }
                    preset={ preset }
                    name={ radioName }
                    isActive={ activePreset.id === preset.id }
                    isModified={ modified }
                    disabled={ isReadOnly }
                    onApply={ () => handlePresetClick( preset ) }
                  />
                ) ) }
              </div>
              <p className='sf-appearance-panel__caption'>
                { __( 'Presets never change the page around the form. Switch the canvas between light and dark above to see the form on both.', 'subtleforms' ) }
              </p>
            </div>
          ) }

          { tab === 'custom' && (
            <div className='sf-appearance-panel__custom'>
              <div className='sf-appearance-panel__base'>
                <p className='sf-appearance-panel__caption'>
                  { sprintf(
                    /* translators: %s: preset name */
                    __( 'Starting from %s.', 'subtleforms' ),
                    activeLabel
                  ) }
                  { modified && <span className='sf-pcard__edited'>{ __( 'edited', 'subtleforms' ) }</span> }
                </p>
                { modified && ! isReadOnly && (
                  <button type='button' className='sf-appearance-panel__link' onClick={ () => applyPreset( activePreset ) }>
                    { sprintf(
                      /* translators: %s: preset name */
                      __( 'Revert to %s', 'subtleforms' ),
                      activeLabel
                    ) }
                  </button>
                ) }
              </div>
              { isTheme && (
                <p className='sf-appearance-panel__caption sf-form-appearance__theme-note'>
                  { isPureTheme( appearance )
                    ? __( 'Your theme styles this form. Changing colours, type, or the field and button style below switches to SubtleForms styling that starts from your theme.', 'subtleforms' )
                    : __( 'SubtleForms styles this form, starting from your theme. Revert to let your theme style it again.', 'subtleforms' ) }
                </p>
              ) }
              { SECTIONS.map( renderSection ) }
            </div>
          ) }
        </div>
      </div>

      { confirming && (
        <div className='sf-appearance-panel__confirm'>
          <Notice status='warning' isDismissible={ false }>
            <p>
              { confirming.kind === 'preset'
                ? sprintf(
                    /* translators: %s: name of the style preset being applied */
                    __( 'Applying “%s” replaces the custom styling on this form.', 'subtleforms' ),
                    PRESET_LABELS[ confirming.preset.id ]?.label || confirming.preset.label
                  )
                : __( 'This puts every colour, font, size and shape on this form back to your theme. It cannot be undone after you save.', 'subtleforms' ) }
            </p>
            <div className='sf-appearance-panel__confirm-actions'>
              <Button
                variant='primary'
                size='small'
                isDestructive={ confirming.kind === 'reset' }
                onClick={ () => applyPreset( confirming.kind === 'preset' ? confirming.preset : getPreset( 'theme' ) ) }>
                { confirming.kind === 'preset' ? __( 'Apply preset', 'subtleforms' ) : __( 'Reset to theme', 'subtleforms' ) }
              </Button>
              <Button variant='tertiary' size='small' onClick={ () => setConfirming( null ) }>
                { confirming.kind === 'preset' ? __( 'Keep mine', 'subtleforms' ) : __( 'Keep my styling', 'subtleforms' ) }
              </Button>
            </div>
          </Notice>
        </div>
      ) }

      <div className='sf-field-inspector__footer'>
        { ! isReadOnly && (
          <Button
            variant='link'
            className='sf-appearance-panel__reset'
            disabled={ isTheme && isPureTheme( appearance ) }
            onClick={ requestReset }>
            { __( 'Reset to theme', 'subtleforms' ) }
          </Button>
        ) }
      </div>
    </div>
  );
}
