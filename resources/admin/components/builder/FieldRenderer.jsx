import { memo, useState, useRef, useCallback, useEffect, useContext } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { getFieldIcon } from '../../utils/iconRegistry';
import Icon from '../../ui/Icon';
import NameFieldRenderer from './NameFieldRenderer';
import AddressFieldRenderer from './AddressFieldRenderer';
import { ProductPreview, ChoicePreview, SummaryPreview, CardPreview } from './PaymentPreviews';
import { getCanvasPreview } from '../../../shared/extend';
import { fieldDisplay } from '../../../shared/fieldDisplay';
import { fieldConfig } from '../../../shared/fieldConfig';
import { orderedCountries, preferredCountryCodes, COUNTRIES } from '../../../shared/countries';
import { toggleInitialValue, toggleIsOn } from '../../../shared/toggleState';
import ChainedSelect from '../../../frontend/components/fields/ChainedSelect';
import PhoneField from '../../../frontend/components/fields/PhoneField';
import { ConfigContext } from './context/ConfigContext';
import './FieldRenderer.scss';

// Types that do not accept user input — required indicator suppressed
const NON_INPUT_TYPES = new Set([
  'section_break', 'form_step', 'repeat_field', 'html', 'hidden',
  'one_column_container', 'two_column_container', 'three_column_container',
  'four_column_container', 'five_column_container', 'six_column_container',
  'repeat_container', 'group_container', 'step', 'action_hook', 'disclaimer',
  'payment_summary', 'payment_hidden_price', 'calculation', 'payment_card',
  'recaptcha', 'hcaptcha', 'turnstile',
]);

// All field types recognized by this renderer — unknown types get legacy fallback
const KNOWN_TYPES = new Set([
  ...NON_INPUT_TYPES,
  'text', 'email', 'phone', 'tel', 'url', 'number', 'textarea', 'checkbox', 'consent',
  'radio', 'multiple_choice', 'select', 'dropdown', 'date', 'time', 'datetime',
  'country', 'chained_select', 'password', 'rating', 'range_slider',
  'color_picker', 'signature', 'image_upload', 'file_upload',
  'name_group', 'address_group',
  'payment_amount', 'payment_coupon', 'payment_product', 'payment_choice',
  'post_create', 'quiz_score',
  'rich_text', 'net_promoter_score', 'checkbox_grid',
  'toggle', 'scale', 'picture_choice', 'calculation',
]);

/** Whether authored HTML has any visible text. */
function hasText(html) {
  return typeof html === 'string' && html.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '').length > 0;
}

/**
 * FieldRenderer - Memoized field preview component
 * 
 * Wrapped in memo() to prevent unnecessary re-renders during drag operations.
 * Only re-renders when field prop changes.
 */
const FieldRenderer = memo(function FieldRenderer({ field, previewMode = false, onLabelChange, interactive = false }) {
  // Null-safe destructure — required before hooks so all hooks run unconditionally
  const { type, label, required, placeholder, options, subFields } = field || {};

  const labelClass = 'sf-field-renderer__label';
  const inputClass = 'sf-field-renderer__input';
  const selectClass = 'sf-field-renderer__select';

  // ── Inline label editing state — ALL hooks before any early return ──────────
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState('');
  const [chainedSelections, setChainedSelections] = useState([]);
  const labelInputRef = useRef(null);

  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [isEditingLabel]);

  // Reset editing state when label changes externally (e.g. undo/redo)
  useEffect(() => {
    setIsEditingLabel(false);
    setEditLabelValue(label || '');
  }, [label]);

  const handleLabelClick = useCallback((e) => {
    if (!onLabelChange) return;
    // Do NOT stopPropagation — let the click bubble to FieldChrome so the field
    // gets selected (inspector opens) before / alongside entering edit mode.
    setEditLabelValue(label || field?.name || '');
    setIsEditingLabel(true);
  }, [onLabelChange, label, field?.name]);

  const commitLabelEdit = useCallback(() => {
    setIsEditingLabel(false);
    if (onLabelChange) {
      const trimmed = (editLabelValue || '').trim();
      // Fallback to original label rather than saving an empty string
      onLabelChange(field?.id, trimmed || label || field?.name || __('Untitled', 'subtleforms'));
    }
  }, [onLabelChange, editLabelValue, field?.id, label, field?.name]);

  const handleLabelKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitLabelEdit();
    }
    if (e.key === 'Escape') {
      e.stopPropagation();
      setIsEditingLabel(false);
    }
  }, [commitLabelEdit]);

  // ── Preview validation touched state ────────────────────────────────────
  // Fields already on canvas when preview toggles on show errors immediately.
  // Fields added while preview is already active get a brief grace period so
  // the user isn’t confronted with an error the instant they drop the field.
  const previewModeOnMount = useRef(previewMode);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!previewMode) {
      setTouched(false);
      return;
    }
    if (previewModeOnMount.current) {
      // Field was added while preview was already active — grace period.
      const t = setTimeout(() => {
        setTouched(true);
        previewModeOnMount.current = false;
      }, 700);
      return () => clearTimeout(t);
    }
    // Preview was off when this field was first rendered, now turned on.
    setTouched(true);
  }, [previewMode]);

  // Label visibility and help text placement, with the form's defaults: the
  // canvas shows them as the live form does (2.3.2).
  const builderConfig = useContext(ConfigContext);
  const display = fieldDisplay(field, builderConfig?.fieldDefaults || {});

  // ── Early return AFTER all hooks ────────────────────────────────────────────
  // Guard against null/undefined field or missing type — do NOT crash builder
  if (!field || !field.type) {
    return null;
  }

  const showRequired = required && !NON_INPUT_TYPES.has(type);
  const FieldIcon = getFieldIcon(type);

  // ── Section Break ───────────────────────────────────────────────────────────
  if (type === 'section_break') {
    return (
      <div className='sf-field-renderer__section-break'>
        <div className='sf-field-renderer__section-break-line' />
        {field.title && (
          <div className='sf-field-renderer__section-break-title'>{field.title}</div>
        )}
        {field.description && (
          <div className='sf-field-renderer__section-break-desc'>{field.description}</div>
        )}
        {!field.title && !field.description && (
          <span className='sf-field-renderer__section-break-placeholder'>
            {__('Section Break', 'subtleforms')}
          </span>
        )}
      </div>
    );
  }

  const isCompositeType = type === 'name_group' || type === 'address_group';

  return (
    <div className={[
      previewMode && showRequired && touched ? 'sf-field-renderer--preview-error' : null,
      isCompositeType ? 'sf-field-renderer--composite' : null,
    ].filter(Boolean).join(' ') || undefined}>
      {/* Label — inline editable when onLabelChange is provided */}
      {isEditingLabel ? (
        <input
          ref={labelInputRef}
          type='text'
          className='sf-field-renderer__label-input'
          value={editLabelValue}
          onChange={(e) => setEditLabelValue(e.target.value)}
          onBlur={commitLabelEdit}
          onKeyDown={handleLabelKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className={`sf-field-renderer__header${display.labelHidden && !NON_INPUT_TYPES.has(type) ? ' is-label-hidden' : ''}`}>
          <span className='sf-field-renderer__icon'>
            <FieldIcon size={14} />
          </span>
          <label
            className={`${labelClass}${onLabelChange ? ' sf-field-renderer__label--editable' : ''}`}
            onClick={handleLabelClick}
          >
            {label || field.name}
            {showRequired && (
              <span className='sf-field-renderer__required-mark'>*</span>
            )}
          </label>
          {display.labelHidden && !NON_INPUT_TYPES.has(type) && (
            <span className='sf-field-renderer__label-hidden-badge'>
              <Icon.EyeOff size={12} aria-hidden='true' />
              {__('Label hidden', 'subtleforms')}
            </span>
          )}
        </div>
      )}

      {/* Help text above the input (2.3.2) */}
      {field.description && !NON_INPUT_TYPES.has(type) && display.descriptionAbove && (
        <p className='sf-field-renderer__help-text sf-field-renderer__help-text--above'>{field.description}</p>
      )}

      {/* Render appropriate input based on type */}
      {(type === 'phone' || type === 'tel') && fieldConfig(field).enableCountryCode && (
        <PhoneField
          config={fieldConfig(field)}
          value=""
          showFlags={(fieldConfig(field).appearance || {}).showFlags !== false}
          disabled={!interactive}
          inputClassName={inputClass}
          placeholder={placeholder}
        />
      )}

      {(type === 'text' ||
        type === 'email' ||
        ((type === 'phone' || type === 'tel') && !fieldConfig(field).enableCountryCode) ||
        type === 'url' ||
        type === 'number') && (
        <div className={field.prefix || field.suffix ? 'sf-field-renderer__affix' : undefined}>
          {field.prefix && <span className='sf-field-renderer__affix-part'>{field.prefix}</span>}
          <input
            type={type === 'email' ? 'email' : type === 'url' ? 'url' : type === 'number' ? 'number' : 'text'}
            placeholder={placeholder || ''}
            className={inputClass}
            readOnly
            tabIndex='-1'
          />
          {field.suffix && <span className='sf-field-renderer__affix-part'>{field.suffix}</span>}
        </div>
      )}

      {type === 'toggle' && (() => {
        const cfg = fieldConfig(field);
        const on = toggleIsOn(toggleInitialValue(cfg), cfg);
        return (
          <div className='sf-field-renderer__toggle'>
            <span className={`sf-field-renderer__toggle-track${on ? ' is-on' : ''}`} aria-hidden='true'>
              <span className='sf-field-renderer__toggle-thumb' />
            </span>
            <span>{field.toggleLabel || __('Yes', 'subtleforms')}</span>
          </div>
        );
      })()}

      {type === 'scale' && (() => {
        const min = parseInt(field.scaleMin ?? 1, 10);
        const max = Math.max(min + 1, Math.min(10, parseInt(field.scaleMax ?? 5, 10)));
        const points = [];
        for (let i = min; i <= max; i++) points.push(i);
        return (
          <div className='sf-field-renderer__scale'>
            <div className='sf-field-renderer__scale-row' style={{ '--sf-scale-count': points.length }}>
              {points.map((p) => (
                <span key={p} className='sf-field-renderer__scale-point'>{p}</span>
              ))}
            </div>
            {(field.minLabel || field.maxLabel) && (
              <div className='sf-field-renderer__nps-labels'>
                <span>{field.minLabel}</span>
                <span>{field.maxLabel}</span>
              </div>
            )}
          </div>
        );
      })()}

      {type === 'picture_choice' && (
        <div
          className='sf-field-renderer__pictures'
          style={{ '--sf-picture-cols': parseInt(field.pictureColumns || 3, 10) }}>
          {(options || []).map((opt, i) => (
            <div key={opt.value || i} className='sf-field-renderer__picture'>
              <div className='sf-field-renderer__picture-media'>
                {opt.image ? <img src={opt.image} alt='' /> : <Icon.Image size={20} />}
              </div>
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      )}

      {type === 'calculation' && (
        String(field.formula || '').trim() ? (
          <div className='sf-field-renderer__calculation'>
            <span className='sf-field-renderer__calculation-value'>
              {field.prefix}0{parseInt(field.decimals ?? 2, 10) > 0 ? '.' + '0'.repeat(parseInt(field.decimals ?? 2, 10)) : ''}{field.suffix}
            </span>
            <code className='sf-field-renderer__calculation-formula'>{field.formula}</code>
          </div>
        ) : (
          // No formula yet: say what to do instead of showing a fake 0.00. The
          // field is hidden on the live form until it has one (bug 9).
          <p className='sf-field-renderer__placeholder-note'>
            {__('Add a formula in the field settings', 'subtleforms')}
          </p>
        )
      )}

      {type === 'disclaimer' && (
        hasText(field.content) ? (
          <div
            className={`sf-field-renderer__disclaimer sf-field-renderer__disclaimer--${field.variant || 'info'}`}
            dangerouslySetInnerHTML={{ __html: field.content }}
          />
        ) : (
          // Empty disclaimers are not shown on the live form (bug 10).
          <p className='sf-field-renderer__placeholder-note'>
            {__('Add the disclaimer text in the field settings. Empty disclaimers are hidden on the live form.', 'subtleforms')}
          </p>
        )
      )}

      {type === 'textarea' && (
        <textarea
          rows={field.rows || 4}
          placeholder={placeholder || ''}
          className={`${inputClass} resize-y`}
          readOnly
          tabIndex='-1'
        />
      )}

      {type === 'checkbox' && (
        <div className='sf-field-renderer__checkbox-single'>
          <input
            type='checkbox'
            className='sf-field-renderer__checkbox'
            tabIndex='-1'
            readOnly
          />
          <span className='sf-field-renderer__checkbox-label'>
            {field.checkboxLabel || __('I agree', 'subtleforms')}
          </span>
        </div>
      )}

      {type === 'consent' && (
        <div className='sf-field-renderer__checkbox-single sf-field-renderer__consent'>
          <input
            type='checkbox'
            className='sf-field-renderer__checkbox'
            tabIndex='-1'
            readOnly
          />
          <span className='sf-field-renderer__checkbox-label'>
            {(() => {
              const label = field.checkboxLabel || __('I agree to the Privacy Policy.', 'subtleforms');
              const url = field.privacyPolicyUrl || '';
              const linkText = field.linkText || __('Privacy Policy', 'subtleforms');
              if (!url) return label;
              if (label.indexOf('{{link}}') !== -1) {
                const [before, after] = label.split('{{link}}');
                return (
                  <>
                    {before}
                    <a
                      href={url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='sf-field-renderer__consent-link'
                      onClick={(e) => e.preventDefault()}>
                      {linkText}
                    </a>
                    {after}
                  </>
                );
              }
              return (
                <>
                  {label}{' '}
                  <a
                    href={url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='sf-field-renderer__consent-link'
                    onClick={(e) => e.preventDefault()}>
                    {linkText}
                  </a>
                </>
              );
            })()}
          </span>
        </div>
      )}

      {type === 'radio' && options && (
        <div className={`sf-field-renderer__options-list sf-field-renderer__options-list--${field.optionLayout || 'stacked'}`}>
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
        <div className={`sf-field-renderer__options-list sf-field-renderer__options-list--${field.optionLayout || 'stacked'}`}>
          {options.map((opt, idx) => (
            <div key={idx} className='sf-field-renderer__checkbox-wrapper'>
              <input
                type={field.allowMultiple === false ? 'radio' : 'checkbox'}
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

      {(type === 'dropdown' || type === 'select') && (() => {
        const choiceOptions = (fieldConfig(field).options || options || [])
          .map((opt) => (
            opt && typeof opt === 'object'
              ? { label: opt.label || opt.value || '', value: opt.value ?? opt.label ?? '' }
              : { label: String(opt ?? ''), value: String(opt ?? '') }
          ))
          .filter((opt) => opt.label || opt.value);
        return (
          <div className='sf-field-renderer__menu'>
            <select
              className={selectClass}
              defaultValue=''
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}>
              <option value=''>
                {placeholder || __('Select an option', 'subtleforms')}
              </option>
              {choiceOptions.map((opt, idx) => (
                <option key={`${opt.value}-${idx}`} value={opt.value}>
                  {opt.label || opt.value}
                </option>
              ))}
            </select>
            {choiceOptions.length > 0 ? (
              <ul className='sf-field-renderer__choice-preview' aria-label={__('Choices', 'subtleforms')}>
                {choiceOptions.map((opt, idx) => (
                  <li key={`${opt.value}-${idx}`}>{opt.label || opt.value}</li>
                ))}
              </ul>
            ) : (
              <p className='sf-field-renderer__choice-empty'>
                {__('Add choices in the field settings to show them here.', 'subtleforms')}
              </p>
            )}
          </div>
        );
      })()}

      {type === 'date' && (
        <div className='sf-field-renderer__date-placeholder'>
          <span className='sf-field-renderer__date-icon'><Icon.Calendar size={16} /></span>
          <span className='sf-field-renderer__date-text'>
            {placeholder || __('Select a date', 'subtleforms')}
          </span>
        </div>
      )}

      {type === 'time' && (
        <div className='sf-field-renderer__time-placeholder'>
          <span className='sf-field-renderer__time-icon'><Icon.Clock size={16} /></span>
          <span className='sf-field-renderer__time-text'>
            {placeholder || __('Select a time', 'subtleforms')}
          </span>
        </div>
      )}

      {type === 'datetime' && (
        <div className='sf-field-renderer__datetime-placeholder'>
          <span className='sf-field-renderer__datetime-icon'><Icon.Calendar size={16} /><Icon.Clock size={16} /></span>
          <span className='sf-field-renderer__datetime-text'>
            {placeholder || __('Select date and time', 'subtleforms')}
          </span>
        </div>
      )}

      {type === 'country' && (() => {
        const cfg = fieldConfig(field);
        const outputFormat = cfg.output_format || 'code';
        const countries = orderedCountries(preferredCountryCodes(cfg.preferred_countries));
        const raw = cfg.default_country || '';
        const matched = COUNTRIES.find((country) => country.code === String(raw).toUpperCase());
        const selected = outputFormat === 'name' ? (matched ? matched.name : raw) : raw;
        return (
          <div className='sf-country-field'>
            <select
              className={selectClass}
              defaultValue={selected}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}>
              <option value=''>
                {placeholder || __('Select a country', 'subtleforms')}
              </option>
              {countries.map((country) => (
                <option
                  key={country.code}
                  value={outputFormat === 'name' ? country.name : country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            <ul className='sf-field-renderer__choice-preview' aria-label={__('Countries', 'subtleforms')}>
              {countries.map((country) => (
                <li key={country.code}>{country.name}</li>
              ))}
            </ul>
          </div>
        );
      })()}

      {type === 'hidden' && (
        <div className='sf-field-renderer__hidden-field'>
          <Icon.Lock size={14} />
          {__('Hidden field (not visible to users)', 'subtleforms')}
        </div>
      )}

      {type === 'html' && (
        // The content as visitors see it (2.3.2), not a locked-looking
        // placeholder. Same trust level as the Notice field above: authored by
        // the admin and sanitized on save.
        hasText(field.content) || /<(img|hr|iframe|video)\b/i.test(field.content || '') ? (
          <div
            className='sf-field-renderer__html'
            dangerouslySetInnerHTML={{ __html: field.content }}
          />
        ) : (
          <p className='sf-field-renderer__placeholder-note'>
            {__('Add HTML content in the field settings.', 'subtleforms')}
          </p>
        )
      )}

      {type === 'image_upload' && (
        <div className='sf-field-renderer__image-placeholder'>
          <div className='sf-field-renderer__image-icon'><Icon.Image size={28} /></div>
          <div className='sf-field-renderer__image-text'>
            {__('Click to upload or drag image here', 'subtleforms')}
          </div>
        </div>
      )}

      {type === 'file_upload' && (
        <div className='sf-field-renderer__file-placeholder'>
          <div className='sf-field-renderer__file-icon'><Icon.File size={28} /></div>
          <div className='sf-field-renderer__file-text'>
            {__('Click to upload or drag file here', 'subtleforms')}
          </div>
        </div>
      )}

      {/* Legacy address field detected — deprecated and ignored */}

      {/* Payment fields */}
      {type === 'payment_amount' && (
        <div className='sf-field-renderer__rating-wrapper'>
          {field.showCurrencySymbol !== false && field.currency && (
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

      {type === 'payment_summary' && <SummaryPreview field={field} />}

      {type === 'payment_product' && <ProductPreview field={field} />}

      {type === 'payment_choice' && <ChoicePreview field={field} />}

      {type === 'payment_card' && <CardPreview />}

      {/* Canvas previews registered by add-ons (registerCanvasPreview). */}
      {(() => {
        const AddonPreview = getCanvasPreview(type);
        return AddonPreview ? <AddonPreview field={field} /> : null;
      })()}

      {type === 'payment_coupon' && (
        <div className='sf-field-renderer__subscribe-wrapper'>
          <input
            type='text'
            placeholder={placeholder || __('Enter coupon code', 'subtleforms')}
            className={`${inputClass} sf-field-renderer__subscribe-input`}
            readOnly
            tabIndex='-1'
          />
          <button
            type='button'
            className='sf-field-renderer__subscribe-button'
            disabled>
            <span className='sf-field-renderer__button-icon'><Icon.Check size={12} /></span>
            {field.buttonText || __('Apply', 'subtleforms')}
          </button>
        </div>
      )}

      {type === 'payment_hidden_price' && (
        <div className='sf-field-renderer__hidden-field'>
          {__('Hidden pricing field (not visible to users)', 'subtleforms')}
        </div>
      )}

      {type === 'action_hook' && (
        <div className='sf-action-hook-preview'>
          <div className='sf-action-hook-preview__header'>
            <span className='sf-action-hook-preview__icon'><Icon.Zap size={18} /></span>
            <div className='sf-action-hook-preview__title-group'>
              <div className='sf-action-hook-preview__title'>
                {__('Action Hook', 'subtleforms')}
              </div>
              <div className='sf-action-hook-preview__subtitle'>
                {__('WordPress Action Integration', 'subtleforms')}
              </div>
            </div>
          </div>
          <div className='sf-action-hook-preview__body'>
            <div className='sf-action-hook-preview__code'>
              <span className='sf-action-hook-preview__code-keyword'>do_action</span>
              <span className='sf-action-hook-preview__code-bracket'>(</span>
              <span className='sf-action-hook-preview__code-string'>
                {`'${field.hook_name || 'subtleforms_custom_action'}'`}
              </span>
              <span className='sf-action-hook-preview__code-bracket'>)</span>
            </div>
          </div>
        </div>
      )}

      {type === 'step' && (
        <div className='sf-step-preview'>
          <div className='sf-step-preview__header'>
            <div className='sf-step-preview__number'>
              <span className='sf-step-preview__number-icon'><Icon.Layers size={14} /></span>
            </div>
            <div className='sf-step-preview__title-group'>
              <div className='sf-step-preview__title'>
                {field.title || field.label || __('Step', 'subtleforms')}
              </div>
              <div className='sf-step-preview__subtitle'>
                {field.description || __('Multi-step form container', 'subtleforms')}
              </div>
            </div>
          </div>
          <div className='sf-step-preview__progress'>
            <div className='sf-step-preview__progress-bar'>
              <div className='sf-step-preview__progress-fill'></div>
            </div>
          </div>
        </div>
      )}

      {(type === 'recaptcha' || type === 'hcaptcha' || type === 'turnstile') && (
        <div className='sf-captcha-preview'>
          <div className='sf-captcha-preview__header'>
            <div className='sf-captcha-preview__icon'><Icon.Lock size={20} /></div>
            <div className='sf-captcha-preview__title-group'>
              <div className='sf-captcha-preview__title'>
                {type === 'recaptcha' ? 'Google reCAPTCHA' : type === 'hcaptcha' ? 'hCaptcha' : 'Cloudflare Turnstile'}
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
          </div>
          <div className='sf-captcha-preview__footer'>
            <div className='sf-captcha-preview__status'>
              <span className='sf-captcha-preview__status-icon'><Icon.HelpCircle size={12} /></span>
              {__('CAPTCHA will appear here on the live form', 'subtleforms')}
            </div>
          </div>
        </div>
      )}

      {/* ── Chained Select ──────────────────────────────────────────────────── */}
      {type === 'chained_select' && (
        <ChainedSelect
          config={fieldConfig(field)}
          value={chainedSelections}
          onChange={setChainedSelections}
          selectClassName={selectClass}
          disabled={!interactive}
        />
      )}

      {/* ── Color Picker ────────────────────────────────────────────────────── */}
      {type === 'color_picker' && (
        <div className='sf-field-renderer__color-picker'>
          <div className='sf-field-renderer__color-swatch-row'>
            {['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'].map((c) => (
              <span
                key={c}
                className='sf-field-renderer__color-swatch'
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            type='text'
            placeholder={placeholder || __('#000000', 'subtleforms')}
            className={inputClass}
            readOnly
            tabIndex='-1'
          />
        </div>
      )}

      {/* ── Signature ───────────────────────────────────────────────────────── */}
      {type === 'signature' && (
        <div className='sf-field-renderer__signature'>
          <div className='sf-field-renderer__signature-canvas'>
            <span className='sf-field-renderer__signature-placeholder'>
              {__('Sign here', 'subtleforms')}
            </span>
          </div>
          <div className='sf-field-renderer__field-hint'>
            {__('Draw your signature on the live form', 'subtleforms')}
          </div>
        </div>
      )}

      {/* ── Password ────────────────────────────────────────────────────────── */}
      {type === 'password' && (
        <input
          type='password'
          placeholder={placeholder || '••••••••'}
          className={inputClass}
          readOnly
          tabIndex='-1'
        />
      )}

      {/* ── Rating ──────────────────────────────────────────────────────────── */}
      {type === 'rating' && (
        <div className='sf-field-renderer__rating'>
          {Array.from({ length: field.max || 5 }, (_, i) => (
            <span key={i} className='sf-field-renderer__rating-star'>
              <Icon.Star size={22} />
            </span>
          ))}
        </div>
      )}

      {/* ── Range Slider ────────────────────────────────────────────────────── */}
      {type === 'range_slider' && (
        <div className='sf-field-renderer__range-slider'>
          <div className='sf-field-renderer__range-track'>
            <div className='sf-field-renderer__range-fill' />
            <div className='sf-field-renderer__range-thumb' />
          </div>
          <div className='sf-field-renderer__range-labels'>
            <span>{field.min ?? 0}</span>
            <span>{field.max ?? 100}</span>
          </div>
        </div>
      )}

      {/* ── Rich Text ───────────────────────────────────────────────────────── */}
      {type === 'rich_text' && (
        <div className='sf-field-renderer__rich-text'>
          <div className='sf-field-renderer__rich-text-toolbar'>
            <span className='sf-field-renderer__rich-text-btn'>B</span>
            <span className='sf-field-renderer__rich-text-btn'>I</span>
            <span className='sf-field-renderer__rich-text-btn'>U</span>
            <span className='sf-field-renderer__rich-text-sep' />
            <span className='sf-field-renderer__rich-text-btn'>≡</span>
          </div>
          <div className='sf-field-renderer__rich-text-body'>
            {__('Rich text content…', 'subtleforms')}
          </div>
        </div>
      )}

      {/* ── Net Promoter Score ──────────────────────────────────────────────── */}
      {type === 'net_promoter_score' && (
        <div className='sf-field-renderer__nps'>
          <div className='sf-field-renderer__nps-scale'>
            {Array.from({ length: 11 }, (_, i) => (
              <span key={i} className='sf-field-renderer__nps-option'>{i}</span>
            ))}
          </div>
          <div className='sf-field-renderer__nps-labels'>
            <span>{__('Not likely', 'subtleforms')}</span>
            <span>{__('Very likely', 'subtleforms')}</span>
          </div>
        </div>
      )}

      {/* ── Checkbox Grid ───────────────────────────────────────────────────── */}
      {type === 'checkbox_grid' && !(field.columns?.length && field.rows?.length) && (
        // Nothing to answer yet; the live form hides an empty matrix (bug 8).
        <p className='sf-field-renderer__placeholder-note'>
          {__('Add at least one row and one column in the field settings.', 'subtleforms')}
        </p>
      )}

      {type === 'checkbox_grid' && field.columns?.length > 0 && field.rows?.length > 0 && (() => {
        const gridCols = field.columns;
        const gridRows = field.rows;
        const gridStyle = { '--sf-grid-cols': gridCols.length };
        return (
          <div className='sf-field-renderer__checkbox-grid'>
            <div className='sf-field-renderer__checkbox-grid-header' style={gridStyle}>
              <span />
              {gridCols.map((col, i) => (
                <span key={i} className='sf-field-renderer__checkbox-grid-col'>{col?.label ?? col}</span>
              ))}
            </div>
            {gridRows.map((row, i) => (
              <div key={i} className='sf-field-renderer__checkbox-grid-row' style={gridStyle}>
                <span className='sf-field-renderer__checkbox-grid-row-label'>{row?.label ?? row}</span>
                {gridCols.map((_, j) => (
                  <span key={j} className='sf-field-renderer__checkbox-grid-cell'>
                    <input type={field.multiplePerRow === false ? 'radio' : 'checkbox'} className='sf-field-renderer__checkbox' readOnly tabIndex='-1' />
                  </span>
                ))}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Name (composite) ────────────────────────────────────────────────── */}
      {type === 'name_group' && <NameFieldRenderer field={field} />}

      {/* ── Address (composite) ─────────────────────────────────────────────── */}
      {type === 'address_group' && <AddressFieldRenderer field={field} />}

      {/* Unknown / legacy field type — safe fallback, do NOT crash builder */}
      {!KNOWN_TYPES.has(type) && !getCanvasPreview(type) && (
        <div className='sf-field-renderer__unknown-field'>
          {__('Unsupported field (legacy)', 'subtleforms')}
        </div>
      )}

      {/* ── Help text — shown for input fields only ─────────────────────────── */}
      {field.description && !NON_INPUT_TYPES.has(type) && !display.descriptionAbove && (
        <p className='sf-field-renderer__help-text'>{field.description}</p>
      )}

      {/* ── Builder: required field hint (normal mode) ── */}
      {showRequired && !previewMode && (
        <p className='sf-field-renderer__required-hint'>
          {__('Required', 'subtleforms')}
        </p>
      )}

      {/* ── Builder: preview validation error ── */}
      {previewMode && showRequired && touched && (
        <p className='sf-field-renderer__preview-error'>
          {__('This field is required.', 'subtleforms')}
        </p>
      )}
    </div>
  );
});

export default FieldRenderer;
