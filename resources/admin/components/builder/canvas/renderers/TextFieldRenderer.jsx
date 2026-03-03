/**
 * TextFieldRenderer.jsx
 * 
 * Renders text-based input fields: text, email, phone, url, number, textarea
 */

import { __ } from '@wordpress/i18n';

export default function TextFieldRenderer({ field }) {
  const { type, label, required, placeholder } = field;

  const labelClass = 'sf-field-renderer__label';
  const inputClass = 'sf-field-renderer__input';

  return (
    <div>
      {/* Label */}
      <label className={labelClass}>
        {label || field.name}
        {required && (
          <span className='sf-field-renderer__required-mark'>*</span>
        )}
      </label>

      {/* Text input (text, email, phone, url) */}
      {(type === 'text' ||
        type === 'email' ||
        type === 'phone' ||
        type === 'url') && (
        <input
          type={type === 'email' ? 'email' : type === 'url' ? 'url' : 'text'}
          placeholder={placeholder || ''}
          className={inputClass}
          readOnly
          tabIndex='-1'
        />
      )}

      {/* Number input */}
      {type === 'number' && (
        <input
          type='number'
          placeholder={placeholder || ''}
          className={inputClass}
          readOnly
          tabIndex='-1'
        />
      )}

      {/* Textarea */}
      {type === 'textarea' && (
        <textarea
          rows={4}
          placeholder={placeholder || ''}
          className={`${inputClass} resize-y`}
          readOnly
          tabIndex='-1'
        />
      )}
    </div>
  );
}
