import {
  Button,
  TextControl,
  TabPanel,
  CheckboxControl,
  ToggleControl,
  Notice,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import ConditionEditor from './ConditionEditor';
import { useBuilder } from './context/BuilderContext';

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
                      {field.type === 'step' ? (
                        <>
                          <TextControl
                            label={__('Step Title', 'subtleforms')}
                            value={field.title || ''}
                            onChange={(v) => handleUpdate({ title: v })}
                            help={__(
                              'Title shown in step navigation',
                              'subtleforms'
                            )}
                          />
                          <TextControl
                            label={__('Description', 'subtleforms')}
                            value={field.description || ''}
                            onChange={(v) => handleUpdate({ description: v })}
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
                                onChange={(v) =>
                                  handleUpdate({ buttonLabel: v })
                                }
                              />
                              <TextControl
                                label={__('Min Repeats', 'subtleforms')}
                                type='number'
                                value={field.min || 1}
                                onChange={(v) =>
                                  handleUpdate({ min: parseInt(v, 10) })
                                }
                              />
                              <TextControl
                                label={__('Max Repeats', 'subtleforms')}
                                type='number'
                                value={field.max || 5}
                                onChange={(v) =>
                                  handleUpdate({ max: parseInt(v, 10) })
                                }
                              />
                            </>
                          )}
                          <TextControl
                            label={__('Spacing (px)', 'subtleforms')}
                            type='number'
                            value={field.spacing ?? ''}
                            onChange={(v) => {
                              const next = parseInt(v, 10);
                              handleUpdate({
                                spacing: Number.isNaN(next) ? 0 : next,
                              });
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <TextControl
                            label={__('Field Label', 'subtleforms')}
                            value={field.label || ''}
                            onChange={(v) => handleUpdate({ label: v })}
                            help={__(
                              'The label displayed above the field',
                              'subtleforms'
                            )}
                          />
                          <TextControl
                            label={__('Placeholder Text', 'subtleforms')}
                            value={field.placeholder || ''}
                            onChange={(v) => handleUpdate({ placeholder: v })}
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
                        <div className='sf-field-inspector__options-section'>
                          <label className='sf-field-inspector__options-label'>
                            {__('Options', 'subtleforms')}
                          </label>
                          {(field.options || []).map((opt, idx) => (
                            <div
                              key={idx}
                              className='sf-field-inspector__option-row'>
                              <TextControl
                                value={opt.label}
                                onChange={(v) => {
                                  const newOptions = [...(field.options || [])];
                                  newOptions[idx] = { ...opt, label: v };
                                  handleUpdate({ options: newOptions });
                                }}
                                placeholder={__('Option label', 'subtleforms')}
                              />
                              <Button
                                isSmall
                                isDestructive
                                onClick={() => {
                                  const newOptions = [...(field.options || [])];
                                  newOptions.splice(idx, 1);
                                  handleUpdate({ options: newOptions });
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
                              handleUpdate({ options: newOptions });
                            }}>
                            {__('+ Add Option', 'subtleforms')}
                          </Button>
                        </div>
                      )}

                      {/* Name Group Field Config */}
                      {field.type === 'name_group' && (
                        <div className='sf-field-inspector__name-group-section'>
                          {' '}
                          <label className='sf-field-inspector__section-label'>
                            {__('Name Parts', 'subtleforms')}
                          </label>
                          <ToggleControl
                            label={__('First Name', 'subtleforms')}
                            checked={field.enable_first_name !== false}
                            onChange={(v) =>
                              handleUpdate({ enable_first_name: v })
                            }
                          />
                          <ToggleControl
                            label={__('Middle Name', 'subtleforms')}
                            checked={!!field.enable_middle_name}
                            onChange={(v) =>
                              handleUpdate({ enable_middle_name: v })
                            }
                          />
                          <ToggleControl
                            label={__('Last Name', 'subtleforms')}
                            checked={field.enable_last_name !== false}
                            onChange={(v) =>
                              handleUpdate({ enable_last_name: v })
                            }
                          />
                        </div>
                      )}

                      {/* Address Group Field Config */}
                      {field.type === 'address_group' && (
                        <div className='sf-field-inspector__address-group-section'>
                          <label className='sf-field-inspector__section-label'>
                            {__('Address Parts', 'subtleforms')}
                          </label>
                          <ToggleControl
                            label={__('Street Address', 'subtleforms')}
                            checked={field.enable_street1 !== false}
                            onChange={(v) =>
                              handleUpdate({ enable_street1: v })
                            }
                          />
                          <ToggleControl
                            label={__('Street Address Line 2', 'subtleforms')}
                            checked={field.enable_street2 !== false}
                            onChange={(v) =>
                              handleUpdate({ enable_street2: v })
                            }
                          />
                          <ToggleControl
                            label={__('City', 'subtleforms')}
                            checked={field.enable_city !== false}
                            onChange={(v) => handleUpdate({ enable_city: v })}
                          />
                          <ToggleControl
                            label={__('State / Province', 'subtleforms')}
                            checked={field.enable_state !== false}
                            onChange={(v) => handleUpdate({ enable_state: v })}
                          />
                          <ToggleControl
                            label={__('Postal Code', 'subtleforms')}
                            checked={field.enable_postal_code !== false}
                            onChange={(v) =>
                              handleUpdate({ enable_postal_code: v })
                            }
                          />
                          <ToggleControl
                            label={__('Country', 'subtleforms')}
                            checked={field.enable_country !== false}
                            onChange={(v) =>
                              handleUpdate({ enable_country: v })
                            }
                          />
                        </div>
                      )}
                    </>
                  )}
                  {tab.name === 'validation' && (
                    <>
                      <CheckboxControl
                        label={__('Required Field', 'subtleforms')}
                        checked={!!field.required}
                        onChange={(checked) =>
                          handleUpdate({ required: checked })
                        }
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
