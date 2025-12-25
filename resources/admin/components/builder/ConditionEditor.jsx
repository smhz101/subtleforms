import { Button, SelectControl, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

export default function ConditionEditor({
  conditions,
  availableFields,
  onChange,
}) {
  const operators = [
    { label: __('Equals', 'subtleforms'), value: 'equals' },
    { label: __('Not Equals', 'subtleforms'), value: 'not_equals' },
    { label: __('Contains', 'subtleforms'), value: 'contains' },
    { label: __('Not Contains', 'subtleforms'), value: 'not_contains' },
    { label: __('Is Empty', 'subtleforms'), value: 'empty' },
    { label: __('Is Not Empty', 'subtleforms'), value: 'not_empty' },
    { label: __('Greater Than', 'subtleforms'), value: 'greater_than' },
    { label: __('Less Than', 'subtleforms'), value: 'less_than' },
  ];

  const effects = [
    { label: __('Show', 'subtleforms'), value: 'show' },
    { label: __('Hide', 'subtleforms'), value: 'hide' },
    { label: __('Require', 'subtleforms'), value: 'require' },
    { label: __('Disable', 'subtleforms'), value: 'disable' },
  ];

  const handleAddCondition = () => {
    const newCondition = {
      sourceField: '',
      operator: 'equals',
      value: '',
      effect: 'show',
    };
    onChange([...(conditions || []), newCondition]);
  };

  const handleUpdateCondition = (index, updates) => {
    const updated = [...(conditions || [])];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const handleRemoveCondition = (index) => {
    const updated = [...(conditions || [])];
    updated.splice(index, 1);
    onChange(updated);
  };

  const needsValue = (operator) => {
    return !['empty', 'not_empty'].includes(operator);
  };

  return (
    <div className='mt-4'>
      <div className='flex justify-between items-center mb-3'>
        <label className='font-semibold text-gray-900 text-xs'>
          {__('Conditional Logic', 'subtleforms')}
        </label>
        <Button isSmall isSecondary onClick={handleAddCondition}>
          {__('+ Add Rule', 'subtleforms')}
        </Button>
      </div>

      {(!conditions || conditions.length === 0) && (
        <p className='my-2 text-gray-600 text-xs italic'>
          {__('No conditions set', 'subtleforms')}
        </p>
      )}

      {conditions &&
        conditions.map((condition, index) => (
          <div
            key={index}
            className='bg-gray-50 mb-3 p-3 border border-gray-300'>
            <div className='flex justify-between items-center mb-2'>
              <span className='font-semibold text-[11px] text-gray-600 uppercase'>
                {__('Rule', 'subtleforms')} {index + 1}
              </span>
              <Button
                isSmall
                isDestructive
                onClick={() => handleRemoveCondition(index)}>
                ×
              </Button>
            </div>

            <SelectControl
              label={__('When field', 'subtleforms')}
              value={condition.sourceField}
              options={[
                { label: __('Select field...', 'subtleforms'), value: '' },
                ...availableFields.map((f) => ({
                  label: f.label || f.key,
                  value: f.key,
                })),
              ]}
              onChange={(v) => handleUpdateCondition(index, { sourceField: v })}
            />

            <SelectControl
              label={__('Operator', 'subtleforms')}
              value={condition.operator}
              options={operators}
              onChange={(v) => handleUpdateCondition(index, { operator: v })}
            />

            {needsValue(condition.operator) && (
              <TextControl
                label={__('Value', 'subtleforms')}
                value={condition.value || ''}
                onChange={(v) => handleUpdateCondition(index, { value: v })}
              />
            )}

            <SelectControl
              label={__('Then', 'subtleforms')}
              value={condition.effect}
              options={effects}
              onChange={(v) => handleUpdateCondition(index, { effect: v })}
            />
          </div>
        ))}
    </div>
  );
}
