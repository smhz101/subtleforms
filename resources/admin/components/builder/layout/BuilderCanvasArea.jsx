/**
 * BuilderCanvasArea Component
 *
 * Pure UI component for the builder canvas with tabs (Build, Settings, Entries).
 */

import { useMemo } from '@wordpress/element';
import { Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import FormEditor from '../FormEditor';
import FormSettings from '../FormSettings';
import SubmissionsTable from '../../SubmissionsTable';
import ProDowngradeBanner from '../../ProDowngradeBanner';
import EmptyFormWelcome from '../EmptyFormWelcome';
import PreviewWorkspace from '../PreviewWorkspace';
import { formUsesProFeatures, getProFeaturesUsed } from '../../../utils/proFeatureDetector';
import './BuilderCanvasArea.scss';

export default function BuilderCanvasArea({
  view = 'build',
  draftSchema,
  fieldGroups,
  fieldDefinitions,
  validationErrors,
  fieldErrors = {},
  onSchemaChange,
  currentFormId,
  saveError,
  hasValidationErrors,
  showWelcome = false,
  isDirty = false,
}) {
  // Detect Pro feature usage and license state
  const usesProFeatures = useMemo(() => formUsesProFeatures(draftSchema), [draftSchema]);
  const capabilities = window.subtleformsAdmin?.capabilities || {};
  const hasProLicense = capabilities['templates.pro'] === true;
  const isReadOnly = usesProFeatures && !hasProLicense;
  const proFeaturesUsed = useMemo(() => 
    isReadOnly ? getProFeaturesUsed(draftSchema) : [],
    [isReadOnly, draftSchema]
  );
  return (
    <>
      {/* Pro Downgrade Banner */}
      {isReadOnly && <ProDowngradeBanner featuresUsed={proFeaturesUsed} />}

      {saveError && (
        <div className='sf-builder-canvas-area__error-banner'>
          <span className='sf-builder-canvas-area__error-text'>
            {saveError}
          </span>
        </div>
      )}

      {hasValidationErrors && (
        <div className='sf-builder-canvas-area__validation-notice'>
          <Notice status='warning' isDismissible={false}>
            <p className='sf-builder-canvas-area__validation-text'>
              {__(
                'Validation issues detected. Publishing is blocked until these are fixed:',
                'subtleforms'
              )}
            </p>
            <ul className='sf-builder-canvas-area__validation-list'>
              {validationErrors.slice(0, 6).map((err, idx) => (
                <li key={idx}>
                  {err?.message || __('Validation error', 'subtleforms')}
                </li>
              ))}
              {validationErrors.length > 6 && (
                <li>
                  {(() => {
                    return sprintf(
                      /* translators: %1$d: number of additional validation issues */
                      __('…and %1$d more', 'subtleforms'),
                      validationErrors.length - 6
                    );
                  })()}
                </li>
              )}
            </ul>
          </Notice>
        </div>
      )}

      <div className={`sf-builder-view sf-builder-view--${view}`} role='tabpanel' aria-labelledby={`sf-builder-view-${view}`}>
          <>
            {view === 'build' && showWelcome && (
              <EmptyFormWelcome />
            )}
            {view === 'build' && !showWelcome && (
              <FormEditor
                schema={draftSchema}
                fieldGroups={fieldGroups}
                fieldDefinitions={fieldDefinitions}
                validationErrors={validationErrors}
                fieldErrors={fieldErrors}
                onChange={onSchemaChange}
                isReadOnly={isReadOnly}
              />
            )}
            {view === 'settings' && (
              <FormSettings
                schema={draftSchema}
                validationErrors={validationErrors}
                fieldErrors={fieldErrors}
                onChange={onSchemaChange}
                isReadOnly={isReadOnly}
              />
            )}
            {view === 'entries' && currentFormId && (
              <div className='sf-builder-canvas-area__entries-container'>
                <SubmissionsTable
                  formId={currentFormId}
                  showFormColumn={false}
                />
              </div>
            )}
            {view === 'entries' && !currentFormId && (
              <div className='sf-builder-canvas-area__entries-container'>
                <Notice status='info'>
                  {__('Save the form first to view entries', 'subtleforms')}
                </Notice>
              </div>
            )}
            {view === 'preview' && (
              <PreviewWorkspace
                schema={draftSchema}
                formId={currentFormId}
                onChange={onSchemaChange}
                isDirty={isDirty}
                isReadOnly={isReadOnly}
              />
            )}
          </>
      </div>
    </>
  );
}
