import { Button, TabPanel, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import ConditionEditor from './ConditionEditor';
import { useBuilder } from './context/BuilderContext';
import {
  GeneralSettingsPanel,
  OptionsPanel,
  CompositeFieldPanel,
  ValidationPanel,
} from './inspector/panels';

export default function FieldInspector({ field, allFields, isReadOnly = false }) {
  const { setSelectedId, actions, validationErrors, selectedId } = useBuilder();

  const selectedFieldValidationMessages = selectedId
    ? (validationErrors || [])
        .filter((v) => v.fieldKey === field?.config?.key)
        .map((v) => v.message)
    : [];

  const hasValidationMessages =
    Array.isArray(selectedFieldValidationMessages) &&
    selectedFieldValidationMessages.length > 0;

  const handleUpdate = (changes) => {
    if (!selectedId || isReadOnly) return;
    actions.onUpdate(selectedId, changes);
  };

  const handleClose = () => {
    setSelectedId(null);
  };

  return (
    <div className='sf-field-inspector'>
      {/* Header */}
      <div className='sf-field-inspector__header'>
        <strong className='sf-field-inspector__title'>
          {__('Settings', 'subtleforms')}
        </strong>
        <Button
          isSmall
          onClick={handleClose}
          disabled={!field}
          className='sf-field-inspector__close-button'>
          ×
        </Button>
      </div>

      {/* Content */}
      <div className='sf-field-inspector__content'>
        {!field && (
          <div className='sf-field-inspector__empty'>
            <p className='sf-field-inspector__empty-paragraph'>
              {__('Nothing selected', 'subtleforms')}
            </p>
            <p className='sf-field-inspector__empty-subtext'>
              {__(
                'Click a field (or container) in the canvas to edit its settings, validation, and conditions.',
                'subtleforms'
              )}
            </p>
          </div>
        )}

        {field && (
          <>
            {isReadOnly && (
              <Notice status='info' isDismissible={false}>
                <p className='sf-field-inspector__notice-paragraph'>
                  {__('Read-only mode: Activate your Pro license to edit. Your form continues working—no data loss.', 'subtleforms')}
                </p>
              </Notice>
            )}
            {hasValidationMessages && (
              <Notice status='warning' isDismissible={false}>
                <p className='sf-field-inspector__notice-paragraph'>
                  {selectedFieldValidationMessages[0]}
                </p>
              </Notice>
            )}
            <TabPanel
              tabs={[
                { name: 'general', title: __('General', 'subtleforms') },
                {
                  name: 'validation',
                  title: (
                    <span className='sf-field-inspector__tab-label'>
                      {__('Validation', 'subtleforms')}
                      {hasValidationMessages && (
                        <span
                          className='sf-field-inspector__tab-warning-indicator'
                          aria-hidden='true'
                        />
                      )}
                    </span>
                  ),
                },
                { name: 'conditions', title: __('Conditions', 'subtleforms') },
              ]}>
              {(tab) => (
                <div className='sf-field-inspector__tab-content'>
                  {tab.name === 'general' && (
                    <>
                      <GeneralSettingsPanel
                        field={field}
                        onUpdate={handleUpdate}
                        isReadOnly={isReadOnly}
                      />
                      <OptionsPanel
                        field={field}
                        onUpdate={handleUpdate}
                        isReadOnly={isReadOnly}
                      />
                      <CompositeFieldPanel
                        field={field}
                        onUpdate={handleUpdate}
                        isReadOnly={isReadOnly}
                      />
                    </>
                  )}
                  {tab.name === 'validation' && (
                    <ValidationPanel
                      field={field}
                      onUpdate={handleUpdate}
                      isReadOnly={isReadOnly}
                    />
                  )}
                  {tab.name === 'conditions' && (
                    <ConditionEditor
                      conditions={field.conditions || []}
                      availableFields={allFields || []}
                      onChange={(conditions) => handleUpdate({ conditions })}
                    />
                  )}
                </div>
              )}
            </TabPanel>
          </>
        )}
      </div>
    </div>
  );
}
