import { __ } from '@wordpress/i18n';

/**
 * ChoiceFieldPreview Component
 *
 * Renders choice-based fields: dropdown, radio, checkbox
 */
export default function ChoiceFieldPreview({ field, fieldId }) {
  const config = field.config || {};
  const placeholder = config.placeholder || '';
  const helpText = config.help || '';
  const helpTextId = helpText ? `${fieldId}-help` : undefined;

  // Dropdown / Select
  if (field.type === 'select' || field.type === 'dropdown') {
    return (
      <select
        id={fieldId}
        className='sf-form-preview-field__input'
        aria-describedby={helpTextId}
        disabled>
        <option value=''>{placeholder || __('Select...', 'subtleforms')}</option>
        {field.options?.map((opt, i) => (
          <option key={i} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  // Radio buttons
  if (field.type === 'radio') {
    return (
      <div
        className='sf-form-preview-field__radio-group'
        role='radiogroup'
        aria-describedby={helpTextId}>
        {field.options?.map((opt, i) => (
          <label key={i} className='sf-form-preview-field__option'>
            <input type='radio' name={field.key} value={opt.value} disabled />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    );
  }

  // Checkbox - single
  if (field.type === 'checkbox' && (!field.options || field.options.length === 0)) {
    const label = config.label || field.label || field.key;
    return (
      <label className='sf-form-preview-field__single-checkbox'>
        <input type='checkbox' disabled aria-describedby={helpTextId} />
        <span>{label}</span>
      </label>
    );
  }

  // Checkbox - multiple
  if (field.type === 'checkbox') {
    return (
      <div
        className='sf-form-preview-field__checkbox-group'
        role='group'
        aria-describedby={helpTextId}>
        {field.options?.map((opt, i) => (
          <label key={i} className='sf-form-preview-field__option'>
            <input type='checkbox' value={opt.value} disabled />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    );
  }

  return null;
}
