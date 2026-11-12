import { useEffect, useRef, useState } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import FormPreviewBody from '../form-preview/FormPreviewBody';
import FormAppearancePanel from './appearance/FormAppearancePanel';
import { getPreset, previewBreakpoints } from '../../../shared/appearance';
import { previewFrame, previewScale } from '../../../shared/previewScale';
import Icon from '../../ui/Icon';
import './PreviewWorkspace.scss';

/**
 * The Preview tab: a canvas and the controls that change it.
 *
 * Appearance used to live in Settings, two tabs away from the only thing that
 * shows what it does. Editing a colour there meant changing a value, switching
 * tab, and hoping. Here the canvas is the same iframe-isolated FormRenderer the
 * public page uses, so every control writes to `metadata.appearance` and the
 * result redraws beside it in the same frame.
 */

function viewportWidths() {
  const fromAdmin = window.subtleformsAdmin?.previewBreakpoints;
  if ( fromAdmin && fromAdmin.desktop && fromAdmin.tablet && fromAdmin.mobile ) {
    return {
      desktop: Number( fromAdmin.desktop ),
      tablet: Number( fromAdmin.tablet ),
      mobile: Number( fromAdmin.mobile ),
    };
  }
  return previewBreakpoints();
}

const widths = viewportWidths();

export const SCHEME_STORAGE_KEY = 'sf-preview-scheme';

const SCHEMES = [
  { id: 'light', label: __( 'Light', 'subtleforms' ), icon: Icon.Sun },
  { id: 'dark', label: __( 'Dark', 'subtleforms' ), icon: Icon.Moon },
];

/** The canvas the person chose in this browser, or null when they have not chosen. */
function readScheme() {
  try {
    const saved = window.localStorage.getItem( SCHEME_STORAGE_KEY );
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch ( e ) {
    return null;
  }
}

const VIEWPORTS = [
  { id: 'desktop', label: __( 'Desktop', 'subtleforms' ), icon: Icon.Desktop, width: widths.desktop },
  { id: 'tablet', label: __( 'Tablet', 'subtleforms' ), icon: Icon.Tablet, width: widths.tablet },
  { id: 'mobile', label: __( 'Mobile', 'subtleforms' ), icon: Icon.Smartphone, width: widths.mobile },
];

export default function PreviewWorkspace( {
  schema,
  formId = null,
  onChange,
  isDirty = false,
  isReadOnly = false,
} ) {
  const [ viewport, setViewport ] = useState( 'desktop' );
  const [ showControls, setShowControls ] = useState( true );
  const [ scale, setScale ] = useState( 1 );
  const [ stageHeight, setStageHeight ] = useState( 0 );
  // Light or Dark page around the form. Nothing is stored until the person
  // chooses; until then a form made for a dark page (a preset with a backdrop)
  // is shown on a dark one. It never touches the form's own appearance.
  const [ chosenScheme, setChosenScheme ] = useState( readScheme );
  const presetWantsDark = !! getPreset( schema?.metadata?.appearance?.preset )?.backdrop;
  const scheme = chosenScheme || ( presetWantsDark ? 'dark' : 'light' );
  const chooseScheme = ( next ) => {
    setChosenScheme( next );
    try {
      window.localStorage.setItem( SCHEME_STORAGE_KEY, next );
    } catch ( e ) {
      // Storage is blocked: the canvas still switches.
    }
  };
  const canvasRef = useRef( null );
  const formRef = useRef( null );

  const active = VIEWPORTS.find( ( v ) => v.id === viewport ) || VIEWPORTS[ 0 ];
  const frame = previewFrame( active.width, scale );

  useEffect( () => {
    const canvas = canvasRef.current;
    const form = formRef.current;
    if ( ! canvas || ! form || typeof ResizeObserver === 'undefined' ) {
      return undefined;
    }
    const measure = () => {
      const styles = window.getComputedStyle( canvas );
      const pad = ( parseFloat( styles.paddingLeft ) || 0 ) + ( parseFloat( styles.paddingRight ) || 0 );
      const nextScale = previewScale( canvas.clientWidth - pad, active.width );
      setScale( nextScale );
      setStageHeight( form.offsetHeight * nextScale );
    };
    measure();
    const observer = new ResizeObserver( measure );
    observer.observe( canvas );
    observer.observe( form );
    return () => observer.disconnect();
  }, [ active.width, schema ] );

  return (
    <div className='sf-preview-workspace'>
      <div className='sf-preview-workspace__toolbar'>
        <div
          className='sf-preview-workspace__viewports'
          role='group'
          aria-label={ __( 'Preview width', 'subtleforms' ) }>
          { VIEWPORTS.map( ( option ) => {
            const ViewportIcon = option.icon;
            return (
            <button
              key={ option.id }
              type='button'
              className={ `sf-preview-workspace__viewport${
                option.id === viewport ? ' is-active' : ''
              }` }
              aria-pressed={ option.id === viewport }
              title={ sprintf(
                /* translators: 1: device name, 2: width in pixels */
                __( '%1$s, %2$d pixels', 'subtleforms' ),
                option.label,
                option.width
              ) }
              onClick={ () => setViewport( option.id ) }>
              <ViewportIcon size={ 16 } aria-hidden='true' />
              <span>{ option.label }</span>
            </button>
            );
          } ) }
        </div>

        <div className='sf-preview-workspace__tools'>
          <div
            className='sf-preview-workspace__viewports sf-preview-workspace__schemes'
            role='group'
            aria-label={ __( 'Canvas', 'subtleforms' ) }>
            { SCHEMES.map( ( option ) => {
              const SchemeIcon = option.icon;
              return (
                <button
                  key={ option.id }
                  type='button'
                  className={ `sf-preview-workspace__viewport sf-preview-workspace__scheme${ option.id === scheme ? ' is-active' : '' }` }
                  aria-pressed={ option.id === scheme }
                  aria-label={ sprintf(
                    /* translators: %s: Light or Dark */
                    __( '%s canvas', 'subtleforms' ),
                    option.label
                  ) }
                  title={ sprintf(
                    /* translators: %s: light or dark */
                    __( 'Show the page around the form as %s', 'subtleforms' ),
                    option.label.toLowerCase()
                  ) }
                  onClick={ () => chooseScheme( option.id ) }>
                  <SchemeIcon size={ 16 } aria-hidden='true' />
                  <span>{ option.label }</span>
                </button>
              );
            } ) }
          </div>
        <Button
          variant='tertiary'
          onClick={ () => setShowControls( ( open ) => ! open ) }
          aria-expanded={ showControls }>
          { showControls
            ? __( 'Hide styling', 'subtleforms' )
            : __( 'Show styling', 'subtleforms' ) }
        </Button>
        </div>
      </div>

      <div
        className={ `sf-preview-workspace__body${
          showControls ? '' : ' is-controls-hidden'
        }` }>
        <div className='sf-preview-workspace__canvas' ref={ canvasRef }>
          <div
            className={ `sf-preview-workspace__stage is-${ scheme }` }
            data-scheme={ scheme }
            style={ {
              width: `${ frame.stageWidth }px`,
              ...( stageHeight ? { height: `${ stageHeight }px` } : {} ),
            } }>
            <div
              ref={ formRef }
              className='sf-preview-workspace__form'
              style={ {
                width: `${ active.width }px`,
                transform: `scale(${ scale })`,
                transformOrigin: frame.origin,
              } }>
              <FormPreviewBody
                schema={ schema }
                formId={ formId }
                isDirty={ isDirty }
                scheme={ scheme }
              />
            </div>
          </div>
        </div>

        { showControls && (
          <aside
            className='sf-preview-workspace__controls'
            aria-label={ __( 'Form styling', 'subtleforms' ) }>
            <FormAppearancePanel
              schema={ schema }
              onChange={ onChange }
              isReadOnly={ isReadOnly }
              formId={ formId }
            />
          </aside>
        ) }
      </div>
    </div>
  );
}
