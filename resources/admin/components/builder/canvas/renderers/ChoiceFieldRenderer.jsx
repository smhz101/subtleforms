/**
 * ChoiceFieldRenderer.jsx
 * 
 * Renders choice-based fields: checkbox, radio, multiple_choice, dropdown
 */

import { __ } from '@wordpress/i18n';

export default function ChoiceFieldRenderer({ field }) {
  const { type, label, required, options } = field;

  const labelClass = 'sf-field-renderer__label';
  const selectClass = 'sf-field-renderer__select';

  return (
    <div>
      {/* Checkbox (single) */}
      {type === 'checkbox' && (
        <div className='sf-field-renderer__checkbox-wrapper'>
          <input
            type='checkbox'
            className='sf-field-renderer__checkbox'
            tabIndex='-1'
          />
          <span className='sf-field-renderer__checkbox-label'>{label}</span>
        </div>
      )}

      {/* Radio buttons */}
      {type === 'radio' && options && (
        <div>
          <label className={labelClass}>
            {label || field.name}
            {required && (
              <span className='sf-field-renderer__required-mark'>*</span>
            )}
          </label>
          <div className='sf-field-renderer__options-list'>
            {options.map((opt, idx) => (
              <div key={idx} className='sf-field-renderer__checkbox-wrapper'>
                <input
                  type='radio'
                  name={field.key}
                  className='sf-field-renderer__radio'
                  tabIndex='-1'
                />
                <span className='sf-field-renderer__checkbox-label'>
                  {opt.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Multiple choice (checkboxes) */}
      {type === 'multiple_choice' && options && (
        <div>
          <label className={labelClass}>
            {label || field.name}
            {required && (
              <span className='sf-field-renderer__required-mark'>*</span>
            )}
          </label>
          <div className='sf-field-renderer__options-list'>
            {options.map((opt, idx) => (
              <div key={idx} className='sf-field-renderer__checkbox-wrapper'>
                <input
                  type='checkbox'
                  className='sf-field-renderer__checkbox'
                  tabIndex='-1'
                />
                <span className='sf-field-renderer__checkbox-label'>
                  {opt.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dropdown select */}
      {type === 'dropdown' && options && (
        <div>
          <label className={labelClass}>
            {label || field.name}
            {required && (
              <span className='sf-field-renderer__required-mark'>*</span>
            )}
          </label>
          <select
            className={selectClass}
            tabIndex='-1'>
            <option value=''>
              {__('Select an option', 'subtleforms')}
            </option>
            {options.map((opt, idx) => (
              <option key={idx} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
