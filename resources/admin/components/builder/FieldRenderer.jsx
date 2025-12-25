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
        {required && <span className='ml-1 text-danger'>*</span>}
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
        <div className='flex items-center gap-2'>
          <input
            type='checkbox'
            className='border-border rounded-none focus:ring-0 w-4 h-4 text-primary pointer-events-none'
          />
          <span className='text-text-primary text-sm'>{label}</span>
        </div>
      )}

      {type === 'radio' && options && (
        <div className='flex flex-col gap-2'>
          {options.map((opt, idx) => (
            <div key={idx} className='flex items-center gap-2'>
              <input
                type='radio'
                name={field.key}
                className='border-border rounded-full focus:ring-0 w-4 h-4 text-primary pointer-events-none'
              />
              <span className='text-text-primary text-sm'>{opt.label}</span>
            </div>
          ))}
        </div>
      )}

      {type === 'multiple_choice' && options && (
        <div className='flex flex-col gap-2'>
          {options.map((opt, idx) => (
            <div key={idx} className='flex items-center gap-2'>
              <input
                type='checkbox'
                className='border-border rounded-none focus:ring-0 w-4 h-4 text-primary pointer-events-none'
              />
              <span className='text-text-primary text-sm'>{opt.label}</span>
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
        <div className='bg-secondary p-3 border border-text-tertiary border-dashed rounded-none text-text-secondary text-xs italic'>
          {__('Hidden field (not visible to users)', 'subtleforms')}
        </div>
      )}

      {type === 'html' && (
        <div className='bg-yellow-50 p-3 border border-yellow-200 rounded-none text-yellow-800 text-xs'>
          📝 {__('HTML Content Block', 'subtleforms')}
        </div>
      )}

      {type === 'image_upload' && (
        <div className='bg-surface-alt p-10 border-2 border-border border-dashed rounded-none text-center'>
          <div className='mb-2 text-4xl'>🖼️</div>
          <div className='text-text-secondary text-xs'>
            {__('Click to upload or drag image here', 'subtleforms')}
          </div>
        </div>
      )}

      {type === 'file_upload' && (
        <div className='bg-surface-alt p-10 border-2 border-border border-dashed rounded-none text-center'>
          <div className='mb-2 text-4xl'>📎</div>
          <div className='text-text-secondary text-xs'>
            {__('Click to upload or drag file here', 'subtleforms')}
          </div>
        </div>
      )}

      {/* Composite field: Address */}
      {type === 'address' && subFields && (
        <div className='bg-surface-alt p-4 border border-border rounded-none'>
          {subFields.map((sub, idx) => (
            <div key={idx} className={idx < subFields.length - 1 ? 'mb-3' : ''}>
              <label className='block mb-1 font-medium text-text-primary text-sm'>
                {sub.label}
                {sub.required && <span className='ml-1 text-danger'>*</span>}
              </label>
              <input type='text' className={inputClass} readOnly />
            </div>
          ))}
        </div>
      )}

      {/* Payment fields */}
      {type === 'payment_amount' && (
        <div className='flex items-center gap-2'>
          {field.currency && (
            <span className='font-medium text-text-primary'>
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
        <div className='bg-surface-alt p-4 border border-border rounded-none'>
          <div className='flex justify-between mb-2 text-text-primary text-sm'>
            <span>{__('Subtotal:', 'subtleforms')}</span>
            <span>$0.00</span>
          </div>
          <div className='flex justify-between mb-2 text-text-primary text-sm'>
            <span>{__('Tax:', 'subtleforms')}</span>
            <span>$0.00</span>
          </div>
          <div className='flex justify-between pt-2 border-border border-t font-medium text-text-primary'>
            <span>{__('Total:', 'subtleforms')}</span>
            <span>$0.00</span>
          </div>
        </div>
      )}

      {type === 'payment_coupon' && (
        <div className='flex gap-2'>
          <input
            type='text'
            placeholder={placeholder || __('Enter coupon code', 'subtleforms')}
            className={`${inputClass} flex-1`}
            readOnly
          />
          <button
            type='button'
            className='bg-primary px-4 py-2 font-medium text-white text-sm pointer-events-none'
            disabled>
            {__('Apply', 'subtleforms')}
          </button>
        </div>
      )}

      {type === 'payment_hidden_price' && (
        <div className='bg-secondary p-3 border border-text-tertiary border-dashed rounded-none text-text-secondary text-xs italic'>
          {__('Hidden pricing field (not visible to users)', 'subtleforms')}
        </div>
      )}
    </div>
  );
}
