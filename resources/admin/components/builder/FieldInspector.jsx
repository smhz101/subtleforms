import {
  Button,
  TextControl,
  TabPanel,
  CheckboxControl,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import ConditionEditor from './ConditionEditor';

export default function FieldInspector({
  field,
  onUpdate,
  onClose,
  allFields,
}) {
  if (!field) return null;

  return (
    <div className='sf-bg-white sf-border-gray-300 sf-border-l sf-w-80 sf-h-full sf-overflow-auto'>
      {/* Header */}
      <div className='sf-flex sf-justify-between sf-items-center sf-bg-white sf-px-5 sf-py-4 sf-border-gray-300 sf-border-b'>
        <strong className='sf-font-semibold sf-text-gray-900 sf-text-sm uppercase sf-tracking-wide'>
          {__('Settings', 'subtleforms')}
        </strong>
        <Button isSmall onClick={onClose} className='sf-px-2 sf-py-1 sf-min-w-0'>
          ×
        </Button>
      </div>

      {/* Content */}
      <div className='sf-p-5'>
        <TabPanel
          tabs={[
            { name: 'general', title: __('General', 'subtleforms') },
            {
              name: 'validation',
              title: __('Validation', 'subtleforms'),
            },
            { name: 'conditions', title: __('Conditions', 'subtleforms') },
          ]}>
          {(tab) => (
            <div className='sf-py-3'>
              {tab.name === 'general' && (
                <>
                  {field.type === 'step' ? (
                    <>
                      <TextControl
                        label={__('Step Title', 'subtleforms')}
                        value={field.title || ''}
                        onChange={(v) => onUpdate({ title: v })}
                        help={__(
                          'Title shown in step navigation',
                          'subtleforms'
                        )}
                      />
                      <TextControl
                        label={__('Description', 'subtleforms')}
                        value={field.description || ''}
                        onChange={(v) => onUpdate({ description: v })}
                        help={__(
                          'Optional description for this step',
                          'subtleforms'
                        )}
                      />
                    </>
                  ) : field.type.endsWith('_column_container') ||
                    field.type === 'repeat_container' ||
                    field.type === 'group_container' ? (
                    <>
                      {field.type.endsWith('_column_container') && (
                        <TextControl
                          label={__('Columns', 'subtleforms')}
                          value={field.columns}
                          readOnly
                          help={__('Number of columns', 'subtleforms')}
                        />
                      )}
                      {field.type === 'repeat_container' && (
                        <>
                          <TextControl
                            label={__('Button Label', 'subtleforms')}
                            value={field.buttonLabel || ''}
                            onChange={(v) => onUpdate({ buttonLabel: v })}
                          />
                          <TextControl
                            label={__('Min Repeats', 'subtleforms')}
                            type='number'
                            value={field.min || 1}
                            onChange={(v) => onUpdate({ min: parseInt(v, 10) })}
                          />
                          <TextControl
                            label={__('Max Repeats', 'subtleforms')}
                            type='number'
                            value={field.max || 5}
                            onChange={(v) => onUpdate({ max: parseInt(v, 10) })}
                          />
                        </>
                      )}
                      <TextControl
                        label={__('Spacing (px)', 'subtleforms')}
                        type='number'
                        value={field.spacing ?? ''}
                        onChange={(v) => {
                          const next = parseInt(v, 10);
                          onUpdate({ spacing: Number.isNaN(next) ? 0 : next });
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <TextControl
                        label={__('Field Label', 'subtleforms')}
                        value={field.label || ''}
                        onChange={(v) => onUpdate({ label: v })}
                        help={__(
                          'The label displayed above the field',
                          'subtleforms'
                        )}
                      />
                      <TextControl
                        label={__('Placeholder Text', 'subtleforms')}
                        value={field.placeholder || ''}
                        onChange={(v) => onUpdate({ placeholder: v })}
                        help={__(
                          'Hint text shown inside the field',
                          'subtleforms'
                        )}
                      />
                      <TextControl
                        label={__('Field Key', 'subtleforms')}
                        value={field.key || ''}
                        disabled
                        help={__(
                          'Unique identifier for data mapping',
                          'subtleforms'
                        )}
                      />
                    </>
                  )}

                  {/* Options editor for choice fields */}
                  {(field.type === 'radio' ||
                    field.type === 'multiple_choice' ||
                    field.type === 'dropdown') && (
                    <div className='sf-mt-4'>
                      <label className='sf-block sf-mb-2 sf-font-semibold sf-text-xs'>
                        {__('Options', 'subtleforms')}
                      </label>
                      {(field.options || []).map((opt, idx) => (
                        <div key={idx} className='sf-flex sf-gap-2 sf-mb-2'>
                          <TextControl
                            value={opt.label}
                            onChange={(v) => {
                              const newOptions = [...(field.options || [])];
                              newOptions[idx] = { ...opt, label: v };
                              onUpdate({ options: newOptions });
                            }}
                            placeholder={__('Option label', 'subtleforms')}
                          />
                          <Button
                            isSmall
                            isDestructive
                            onClick={() => {
                              const newOptions = [...(field.options || [])];
                              newOptions.splice(idx, 1);
                              onUpdate({ options: newOptions });
                            }}>
                            ×
                          </Button>
                        </div>
                      ))}
                      <Button
                        isSecondary
                        isSmall
                        onClick={() => {
                          const newOptions = [
                            ...(field.options || []),
                            {
                              label: `Option ${
                                (field.options?.length || 0) + 1
                              }`,
                              value: `option_${Date.now()}`,
                            },
                          ];
                          onUpdate({ options: newOptions });
                        }}>
                        {__('+ Add Option', 'subtleforms')}
                      </Button>
                    </div>
                  )}
                </>
              )}
              {tab.name === 'validation' && (
                <>
                  <CheckboxControl
                    label={__('Required Field', 'subtleforms')}
                    checked={!!field.required}
                    onChange={(checked) => onUpdate({ required: checked })}
                    help={__(
                      'User must fill this field to submit',
                      'subtleforms'
                    )}
                  />
                </>
              )}
              {tab.name === 'conditions' && (
                <ConditionEditor
                  conditions={field.conditions || []}
                  availableFields={allFields || []}
                  onChange={(conditions) => onUpdate({ conditions })}
                />
              )}
            </div>
          )}
        </TabPanel>
      </div>
    </div>
  );
}
