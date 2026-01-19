import { Modal, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Icon from './ui/Icon';
import './FormPreviewModal.scss';

/**
 * FormPreviewModal Component
 *
 * ⚠️ TASK 5.4 - Preview Uses Draft Schema (NEVER Active)
 * - Renders read-only preview of current draft schema
 * - NO backend mutations (all inputs disabled)
 * - Does NOT fetch active schema from server
 * - Schema prop is draftSchema from BuilderPage state
 */
export default function FormPreviewModal({ schema, onClose, isDirty = false }) {
  if (!schema || !schema.fields) {
    return null;
  }

  const formType = schema.metadata?.type || 'regular';
  const isConversational = formType === 'conversational';

  const renderField = (field, index) => {
    const config = field.config || {};
    const label = config.label || field.label || field.key;
    const required = config.required || false;
    const placeholder = config.placeholder || '';
    const helpText = config.help || '';
    const inputId = `preview-${field.key || index}`;

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label htmlFor={inputId}>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <input
              id={inputId}
              type={field.type}
              placeholder={placeholder}
              className='sf-form-preview-field__input'
              disabled
            />
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label htmlFor={inputId}>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <input
              id={inputId}
              type='number'
              placeholder={placeholder}
              min={config.min}
              max={config.max}
              step={config.step}
              className='sf-form-preview-field__input'
              disabled
            />
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label htmlFor={inputId}>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <textarea
              id={inputId}
              placeholder={placeholder}
              rows={config.rows || 4}
              className='sf-form-preview-field__input'
              disabled
            />
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'select':
      case 'dropdown':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label htmlFor={inputId}>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <select
              id={inputId}
              className='sf-form-preview-field__input'
              disabled>
              <option value=''>
                {placeholder || __('Select...', 'subtleforms')}
              </option>
              {field.options?.map((opt, i) => (
                <option key={i} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'radio':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <div className='sf-form-preview-field__radio-group'>
              {field.options?.map((opt, i) => (
                <label key={i} className='sf-form-preview-field__option'>
                  <input
                    type='radio'
                    name={field.key}
                    value={opt.value}
                    disabled
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'checkbox':
        // Single checkbox
        if (!field.options || field.options.length === 0) {
          return (
            <div key={field.key || index} className='sf-form-preview-field'>
              <label className='sf-form-preview-field__single-checkbox'>
                <input type='checkbox' disabled />
                <span>
                  {label}
                  {required && (
                    <span className='sf-form-preview-field__required'>*</span>
                  )}
                </span>
              </label>
              {helpText && (
                <p className='sf-form-preview-field__help'>{helpText}</p>
              )}
            </div>
          );
        }
        // Multiple checkboxes
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <div className='sf-form-preview-field__checkbox-group'>
              {field.options?.map((opt, i) => (
                <label key={i} className='sf-form-preview-field__option'>
                  <input type='checkbox' value={opt.value} disabled />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'date':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <input
              type='date'
              className='sf-form-preview-field__input'
              disabled
            />
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'time':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <input
              type='time'
              className='sf-form-preview-field__input'
              disabled
            />
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'file':
      case 'upload':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <div className='sf-form-preview-field__upload'>
              <p>{__('Click to upload or drag and drop', 'subtleforms')}</p>
            </div>
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'hidden':
        return null;

      case 'captcha':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <div className='sf-captcha-preview sf-captcha-preview--preview-mode'>
              <div className='sf-captcha-preview__icon'>🔒</div>
              <div className='sf-captcha-preview__content'>
                <div className='sf-captcha-preview__title'>
                  {__('CAPTCHA Verification', 'subtleforms')}
                </div>
                <div className='sf-captcha-preview__description'>
                  {__(
                    'CAPTCHA will appear here on the live form',
                    'subtleforms'
                  )}
                </div>
                {field.config?.providerName && (
                  <div className='sf-captcha-preview__provider'>
                    {field.config.providerName === 'recaptcha' &&
                      'Google reCAPTCHA'}
                    {field.config.providerName === 'hcaptcha' && 'hCaptcha'}
                    {field.config.providerName === 'turnstile' &&
                      'Cloudflare Turnstile'}
                  </div>
                )}
              </div>
            </div>
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'country':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label htmlFor={inputId}>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <select
              id={inputId}
              className='sf-form-preview-field__input sf-country-field__select'
              disabled>
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
            <div
              className='sf-country-field__info'
              style={{ marginTop: '0.5rem' }}>
              <span
                className='dashicons dashicons-admin-site'
                style={{
                  fontSize: '16px',
                  width: '16px',
                  height: '16px',
                }}></span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontStyle: 'italic',
                  color: '#0369a1',
                }}>
                {__(
                  'Full ISO-3166 country list available on frontend',
                  'subtleforms'
                )}
              </span>
            </div>
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'name_group':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <div className='sf-form-preview-field__name-group'>
              {field.enable_first_name !== false &&
                config.enable_first_name !== false && (
                  <div className='sf-form-preview-field__name-part'>
                    <label htmlFor={`${inputId}-first`}>
                      {__('First Name', 'subtleforms')}
                      {required && (
                        <span className='sf-form-preview-field__required'>
                          *
                        </span>
                      )}
                    </label>
                    <input
                      id={`${inputId}-first`}
                      type='text'
                      placeholder={__('First Name', 'subtleforms')}
                      className='sf-form-preview-field__input'
                      disabled
                    />
                  </div>
                )}
              {(field.enable_middle_name || config.enable_middle_name) && (
                <div className='sf-form-preview-field__name-part'>
                  <label htmlFor={`${inputId}-middle`}>
                    {__('Middle Name', 'subtleforms')}
                  </label>
                  <input
                    id={`${inputId}-middle`}
                    type='text'
                    placeholder={__('Middle Name', 'subtleforms')}
                    className='sf-form-preview-field__input'
                    disabled
                  />
                </div>
              )}
              {field.enable_last_name !== false &&
                config.enable_last_name !== false && (
                  <div className='sf-form-preview-field__name-part'>
                    <label htmlFor={`${inputId}-last`}>
                      {__('Last Name', 'subtleforms')}
                      {required && (
                        <span className='sf-form-preview-field__required'>
                          *
                        </span>
                      )}
                    </label>
                    <input
                      id={`${inputId}-last`}
                      type='text'
                      placeholder={__('Last Name', 'subtleforms')}
                      className='sf-form-preview-field__input'
                      disabled
                    />
                  </div>
                )}
            </div>
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      case 'address_group':
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <div className='sf-form-preview-field__address-group'>
              {field.enable_street1 !== false &&
                config.enable_street1 !== false && (
                  <div className='sf-form-preview-field__address-part sf-form-preview-field__address-part--full'>
                    <label htmlFor={`${inputId}-street1`}>
                      {__('Street Address', 'subtleforms')}
                      {required && (
                        <span className='sf-form-preview-field__required'>
                          *
                        </span>
                      )}
                    </label>
                    <input
                      id={`${inputId}-street1`}
                      type='text'
                      placeholder={__('Street Address', 'subtleforms')}
                      className='sf-form-preview-field__input'
                      disabled
                    />
                  </div>
                )}
              {field.enable_street2 && config.enable_street2 && (
                <div className='sf-form-preview-field__address-part sf-form-preview-field__address-part--full'>
                  <label htmlFor={`${inputId}-street2`}>
                    {__('Street Address Line 2', 'subtleforms')}
                  </label>
                  <input
                    id={`${inputId}-street2`}
                    type='text'
                    placeholder={__('Apt, Suite, etc.', 'subtleforms')}
                    className='sf-form-preview-field__input'
                    disabled
                  />
                </div>
              )}
              {field.enable_city !== false && config.enable_city !== false && (
                <div className='sf-form-preview-field__address-part'>
                  <label htmlFor={`${inputId}-city`}>
                    {__('City', 'subtleforms')}
                    {required && (
                      <span className='sf-form-preview-field__required'>*</span>
                    )}
                  </label>
                  <input
                    id={`${inputId}-city`}
                    type='text'
                    placeholder={__('City', 'subtleforms')}
                    className='sf-form-preview-field__input'
                    disabled
                  />
                </div>
              )}
              {field.enable_state !== false &&
                config.enable_state !== false && (
                  <div className='sf-form-preview-field__address-part'>
                    <label htmlFor={`${inputId}-state`}>
                      {__('State / Province', 'subtleforms')}
                      {required && (
                        <span className='sf-form-preview-field__required'>
                          *
                        </span>
                      )}
                    </label>
                    <input
                      id={`${inputId}-state`}
                      type='text'
                      placeholder={__('State / Province', 'subtleforms')}
                      className='sf-form-preview-field__input'
                      disabled
                    />
                  </div>
                )}
              {field.enable_postal_code !== false &&
                config.enable_postal_code !== false && (
                  <div className='sf-form-preview-field__address-part'>
                    <label htmlFor={`${inputId}-postal`}>
                      {__('Postal Code', 'subtleforms')}
                      {required && (
                        <span className='sf-form-preview-field__required'>
                          *
                        </span>
                      )}
                    </label>
                    <input
                      id={`${inputId}-postal`}
                      type='text'
                      placeholder={__('Postal Code', 'subtleforms')}
                      className='sf-form-preview-field__input'
                      disabled
                    />
                  </div>
                )}
              {field.enable_country !== false &&
                config.enable_country !== false && (
                  <div className='sf-form-preview-field__address-part'>
                    <label htmlFor={`${inputId}-country`}>
                      {__('Country', 'subtleforms')}
                      {required && (
                        <span className='sf-form-preview-field__required'>
                          *
                        </span>
                      )}
                    </label>
                    <select
                      id={`${inputId}-country`}
                      className='sf-form-preview-field__input'
                      disabled>
                      <option>{__('Select Country', 'subtleforms')}</option>
                    </select>
                  </div>
                )}
            </div>
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={field.key || index} className='sf-form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='sf-form-preview-field__required'>*</span>
              )}
            </label>
            <input
              type='text'
              placeholder={placeholder}
              className='sf-form-preview-field__input'
              disabled
            />
            {helpText && (
              <p className='sf-form-preview-field__help'>{helpText}</p>
            )}
          </div>
        );
    }
  };

  return (
    <Modal
      title={
        <div className='sf-form-preview-modal__header'>
          <span>{__('Form Preview', 'subtleforms')}</span>
          <button
            onClick={onClose}
            className='sf-form-preview-modal__close-btn'>
            <Icon.Close />
          </button>
        </div>
      }
      onRequestClose={onClose}
      className='subtleforms-preview-modal'
      style={{ maxWidth: '700px', width: '100%' }}>
      <div className='sf-form-preview-modal__container'>
        {/* Form Header */}
        <div className='sf-form-preview-modal__form-header'>
          <h2>
            {schema.metadata?.title || __('Untitled Form', 'subtleforms')}
          </h2>
          <p className='sf-form-preview-modal__form-header-notice'>
            {isDirty
              ? __(
                  'Preview shows your current draft (including unsaved changes).',
                  'subtleforms'
                )
              : __('Preview shows your current draft.', 'subtleforms')}
          </p>
          {schema.metadata?.description && (
            <p className='sf-form-preview-modal__form-header-description'>
              {schema.metadata.description}
            </p>
          )}
        </div>

        {/* Form Fields */}
        <div className='sf-form-preview-modal__fields'>
          {isConversational ? (
            <div>
              <div className='sf-form-preview-modal__conversational-notice'>
                <p>
                  {__(
                    'Conversational forms display one question at a time. This preview shows all fields together.',
                    'subtleforms'
                  )}
                </p>
              </div>
              {schema.fields.map((field, index) => renderField(field, index))}
            </div>
          ) : (
            <div>
              {schema.fields.map((field, index) => renderField(field, index))}
            </div>
          )}

          {schema.fields.length === 0 && (
            <div className='sf-form-preview-modal__empty'>
              <p>
                {__(
                  'No fields added yet. Add fields to see the preview.',
                  'subtleforms'
                )}
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className='sf-form-preview-modal__submit-section'>
          <Button isPrimary disabled>
            {__('Submit', 'subtleforms')}
          </Button>
          <p className='sf-form-preview-modal__submit-section-note'>
            {__(
              'This is a preview. The form is not functional.',
              'subtleforms'
            )}
          </p>
        </div>
      </div>
    </Modal>
  );
}
