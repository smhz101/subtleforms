import { __ } from '@wordpress/i18n';
import './FieldRenderer.scss';

export default function FieldRenderer({ field }) {
  const { type, label, required, placeholder, options, subFields } = field;

  const labelClass = 'sf-field-renderer__label';
  const inputClass = 'sf-field-renderer__input';
  const selectClass = 'sf-field-renderer__select';
  const selectBg = `url('data:image/svg+xml;utf8,<svg fill="%238c8f94" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg"><path d="M5 6l5 5 5-5 2 1-7 7-7-7z"/></svg>')`;

  return (
    <div>
      {/* Label */}
      <label className={labelClass}>
        {label || field.name}
        {required && (
          <span className='sf-field-renderer__required-mark'>*</span>
        )}
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
          tabIndex='-1'
        />
      )}

      {type === 'number' && (
        <input
          type='number'
          placeholder={placeholder || ''}
          className={inputClass}
          readOnly
          tabIndex='-1'
        />
      )}

      {type === 'textarea' && (
        <textarea
          rows={4}
          placeholder={placeholder || ''}
          className={`${inputClass} resize-y`}
          readOnly
          tabIndex='-1'
        />
      )}

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

      {type === 'radio' && options && (
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
      )}

      {type === 'multiple_choice' && options && (
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
      )}

      {type === 'dropdown' && options && (
        <select
          className={selectClass}
          style={{ backgroundImage: selectBg }}
          disabled
          tabIndex='-1'>
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
        <div className='sf-country-field'>
          <select
            className={selectClass}
            style={{ backgroundImage: selectBg }}
            disabled
            tabIndex='-1'>
            <option>
              {placeholder || __('Select a country', 'subtleforms')}
            </option>
            <option>United States</option>
            <option>United Kingdom</option>
            <option>Canada</option>
            <option>Australia</option>
            <option>Germany</option>
            <option>France</option>
            <option>Spain</option>
            <option>Italy</option>
            <option>Japan</option>
            <option>China</option>
            <option>{__('...and 200+ more countries', 'subtleforms')}</option>
          </select>
        </div>
      )}

      {type === 'hidden' && (
        <div className='sf-field-renderer__hidden-field'>
          {__('Hidden field (not visible to users)', 'subtleforms')}
        </div>
      )}

      {type === 'html' && (
        <div className='sf-field-renderer__warning-box'>
          📝 {__('HTML Content Block', 'subtleforms')}
        </div>
      )}

      {type === 'image_upload' && (
        <div className='sf-field-renderer__image-placeholder'>
          <div className='sf-field-renderer__image-icon'>🖼️</div>
          <div className='sf-field-renderer__image-text'>
            {__('Click to upload or drag image here', 'subtleforms')}
          </div>
        </div>
      )}

      {type === 'file_upload' && (
        <div className='sf-field-renderer__file-placeholder'>
          <div className='sf-field-renderer__file-icon'>📎</div>
          <div className='sf-field-renderer__file-text'>
            {__('Click to upload or drag file here', 'subtleforms')}
          </div>
        </div>
      )}

      {/* Composite field: Address */}
      {type === 'address' && subFields && (
        <div className='sf-field-renderer__repeater-item'>
          {subFields.map((sub, idx) => (
            <div
              key={idx}
              className={
                idx < subFields.length - 1
                  ? 'sf-field-renderer__repeater-subfield'
                  : 'sf-field-renderer__repeater-subfield sf-field-renderer__repeater-subfield--last'
              }>
              <label className='sf-field-renderer__repeater-label'>
                {sub.label}
                {sub.required && (
                  <span className='sf-field-renderer__required-mark'>*</span>
                )}
              </label>
              <input type='text' className={inputClass} readOnly />
            </div>
          ))}
        </div>
      )}

      {/* Payment fields */}
      {type === 'payment_amount' && (
        <div className='sf-field-renderer__rating-wrapper'>
          {field.currency && (
            <span className='sf-field-renderer__rating-text'>
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
        <div className='sf-field-renderer__calculation-box'>
          <div className='sf-field-renderer__calc-row'>
            <span>{__('Subtotal:', 'subtleforms')}</span>
            <span>$0.00</span>
          </div>
          <div className='sf-field-renderer__calc-row'>
            <span>{__('Tax:', 'subtleforms')}</span>
            <span>$0.00</span>
          </div>
          <div className='sf-field-renderer__calc-total'>
            <span>{__('Total:', 'subtleforms')}</span>
            <span>$0.00</span>
          </div>
        </div>
      )}

      {type === 'payment_coupon' && (
        <div className='sf-field-renderer__subscribe-wrapper'>
          <input
            type='text'
            placeholder={placeholder || __('Enter coupon code', 'subtleforms')}
            className={`${inputClass} sf-field-renderer__subscribe-input`}
            readOnly
          />
          <button
            type='button'
            className='sf-field-renderer__subscribe-button'
            disabled>
            {__('Apply', 'subtleforms')}
          </button>
        </div>
      )}

      {type === 'payment_hidden_price' && (
        <div className='sf-field-renderer__hidden-field'>
          {__('Hidden pricing field (not visible to users)', 'subtleforms')}
        </div>
      )}

      {type === 'captcha' && (
        <div className='sf-captcha-preview'>
          <div className='sf-captcha-preview__icon'>🔒</div>
          <div className='sf-captcha-preview__content'>
            <div className='sf-captcha-preview__title'>
              {__('CAPTCHA Verification', 'subtleforms')}
            </div>
            <div className='sf-captcha-preview__description'>
              {__('CAPTCHA will appear here on the live form', 'subtleforms')}
            </div>
            {field.config?.providerName && (
              <div className='sf-captcha-preview__provider'>
                {field.config.providerName === 'recaptcha' && 'Google reCAPTCHA'}
                {field.config.providerName === 'hcaptcha' && 'hCaptcha'}
                {field.config.providerName === 'turnstile' && 'Cloudflare Turnstile'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
