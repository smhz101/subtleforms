import { __ } from '@wordpress/i18n';

export default function FieldRenderer({
  field,
  value,
  onChange,
  error,
  hiddenFields,
}) {
  const fieldKey = field.config?.key || field.key;
  const label = field.config?.label || field.label || fieldKey;
  const placeholder = field.config?.placeholder || '';
  const required = field.config?.required || false;
  const isHidden = hiddenFields?.has(fieldKey);

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
              value={value}
              onChange={onChange}
              error={error}
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
                  value={value}
                  onChange={onChange}
                  error={error}
                  hiddenFields={hiddenFields}
                />
              ))}
          </div>
        ))}
      </div>
    );
  }

  // Render input fields
  return (
    <div className={`subtleforms-field subtleforms-field-${field.type}`}>
      <label className='subtleforms-field-label'>
        {label}
        {required && <span className='subtleforms-required'>*</span>}
      </label>

      {renderInput(field, value, onChange, placeholder)}

      {error && <div className='subtleforms-field-error'>{error}</div>}
    </div>
  );
}

function renderInput(field, value, onChange, placeholder) {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'number':
    case 'phone':
      return (
        <input
          type={getInputType(field.type)}
          className='subtleforms-input'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      );

    case 'textarea':
      return (
        <textarea
          className='subtleforms-textarea'
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
        />
      );

    case 'checkbox':
      return (
        <label className='subtleforms-checkbox-label'>
          <input
            type='checkbox'
            className='subtleforms-checkbox'
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
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
          {options.map((option, index) => (
            <label
              key={option.value || index}
              className='subtleforms-radio-label'>
              <input
                type='radio'
                className='subtleforms-radio'
                name={field.config?.key || field.key}
                value={option.value}
                checked={value === option.value}
                onChange={(e) => onChange(e.target.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );

    case 'select':
    case 'dropdown':
      const selectOptions = field.config?.options || [];
      return (
        <select
          className='subtleforms-select'
          value={value}
          onChange={(e) => onChange(e.target.value)}>
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

    case 'hidden':
      return (
        <input
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
            type='number'
            className='subtleforms-input'
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
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
            type='text'
            className='subtleforms-input'
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              field.config?.placeholder ||
              __('Enter coupon code', 'subtleforms')
            }
            maxLength={field.config?.maxLength || 50}
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
