import { __ } from '@wordpress/i18n';

export default function FieldRenderer({ field }) {
  const { type, label, required, placeholder, options, subFields } = field;

  const labelClass = 'block mb-2 text-sm font-medium text-text-primary';
  const inputClass =
    'w-full px-3 py-2 text-sm border border-border rounded-none font-inherit pointer-events-none bg-white text-text-primary';
  const selectClass = `${inputClass} appearance-none pr-9 bg-no-repeat bg-[right_8px_center]`;
  const selectBg = `url('data:image/svg+xml;utf8,<svg fill="%238c8f94" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M5 6l5 5 5-5 2 1-7 7-7-7z"/></svg>')`;

  return (
    <div>
      {/* Label */}
      <label className={labelClass}>
        {label || field.name}
        {required && <span className='sf-ml-1 sf-text-danger'>*</span>}
      </label>

      {/* Render appropriate input based on type */}
      {(type === 'text' ||
        type === 'email' ||
        type === 'phone' ||
        type === 'url') && (
        <input
          type={type === 'email' ? 'email' : type === 'url' ? 'url' : 'text'}
          placeholder={placeholder || ''}
          className={inputClass}
          readOnly
        />
      )}

      {type === 'number' && (
        <input
          type='number'
          placeholder={placeholder || ''}
          className={inputClass}
          readOnly
        />
      )}

      {type === 'textarea' && (
        <textarea
          rows={4}
          placeholder={placeholder || ''}
          className={`${inputClass} resize-y`}
          readOnly
        />
      )}

      {type === 'checkbox' && (
        <div className='sf-flex sf-items-center sf-gap-2'>
          <input
            type='checkbox'
            className='sf-border-border rounded-none focus:ring-0 sf-w-4 sf-h-4 sf-text-primary sf-pointer-events-none'
          />
          <span className='sf-text-text-primary sf-text-sm'>{label}</span>
        </div>
      )}

      {type === 'radio' && options && (
        <div className='sf-flex sf-flex-col sf-gap-2'>
          {options.map((opt, idx) => (
            <div key={idx} className='sf-flex sf-items-center sf-gap-2'>
              <input
                type='radio'
                name={field.key}
                className='sf-border-border rounded-full focus:ring-0 sf-w-4 sf-h-4 sf-text-primary sf-pointer-events-none'
              />
              <span className='sf-text-text-primary sf-text-sm'>{opt.label}</span>
            </div>
          ))}
        </div>
      )}

      {type === 'multiple_choice' && options && (
        <div className='sf-flex sf-flex-col sf-gap-2'>
          {options.map((opt, idx) => (
            <div key={idx} className='sf-flex sf-items-center sf-gap-2'>
              <input
                type='checkbox'
                className='sf-border-border rounded-none focus:ring-0 sf-w-4 sf-h-4 sf-text-primary sf-pointer-events-none'
              />
              <span className='sf-text-text-primary sf-text-sm'>{opt.label}</span>
            </div>
          ))}
        </div>
      )}

      {type === 'dropdown' && options && (
        <select
          className={selectClass}
          style={{ backgroundImage: selectBg }}
          disabled>
          <option>
            {placeholder || __('Select an option', 'subtleforms')}
          </option>
          {options.map((opt, idx) => (
            <option key={idx} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {type === 'date' && <input type='date' className={inputClass} readOnly />}

      {type === 'time' && <input type='time' className={inputClass} readOnly />}

      {type === 'datetime' && (
        <input type='datetime-local' className={inputClass} readOnly />
      )}

      {type === 'country' && (
        <select
          className={selectClass}
          style={{ backgroundImage: selectBg }}
          disabled>
          <option>{__('Select a country', 'subtleforms')}</option>
          <option>United States</option>
          <option>Canada</option>
          <option>United Kingdom</option>
        </select>
      )}

      {type === 'hidden' && (
        <div className='sf-bg-secondary sf-p-3 sf-border sf-border-text-tertiary sf-border-dashed rounded-none sf-text-text-secondary sf-text-xs italic'>
          {__('Hidden field (not visible to users)', 'subtleforms')}
        </div>
      )}

      {type === 'html' && (
        <div className='sf-bg-yellow-50 sf-p-3 sf-border sf-border-yellow-200 rounded-none sf-text-yellow-800 sf-text-xs'>
          📝 {__('HTML Content Block', 'subtleforms')}
        </div>
      )}

      {type === 'image_upload' && (
        <div className='sf-bg-surface-alt sf-p-10 sf-border-2 sf-border-border sf-border-dashed rounded-none sf-text-center'>
          <div className='sf-mb-2 sf-text-4xl'>🖼️</div>
          <div className='sf-text-text-secondary sf-text-xs'>
            {__('Click to upload or drag image here', 'subtleforms')}
          </div>
        </div>
      )}

      {type === 'file_upload' && (
        <div className='sf-bg-surface-alt sf-p-10 sf-border-2 sf-border-border sf-border-dashed rounded-none sf-text-center'>
          <div className='sf-mb-2 sf-text-4xl'>📎</div>
          <div className='sf-text-text-secondary sf-text-xs'>
            {__('Click to upload or drag file here', 'subtleforms')}
          </div>
        </div>
      )}

      {/* Composite field: Address */}
      {type === 'address' && subFields && (
        <div className='sf-bg-surface-alt sf-p-4 sf-border sf-border-border rounded-none'>
          {subFields.map((sub, idx) => (
            <div key={idx} className={idx < subFields.length - 1 ? 'mb-3' : ''}>
              <label className='sf-block sf-mb-1 sf-font-medium sf-text-text-primary sf-text-sm'>
                {sub.label}
                {sub.required && <span className='sf-ml-1 sf-text-danger'>*</span>}
              </label>
              <input type='text' className={inputClass} readOnly />
            </div>
          ))}
        </div>
      )}

      {/* Payment fields */}
      {type === 'payment_amount' && (
        <div className='sf-flex sf-items-center sf-gap-2'>
          {field.currency && (
            <span className='sf-font-medium sf-text-text-primary'>
              {field.currency === 'USD'
                ? '$'
                : field.currency === 'EUR'
                ? '€'
                : field.currency === 'GBP'
                ? '£'
                : field.currency}
            </span>
          )}
          <input
            type='number'
            placeholder={placeholder || '0.00'}
            className={inputClass}
            readOnly
          />
        </div>
      )}

      {type === 'payment_summary' && (
        <div className='sf-bg-surface-alt sf-p-4 sf-border sf-border-border rounded-none'>
          <div className='sf-flex sf-justify-between sf-mb-2 sf-text-text-primary sf-text-sm'>
            <span>{__('Subtotal:', 'subtleforms')}</span>
            <span>$0.00</span>
          </div>
          <div className='sf-flex sf-justify-between sf-mb-2 sf-text-text-primary sf-text-sm'>
            <span>{__('Tax:', 'subtleforms')}</span>
            <span>$0.00</span>
          </div>
          <div className='sf-flex sf-justify-between sf-pt-2 sf-border-border sf-border-t sf-font-medium sf-text-text-primary'>
            <span>{__('Total:', 'subtleforms')}</span>
            <span>$0.00</span>
          </div>
        </div>
      )}

      {type === 'payment_coupon' && (
        <div className='sf-flex sf-gap-2'>
          <input
            type='text'
            placeholder={placeholder || __('Enter coupon code', 'subtleforms')}
            className={`${inputClass} flex-1`}
            readOnly
          />
          <button
            type='button'
            className='sf-bg-primary sf-px-4 sf-py-2 sf-font-medium sf-text-white sf-text-sm sf-pointer-events-none'
            disabled>
            {__('Apply', 'subtleforms')}
          </button>
        </div>
      )}

      {type === 'payment_hidden_price' && (
        <div className='sf-bg-secondary sf-p-3 sf-border sf-border-text-tertiary sf-border-dashed rounded-none sf-text-text-secondary sf-text-xs italic'>
          {__('Hidden pricing field (not visible to users)', 'subtleforms')}
        </div>
      )}
    </div>
  );
}
