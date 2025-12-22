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
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}>
        <label
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#1e1e1e',
          }}>
          {__('Conditional Logic', 'subtleforms')}
        </label>
        <Button isSmall isSecondary onClick={handleAddCondition}>
          {__('+ Add Rule', 'subtleforms')}
        </Button>
      </div>

      {(!conditions || conditions.length === 0) && (
        <p
          style={{
            margin: '8px 0',
            fontSize: '12px',
            color: '#757575',
            fontStyle: 'italic',
          }}>
          {__('No conditions set', 'subtleforms')}
        </p>
      )}

      {conditions &&
        conditions.map((condition, index) => (
          <div
            key={index}
            style={{
              padding: 12,
              marginBottom: 12,
              border: '1px solid #dcdcde',
              borderRadius: 4,
              background: '#f9f9f9',
            }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#646970',
                  textTransform: 'uppercase',
                }}>
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
