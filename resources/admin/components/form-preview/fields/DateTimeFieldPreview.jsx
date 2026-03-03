import { __ } from '@wordpress/i18n';

/**
 * DateTimeFieldPreview Component
 *
 * Renders date and time input fields
 */
export default function DateTimeFieldPreview({ field, fieldId }) {
  const config = field.config || {};
  const helpText = config.help || '';
  const helpTextId = helpText ? `${fieldId}-help` : undefined;

  if (field.type === 'date') {
    return (
      <input
        id={fieldId}
        type='date'
        className='sf-form-preview-field__input'
        aria-describedby={helpTextId}
        disabled
      />
    );
  }

  if (field.type === 'time') {
    return (
      <input
        id={fieldId}
        type='time'
        className='sf-form-preview-field__input'
        aria-describedby={helpTextId}
        disabled
      />
    );
  }

  return null;
}
