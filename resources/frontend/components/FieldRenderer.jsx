import { __, sprintf } from '@wordpress/i18n';
import { getIn } from '../utils/valuePaths';
import { getCompositeEmptyParts } from '../utils/fieldValidation';
import { debug } from '../../shared/debug';
import { lazy, Suspense } from '@wordpress/element';
import ChainedSelect from './fields/ChainedSelect';
import FileUpload from './fields/FileUpload';
import RepeaterField from './fields/RepeaterField';
import {
  PaymentSummary,
  PaymentCoupon,
  PaymentProduct,
  PaymentChoice,
  PaymentCard,
  usePayment,
} from './fields/Payments';
import { getFieldType } from '../../shared/extend';
import { fieldConfig } from '../../shared/fieldConfig';
import { COUNTRIES, orderedCountries } from '../../shared/countries';

// The signature pad and rich text editor are only downloaded on pages whose
// form has those fields (2.3.0). Every other form skips that code.
const SignaturePad = lazy(() =>
  import(/* webpackChunkName: "field-signature" */ './fields/SignaturePad')
);
const RichTextInput = lazy(() =>
  import(/* webpackChunkName: "field-rich-text" */ './fields/RichTextInput')
);

/** Placeholder while a lazily loaded field downloads. */
function FieldLoading() {
  return (
    <div className='subtleforms-field-loading' aria-busy='true'>
      {__('Loading…', 'subtleforms')}
    </div>
  );
}
import {
  fieldAppearanceStyle,
  fieldAppearanceClasses,
} from '../../shared/appearance';

// HTML autocomplete tokens per field type, so browsers can autofill the form
// (Part B2). `undefined` means no hint (let the browser decide).
const AUTOCOMPLETE_TOKENS = {
  text: 'off',
  email: 'email',
  url: 'url',
  number: 'off',
  phone: 'tel',
  tel: 'tel',
  // Not every date is a birthday, so dates get no autocomplete hint.
  date: undefined,
  time: 'off',
  datetime: undefined,
  password: 'new-password',
};


/**
 * Split a consent statement into text/link parts for rendering.
 *
 * Supports a `{{link}}` placeholder (recommended) and a bare Privacy Policy
 * URL as a fallback. Returns an array of { text, url? } parts so the renderer
 * can wrap the link in an <a> and keep the rest as plain text.
 *
 * @param {string} label    Consent statement text.
 * @param {string} url      Privacy Policy URL.
 * @param {string} linkText Link text for the placeholder.
 * @returns {Array<{text: string, url?: string}>}
 */
function renderConsentLabel(label, url, linkText) {
  if (!label) {
    return [{ text: linkText, url }];
  }

  if (label.indexOf('{{link}}') !== -1) {
    const [before, after] = label.split('{{link}}');
    const parts = [];
    if (before) parts.push({ text: before });
    parts.push({ text: linkText, url });
    if (after) parts.push({ text: after });
    return parts;
  }

  // Fallback: if the URL itself appears in the statement, link it; otherwise
  // append the link at the end so the consent statement always has one.
  if (url && label.indexOf(url) !== -1) {
    const [before, after] = label.split(url);
    const parts = [];
    if (before) parts.push({ text: before });
    parts.push({ text: url, url });
    if (after) parts.push({ text: after });
    return parts;
  }

  return [{ text: label + ' ' }, { text: linkText, url }];
}

export default function FieldRenderer({
  field,
  fieldPath,
  values,
  onChange,
  errors,
  hiddenFields,
  // Inside a Repeater group (2.3.1): the value path prefix (`items.0.`) and
  // the input name prefix (`items[0]`).
  pathPrefix = '',
  namePrefix = '',
}) {
  // Normalise: the admin builder wraps properties under field.config, the API
  // serves flat nodes, and some saved forms carry both (a flat node plus a
  // partial config holding only appearance). fieldConfig() merges them so a
  // width never hides required, options, placeholder or help text (bug 1).
  const config = fieldConfig(field);

  const ownKey = config.key || field.key;
  const resolvedPath = fieldPath || (ownKey ? `${pathPrefix}${ownKey}` : ownKey);
  // Input name: the field key, or `items[0][qty]` inside a Repeater group.
  const inputName = ownKey ? (namePrefix ? `${namePrefix}[${ownKey}]` : ownKey) : undefined;
  const nested = { pathPrefix, namePrefix };
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

  // Structural fields carry no value and take no label/error chrome, so they
  // return before the input wrapper below.
  // Resolved before the structural branches below, which return early: a section
  // break or a container is still something you can style, so the value has to
  // be available to them and not only to the input wrapper further down.
  const fieldAppearance = config.appearance;
  const appearanceStyle = fieldAppearanceStyle(fieldAppearance);
  const appearanceClasses = fieldAppearanceClasses(fieldAppearance);

  if (field.type === 'section_break') {
    return (
      <div
        className={['subtleforms-section-break', appearanceClasses]
          .filter(Boolean)
          .join(' ')}
        style={appearanceStyle}>
        {config.title && (
          <h3 className='subtleforms-section-break__title'>{config.title}</h3>
        )}
        {config.description && (
          <p className='subtleforms-section-break__description'>
            {config.description}
          </p>
        )}
        <hr className='subtleforms-section-break__rule' />
      </div>
    );
  }

  if (field.type === 'disclaimer') {
    // A dedicated disclaimer / notice block. Content is authored by an
    // administrator and sanitized server-side on save. An empty disclaimer
    // would show a lone icon, so it is not drawn at all (bug 10).
    if (!hasVisibleText(config.content)) {
      return null;
    }
    const variant = config.variant || 'info';
    return (
      <div
        className={[
          'subtleforms-disclaimer',
          `subtleforms-disclaimer--${variant}`,
          appearanceClasses,
        ]
          .filter(Boolean)
          .join(' ')}
        style={appearanceStyle}
        role='note'>
        <span className='subtleforms-disclaimer__icon' aria-hidden='true'>
          {variant === 'warning' ? '⚠' : variant === 'success' ? '✓' : 'ℹ'}
        </span>
        <div
          className='subtleforms-disclaimer__content'
          dangerouslySetInnerHTML={{ __html: config.content || '' }}
        />
      </div>
    );
  }

  if (field.type === 'html') {
    // Content is authored by an administrator in the builder, not by the
    // visitor, and is sanitized server-side on save.
    return (
      <div
        className={['subtleforms-html', appearanceClasses].filter(Boolean).join(' ')}
        style={appearanceStyle}
        dangerouslySetInnerHTML={{ __html: config.content || '' }}
      />
    );
  }

  // A calculation with no formula has nothing to show (bug 9).
  if (field.type === 'calculation' && !String(config.formula || '').trim()) {
    return null;
  }

  // A matrix with no rows or no columns has nothing to answer (bug 8).
  if (
    field.type === 'checkbox_grid' &&
    (!Array.isArray(config.rows) ||
      !config.rows.length ||
      !Array.isArray(config.columns) ||
      !config.columns.length)
  ) {
    return null;
  }

  if (field.type === 'action_hook') {
    // A server-side extension point. It renders nothing, but must be a known
    // type so it doesn't fall through to "Field type not supported".
    return null;
  }

  if (field.type === 'step') {
    // Step boundaries are consumed by FormRenderer to slice the form into
    // pages; they are never drawn inline.
    return null;
  }

  // Repeater: visitors add and remove whole groups (2.3.1, QA-09).
  if (field.type === 'repeat_container') {
    return (
      <RepeaterField
        field={field}
        config={config}
        path={resolvedPath}
        namePrefix={inputName}
        label={label}
        values={values}
        onChange={onChange}
        errors={errors}
        appearanceClasses={appearanceClasses}
        appearanceStyle={appearanceStyle}
        renderChild={(child, { pathPrefix: childPrefix, namePrefix: childNamePrefix, key }) => (
          <FieldRenderer
            key={key}
            field={child}
            values={values}
            onChange={onChange}
            errors={errors}
            hiddenFields={hiddenFields}
            pathPrefix={childPrefix}
            namePrefix={childNamePrefix}
          />
        )}
      />
    );
  }

  // Handle container fields
  if (field.type === 'group_container') {
    return (
      <div
        className={[
          'subtleforms-field',
          'subtleforms-field-container',
          appearanceClasses,
        ]
          .filter(Boolean)
          .join(' ')}
        style={appearanceStyle}>
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
              values={values}
              errors={errors}
              hiddenFields={hiddenFields}
              {...nested}
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
                  values={values}
                  errors={errors}
                  hiddenFields={hiddenFields}
                  {...nested}
                />
              ))}
          </div>
        ))}
      </div>
    );
  }

  // Composite group fields — name_group / address_group. They carry an object
  // value at their root key, so they render as a real <fieldset>/<legend> (not
  // a <label> pointing at an id that doesn't exist) with the required asterisk
  // shown ONCE on the legend — never on Name + First + Last (Part B1).
  //
  // Two shapes are supported:
  //  • children: Plan A group with real child text nodes (each rendered as its
  //    own FieldRenderer; their `required` is false so they show no asterisk).
  //  • legacy: a single leaf whose renderInput() draws the part inputs and
  //    writes the whole object back to the parent key.
  if (
    field.type === 'name_group' ||
    field.type === 'address_group' ||
    field.type === 'address' ||
    field.kind === 'group'
  ) {
    const hasChildren =
      Array.isArray(field.children) && field.children.length > 0;

    return (
      <fieldset
        className={`subtleforms-field subtleforms-field-${field.type} subtleforms-group-field`}
        aria-invalid={!!error}
      >
        <legend className='subtleforms-field-label'>
          {label}
          {required && (
            <span className='subtleforms-required' aria-label=', required'>*</span>
          )}
        </legend>

        {hasChildren
          ? field.children.map((child) => {
              const childKey = child.config?.key || child.key;
              const childPath = resolvedPath
                ? `${resolvedPath}.${childKey}`
                : childKey;
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
            })
          : renderInput(
              field,
              getIn(values, resolvedPath, {}),
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
    debug('[SubtleForms] Rendering reCAPTCHA v3 (invisible)');
    return (
      <div
        className='subtleforms-captcha-hidden'
        dangerouslySetInnerHTML={{ __html: config.captchaHtml || '' }}
      />
    );
  }

  // Render input fields
  return (
    <div
      className={[
        'subtleforms-field',
        `subtleforms-field-${field.type}`,
        appearanceClasses,
        config.cssClass,
        config.readOnly ? 'subtleforms-field--readonly' : '',
        error ? 'subtleforms-field--has-error' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={appearanceStyle}>
      <label htmlFor={inputId} id={`${inputId}-label`} className='subtleforms-field-label'>
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
        error,
        values,
        inputName
      )}

      {config.description && (
        <p id={`${inputId}-help`} className='subtleforms-field-help'>
          {config.description}
        </p>
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
  error,
  values = {},
  inputName = undefined
) {
  const config = fieldConfig(field);
  const describedBy =
    [error ? `${inputId}-error` : null, config.description ? `${inputId}-help` : null]
      .filter(Boolean)
      .join(' ') || undefined;
  // Every input carries the field key as its name, so the form degrades
  // without JavaScript and autofill/password managers can match it (bug 11).
  const name = inputName || config.key || field.key || undefined;
  const numOrUndef = (v) =>
    v === undefined || v === null || v === '' ? undefined : Number(v);
  const optionLayoutClass = config.optionLayout
    ? ` subtleforms-options--${config.optionLayout}`
    : '';
  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'number':
    case 'phone':
    case 'tel':
    case 'date':
    case 'time':
    case 'datetime':
    case 'password':
    {
      const isNumeric = field.type === 'number';
      const isLength = ['text', 'email', 'url', 'phone', 'tel', 'password'].includes(field.type);
      const input = (
        <input
          id={inputId}
          type={getInputType(field.type)}
          className='subtleforms-input'
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required || undefined}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          name={name}
          autoComplete={config.autocomplete || AUTOCOMPLETE_TOKENS[field.type]}
          readOnly={config.readOnly === true}
          min={isNumeric ? numOrUndef(config.min) : field.type === 'date' ? config.minDate || undefined : undefined}
          max={isNumeric ? numOrUndef(config.max) : field.type === 'date' ? config.maxDate || undefined : undefined}
          step={isNumeric ? numOrUndef(config.step) : undefined}
          minLength={isLength ? numOrUndef(config.minLength) : undefined}
          maxLength={isLength ? numOrUndef(config.maxLength) : undefined}
        />
      );
      if (!config.prefix && !config.suffix) {
        return input;
      }
      return (
        <div className='subtleforms-input-affix'>
          {config.prefix && (
            <span className='subtleforms-input-affix__prefix' aria-hidden='true'>
              {config.prefix}
            </span>
          )}
          {input}
          {config.suffix && (
            <span className='subtleforms-input-affix__suffix' aria-hidden='true'>
              {config.suffix}
            </span>
          )}
        </div>
      );
    }

    case 'textarea':
      return (
        <textarea
          id={inputId}
          className='subtleforms-textarea'
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={numOrUndef(config.rows) || 4}
          required={required || undefined}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          name={name}
          readOnly={config.readOnly === true}
          minLength={numOrUndef(config.minLength)}
          maxLength={numOrUndef(config.maxLength)}
        />
      );

    case 'checkbox':
      // A single checkbox saved with a list of options (older forms, imports)
      // is drawn as the checkbox group it was meant to be, so no answer is
      // lost. New forms are converted to Multiple choice in the builder (bug 7).
      if (Array.isArray(config.options) && config.options.length > 0) {
        return renderCheckboxGroup(config.options, value, onChange, {
          inputId,
          name,
          describedBy,
          required,
          error,
          className: `subtleforms-checkbox-group${optionLayoutClass}`,
        });
      }
      return (
        <label className='subtleforms-checkbox-label' htmlFor={inputId}>
          <input
            id={inputId}
            type='checkbox'
            className='subtleforms-checkbox'
            name={name}
            value='1'
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            required={required || undefined}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
          <span>
            {config.checkboxLabel || __('I agree', 'subtleforms')}
          </span>
        </label>
      );

    case 'consent': {
      // Render the consent statement, substituting the {{link}} placeholder
      // (or a bare URL) with a real Privacy Policy link when one is configured.
      const consentLabel = config.checkboxLabel || __('I agree to the Privacy Policy.', 'subtleforms');
      const policyUrl = config.privacyPolicyUrl || '';
      const linkText = config.linkText || __('Privacy Policy', 'subtleforms');
      const hasLink = !!policyUrl;
      const parts = hasLink
        ? renderConsentLabel(consentLabel, policyUrl, linkText)
        : [{ text: consentLabel }];

      return (
        <label className='subtleforms-checkbox-label subtleforms-consent-label' htmlFor={inputId}>
          <input
            id={inputId}
            type='checkbox'
            className='subtleforms-checkbox subtleforms-consent-checkbox'
            name={name}
            value='1'
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            required={required || undefined}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
          <span>
            {parts.map((part, i) =>
              part.url ? (
                <a
                  key={i}
                  href={part.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='subtleforms-consent-link'>
                  {part.text}
                </a>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </span>
        </label>
      );
    }

    case 'radio':
      const radioOptions = config.options || [];
      return (
        <div
          className={`subtleforms-radio-group${optionLayoutClass}`}
          role='radiogroup'
          aria-labelledby={`${inputId}-label`}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}>
          {radioOptions.map((option, index) => {
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
                  name={name}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => onChange(e.target.value)}
                  required={(required && index === 0) || undefined}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      );

    case 'multiple_choice':
      const mcOptions = config.options || [];
      const allowMultiple = config.allowMultiple === true;
      if (allowMultiple) {
        return renderCheckboxGroup(mcOptions, value, onChange, {
          inputId,
          name,
          describedBy,
          required,
          error,
          className: `subtleforms-checkbox-group${optionLayoutClass}`,
        });
      }
      return (
        <div
          className={`subtleforms-radio-group${optionLayoutClass}`}
          role='radiogroup'
          aria-labelledby={`${inputId}-label`}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}>
          {mcOptions.map((option, index) => {
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
                  name={name}
                  value={option.value}
                  checked={value === option.value}
                  onChange={(e) => onChange(e.target.value)}
                  required={(required && index === 0) || undefined}
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
          name={name}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required || undefined}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}>
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

    case 'country': {
      // One shared list for this field and the Address field (bug 3). A copy
      // stored in the field's settings is no longer needed.
      const outputFormat = config.output_format || 'code';
      const searchable = config.searchable !== false;
      return (
        <select
          id={inputId}
          className='subtleforms-select subtleforms-country-select'
          name={name}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required || undefined}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          autoComplete='country'
          data-searchable={searchable}>
          <option value=''>
            {placeholder || __('Select a country', 'subtleforms')}
          </option>
          {orderedCountries(config.preferred_countries).map((country) => (
            <option
              key={country.code}
              value={outputFormat === 'name' ? country.name : country.code}>
              {country.name}
            </option>
          ))}
        </select>
      );
    }

    case 'hidden':
      return (
        <input
          id={inputId}
          type='hidden'
          name={name}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'payment_amount': {
      const min = config.min || 0;
      const max = config.max;
      const step = config.step || 0.01;
      const currency = config.currency || window.subtleformsFrontend?.currency || 'USD';
      const showSymbol = config.showCurrencySymbol !== false;
      let currencySymbol = '';
      try {
        currencySymbol =
          new Intl.NumberFormat(undefined, { style: 'currency', currency })
            .formatToParts(0)
            .find((p) => p.type === 'currency')?.value || '';
      } catch (e) {
        currencySymbol = currency;
      }

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
            name={name}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            required={required || undefined}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
        </div>
      );
    }

    case 'payment_summary':
      return <PaymentSummary config={config} />;

    case 'payment_coupon':
      return <PaymentCoupon config={config} />;

    case 'payment_product':
      return (
        <PaymentProduct config={config} value={value} onChange={onChange} inputId={inputId} error={error} />
      );

    case 'payment_choice':
      return (
        <PaymentChoice
          config={config}
          value={value}
          onChange={onChange}
          inputId={inputId}
          error={error}
          name={name}
        />
      );

    case 'payment_card':
      return <PaymentCard config={config} />;

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
        debug('[SubtleForms] CAPTCHA rendering:', {
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
      const nameEmpty = new Set(getCompositeEmptyParts(field, nameValue));
      return (
        <div className='subtleforms-name-group'>
          {config.enable_first_name !== false && (
            <div className='subtleforms-name-part'>
              <label htmlFor={`${inputId}-first`} className='subtleforms-field-label'>
                {__('First Name', 'subtleforms')}
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
                aria-invalid={!!error && nameEmpty.has('first_name')}
                autoComplete='given-name'
                name={`${config.key || field.key || ''}_first_name`}
              />
            </div>
          )}
          {config.enable_middle_name && (
            <div className='subtleforms-name-part'>
              <label htmlFor={`${inputId}-middle`} className='subtleforms-field-label'>
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
                aria-invalid={!!error && nameEmpty.has('middle_name')}
                autoComplete='additional-name'
                name={`${config.key || field.key || ''}_middle_name`}
              />
            </div>
          )}
          {config.enable_last_name !== false && (
            <div className='subtleforms-name-part'>
              <label htmlFor={`${inputId}-last`} className='subtleforms-field-label'>
                {__('Last Name', 'subtleforms')}
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
                aria-invalid={!!error && nameEmpty.has('last_name')}
                autoComplete='family-name'
                name={`${config.key || field.key || ''}_last_name`}
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
              <label htmlFor={`${inputId}-street1`} className='subtleforms-field-label'>
                {__('Street Address', 'subtleforms')}
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
                autoComplete='address-line1'
                name={`${config.key || field.key || ''}_street_address`}
              />
            </div>
          )}
          {config.enable_street2 && (
            <div className='subtleforms-address-part subtleforms-address-part--full'>
              <label htmlFor={`${inputId}-street2`} className='subtleforms-field-label'>
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
                autoComplete='address-line2'
                name={`${config.key || field.key || ''}_street_address_2`}
              />
            </div>
          )}
          {config.enable_city !== false && (
            <div className='subtleforms-address-part'>
              <label htmlFor={`${inputId}-city`} className='subtleforms-field-label'>
                {__('City', 'subtleforms')}
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
                autoComplete='address-level2'
                name={`${config.key || field.key || ''}_city`}
              />
            </div>
          )}
          {config.enable_state !== false && (
            <div className='subtleforms-address-part'>
              <label htmlFor={`${inputId}-state`} className='subtleforms-field-label'>
                {__('State / Province', 'subtleforms')}
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
                autoComplete='address-level1'
                name={`${config.key || field.key || ''}_state`}
              />
            </div>
          )}
          {config.enable_postal_code !== false && (
            <div className='subtleforms-address-part'>
              <label htmlFor={`${inputId}-postal`} className='subtleforms-field-label'>
                {__('Postal Code', 'subtleforms')}
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
                autoComplete='postal-code'
                name={`${config.key || field.key || ''}_postal_code`}
              />
            </div>
          )}
          {config.enable_country !== false && (
            <div className='subtleforms-address-part'>
              <label htmlFor={`${inputId}-country`} className='subtleforms-field-label'>
                {__('Country', 'subtleforms')}
              </label>
              <select
                id={`${inputId}-country`}
                className='subtleforms-select'
                value={addressValue.country || ''}
                onChange={(e) =>
                  onChange({ ...addressValue, country: e.target.value })
                }
                autoComplete='country-name'
                name={`${config.key || field.key || ''}_country`}>
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
        <FileUpload
          field={field}
          config={config}
          value={value}
          onChange={onChange}
          inputId={inputId}
          error={error}
          required={required}
        />
      );

    case 'rating': {
      const ratingMax = config.max || 5;
      const ratingValue = parseInt(value, 10) || 0;
      return (
        <div
          className='subtleforms-rating'
          role='radiogroup'
          aria-labelledby={`${inputId}-label`}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}>
          {Array.from({ length: ratingMax }, (_, i) => {
            const star = i + 1;
            return (
              <label key={star} className='subtleforms-rating__star'>
                <input
                  type='radio'
                  name={name || inputId}
                  value={star}
                  aria-label={sprintf(
                    /* translators: 1: chosen rating, 2: highest rating */
                    __('%1$d of %2$d', 'subtleforms'),
                    star,
                    ratingMax
                  )}
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

    case 'range_slider': {
      const sliderMin = Number(config.min ?? 0);
      const sliderMax = Number(config.max ?? 100);
      const sliderStep = Number(config.step ?? 1);
      const sliderValue =
        value === '' || value === undefined || value === null
          ? Math.round((sliderMin + sliderMax) / 2)
          : Number(value);

      return (
        <div className='subtleforms-range'>
          <input
            id={inputId}
            type='range'
            className='subtleforms-range__input'
            name={name}
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            value={sliderValue}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
          {/* The number is the only cue for the current value, so it is exposed
              to assistive tech rather than hidden as decoration. */}
          <output className='subtleforms-range__value' htmlFor={inputId}>
            {sliderValue}
          </output>
        </div>
      );
    }

    case 'net_promoter_score': {
      const npsValue = value === '' || value === undefined ? null : Number(value);
      return (
        <div
          className='subtleforms-nps'
          role='radiogroup'
          aria-labelledby={`${inputId}-label`}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}>
          <div className='subtleforms-nps__scale'>
            {Array.from({ length: 11 }, (_, score) => (
              <label key={score} className='subtleforms-nps__option'>
                <input
                  type='radio'
                  name={name || inputId}
                  value={score}
                  checked={npsValue === score}
                  onChange={() => onChange(score)}
                  className='subtleforms-sr-only'
                />
                <span
                  className={
                    npsValue === score
                      ? 'subtleforms-nps__number is-selected'
                      : 'subtleforms-nps__number'
                  }>
                  {score}
                </span>
              </label>
            ))}
          </div>
          <div className='subtleforms-nps__legend' aria-hidden='true'>
            <span>{config.minLabel || __('Not at all likely', 'subtleforms')}</span>
            <span>{config.maxLabel || __('Extremely likely', 'subtleforms')}</span>
          </div>
        </div>
      );
    }

    case 'checkbox_grid': {
      const gridRows = Array.isArray(config.rows) ? config.rows : [];
      const gridCols = Array.isArray(config.columns) ? config.columns : [];
      const grid = value && typeof value === 'object' ? value : {};

      if (gridRows.length === 0 || gridCols.length === 0) {
        return null;
      }

      const cellLabel = (row, col) =>
        `${row.label ?? row}: ${col.label ?? col}`;

      return (
        <div
          role='group'
          className='subtleforms-checkbox-grid-wrap'
          aria-labelledby={`${inputId}-label`}
          aria-invalid={!!error}
          aria-describedby={describedBy}>
        <table className='subtleforms-checkbox-grid'>
          <thead>
            <tr>
              <td />
              {gridCols.map((col) => (
                <th key={col.value ?? col} scope='col'>
                  {col.label ?? col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gridRows.map((row) => {
              const rowKey = row.value ?? row;
              return (
                <tr key={rowKey}>
                  <th scope='row'>{row.label ?? row}</th>
                  {gridCols.map((col) => {
                    const colKey = col.value ?? col;
                    // Older forms have no flag and keep their original checkbox grid.
                    const single = config.multiplePerRow === false;
                    const checked = single
                      ? grid[rowKey] === colKey
                      : !!grid[rowKey]?.[colKey];
                    if (single) {
                      return (
                        <td key={colKey}>
                          <input
                            type='radio'
                            className='subtleforms-radio'
                            name={`${name}[${rowKey}]`}
                            value={colKey}
                            checked={checked}
                            aria-label={cellLabel(row, col)}
                            onChange={() => onChange({ ...grid, [rowKey]: colKey })}
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={colKey}>
                        <input
                          type='checkbox'
                          className='subtleforms-checkbox'
                          name={`${name}[${rowKey}][${colKey}]`}
                          value='1'
                          checked={checked}
                          // Each cell needs its own name for screen readers;
                          // the row/column headers alone are not announced
                          // for inputs inside a table cell.
                          aria-label={cellLabel(row, col)}
                          onChange={(e) =>
                            onChange({
                              ...grid,
                              [rowKey]: {
                                ...(grid[rowKey] || {}),
                                [colKey]: e.target.checked,
                              },
                            })
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      );
    }

    case 'toggle': {
      const onValue = config.onValue ?? 'yes';
      const offValue = config.offValue ?? 'no';
      const isOn = value === true || value === onValue;
      return (
        <label className='subtleforms-toggle' htmlFor={inputId}>
          <input
            id={inputId}
            type='checkbox'
            role='switch'
            className='subtleforms-toggle__input'
            name={name}
            value={onValue}
            checked={isOn}
            onChange={(e) => onChange(e.target.checked ? onValue : offValue)}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
          />
          <span className='subtleforms-toggle__track' aria-hidden='true'>
            <span className='subtleforms-toggle__thumb' />
          </span>
          {config.toggleLabel && (
            <span className='subtleforms-toggle__text'>{config.toggleLabel}</span>
          )}
        </label>
      );
    }

    case 'scale': {
      const min = parseInt(config.scaleMin ?? 1, 10);
      const max = Math.max(min + 1, Math.min(10, parseInt(config.scaleMax ?? 5, 10)));
      const points = [];
      for (let i = min; i <= max; i++) points.push(i);
      return (
        <div className='subtleforms-scale'>
          <div
            className='subtleforms-scale__options'
            role='radiogroup'
            aria-labelledby={`${inputId}-label`}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            style={{ '--subtleforms-scale-count': points.length }}>
            {points.map((point) => {
              const optionId = `${inputId}-${point}`;
              const selected = String(value) === String(point);
              return (
                <label
                  key={point}
                  htmlFor={optionId}
                  className={`subtleforms-scale__option${selected ? ' is-selected' : ''}`}>
                  <input
                    id={optionId}
                    type='radio'
                    className='subtleforms-scale__input'
                    name={name}
                    value={point}
                    checked={selected}
                    onChange={() => onChange(point)}
                  />
                  <span>{point}</span>
                </label>
              );
            })}
          </div>
          {(config.minLabel || config.maxLabel) && (
            <div className='subtleforms-scale__labels' aria-hidden='true'>
              <span>{config.minLabel}</span>
              <span>{config.maxLabel}</span>
            </div>
          )}
        </div>
      );
    }

    case 'picture_choice': {
      const pcOptions = config.options || [];
      const multiple = config.allowMultiple === true;
      const selected = Array.isArray(value) ? value : value ? [value] : [];
      const cols = parseInt(config.pictureColumns || 3, 10);
      return (
        <div
          className='subtleforms-picture-choice'
          role={multiple ? 'group' : 'radiogroup'}
          aria-labelledby={`${inputId}-label`}
          aria-required={multiple ? undefined : required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          style={{ '--subtleforms-picture-columns': cols }}>
          {pcOptions.map((option, index) => {
            const optionId = `${inputId}-${index}`;
            const isChecked = selected.includes(option.value);
            return (
              <label
                key={option.value || index}
                htmlFor={optionId}
                className={`subtleforms-picture-choice__option${isChecked ? ' is-selected' : ''}`}>
                <input
                  id={optionId}
                  type={multiple ? 'checkbox' : 'radio'}
                  name={name}
                  className='subtleforms-picture-choice__input'
                  value={option.value}
                  checked={isChecked}
                  onChange={() => {
                    if (multiple) {
                      onChange(
                        isChecked
                          ? selected.filter((v) => v !== option.value)
                          : [...selected, option.value]
                      );
                    } else {
                      onChange(option.value);
                    }
                  }}
                />
                <span className='subtleforms-picture-choice__media'>
                  {option.image ? (
                    <img src={option.image} alt='' loading='lazy' />
                  ) : (
                    <span className='subtleforms-picture-choice__placeholder' aria-hidden='true' />
                  )}
                </span>
                <span className='subtleforms-picture-choice__label'>{option.label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case 'calculation': {
      const decimals = parseInt(config.decimals ?? 2, 10);
      const num = typeof value === 'number' ? value : parseFloat(value) || 0;
      const formatted = num.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return (
        <output
          id={inputId}
          className='subtleforms-calculation'
          aria-live='polite'
          aria-describedby={describedBy}>
          {config.prefix && <span className='subtleforms-calculation__affix'>{config.prefix}</span>}
          <span className='subtleforms-calculation__value'>{formatted}</span>
          {config.suffix && <span className='subtleforms-calculation__affix'>{config.suffix}</span>}
        </output>
      );
    }

    case 'color_picker':
      return (
        <div className='subtleforms-color'>
          <input
            id={inputId}
            type='color'
            className='subtleforms-color__swatch'
            name={name}
            value={value || config.default || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
          />
          {/* A colour well alone is unusable without colour vision; the hex
              value is editable so the field can be completed by typing. */}
          <input
            type='text'
            className='subtleforms-color__hex'
            name={name ? `${name}_hex` : undefined}
            value={value || config.default || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            aria-label={__('Colour hex value', 'subtleforms')}
            pattern='#[0-9a-fA-F]{6}'
          />
        </div>
      );

    case 'signature':
      return (
        <Suspense fallback={<FieldLoading />}>
        <SignaturePad
          inputId={inputId}
          name={name}
          describedBy={describedBy}
          value={value}
          onChange={onChange}
          required={required}
          error={error}
        />
        </Suspense>
      );

    case 'rich_text':
      return (
        <Suspense fallback={<FieldLoading />}>
        <RichTextInput
          inputId={inputId}
          name={name}
          describedBy={describedBy}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          error={error}
        />
        </Suspense>
      );

    case 'chained_select':
      return (
        <ChainedSelect
          inputId={inputId}
          name={name}
          describedBy={describedBy}
          config={config}
          value={value}
          onChange={onChange}
          required={required}
          error={error}
        />
      );

    default: {
      // Field types registered by add-ons (SubtleForms Pro).
      const addon = getFieldType(field.type);
      if (addon) {
        return (
          <AddonField
            component={addon.component}
            field={field}
            config={config}
            value={value}
            onChange={onChange}
            inputId={inputId}
            error={error}
            required={required}
          />
        );
      }
      return (
        <div className='subtleforms-unsupported'>
          {__('Field type not supported:', 'subtleforms')} {field.type}
        </div>
      );
    }
  }
}

/**
 * A group of checkboxes that stores an array of the checked option values.
 *
 * @param {Array}    options  Options ({ label, value }).
 * @param {*}        value    Current value (array, or a single value).
 * @param {Function} onChange Called with the next array.
 * @param {Object}   props    inputId, name, describedBy, required, error, className.
 */
function renderCheckboxGroup(options, value, onChange, props) {
  const { inputId, name, describedBy, required, error, className } = props;
  const current = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <div
      className={className}
      role='group'
      aria-labelledby={`${inputId}-label`}
      aria-invalid={!!error}
      aria-describedby={describedBy}>
      {options.map((option, index) => {
        const optionId = `${inputId}-${index}`;
        const isChecked = current.includes(option.value);
        return (
          <label key={option.value || index} htmlFor={optionId} className='subtleforms-checkbox-label'>
            <input
              id={optionId}
              type='checkbox'
              className='subtleforms-checkbox'
              name={name ? `${name}[]` : undefined}
              value={option.value}
              checked={isChecked}
              onChange={() =>
                onChange(
                  isChecked
                    ? current.filter((v) => v !== option.value)
                    : [...current, option.value]
                )
              }
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Whether authored HTML has any visible text or media.
 *
 * @param {string} html Authored content.
 * @return {boolean}
 */
export function hasVisibleText(html) {
  if (typeof html !== 'string' || !html.trim()) {
    return false;
  }
  if (/<(img|iframe|video|svg|hr)\b/i.test(html)) {
    return true;
  }
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '').length > 0;
}

/**
 * Renders an add-on field with the form's order context.
 */
function AddonField({ component: Component, ...props }) {
  const payment = usePayment();
  return <Component {...props} payment={payment} formId={payment?.formId} preview={!!payment?.preview} />;
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
    case 'time':
      return 'time';
    case 'datetime':
      // datetime-local is the only widely implemented native control; the
      // schema's `format` is applied server-side on display.
      return 'datetime-local';
    case 'password':
      return 'password';
    default:
      return 'text';
  }
}
