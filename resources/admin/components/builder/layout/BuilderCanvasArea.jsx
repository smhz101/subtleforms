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
import AddonFieldsNotice from '../../AddonFieldsNotice';
import EmptyFormWelcome from '../EmptyFormWelcome';
import PreviewWorkspace from '../PreviewWorkspace';
import { getMissingAddonFields, getLimitedFeatures, needsMissingPayment } from '../../../utils/addonFields';
import ExtensionSlot from '../../ExtensionSlot';
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
  const paymentMissing = useMemo(() => needsMissingPayment(draftSchema), [draftSchema]);
  const limitedFeatures = useMemo(() => getLimitedFeatures(draftSchema), [draftSchema]);
  return (
    <>
      <AddonFieldsNotice featuresUsed={missingAddonFields} limited={limitedFeatures} paymentForm={paymentMissing} />

      {/* Notes from add-ons about the form being built (for example how the form is handled). */}
      {view === 'build' && <ExtensionSlot name='builder.canvas.notes' schema={draftSchema} />}

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
                formId={currentFormId || 0}
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
