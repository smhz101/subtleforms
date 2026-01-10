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
      <style>{`
        .subtleforms-builder-tabs-content {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .subtleforms-builder-tabs-content > div[role="tabpanel"] {
          flex: 1;
          height: 100%;
          overflow: hidden;
        }
      `}</style>

      {saveError && (
        <div className='sf-bg-red-50 sf-mb-4 sf-px-6 sf-py-3 sf-border-yellow-500 sf-border-b'>
          <span className='sf-text-red-600 sf-text-xs'>{saveError}</span>
        </div>
      )}

      {hasValidationErrors && (
        <div className='sf-mb-4 sf-px-6'>
          <Notice status='warning' isDismissible={false}>
            <p className='sf-m-0 sf-text-sm'>
              {__(
                'Validation issues detected. Publishing is blocked until these are fixed:',
                'subtleforms'
              )}
            </p>
            <ul className='sf-m-0 sf-mt-2 sf-pl-5 sf-text-sm'>
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
              <div className='sf-p-6 sf-h-full sf-overflow-y-auto'>
                <SubmissionsTable
                  formId={currentFormId}
                  showFormColumn={false}
                />
              </div>
            )}
            {tab.name === 'entries' && !currentFormId && (
              <div className='sf-p-6 sf-h-full sf-overflow-y-auto'>
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
