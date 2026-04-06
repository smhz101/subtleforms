import { __ } from '@wordpress/i18n';
import { getIn } from '../utils/valuePaths';

// ISO 3166-1 Alpha-2 country codes
const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AX', name: 'Åland Islands' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AI', name: 'Anguilla' },
  { code: 'AQ', name: 'Antarctica' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BM', name: 'Bermuda' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BQ', name: 'Bonaire, Sint Eustatius and Saba' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BV', name: 'Bouvet Island' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IO', name: 'British Indian Ocean Territory' },
  { code: 'BN', name: 'Brunei Darussalam' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'KY', name: 'Cayman Islands' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CX', name: 'Christmas Island' },
  { code: 'CC', name: 'Cocos (Keeling) Islands' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo, Democratic Republic of the' },
  { code: 'CK', name: 'Cook Islands' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CW', name: 'Curaçao' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FK', name: 'Falkland Islands (Malvinas)' },
  { code: 'FO', name: 'Faroe Islands' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GF', name: 'French Guiana' },
  { code: 'PF', name: 'French Polynesia' },
  { code: 'TF', name: 'French Southern Territories' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GI', name: 'Gibraltar' },
  { code: 'GR', name: 'Greece' },
  { code: 'GL', name: 'Greenland' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GP', name: 'Guadeloupe' },
  { code: 'GU', name: 'Guam' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GG', name: 'Guernsey' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HM', name: 'Heard Island and McDonald Islands' },
  { code: 'VA', name: 'Holy See' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IM', name: 'Isle of Man' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JE', name: 'Jersey' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KP', name: "Korea, Democratic People's Republic of" },
  { code: 'KR', name: 'Korea, Republic of' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: "Lao People's Democratic Republic" },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MO', name: 'Macao' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MQ', name: 'Martinique' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'YT', name: 'Mayotte' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MS', name: 'Montserrat' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NC', name: 'New Caledonia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NU', name: 'Niue' },
  { code: 'NF', name: 'Norfolk Island' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PS', name: 'Palestine, State of' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PN', name: 'Pitcairn' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RE', name: 'Réunion' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russian Federation' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'BL', name: 'Saint Barthélemy' },
  { code: 'SH', name: 'Saint Helena, Ascension and Tristan da Cunha' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'MF', name: 'Saint Martin (French part)' },
  { code: 'PM', name: 'Saint Pierre and Miquelon' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'Sao Tome and Principe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SX', name: 'Sint Maarten (Dutch part)' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'GS', name: 'South Georgia and the South Sandwich Islands' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SJ', name: 'Svalbard and Jan Mayen' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syrian Arab Republic' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania, United Republic of' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TK', name: 'Tokelau' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TC', name: 'Turks and Caicos Islands' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UM', name: 'United States Minor Outlying Islands' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Viet Nam' },
  { code: 'VG', name: 'Virgin Islands, British' },
  { code: 'VI', name: 'Virgin Islands, U.S.' },
  { code: 'WF', name: 'Wallis and Futuna' },
  { code: 'EH', name: 'Western Sahara' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

export default function FieldRenderer({
  field,
  fieldPath,
  values,
  onChange,
  errors,
  hiddenFields,
}) {
  // Normalise: the admin builder wraps properties under field.config, but the API
  // serves flat schema nodes where properties sit directly on the field object.
  // Using field.config when present keeps admin-builder usage intact; falling back
  // to field itself handles the flat API format.
  const config = field.config ?? field;

  const resolvedPath = fieldPath || config.key || field.key;
  const label = config.label || field.label || resolvedPath;
  const placeholder = config.placeholder || '';
  const required = config.required || false;
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
        {config.label && (
          <div className='subtleforms-container-label'>
            {config.label}
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

  // Plan A group fields — name_group / address_group with real child nodes.
  // Each child renders as an individual text input; its onChange writes to
  // "{parentPath}.{childKey}" so values are stored nested under the parent key:
  //   values.name_group_abc = { text_1: "John", text_3: "Doe" }
  // At submit time getIn(values, "name_group_abc") returns the full object,
  // yielding the required nested payload: { name_group_abc: { text_1: "John" } }.
  // Old forms without .children fall through to the legacy renderInput switch.
  if (
    (field.type === 'name_group' || field.type === 'address_group' || field.kind === 'group') &&
    Array.isArray(field.children) && field.children.length > 0
  ) {
    return (
      <fieldset className={`subtleforms-field subtleforms-field-${field.type} subtleforms-group-field`}>
        <legend className='subtleforms-field-label'>
          {label}
          {required && (
            <span className='subtleforms-required' aria-label=', required'>*</span>
          )}
        </legend>
        {field.children.map((child) => {
          const childKey = child.config?.key || child.key;
          const childPath = resolvedPath ? `${resolvedPath}.${childKey}` : childKey;
          return (
            <FieldRenderer
              key={childKey}
              field={child}
              fieldPath={childPath}
              values={values}
              onChange={onChange}
              errors={errors}
              hiddenFields={hiddenFields}
            />
          );
        })}
        {error && (
          <div className='subtleforms-field-error' role='alert' aria-live='assertive'>
            {error}
          </div>
        )}
      </fieldset>
    );
  }

  const value = getIn(values, resolvedPath, '');

  // Handle reCAPTCHA v3 separately (invisible, no label/wrapper needed)
  if (
    (field.type === 'captcha' ||
      field.type === 'recaptcha' ||
      field.type === 'hcaptcha' ||
      field.type === 'turnstile') &&
    config.captchaHtml?.includes('subtleforms-recaptcha-v3')
  ) {
    console.log('[SubtleForms] Rendering reCAPTCHA v3 (invisible)');
    return (
      <div
        className='subtleforms-captcha-hidden'
        dangerouslySetInnerHTML={{ __html: config.captchaHtml || '' }}
      />
    );
  }

  // Render input fields
  return (
    <div className={`subtleforms-field subtleforms-field-${field.type}`}>
      <label htmlFor={inputId} className='subtleforms-field-label'>
        {label}
        {required && (
          <span className='subtleforms-required' aria-label={', required'}>*</span>
        )}
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

      {error && (
        <div
          id={`${inputId}-error`}
          className='subtleforms-field-error'
          role='alert'
          aria-live='assertive'
        >
          {error}
        </div>
      )}
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
  const config = field.config ?? field;
  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'number':
    case 'phone':
    case 'tel':
    case 'date':
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
          aria-describedby={error ? `${inputId}-error` : undefined}
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
          aria-describedby={error ? `${inputId}-error` : undefined}
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
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
          <span>
            {config.checkboxLabel || __('I agree', 'subtleforms')}
          </span>
        </label>
      );

    case 'radio':
    case 'multiple_choice':
      const options = config.options || [];
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
                  name={config.key || field.key}
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
      const selectOptions = config.options || [];
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
      const countryList = config.countryList || [];
      const outputFormat = config.output_format || 'code';
      const searchable = config.searchable !== false;
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
      const min = config.min || 0;
      const max = config.max;
      const step = config.step || 0.01;
      const currency = config.currency || 'USD';
      const showSymbol = config.showCurrencySymbol !== false;
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
          {config.showSubtotal && (
            <div className='summary-line'>
              <span>{__('Subtotal:', 'subtleforms')}</span>
              <span>{value?.subtotal || '0.00'}</span>
            </div>
          )}
          {config.showTax && (
            <div className='summary-line'>
              <span>{__('Tax:', 'subtleforms')}</span>
              <span>{value?.tax || '0.00'}</span>
            </div>
          )}
          {config.showTotal && (
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
              config.placeholder ||
              __('Enter coupon code', 'subtleforms')
            }
            maxLength={config.maxLength || 50}
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
            {config.buttonText || __('Apply', 'subtleforms')}
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
      if (config.captchaHtml) {
        console.log('[SubtleForms] CAPTCHA rendering:', {
          type: field.type,
          provider: config.providerName,
          htmlLength: config.captchaHtml.length,
        });
      } else {
        console.error(
          '[SubtleForms] CAPTCHA HTML is missing! Check if CAPTCHA is enabled and keys are configured in Settings > Advanced.'
        );
      }

      return (
        <div
          className='subtleforms-captcha-container'
          dangerouslySetInnerHTML={{ __html: config.captchaHtml || '' }}
        />
      );

    case 'name_group':
      const nameValue = typeof value === 'object' ? value : {};
      return (
        <div className='subtleforms-name-group'>
          {config.enable_first_name !== false && (
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
                value={nameValue.first_name || ''}
                onChange={(e) =>
                  onChange({ ...nameValue, first_name: e.target.value })
                }
                placeholder={__('First Name', 'subtleforms')}
                aria-required={required}
                aria-invalid={!!error}
              />
            </div>
          )}
          {config.enable_middle_name && (
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
                value={nameValue.middle_name || ''}
                onChange={(e) =>
                  onChange({ ...nameValue, middle_name: e.target.value })
                }
                placeholder={__('Middle Name', 'subtleforms')}
                aria-invalid={!!error}
              />
            </div>
          )}
          {config.enable_last_name !== false && (
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
                value={nameValue.last_name || ''}
                onChange={(e) =>
                  onChange({ ...nameValue, last_name: e.target.value })
                }
                placeholder={__('Last Name', 'subtleforms')}
                aria-required={required}
                aria-invalid={!!error}
              />
            </div>
          )}
        </div>
      );

    case 'address_group':
      const addressValue = typeof value === 'object' ? value : {};
      return (
        <div className='subtleforms-address-group'>
          {config.enable_street1 !== false && (
            <div className='subtleforms-address-part subtleforms-address-part--full'>
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
                value={addressValue.street_address || ''}
                onChange={(e) =>
                  onChange({ ...addressValue, street_address: e.target.value })
                }
                placeholder={__('Street Address', 'subtleforms')}
                aria-required={required}
                aria-invalid={!!error}
              />
            </div>
          )}
          {config.enable_street2 && (
            <div className='subtleforms-address-part subtleforms-address-part--full'>
              <label
                htmlFor={`${inputId}-street2`}
                className='subtleforms-field-label'>
                {__('Street Address Line 2', 'subtleforms')}
              </label>
              <input
                id={`${inputId}-street2`}
                type='text'
                className='subtleforms-input'
                value={addressValue.street_address_2 || ''}
                onChange={(e) =>
                  onChange({
                    ...addressValue,
                    street_address_2: e.target.value,
                  })
                }
                placeholder={__('Apt, Suite, etc.', 'subtleforms')}
                aria-invalid={!!error}
              />
            </div>
          )}
          {config.enable_city !== false && (
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
          {config.enable_state !== false && (
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
          {config.enable_postal_code !== false && (
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
          {config.enable_country !== false && (
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
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      );

    case 'file_upload':
    case 'image_upload':
      return (
        <input
          id={inputId}
          type='file'
          className='subtleforms-input subtleforms-file-input'
          accept={
            field.type === 'image_upload'
              ? 'image/*'
              : config.allowedExtensions
              ? config.allowedExtensions
                  .map((ext) => `.${ext}`)
                  .join(',')
              : undefined
          }
          multiple={config.multiple === true}
          onChange={(e) => onChange(e.target.files[0] || null)}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
      );

    case 'rating': {
      const ratingMax = config.max || 5;
      const ratingValue = parseInt(value, 10) || 0;
      return (
        <div className='subtleforms-rating' role='radiogroup'>
          {Array.from({ length: ratingMax }, (_, i) => {
            const star = i + 1;
            return (
              <label key={star} className='subtleforms-rating__star'>
                <input
                  type='radio'
                  name={config.key || field.key || inputId}
                  value={star}
                  checked={ratingValue === star}
                  onChange={() => onChange(star)}
                  className='subtleforms-sr-only'
                />
                <span
                  aria-hidden='true'
                  style={{
                    cursor: 'pointer',
                    fontSize: '1.5em',
                    color: ratingValue >= star ? '#f59e0b' : '#d1d5db',
                  }}>
                  &#9733;
                </span>
              </label>
            );
          })}
        </div>
      );
    }

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
    case 'tel':
      return 'tel';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}
