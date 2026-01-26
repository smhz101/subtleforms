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

      {type === 'date' && (
        <div className='sf-field-renderer__date-placeholder'>
          <span className='sf-field-renderer__date-icon'>📅</span>
          <span className='sf-field-renderer__date-text'>
            {placeholder || __('Select a date', 'subtleforms')}
          </span>
        </div>
      )}

      {type === 'time' && (
        <div className='sf-field-renderer__time-placeholder'>
          <span className='sf-field-renderer__time-icon'>🕐</span>
          <span className='sf-field-renderer__time-text'>
            {placeholder || __('Select a time', 'subtleforms')}
          </span>
        </div>
      )}

      {type === 'datetime' && (
        <div className='sf-field-renderer__datetime-placeholder'>
          <span className='sf-field-renderer__datetime-icon'>📅🕐</span>
          <span className='sf-field-renderer__datetime-text'>
            {placeholder || __('Select date and time', 'subtleforms')}
          </span>
        </div>
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
            <option>🇺🇸 United States</option>
            <option>🇬🇧 United Kingdom</option>
            <option>🇨🇦 Canada</option>
            <option>🇦🇺 Australia</option>
            <option>🇩🇪 Germany</option>
            <option>🇫🇷 France</option>
            <option>🇪🇸 Spain</option>
            <option>🇮🇹 Italy</option>
            <option>🇯🇵 Japan</option>
            <option>🇨🇳 China</option>
            <option>{__('...and 235+ more countries', 'subtleforms')}</option>
          </select>
          <div className='sf-country-field__info'>
            <span className='dashicons dashicons-admin-site'></span>
            <span className='sf-country-field__text'>
              {__(
                'Full ISO-3166 country list available on frontend',
                'subtleforms'
              )}
            </span>
          </div>
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
          <div className='sf-field-renderer__calc-header'>
            <span className='sf-field-renderer__calc-icon'>📋</span>
            <span className='sf-field-renderer__calc-title'>
              {__('Payment Summary', 'subtleforms')}
            </span>
          </div>
          <div className='sf-field-renderer__calc-divider'></div>
          <div className='sf-field-renderer__calc-row'>
            <span>
              <span className='sf-field-renderer__calc-row-icon'>💵</span>
              {__('Subtotal:', 'subtleforms')}
            </span>
            <span className='sf-field-renderer__calc-value'>$0.00</span>
          </div>
          <div className='sf-field-renderer__calc-row'>
            <span>
              <span className='sf-field-renderer__calc-row-icon'>🏦</span>
              {__('Tax:', 'subtleforms')}
            </span>
            <span className='sf-field-renderer__calc-value'>$0.00</span>
          </div>
          <div className='sf-field-renderer__calc-row sf-field-renderer__calc-row--discount'>
            <span>
              <span className='sf-field-renderer__calc-row-icon'>🏷️</span>
              {__('Discount:', 'subtleforms')}
            </span>
            <span className='sf-field-renderer__calc-value sf-field-renderer__calc-value--discount'>-$0.00</span>
          </div>
          <div className='sf-field-renderer__calc-divider sf-field-renderer__calc-divider--bold'></div>
          <div className='sf-field-renderer__calc-total'>
            <span>
              <span className='sf-field-renderer__calc-total-icon'>💰</span>
              {__('Total:', 'subtleforms')}
            </span>
            <span className='sf-field-renderer__calc-total-value'>$0.00</span>
          </div>
          <div className='sf-field-renderer__calc-footer'>
            <span className='sf-field-renderer__calc-footer-icon'>ℹ️</span>
            <span className='sf-field-renderer__calc-footer-text'>
              {__('Amount will be calculated automatically', 'subtleforms')}
            </span>
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
          <div className='sf-captcha-preview__header'>
            <div className='sf-captcha-preview__icon'>🛡️</div>
            <div className='sf-captcha-preview__title-group'>
              <div className='sf-captcha-preview__title'>
                {__('Security Verification', 'subtleforms')}
              </div>
              <div className='sf-captcha-preview__subtitle'>
                {__('Verify you\'re human', 'subtleforms')}
              </div>
            </div>
          </div>
          
          <div className='sf-captcha-preview__body'>
            <div className='sf-captcha-preview__checkbox-wrapper'>
              <div className='sf-captcha-preview__checkbox'></div>
              <span className='sf-captcha-preview__checkbox-label'>
                {__('I\'m not a robot', 'subtleforms')}
              </span>
            </div>
            
            {field.config?.providerName && (
              <div className='sf-captcha-preview__provider-badge'>
                {field.config.providerName === 'recaptcha' && (
                  <>
                    <span className='sf-captcha-preview__provider-icon'>🔐</span>
                    <span>Google reCAPTCHA</span>
                  </>
                )}
                {field.config.providerName === 'hcaptcha' && (
                  <>
                    <span className='sf-captcha-preview__provider-icon'>✅</span>
                    <span>hCaptcha</span>
                  </>
                )}
                {field.config.providerName === 'turnstile' && (
                  <>
                    <span className='sf-captcha-preview__provider-icon'>☁️</span>
                    <span>Cloudflare Turnstile</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className='sf-captcha-preview__footer'>
            <div className='sf-captcha-preview__status'>
              <span className='sf-captcha-preview__status-icon'>ℹ️</span>
              {__('CAPTCHA will appear here on the live form', 'subtleforms')}
            </div>
          </div>
        </div>
      )}

      {type === 'name_group' && (
        <div className='sf-field-renderer__name-group'>
          {field.enable_first_name !== false && (
            <div className='sf-field-renderer__name-part'>
              <label className={labelClass}>
                {__('First Name', 'subtleforms')}
              </label>
              <input
                type='text'
                placeholder={__('First Name', 'subtleforms')}
                className={inputClass}
                readOnly
                tabIndex='-1'
              />
            </div>
          )}
          {field.enable_middle_name && (
            <div className='sf-field-renderer__name-part'>
              <label className={labelClass}>
                {__('Middle Name', 'subtleforms')}
              </label>
              <input
                type='text'
                placeholder={__('Middle Name', 'subtleforms')}
                className={inputClass}
                readOnly
                tabIndex='-1'
              />
            </div>
          )}
          {field.enable_last_name !== false && (
            <div className='sf-field-renderer__name-part'>
              <label className={labelClass}>
                {__('Last Name', 'subtleforms')}
              </label>
              <input
                type='text'
                placeholder={__('Last Name', 'subtleforms')}
                className={inputClass}
                readOnly
                tabIndex='-1'
              />
            </div>
          )}
        </div>
      )}

      {type === 'address_group' && (
        <div className='sf-field-renderer__address-group'>
          {field.enable_street1 !== false && (
            <div className='sf-field-renderer__address-part sf-field-renderer__address-part--full'>
              <label className={labelClass}>
                {__('Street Address', 'subtleforms')}
              </label>
              <input
                type='text'
                placeholder={__('Street Address', 'subtleforms')}
                className={inputClass}
                readOnly
                tabIndex='-1'
              />
            </div>
          )}
          {field.enable_street2 && (
            <div className='sf-field-renderer__address-part sf-field-renderer__address-part--full'>
              <label className={labelClass}>
                {__('Street Address Line 2', 'subtleforms')}
              </label>
              <input
                type='text'
                placeholder={__('Apt, Suite, etc.', 'subtleforms')}
                className={inputClass}
                readOnly
                tabIndex='-1'
              />
            </div>
          )}
          {field.enable_city !== false && (
            <div className='sf-field-renderer__address-part'>
              <label className={labelClass}>{__('City', 'subtleforms')}</label>
              <input
                type='text'
                placeholder={__('City', 'subtleforms')}
                className={inputClass}
                readOnly
                tabIndex='-1'
              />
            </div>
          )}
          {field.enable_state !== false && (
            <div className='sf-field-renderer__address-part'>
              <label className={labelClass}>
                {__('State / Province', 'subtleforms')}
              </label>
              <input
                type='text'
                placeholder={__('State / Province', 'subtleforms')}
                className={inputClass}
                readOnly
                tabIndex='-1'
              />
            </div>
          )}
          {field.enable_postal_code !== false && (
            <div className='sf-field-renderer__address-part'>
              <label className={labelClass}>
                {__('Postal Code', 'subtleforms')}
              </label>
              <input
                type='text'
                placeholder={__('Postal Code', 'subtleforms')}
                className={inputClass}
                readOnly
                tabIndex='-1'
              />
            </div>
          )}
          {field.enable_country !== false && (
            <div className='sf-field-renderer__address-part'>
              <label className={labelClass}>
                {__('Country', 'subtleforms')}
              </label>
              <select className={selectClass} readOnly tabIndex='-1'>
                <option value=''>{__('Select Country', 'subtleforms')}</option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
