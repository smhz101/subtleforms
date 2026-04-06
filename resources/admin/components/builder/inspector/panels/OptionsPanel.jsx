/**
 * OptionsPanel.jsx
 * 
 * Options editor for choice fields (radio, multiple_choice, dropdown)
 */

import { Button, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

export default function OptionsPanel({ field, onUpdate, isReadOnly }) {
  if (
    field.type !== 'radio' &&
    field.type !== 'multiple_choice' &&
    field.type !== 'dropdown' &&
    field.type !== 'select' &&
    field.type !== 'checkbox'
  ) {
    return null;
  }

  return (
    <div className='sf-field-inspector__options-section'>
      <label className='sf-field-inspector__options-label'>
        {__('Options', 'subtleforms')}
      </label>
      {(field.options || []).map((opt, idx) => (
        <div key={idx} className='sf-field-inspector__option-row'>
          <TextControl
            value={opt.label}
            onChange={(v) => {
              const newOptions = [...(field.options || [])];
              newOptions[idx] = { ...opt, label: v };
              onUpdate({ options: newOptions });
            }}
            disabled={isReadOnly}
            placeholder={__('Option label', 'subtleforms')}
          />
          <Button
            isSmall
            isDestructive
            disabled={isReadOnly}
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
        disabled={isReadOnly}
        onClick={() => {
          const newOptions = [
            ...(field.options || []),
            {
              label: `Option ${(field.options?.length || 0) + 1}`,
              value: `option_${Date.now()}`,
            },
          ];
          onUpdate({ options: newOptions });
        }}>
        {__('+ Add Option', 'subtleforms')}
      </Button>
    </div>
  );
}
