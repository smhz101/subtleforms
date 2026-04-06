import { Button, TabPanel, Notice } from '@wordpress/components';
import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import Icon from '../ui/Icon';
import ConditionEditor from './ConditionEditor';
import { useBuilder } from './context/BuilderContext';
import { useConfig } from './context/ConfigContext';
import {
  OptionsPanel,
  ValidationPanel,
  DynamicInspectorPanel,
} from './inspector/panels';

export default function FieldInspector({ field, allFields, isReadOnly = false }) {
  const { setSelectedId, actions, validationErrors, selectedId } = useBuilder();
  const { fieldDefinitions } = useConfig();

  const selectedFieldValidationMessages = selectedId
    ? (validationErrors || [])
        .filter((v) => v.fieldKey === field?.key)
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

  // Derive meta category from PHP field definitions for tab gating.
  const fieldCategory = fieldDefinitions?.[ field?.type ]?.meta?.category;
  const isInputLike = !fieldCategory || fieldCategory === 'regular' || fieldCategory === 'composite';

  // Detect config problems that should be surfaced to the builder
  const fieldWarnings = useMemo(() => {
    if (!field) return [];
    const warnings = [];
    if (field.required && !field.label?.trim()) {
      warnings.push(__('This required field has no label — users won\'t know what to fill in.', 'subtleforms'));
    }
    const OPTION_TYPES = ['dropdown', 'select', 'radio', 'multiple_choice'];
    if (OPTION_TYPES.includes(field.type) && (!field.options || field.options.length === 0)) {
      warnings.push(__('No options configured — users will see an empty list.', 'subtleforms'));
    }
    return warnings;
  }, [field]);

  // Type-specific smart hints shown in the General tab
  const smartHint = useMemo(() => {
    if (!field) return null;
    if (field.type === 'email') return __('Email format is automatically validated on submission.', 'subtleforms');
    if (field.type === 'url') return __('URL format is automatically validated on submission.', 'subtleforms');
    if (field.type === 'number') return __('Set Min / Max in the controls above to restrict this field\'s input range.', 'subtleforms');
    if (field.type === 'phone' || field.type === 'tel') return __('Tip: add a placeholder (e.g. +1 555 000 0000) for better UX.', 'subtleforms');
    return null;
  }, [field]);

  return (
    <div className='sf-field-inspector'>
      {/* Header */}
      <div className='sf-field-inspector__header'>
        <div className='sf-field-inspector__header-info'>
          <strong className='sf-field-inspector__title'>
            {field
              ? field.label || field.name || field.type
              : __('Settings', 'subtleforms')}
          </strong>
          {field && (
            <span className='sf-field-inspector__field-type'>
              {field.type?.replace(/_/g, ' ')}
            </span>
          )}
        </div>
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
            {fieldWarnings.map((warning, i) => (
              <Notice key={i} status='warning' isDismissible={false}>
                <p className='sf-field-inspector__notice-paragraph'>{warning}</p>
              </Notice>
            ))}
            <TabPanel
              key={field?.id ?? 'none'}
              tabs={[
                { name: 'general', title: __('General', 'subtleforms') },
                ...( isInputLike ? [
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
                ] : [] ),
              ]}>
              {(tab) => (
                <div className='sf-field-inspector__tab-content'>
                  {tab.name === 'general' && (
                    <>
                      <DynamicInspectorPanel
                        field={field}
                        onUpdate={handleUpdate}
                        isReadOnly={isReadOnly}
                      />
                      <OptionsPanel
                        field={field}
                        onUpdate={handleUpdate}
                        isReadOnly={isReadOnly}
                      />
                      {smartHint && (
                        <div className='sf-field-inspector__smart-hint'>
                          <Icon.Lightbulb size={14} aria-hidden='true' />
                          <p>{smartHint}</p>
                        </div>
                      )}
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
