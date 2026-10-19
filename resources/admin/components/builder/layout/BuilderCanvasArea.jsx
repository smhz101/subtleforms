/**
 * BuilderCanvasArea Component
 *
 * Pure UI component for the builder canvas with tabs (Build, Settings, Entries).
 */

import { useMemo } from '@wordpress/element';
import { Button, Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import FormEditor from '../FormEditor';
import FormSettings from '../FormSettings';
import SubmissionsTable from '../../SubmissionsTable';
import ProDowngradeBanner from '../../ProDowngradeBanner';
import EmptyFormWelcome from '../EmptyFormWelcome';
import PreviewWorkspace from '../PreviewWorkspace';
import { getMissingAddonFields } from '../../../utils/proFeatureDetector';
import { offlinePaymentNote } from '../../../utils/paymentNotes';
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
  entryCount = 0,
  saveError,
  onRetrySave,
  hasValidationErrors,
  showWelcome = false,
  isDirty = false,
}) {
  // Fields from an add-on that is not active (the form stays editable).
  const missingAddonFields = useMemo(() => getMissingAddonFields(draftSchema), [draftSchema]);
  // A priced form without a Card Payment field saves entries as "Payment
  // pending" (PAY-03); say so while the form is being built.
  const paymentNote = useMemo(() => offlinePaymentNote(draftSchema), [draftSchema]);
  return (
    <>
      <ProDowngradeBanner featuresUsed={missingAddonFields} />

      {paymentNote && view === 'build' && (
        <div className='sf-builder-canvas-area__validation-notice'>
          <Notice status='info' isDismissible={false}>
            {paymentNote}
          </Notice>
        </div>
      )}

      {saveError && (
        <div className='sf-builder-canvas-area__error-banner' role='alert'>
          <span className='sf-builder-canvas-area__error-text'>
            {saveError}
          </span>
          {onRetrySave && (
            <Button variant='secondary' onClick={onRetrySave}>
              {__('Retry', 'subtleforms')}
            </Button>
          )}
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
                entryCount={entryCount}
              />
            )}
            {view === 'settings' && (
              <FormSettings
                schema={draftSchema}
                validationErrors={validationErrors}
                fieldErrors={fieldErrors}
                onChange={onSchemaChange}
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
              />
            )}
          </>
      </div>
    </>
  );
}
