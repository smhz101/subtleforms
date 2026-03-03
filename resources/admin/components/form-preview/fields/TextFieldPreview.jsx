import { __ } from '@wordpress/i18n';

/**
 * TextFieldPreview Component
 *
 * Renders text-based input fields: text, email, tel, url, number, textarea
 */
export default function TextFieldPreview({ field, fieldId }) {
  const config = field.config || {};
  const placeholder = config.placeholder || '';
  const helpText = config.help || '';
  const helpTextId = helpText ? `${fieldId}-help` : undefined;

  // Text input types
  if (['text', 'email', 'tel', 'url'].includes(field.type)) {
    return (
      <input
        id={fieldId}
        type={field.type}
        placeholder={placeholder}
        className='sf-form-preview-field__input'
        aria-describedby={helpTextId}
        disabled
      />
    );
  }

  // Number input
  if (field.type === 'number') {
    return (
      <input
        id={fieldId}
        type='number'
        placeholder={placeholder}
        min={config.min}
        max={config.max}
        step={config.step}
        className='sf-form-preview-field__input'
        aria-describedby={helpTextId}
        disabled
      />
    );
  }

  // Textarea
  if (field.type === 'textarea') {
    return (
      <textarea
        id={fieldId}
        placeholder={placeholder}
        rows={config.rows || 4}
        className='sf-form-preview-field__input'
        aria-describedby={helpTextId}
        disabled
      />
    );
  }

  return null;
}
