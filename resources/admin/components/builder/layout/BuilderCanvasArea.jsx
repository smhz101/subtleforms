/**
 * BuilderCanvasArea Component
 *
 * Pure UI component for the builder canvas with tabs (Build, Settings, Entries).
 */

import { TabPanel, Notice } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import FormEditor from '../FormEditor';
import FormSettings from '../FormSettings';
import SubmissionsTable from '../../SubmissionsTable';
import './BuilderCanvasArea.scss';

export default function BuilderCanvasArea({
  draftSchema,
  fieldGroups,
  fieldDefinitions,
  validationErrors,
  onSchemaChange,
  currentFormId,
  saveError,
  hasValidationErrors,
}) {
  return (
    <>
      {saveError && (
        <div className='sf-builder-canvas-area__error-banner'>
          <span className='sf-builder-canvas-area__error-text'>{saveError}</span>
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

      <TabPanel
        className='subtleforms-builder-tabs-content'
        activeClass='is-active'
        tabs={[
          {
            name: 'build',
            title: __('Build', 'subtleforms'),
          },
          {
            name: 'settings',
            title: __('Settings', 'subtleforms'),
          },
          {
            name: 'entries',
            title: __('Entries', 'subtleforms'),
            className: 'data-tour-submissions-tab',
          },
        ]}>
        {(tab) => (
          <>
            {tab.name === 'build' && (
              <FormEditor
                schema={draftSchema}
                fieldGroups={fieldGroups}
                fieldDefinitions={fieldDefinitions}
                validationErrors={validationErrors}
                onChange={onSchemaChange}
              />
            )}
            {tab.name === 'settings' && (
              <FormSettings
                schema={draftSchema}
                validationErrors={validationErrors}
                onChange={onSchemaChange}
              />
            )}
            {tab.name === 'entries' && currentFormId && (
              <div className='sf-builder-canvas-area__entries-container'>
                <SubmissionsTable
                  formId={currentFormId}
                  showFormColumn={false}
                />
              </div>
            )}
            {tab.name === 'entries' && !currentFormId && (
              <div className='sf-builder-canvas-area__entries-container'>
                <Notice status='info'>
                  {__('Save the form first to view entries', 'subtleforms')}
                </Notice>
              </div>
            )}
          </>
        )}
      </TabPanel>
    </>
  );
}
