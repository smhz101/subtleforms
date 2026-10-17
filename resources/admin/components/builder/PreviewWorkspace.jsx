import { useState } from '@wordpress/element';
import { Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FormPreviewBody from '../form-preview/FormPreviewBody';
import FormAppearancePanel from './appearance/FormAppearancePanel';
import { appearanceBackdrop } from '../../../shared/appearance';
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

const VIEWPORTS = [
  { id: 'desktop', label: __( 'Desktop', 'subtleforms' ), width: 960 },
  { id: 'tablet', label: __( 'Tablet', 'subtleforms' ), width: 768 },
  { id: 'mobile', label: __( 'Mobile', 'subtleforms' ), width: 380 },
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

  const active = VIEWPORTS.find( ( v ) => v.id === viewport ) || VIEWPORTS[ 0 ];

  return (
    <div className='sf-preview-workspace'>
      <div className='sf-preview-workspace__toolbar'>
        <div
          className='sf-preview-workspace__viewports'
          role='group'
          aria-label={ __( 'Preview width', 'subtleforms' ) }>
          { VIEWPORTS.map( ( option ) => (
            <button
              key={ option.id }
              type='button'
              className={ `sf-preview-workspace__viewport${
                option.id === viewport ? ' is-active' : ''
              }` }
              aria-pressed={ option.id === viewport }
              onClick={ () => setViewport( option.id ) }>
              { option.label }
            </button>
          ) ) }
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

      <div
        className={ `sf-preview-workspace__body${
          showControls ? '' : ' is-controls-hidden'
        }` }>
        <div className='sf-preview-workspace__canvas'>
          <div className='sf-preview-workspace__stage'>
            <div
              className='sf-preview-workspace__form'
              style={ {
                maxWidth: `${ active.width }px`,
                // A form made for a dark footer is previewed on one (2.3.0).
                ...( appearanceBackdrop( schema?.metadata?.appearance )
                  ? { background: appearanceBackdrop( schema?.metadata?.appearance ), padding: '24px' }
                  : {} ),
              } }>
              <FormPreviewBody
                schema={ schema }
                formId={ formId }
                isDirty={ isDirty }
              />
            </div>
          </div>
        </div>

        { showControls && (
          <aside
            className='sf-preview-workspace__controls'
            aria-label={ __( 'Form styling', 'subtleforms' ) }>
            <h2 className='sf-preview-workspace__controls-title'>
              { __( 'Appearance', 'subtleforms' ) }
            </h2>
            <p className='sf-preview-workspace__controls-hint'>
              { __(
                'Changes show in the canvas immediately. Publish to put them on your site.',
                'subtleforms'
              ) }
            </p>

            { isReadOnly && (
              <Notice status='info' isDismissible={ false }>
                <p>
                  { __(
                    'Styling is read-only: activate your Pro licence to edit. The form keeps working either way.',
                    'subtleforms'
                  ) }
                </p>
              </Notice>
            ) }

            <FormAppearancePanel
              schema={ schema }
              onChange={ onChange }
              isReadOnly={ isReadOnly }
            />
          </aside>
        ) }
      </div>
    </div>
  );
}
