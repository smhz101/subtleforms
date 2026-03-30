import { memo, useState, useRef, useCallback, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { getFieldRenderer } from './canvas/renderers';
import { getFieldIcon } from '../../utils/iconRegistry';
import Icon from '../../components/ui/Icon';
import './FieldRenderer.scss';

// Types that do not accept user input — required indicator suppressed
const NON_INPUT_TYPES = new Set([
  'section_break', 'form_step', 'repeat_field', 'html', 'hidden',
  'one_column_container', 'two_column_container', 'three_column_container',
  'four_column_container', 'five_column_container', 'six_column_container',
  'repeat_container', 'group_container', 'step', 'action_hook',
  'payment_summary', 'payment_hidden_price',
  'recaptcha', 'hcaptcha', 'turnstile',
]);

// All field types recognized by this renderer — unknown types get legacy fallback
const KNOWN_TYPES = new Set([
  ...NON_INPUT_TYPES,
  'text', 'email', 'phone', 'url', 'number', 'textarea', 'checkbox',
  'radio', 'multiple_choice', 'dropdown', 'date', 'time', 'datetime',
  'country', 'chained_select', 'password', 'rating', 'range_slider',
  'color_picker', 'signature', 'image_upload', 'file_upload',
  'name_group', 'address_group',
  'payment_amount', 'payment_coupon',
  'post_create', 'quiz_score',
]);

/**
 * FieldRenderer - Memoized field preview component
 * 
 * Wrapped in memo() to prevent unnecessary re-renders during drag operations.
 * Only re-renders when field prop changes.
 */
const FieldRenderer = memo(function FieldRenderer({ field, previewMode = false, onLabelChange }) {
  // Null-safe destructure — required before hooks so all hooks run unconditionally
  const { type, label, required, placeholder, options, subFields } = field || {};

  const labelClass = 'sf-field-renderer__label';
  const inputClass = 'sf-field-renderer__input';
  const selectClass = 'sf-field-renderer__select';

  // ── Inline label editing state — ALL hooks before any early return ──────────
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState('');
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

  // ── Early return AFTER all hooks ────────────────────────────────────────────
  // Guard against null/undefined field or missing type — do NOT crash builder
  if (!field || !field.type) {
    return null;
  }

  const showRequired = required && !NON_INPUT_TYPES.has(type);

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

  return (
    <div className={previewMode && showRequired && touched ? 'sf-field-renderer--preview-error' : undefined}>
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
        <label
          className={`${labelClass}${onLabelChange ? ' sf-field-renderer__label--editable' : ''}`}
          onClick={handleLabelClick}
        >
          {label || field.name}
          {showRequired && (
            <span className='sf-field-renderer__required-mark'>*</span>
          )}
        </label>
      )}

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
          rows={field.rows || 4}
          placeholder={placeholder || ''}
          className={`${inputClass} resize-y`}
          readOnly
          tabIndex='-1'
        />
      )}

      {type === 'checkbox' && (
        <div className='sf-field-renderer__options-list'>
          {(options || [{ label: __('Option', 'subtleforms') }]).map((opt, idx) => (
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

      {type === 'country' && (
        <div className='sf-country-field'>
          <select
            className={selectClass}
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
            <option>{__('...and 235+ more countries', 'subtleforms')}</option>
          </select>
          <div className='sf-country-field__info'>
            {(() => { const CountryIcon = getFieldIcon('country'); return <CountryIcon size={16} />; })()}
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
          <Icon.Lock size={14} />
          {__('Hidden field (not visible to users)', 'subtleforms')}
        </div>
      )}

      {type === 'html' && (
        <div className='sf-field-renderer__warning-box'>
          <Icon.Code size={14} />
          {__('HTML Content Block', 'subtleforms')}
        </div>
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

      {type === 'payment_summary' && (
        <div className='sf-field-renderer__calculation-box'>
          <div className='sf-field-renderer__calc-header'>
            <span className='sf-field-renderer__calc-icon'><Icon.FileText size={14} /></span>
            <span className='sf-field-renderer__calc-title'>
              {__('Payment Summary', 'subtleforms')}
            </span>
          </div>
          <div className='sf-field-renderer__calc-divider'></div>
          {field.showSubtotal !== false && (
            <div className='sf-field-renderer__calc-row'>
              <span>
                <span className='sf-field-renderer__calc-row-icon'><Icon.DollarSign size={12} /></span>
                {__('Subtotal:', 'subtleforms')}
              </span>
              <span className='sf-field-renderer__calc-value'>$0.00</span>
            </div>
          )}
          {field.showTax && (
            <div className='sf-field-renderer__calc-row'>
              <span>
                <span className='sf-field-renderer__calc-row-icon'><Icon.Database size={12} /></span>
                {field.taxRate ? `${__('Tax', 'subtleforms')} (${field.taxRate}%):` : __('Tax:', 'subtleforms')}
              </span>
              <span className='sf-field-renderer__calc-value'>$0.00</span>
            </div>
          )}
          <div className='sf-field-renderer__calc-row sf-field-renderer__calc-row--discount'>
            <span>
              <span className='sf-field-renderer__calc-row-icon'><Icon.Tag size={12} /></span>
              {__('Discount:', 'subtleforms')}
            </span>
            <span className='sf-field-renderer__calc-value sf-field-renderer__calc-value--discount'>-$0.00</span>
          </div>
          <div className='sf-field-renderer__calc-divider sf-field-renderer__calc-divider--bold'></div>
          {field.showTotal !== false && (
            <div className='sf-field-renderer__calc-total'>
              <span>
                <span className='sf-field-renderer__calc-total-icon'><Icon.DollarSign size={14} /></span>
                {__('Total:', 'subtleforms')}
              </span>
              <span className='sf-field-renderer__calc-total-value'>$0.00</span>
            </div>
          )}
          <div className='sf-field-renderer__calc-footer'>
            <span className='sf-field-renderer__calc-footer-icon'><Icon.HelpCircle size={12} /></span>
            <span className='sf-field-renderer__calc-footer-text'>
              {__('Amount will be calculated automatically', 'subtleforms')}
            </span>
          </div>
        </div>
      )}

      {type === 'payment_coupon' && (
        <div className='sf-field-renderer__coupon-container'>
          <div className='sf-field-renderer__coupon-header'>
            <span className='sf-field-renderer__coupon-icon'><Icon.Tag size={14} /></span>
            <span className='sf-field-renderer__coupon-title'>
              {__('Have a coupon code?', 'subtleforms')}
            </span>
          </div>
          <div className='sf-field-renderer__subscribe-wrapper'>
            <div className='sf-field-renderer__input-wrapper'>
              <input
                type='text'
                placeholder={placeholder || __('Enter coupon code', 'subtleforms')}
                className={`${inputClass} sf-field-renderer__subscribe-input`}
                readOnly
                tabIndex='-1'
              />
            </div>
            <button
              type='button'
              className='sf-field-renderer__subscribe-button'
              disabled>
              <span className='sf-field-renderer__button-icon'><Icon.Check size={12} /></span>
              {field.buttonText || __('Apply', 'subtleforms')}
            </button>
          </div>
          <div className='sf-field-renderer__coupon-hint'>
            <span className='sf-field-renderer__coupon-hint-icon'><Icon.Lightbulb size={12} /></span>
            <span className='sf-field-renderer__coupon-hint-text'>
              {__('Enter your discount code to save on your purchase', 'subtleforms')}
            </span>
          </div>
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
                '{field.hook_name || 'subtleforms_custom_action'}'
              </span>
              <span className='sf-action-hook-preview__code-bracket'>)</span>
            </div>
            <div className='sf-action-hook-preview__info'>
              <span className='sf-action-hook-preview__info-icon'><Icon.Zap size={12} /></span>
              <span className='sf-action-hook-preview__info-text'>
                {__('Triggers custom WordPress actions during form processing', 'subtleforms')}
              </span>
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
            <div className='sf-step-preview__progress-text'>
              {__('Step navigation will appear here', 'subtleforms')}
            </div>
          </div>
          <div className='sf-step-preview__fields'>
            <div className='sf-step-preview__field-indicator'>●</div>
            <div className='sf-step-preview__field-indicator'>●</div>
            <div className='sf-step-preview__field-indicator'>●</div>
            <span className='sf-step-preview__fields-text'>
              {__('Form fields will be displayed here', 'subtleforms')}
            </span>
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

      {/* ── Chained Select ──────────────────────────────────────────────────── */}
      {type === 'chained_select' && (
        <div className='sf-field-renderer__chained-select'>
          <select className={selectClass} disabled tabIndex='-1'>
            <option>{placeholder || __('Select category…', 'subtleforms')}</option>
          </select>
          <select className={selectClass} disabled tabIndex='-1' style={{ marginTop: '6px' }}>
            <option>{__('Select subcategory…', 'subtleforms')}</option>
          </select>
          <div className='sf-field-renderer__field-hint'>
            {__('Options load based on parent selection', 'subtleforms')}
          </div>
        </div>
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
      {type === 'checkbox_grid' && (() => {
        const gridCols = field.columns?.length ? field.columns : ['Option 1', 'Option 2'];
        const gridRows = field.rows?.length ? field.rows : ['Row 1', 'Row 2'];
        const gridStyle = { gridTemplateColumns: `auto ${gridCols.map(() => '1fr').join(' ')}` };
        return (
          <div className='sf-field-renderer__checkbox-grid'>
            <div className='sf-field-renderer__checkbox-grid-header' style={gridStyle}>
              <span />
              {gridCols.map((col, i) => (
                <span key={i} className='sf-field-renderer__checkbox-grid-col'>{col}</span>
              ))}
            </div>
            {gridRows.map((row, i) => (
              <div key={i} className='sf-field-renderer__checkbox-grid-row' style={gridStyle}>
                <span className='sf-field-renderer__checkbox-grid-row-label'>{row}</span>
                {gridCols.map((_, j) => (
                  <span key={j} className='sf-field-renderer__checkbox-grid-cell'>
                    <input type='checkbox' className='sf-field-renderer__checkbox' readOnly tabIndex='-1' />
                  </span>
                ))}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Unknown / legacy field type — safe fallback, do NOT crash builder */}
      {!KNOWN_TYPES.has(type) && (
        <div className='sf-field-renderer__unknown-field'>
          {__('Unsupported field (legacy)', 'subtleforms')}
        </div>
      )}

      {/* ── Help text — shown for input fields only ─────────────────────────── */}
      {field.description && !NON_INPUT_TYPES.has(type) && (
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
