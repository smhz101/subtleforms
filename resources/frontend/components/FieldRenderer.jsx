import { __, sprintf } from '@wordpress/i18n';
import { getIn } from '../utils/valuePaths';
import { columnCountFromType } from '../../shared/columnCount';
import { consentParts } from '../../shared/consentLabel';
import { formatUsPhone, isCompleteUsPhone } from '../../shared/phoneFormat';
import { passwordStrength } from '../../shared/passwordStrength';
import { columnFields } from '../utils/columnFields';
import { getCompositeEmptyParts } from '../utils/fieldValidation';
import { compositeParts, partValue } from '../../shared/compositeParts';
import { rangeSliderSeed } from '../utils/defaults';
import { debug } from '../../shared/debug';
import { cloneElement, useContext, useEffect } from '@wordpress/element';
import ChoiceSelect from './fields/ChoiceSelect';
import { FormContext } from './fields/contexts';
import { lazyField } from './fields/lazyFields';
import { getFieldType, getFieldOverride } from '../../shared/extend';
import { effectiveFieldType } from '../../shared/fieldFallback';
import { fieldConfig } from '../../shared/fieldConfig';
import { flagsOn } from '../../shared/flagsOn';
import { fieldDisplay, requiredIndicatorMark } from '../../shared/fieldDisplay';
import { toggleIsOn } from '../../shared/toggleState';

// Heavier fields are only downloaded for forms that have them (rich text
// since 2.3.0, the rest since 2.6.0). See fields/lazyFields.jsx.
const ChainedSelect = lazyField('chained');
const PhoneField = lazyField('geo', 'PhoneField');
const CountrySelect = lazyField('geo', 'CountrySelect');
const DateTimeField = lazyField('date');
const FileUpload = lazyField('upload');
const RepeaterField = lazyField('repeater');
const RichTextInput = lazyField('richText');
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
  // Label visibility and help text placement, with the form's defaults (2.3.2).
  const { fieldDefaults } = useContext(FormContext) || {};
  const display = fieldDisplay(field, fieldDefaults);
  const requiredMark = requiredIndicatorMark(fieldDefaults);

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
  // A saved node can lack a key (RCOMPAT-02); never let that stop the form.
  const inputId = `subtleforms-field-${String(resolvedPath || field.key || field.id || '').replace(
    /[^a-zA-Z0-9\-_:.]/g,
    '-'
  )}`;

  const error = errors?.[resolvedPath];

  // An untouched slider shows a number before the visitor moves it. Write that
  // number into the form so a required slider submits what it already displays.
  useEffect(() => {
    if (field?.type !== 'range_slider' || !resolvedPath || isHidden || typeof onChange !== 'function') {
      return;
    }
    const current = getIn(values, resolvedPath, '');
    if (current !== '' && current !== undefined && current !== null) {
      return;
    }
    onChange(resolvedPath, rangeSliderSeed(config));
  }, [field, resolvedPath, isHidden, values, onChange, config]);

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
  // A hidden label is hidden visually only (screen readers still read it).
  const appearanceClasses = [
    fieldAppearanceClasses(fieldAppearance),
    display.labelHidden && !fieldAppearance?.hideLabel ? 'subtleforms-field--no-label' : '',
    display.descriptionAbove ? 'subtleforms-field--help-above' : '',
  ]
    .filter(Boolean)
    .join(' ');

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

  // An add-on field with nothing to show (for example a Calculation
  // without a formula) is not drawn (bug 9).
  const addonType = getFieldType(field.type);
  if (addonType && typeof addonType.isAnswerable === 'function' && !addonType.isAnswerable(config)) {
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
        {(config.label || config.description) && (
          <div className='subtleforms-container-header'>
            {config.label && (
              <div className='subtleforms-container-label subtleforms-field-label'>
                {config.label}
              </div>
            )}
            {config.description && (
              <p className='subtleforms-field-help subtleforms-container-help'>{config.description}</p>
            )}
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
    const columnCount = columnCountFromType(field.type);
    const columns = field.columns || [];

    const columnsBody = (
      <div
        className={`subtleforms-field subtleforms-field-columns subtleforms-columns-${columnCount}`}>
        {columns.map((column, colIndex) => (
          <div key={colIndex} className='subtleforms-column'>
            {columnFields(column).map((child) => (
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
    // Columns have no label of their own unless one is set (2.3.2).
    if (!config.label && !config.description) {
      return columnsBody;
    }
    return (
      <div
        className={['subtleforms-field', 'subtleforms-field-container', 'subtleforms-field-columns-group', appearanceClasses]
          .filter(Boolean)
          .join(' ')}
        style={appearanceStyle}>
        <div className='subtleforms-container-header'>
          {config.label && (
            <div className='subtleforms-container-label subtleforms-field-label'>{config.label}</div>
          )}
          {config.description && (
            <p className='subtleforms-field-help subtleforms-container-help'>{config.description}</p>
          )}
        </div>
        {columnsBody}
      </div>
    );
  }

  // Composite group fields, name_group / address_group. They carry an object
  // value at their root key, so they render as a div role="group" labelled by
  // the field label (not a fieldset/legend, and not a <label> pointing at an
  // id that doesn't exist) with the required asterisk shown ONCE on that
  // label, never on Name + First + Last (Part B1).
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
      <div
        role='group'
        data-sf-key={ownKey || undefined}
        className={[`subtleforms-field subtleforms-field-${field.type} subtleforms-group-field`, appearanceClasses]
          .filter(Boolean)
          .join(' ')}
        aria-labelledby={`${inputId}-label`}
        aria-describedby={
          [config.description ? `${inputId}-help` : null, error ? `${inputId}-error` : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
      >
        {/* The group is named by this text; it labels no single input, so it
            is not a <label> (FB-17). */}
        <span id={`${inputId}-label`} className='subtleforms-field-label subtleforms-group-label'>
          {label}
          {required && (
            <span className='subtleforms-required' aria-label=', required'>{requiredMark}</span>
          )}
        </span>
        {config.description && display.descriptionAbove && (
          <p id={`${inputId}-help`} className='subtleforms-field-help'>{config.description}</p>
        )}

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

        {config.description && !display.descriptionAbove && (
          <p id={`${inputId}-help`} className='subtleforms-field-help'>{config.description}</p>
        )}

        {error && (
          <div
            id={`${inputId}-error`}
            className='subtleforms-field-error'
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  const value = getIn(values, resolvedPath, '');

  // A tracking field: visitors never see a label or a box, only the value
  // that is sent with the entry.
  if (field.type === 'hidden') {
    return (
      <input
        id={inputId}
        type='hidden'
        name={inputName || ownKey}
        value={value ?? ''}
      />
    );
  }

  if (['captcha', 'recaptcha', 'hcaptcha', 'turnstile'].includes(field.type)) {
    if (config.captchaHtml) {
      const hidden = config.captchaHtml.includes('subtleforms-recaptcha-v3');
      return (
        <div
          className={hidden ? 'subtleforms-captcha-hidden' : 'subtleforms-captcha-container'}
          dangerouslySetInnerHTML={{ __html: config.captchaHtml }}
        />
      );
    }
    return (
      <p className='subtleforms-captcha-warning' role='status'>
        {config.captchaWarning || __('This CAPTCHA is not set up yet.', 'subtleforms')}
      </p>
    );
  }

  // An input with no key has nowhere to keep an answer, so it is left out
  // instead of stopping the whole form from loading (RCOMPAT-02).
  if (!ownKey && !fieldPath) {
    return null;
  }

  // A group of choices is a fieldset with a legend, so a screen reader names
  // the group once when focus enters it.
  const groupedChoice = ['radio', 'multiple_choice', 'checkbox_grid'].includes(effectiveFieldType(field))
    || (field.type === 'checkbox' && Array.isArray(config.options) && config.options.length > 0);
  const FieldTag = groupedChoice ? 'fieldset' : 'div';

  // Render input fields
  return (
    <FieldTag
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
      style={appearanceStyle}
      data-sf-key={ownKey || undefined}>
      {(() => {
        const grouped = groupedChoice;
        const LabelTag = grouped ? 'legend' : 'label';
        return (
          <LabelTag
            id={`${inputId}-label`}
            className='subtleforms-field-label'
            {...(grouped ? {} : { htmlFor: inputId })}>
            {label}
            {required && (
              <span className='subtleforms-required' aria-label={', required'}>{requiredMark}</span>
            )}
          </LabelTag>
        );
      })()}

      {config.description && display.descriptionAbove && (
        <p id={`${inputId}-help`} className='subtleforms-field-help subtleforms-field-help--above'>
          {config.description}
        </p>
      )}

      {renderInput(
        field,
        value,
        (next, path) => onChange(path || resolvedPath, next),
        placeholder,
        inputId,
        required,
        error,
        values,
        inputName,
        resolvedPath
      )}

      {config.description && !display.descriptionAbove && (
        <p id={`${inputId}-help`} className='subtleforms-field-help'>
          {config.description}
        </p>
      )}

      {error && (
        <div
          id={`${inputId}-error`}
          className='subtleforms-field-error'
        >
          {error}
        </div>
      )}
    </FieldTag>
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
  inputName = undefined,
  valuePath = ''
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
  // An add-on can draw a built-in type its own way for some fields (for
  // example an upload that takes several files). Without it, the built-in
  // renderer below runs.
  const override = getFieldOverride(field, config);
  if (override) {
    return (
      <AddonField
        component={override.component}
        field={field}
        config={config}
        value={value}
        onChange={onChange}
        inputId={inputId}
        name={name}
        describedBy={describedBy}
        error={error}
        required={required}
        values={values}
      />
    );
  }
  // A type that an add-on provides but is not active (picture choice) is
  // drawn as the plain choice it falls back to; its images are ignored.
  switch (effectiveFieldType(field)) {
    case 'text':
    case 'email':
    case 'url':
    case 'number':
    case 'phone':
    case 'tel': {
      if (config.enableCountryCode) {
        const appearance = config.appearance && typeof config.appearance === 'object' ? config.appearance : {};
        return (
          <PhoneField
            inputId={inputId}
            name={name}
            describedBy={describedBy}
            config={config}
            value={value ?? ''}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            error={error}
            readOnly={config.readOnly === true}
            showFlags={appearance.showFlags !== false}
            flagImages={flagsOn(config.showFlags)}
          />
        );
      }
      // Fall through to the plain text-like input when the country picker is off.
    }
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
      if (field.type === 'phone' && config.format === 'us') {
        const shown = formatUsPhone(value ?? '');
        return (
          <input
            {...input.props}
            value={shown}
            inputMode='tel'
            aria-invalid={!!error || (shown && !isCompleteUsPhone(shown)) || undefined}
            onChange={(event) => onChange(formatUsPhone(event.target.value))}
          />
        );
      }
      if (field.type === 'password' && (config.strengthMeter !== false || config.requireConfirmation)) {
        const level = passwordStrength(value ?? '');
        const confirmPath = valuePath ? `${valuePath}_confirm` : `${name || 'password'}_confirm`;
        const confirm = getIn(values, confirmPath, '') ?? '';
        const mismatch = config.requireConfirmation && value && confirm && confirm !== value;
        return (
          <div className='subtleforms-password'>
            {input}
            {config.strengthMeter !== false && (
              <p className={`subtleforms-password__meter is-${level}`} role='status'>
                {level === 'strong'
                  ? __('Strong password', 'subtleforms')
                  : level === 'fair'
                    ? __('Fair password', 'subtleforms')
                    : __('Weak password', 'subtleforms')}
              </p>
            )}
            {config.requireConfirmation && (
              <input
                type='password'
                className='subtleforms-input subtleforms-password__confirm'
                name={name ? `${name}_confirm` : undefined}
                value={confirm}
                autoComplete='new-password'
                placeholder={__('Confirm password', 'subtleforms')}
                aria-label={__('Confirm password', 'subtleforms')}
                aria-invalid={!!mismatch || undefined}
                onChange={(event) => onChange(event.target.value, confirmPath)}
              />
            )}
          </div>
        );
      }
      if (!config.prefix && !config.suffix) {
        return input;
      }
      const prefixId = config.prefix ? `${inputId}-prefix` : null;
      const suffixId = config.suffix ? `${inputId}-suffix` : null;
      const withAffix = cloneElement(input, {
        'aria-describedby': [input.props['aria-describedby'], prefixId, suffixId].filter(Boolean).join(' ') || undefined,
      });
      return (
        <div className='subtleforms-input-affix'>
          {config.prefix && (
            <span id={prefixId} className='subtleforms-input-affix__prefix'>
              {config.prefix}
            </span>
          )}
          {withAffix}
          {config.suffix && (
            <span id={suffixId} className='subtleforms-input-affix__suffix'>
              {config.suffix}
            </span>
          )}
        </div>
      );
    }

    case 'date':
    case 'time':
    case 'datetime':
      return (
        <DateTimeField
          mode={field.type}
          inputId={inputId}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          format={config.format}
          min={config.minDate}
          max={config.maxDate}
          required={required}
          readOnly={config.readOnly === true}
          describedBy={describedBy}
          invalid={!!error}
        />
      );

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
        ? consentParts(consentLabel, policyUrl, linkText)
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
      return (
        <ChoiceSelect
          inputId={inputId}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          options={config.options || []}
          placeholder={placeholder}
          required={required}
          describedBy={describedBy}
          invalid={!!error}
          readOnly={config.readOnly === true}
        />
      );

    case 'country': {
      const stored = value === undefined || value === null || value === ''
        ? (config.default_country || '')
        : value;
      return (
        <CountrySelect
          inputId={inputId}
          name={name}
          value={stored}
          onChange={onChange}
          preferredCountries={config.preferred_countries}
          outputFormat={config.output_format || 'code'}
          searchable={config.searchable !== false}
          placeholder={placeholder}
          required={required}
          describedBy={describedBy}
          invalid={!!error}
          readOnly={config.readOnly === true}
          flagImages={flagsOn(config.showFlags)}
        />
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
    case 'address_group': {
      // Parts, labels and placeholders come from the builder's sub-field
      // settings; a switched-off part is not drawn (FB-02).
      const partsValue = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const emptyParts = new Set(error ? getCompositeEmptyParts(field, partsValue) : []);
      const baseName = config.key || field.key || '';
      const isName = field.type === 'name_group';
      return (
        <div className={isName ? 'subtleforms-name-group' : 'subtleforms-address-group'}>
          {compositeParts(field.type, config).map((part) => {
            const partId = `${inputId}-${part.part}`;
            const invalid = emptyParts.has(part.value);
            const partClass = isName
              ? 'subtleforms-name-part'
              : `subtleforms-address-part${part.full ? ' subtleforms-address-part--full' : ''}`;
            return (
              <div key={part.part} className={partClass}>
                <label htmlFor={partId} className='subtleforms-field-label'>
                  {part.label}
                </label>
                {part.part === 'country' ? (
                  <CountrySelect
                    inputId={partId}
                    name={`${baseName}_${part.value}`}
                    value={partValue(partsValue, part) || ''}
                    onChange={(next) => onChange({ ...partsValue, [part.value]: next })}
                    placeholder={__('Select Country', 'subtleforms')}
                    invalid={invalid}
                    describedBy={invalid ? `${inputId}-error` : undefined}
                  />
                ) : (
                  <input
                    id={partId}
                    type='text'
                    className='subtleforms-input'
                    value={partValue(partsValue, part) || ''}
                    onChange={(e) => onChange({ ...partsValue, [part.value]: e.target.value })}
                    placeholder={part.placeholder}
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? `${inputId}-error` : undefined}
                    autoComplete={part.auto}
                    name={`${baseName}_${part.value}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    }

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
          ? rangeSliderSeed(config)
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
      return (
        <label className='subtleforms-toggle' htmlFor={inputId}>
          <input
            id={inputId}
            type='checkbox'
            role='switch'
            className='subtleforms-toggle__input'
            name={name}
            value={onValue}
            checked={toggleIsOn(value, config)}
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

    case 'rich_text':
      return (
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
      // Field types registered by add-ons.
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
            name={name}
            describedBy={describedBy}
            error={error}
            required={required}
            values={values}
          />
        );
      }
      // A type no active plugin provides (for example an add-on field
      // after the add-on is deactivated) is left out of the live form.
      return null;
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
 * Renders an add-on field with the form's details (which form, preview).
 */
function AddonField({ component: Component, ...props }) {
  const form = useContext(FormContext);
  return <Component {...props} formId={form?.formId} preview={!!form?.preview} />;
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
