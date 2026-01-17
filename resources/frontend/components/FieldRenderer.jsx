import { __ } from '@wordpress/i18n';
import { getIn } from '../utils/valuePaths';

export default function FieldRenderer({
  field,
  fieldPath,
  values,
  onChange,
  errors,
  hiddenFields,
}) {
  const resolvedPath = fieldPath || field.config?.key || field.key;
  const label = field.config?.label || field.label || resolvedPath;
  const placeholder = field.config?.placeholder || '';
  const required = field.config?.required || false;
  const isHidden = hiddenFields?.has(resolvedPath);

  // Accessible input id
  const inputId = `subtleforms-field-${(resolvedPath || field.key).replace(
    /[^a-zA-Z0-9\-_:.]/g,
    '-'
  )}`;

  const error = errors?.[resolvedPath];

  if (isHidden) {
    return null;
  }

  // Handle container fields
  if (field.type === 'group_container' || field.type === 'repeat_container') {
    return (
      <div className='subtleforms-field subtleforms-field-container'>
        {field.config?.label && (
          <div className='subtleforms-container-label'>
            {field.config.label}
          </div>
        )}
        {field.children &&
          field.children.map((child) => (
            <FieldRenderer
              key={child.config?.key || child.key}
              field={child}
              onChange={onChange}
              fieldPath={child.config?.key || child.key}
              values={values}
              errors={errors}
              hiddenFields={hiddenFields}
            />
          ))}
      </div>
    );
  }

  // Handle column containers
  if (field.type?.includes('_column_container')) {
    const columnCount = parseInt(
      field.type.replace('_column_container', ''),
      10
    );
    const columns = field.columns || [];

    return (
      <div
        className={`subtleforms-field subtleforms-field-columns subtleforms-columns-${columnCount}`}>
        {columns.map((columnFields, colIndex) => (
          <div key={colIndex} className='subtleforms-column'>
            {Array.isArray(columnFields) &&
              columnFields.map((child) => (
                <FieldRenderer
                  key={child.config?.key || child.key}
                  field={child}
                  onChange={onChange}
                  fieldPath={child.config?.key || child.key}
                  values={values}
                  errors={errors}
                  hiddenFields={hiddenFields}
                />
              ))}
          </div>
        ))}
      </div>
    );
  }

  const value = getIn(values, resolvedPath, '');

  // Handle reCAPTCHA v3 separately (invisible, no label/wrapper needed)
  if (
    (field.type === 'captcha' ||
      field.type === 'recaptcha' ||
      field.type === 'hcaptcha' ||
      field.type === 'turnstile') &&
    field.config?.captchaHtml?.includes('subtleforms-recaptcha-v3')
  ) {
    console.log('[SubtleForms] Rendering reCAPTCHA v3 (invisible)');
    return (
      <div
        className='subtleforms-captcha-hidden'
        dangerouslySetInnerHTML={{ __html: field.config?.captchaHtml || '' }}
      />
    );
  }

  // Render input fields
  return (
    <div className={`subtleforms-field subtleforms-field-${field.type}`}>
      <label htmlFor={inputId} className='subtleforms-field-label'>
        {label}
        {required && <span className='subtleforms-required'>*</span>}
      </label>

      {renderInput(
        field,
        value,
        (next) => onChange(resolvedPath, next),
        placeholder,
        inputId,
        required,
        error
      )}

      {error && <div className='subtleforms-field-error'>{error}</div>}
    </div>
  );
}

function renderInput(
  field,
  value,
  onChange,
  placeholder,
  inputId,
  required,
  error
) {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'number':
    case 'phone':
      return (
        <input
          id={inputId}
          type={getInputType(field.type)}
          className='subtleforms-input'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-required={required}
          aria-invalid={!!error}
        />
      );

    case 'textarea':
      return (
        <textarea
          id={inputId}
          className='subtleforms-textarea'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          aria-required={required}
          aria-invalid={!!error}
        />
      );

    case 'checkbox':
      return (
        <label className='subtleforms-checkbox-label' htmlFor={inputId}>
          <input
            id={inputId}
            type='checkbox'
            className='subtleforms-checkbox'
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            aria-required={required}
            aria-invalid={!!error}
          />
          <span>
            {field.config?.checkboxLabel || __('I agree', 'subtleforms')}
          </span>
        </label>
      );

    case 'radio':
    case 'multiple_choice':
      const options = field.config?.options || [];
      return (
        <div className='subtleforms-radio-group'>
          {options.map((option, index) => {
            const optionId = `${inputId}-${index}`;
            return (
              <label
                key={option.value || index}
                htmlFor={optionId}
                className='subtleforms-radio-label'>
                <input
                  id={optionId}
                  type='radio'
                  className='subtleforms-radio'
                  name={field.config?.key || field.key}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => onChange(e.target.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      );

    case 'select':
    case 'dropdown':
      const selectOptions = field.config?.options || [];
      return (
        <select
          id={inputId}
          className='subtleforms-select'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-required={required}
          aria-invalid={!!error}>
          <option value=''>
            {placeholder || __('Select an option', 'subtleforms')}
          </option>
          {selectOptions.map((option, index) => (
            <option key={option.value || index} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case 'country':
      const countryList = field.config?.countryList || [];
      const outputFormat = field.config?.output_format || 'code';
      const searchable = field.config?.searchable !== false;
      return (
        <select
          id={inputId}
          className='subtleforms-select subtleforms-country-select'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-required={required}
          aria-invalid={!!error}
          data-searchable={searchable}>
          <option value=''>
            {placeholder || __('Select a country', 'subtleforms')}
          </option>
          {countryList.map((country, index) => (
            <option
              key={country.value || index}
              value={outputFormat === 'code' ? country.value : country.label}>
              {country.label}
            </option>
          ))}
        </select>
      );

    case 'hidden':
      return (
        <input
          id={inputId}
          type='hidden'
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'payment_amount':
      const min = field.config?.min || 0;
      const max = field.config?.max;
      const step = field.config?.step || 0.01;
      const currency = field.config?.currency || 'USD';
      const showSymbol = field.config?.showCurrencySymbol !== false;
      const currencySymbol =
        currency === 'USD'
          ? '$'
          : currency === 'EUR'
          ? '€'
          : currency === 'GBP'
          ? '£'
          : '';

      return (
        <div className='subtleforms-payment-amount'>
          {showSymbol && currencySymbol && (
            <span className='subtleforms-currency-symbol'>
              {currencySymbol}
            </span>
          )}
          <input
            id={inputId}
            type='number'
            className='subtleforms-input'
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            aria-required={required}
            aria-invalid={!!error}
          />
        </div>
      );

    case 'payment_summary':
      // Payment summary is typically calculated server-side
      // This is a read-only display component
      return (
        <div className='subtleforms-payment-summary'>
          {field.config?.showSubtotal && (
            <div className='summary-line'>
              <span>{__('Subtotal:', 'subtleforms')}</span>
              <span>{value?.subtotal || '0.00'}</span>
            </div>
          )}
          {field.config?.showTax && (
            <div className='summary-line'>
              <span>{__('Tax:', 'subtleforms')}</span>
              <span>{value?.tax || '0.00'}</span>
            </div>
          )}
          {field.config?.showTotal && (
            <div className='summary-line summary-total'>
              <span>{__('Total:', 'subtleforms')}</span>
              <span>{value?.total || '0.00'}</span>
            </div>
          )}
        </div>
      );

    case 'payment_coupon':
      return (
        <div className='subtleforms-payment-coupon'>
          <input
            id={inputId}
            type='text'
            className='subtleforms-input'
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              field.config?.placeholder ||
              __('Enter coupon code', 'subtleforms')
            }
            maxLength={field.config?.maxLength || 50}
            aria-required={required}
            aria-invalid={!!error}
          />
          <button
            type='button'
            className='subtleforms-button subtleforms-coupon-apply'
            onClick={() => {
              // Trigger coupon validation
              if (window.subtleformsApplyCoupon) {
                window.subtleformsApplyCoupon(value);
              }
            }}>
            {field.config?.buttonText || __('Apply', 'subtleforms')}
          </button>
        </div>
      );

    case 'payment_hidden_price':
      // Hidden pricing field - not rendered
      return null;

    case 'captcha':
    case 'recaptcha':
    case 'hcaptcha':
    case 'turnstile':
      // CAPTCHA widget - rendered via provider-specific HTML
      // Note: reCAPTCHA v3 is handled earlier to avoid wrapper/label
      if (field.config?.captchaHtml) {
        console.log('[SubtleForms] CAPTCHA rendering:', {
          type: field.type,
          provider: field.config.providerName,
          htmlLength: field.config.captchaHtml.length,
        });
      } else {
        console.error(
          '[SubtleForms] CAPTCHA HTML is missing! Check if CAPTCHA is enabled and keys are configured in Settings > Advanced.'
        );
      }

      return (
        <div
          className='subtleforms-captcha-container'
          dangerouslySetInnerHTML={{ __html: field.config?.captchaHtml || '' }}
        />
      );

    case 'name_group':
      const nameValue = typeof value === 'object' ? value : {};
      return (
        <div className='subtleforms-name-group'>
          {field.config?.enable_prefix && (
            <div className='subtleforms-name-part'>
              <label
                htmlFor={`${inputId}-prefix`}
                className='subtleforms-field-label'>
                {__('Prefix', 'subtleforms')}
              </label>
              <select
                id={`${inputId}-prefix`}
                className='subtleforms-select'
                value={nameValue.prefix || ''}
                onChange={(e) =>
                  onChange({ ...nameValue, prefix: e.target.value })
                }
                aria-invalid={!!error}>
                <option value=''>{__('Select...', 'subtleforms')}</option>
                {(
                  field.config?.prefix_options || [
                    'Mr.',
                    'Ms.',
                    'Mrs.',
                    'Dr.',
                    'Prof.',
                  ]
                ).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}
          {field.config?.enable_first_name !== false && (
            <div className='subtleforms-name-part'>
              <label
                htmlFor={`${inputId}-first`}
                className='subtleforms-field-label'>
                {__('First Name', 'subtleforms')}
                {required && <span className='subtleforms-required'>*</span>}
              </label>
              <input
                id={`${inputId}-first`}
                type='text'
                className='subtleforms-input'
                value={nameValue.first || ''}
                onChange={(e) =>
                  onChange({ ...nameValue, first: e.target.value })
                }
                placeholder={__('First Name', 'subtleforms')}
                aria-required={required}
                aria-invalid={!!error}
              />
            </div>
          )}
          {field.config?.enable_middle_name && (
            <div className='subtleforms-name-part'>
              <label
                htmlFor={`${inputId}-middle`}
                className='subtleforms-field-label'>
                {__('Middle Name', 'subtleforms')}
              </label>
              <input
                id={`${inputId}-middle`}
                type='text'
                className='subtleforms-input'
                value={nameValue.middle || ''}
                onChange={(e) =>
                  onChange({ ...nameValue, middle: e.target.value })
                }
                placeholder={__('Middle Name', 'subtleforms')}
                aria-invalid={!!error}
              />
            </div>
          )}
          {field.config?.enable_last_name !== false && (
            <div className='subtleforms-name-part'>
              <label
                htmlFor={`${inputId}-last`}
                className='subtleforms-field-label'>
                {__('Last Name', 'subtleforms')}
                {required && <span className='subtleforms-required'>*</span>}
              </label>
              <input
                id={`${inputId}-last`}
                type='text'
                className='subtleforms-input'
                value={nameValue.last || ''}
                onChange={(e) =>
                  onChange({ ...nameValue, last: e.target.value })
                }
                placeholder={__('Last Name', 'subtleforms')}
                aria-required={required}
                aria-invalid={!!error}
              />
            </div>
          )}
          {field.config?.enable_suffix && (
            <div className='subtleforms-name-part'>
              <label
                htmlFor={`${inputId}-suffix`}
                className='subtleforms-field-label'>
                {__('Suffix', 'subtleforms')}
              </label>
              <select
                id={`${inputId}-suffix`}
                className='subtleforms-select'
                value={nameValue.suffix || ''}
                onChange={(e) =>
                  onChange({ ...nameValue, suffix: e.target.value })
                }
                aria-invalid={!!error}>
                <option value=''>{__('Select...', 'subtleforms')}</option>
                {(
                  field.config?.suffix_options || [
                    'Jr.',
                    'Sr.',
                    'II',
                    'III',
                    'IV',
                  ]
                ).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      );

    case 'address_group':
      const addressValue = typeof value === 'object' ? value : {};
      return (
        <div className='subtleforms-address-group'>
          {field.config?.enable_street1 !== false && (
            <div className='subtleforms-address-part'>
              <label
                htmlFor={`${inputId}-street1`}
                className='subtleforms-field-label'>
                {__('Street Address', 'subtleforms')}
                {required && <span className='subtleforms-required'>*</span>}
              </label>
              <input
                id={`${inputId}-street1`}
                type='text'
                className='subtleforms-input'
                value={addressValue.street1 || ''}
                onChange={(e) =>
                  onChange({ ...addressValue, street1: e.target.value })
                }
                placeholder={__('Street Address', 'subtleforms')}
                aria-required={required}
                aria-invalid={!!error}
              />
            </div>
          )}
          {field.config?.enable_street2 !== false && (
            <div className='subtleforms-address-part'>
              <label
                htmlFor={`${inputId}-street2`}
                className='subtleforms-field-label'>
                {__('Street Address Line 2', 'subtleforms')}
              </label>
              <input
                id={`${inputId}-street2`}
                type='text'
                className='subtleforms-input'
                value={addressValue.street2 || ''}
                onChange={(e) =>
                  onChange({ ...addressValue, street2: e.target.value })
                }
                placeholder={__('Apt, Suite, etc.', 'subtleforms')}
                aria-invalid={!!error}
              />
            </div>
          )}
          {field.config?.enable_city !== false && (
            <div className='subtleforms-address-part'>
              <label
                htmlFor={`${inputId}-city`}
                className='subtleforms-field-label'>
                {__('City', 'subtleforms')}
                {required && <span className='subtleforms-required'>*</span>}
              </label>
              <input
                id={`${inputId}-city`}
                type='text'
                className='subtleforms-input'
                value={addressValue.city || ''}
                onChange={(e) =>
                  onChange({ ...addressValue, city: e.target.value })
                }
                placeholder={__('City', 'subtleforms')}
                aria-required={required}
                aria-invalid={!!error}
              />
            </div>
          )}
          {field.config?.enable_state !== false && (
            <div className='subtleforms-address-part'>
              <label
                htmlFor={`${inputId}-state`}
                className='subtleforms-field-label'>
                {__('State / Province', 'subtleforms')}
                {required && <span className='subtleforms-required'>*</span>}
              </label>
              <input
                id={`${inputId}-state`}
                type='text'
                className='subtleforms-input'
                value={addressValue.state || ''}
                onChange={(e) =>
                  onChange({ ...addressValue, state: e.target.value })
                }
                placeholder={__('State / Province', 'subtleforms')}
                aria-required={required}
                aria-invalid={!!error}
              />
            </div>
          )}
          {field.config?.enable_postal_code !== false && (
            <div className='subtleforms-address-part'>
              <label
                htmlFor={`${inputId}-postal`}
                className='subtleforms-field-label'>
                {__('Postal Code', 'subtleforms')}
                {required && <span className='subtleforms-required'>*</span>}
              </label>
              <input
                id={`${inputId}-postal`}
                type='text'
                className='subtleforms-input'
                value={addressValue.postal_code || ''}
                onChange={(e) =>
                  onChange({ ...addressValue, postal_code: e.target.value })
                }
                placeholder={__('Postal Code', 'subtleforms')}
                aria-required={required}
                aria-invalid={!!error}
              />
            </div>
          )}
          {field.config?.enable_country !== false && (
            <div className='subtleforms-address-part'>
              <label
                htmlFor={`${inputId}-country`}
                className='subtleforms-field-label'>
                {__('Country', 'subtleforms')}
                {required && <span className='subtleforms-required'>*</span>}
              </label>
              <select
                id={`${inputId}-country`}
                className='subtleforms-select'
                value={addressValue.country || ''}
                onChange={(e) =>
                  onChange({ ...addressValue, country: e.target.value })
                }
                aria-required={required}
                aria-invalid={!!error}>
                <option value=''>{__('Select Country', 'subtleforms')}</option>
                {/* Country list would be populated here */}
              </select>
            </div>
          )}
        </div>
      );

    default:
      return (
        <div className='subtleforms-unsupported'>
          {__('Field type not supported:', 'subtleforms')} {field.type}
        </div>
      );
  }
}

function getInputType(fieldType) {
  switch (fieldType) {
    case 'email':
      return 'email';
    case 'url':
      return 'url';
    case 'number':
      return 'number';
    case 'phone':
      return 'tel';
    default:
      return 'text';
  }
}
