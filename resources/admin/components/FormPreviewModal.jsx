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

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return (
          <div key={field.key || index} className='form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='form-preview-field__required'>*</span>
              )}
            </label>
            <input
              type={field.type}
              placeholder={placeholder}
              className='form-preview-field__input'
              disabled
            />
            {helpText && <p className='form-preview-field__help'>{helpText}</p>}
          </div>
        );

      case 'number':
        return (
          <div key={field.key || index} className='form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='form-preview-field__required'>*</span>
              )}
            </label>
            <input
              type='number'
              placeholder={placeholder}
              min={config.min}
              max={config.max}
              step={config.step}
              className='form-preview-field__input'
              disabled
            />
            {helpText && <p className='form-preview-field__help'>{helpText}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.key || index} className='form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='form-preview-field__required'>*</span>
              )}
            </label>
            <textarea
              placeholder={placeholder}
              rows={config.rows || 4}
              className='form-preview-field__input'
              disabled
            />
            {helpText && <p className='form-preview-field__help'>{helpText}</p>}
          </div>
        );

      case 'select':
      case 'dropdown':
        return (
          <div key={field.key || index} className='form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='form-preview-field__required'>*</span>
              )}
            </label>
            <select className='form-preview-field__input' disabled>
              <option value=''>
                {placeholder || __('Select...', 'subtleforms')}
              </option>
              {field.options?.map((opt, i) => (
                <option key={i} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {helpText && <p className='form-preview-field__help'>{helpText}</p>}
          </div>
        );

      case 'radio':
        return (
          <div key={field.key || index} className='form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='form-preview-field__required'>*</span>
              )}
            </label>
            <div className='form-preview-field__radio-group'>
              {field.options?.map((opt, i) => (
                <label key={i} className='form-preview-field__option'>
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
            {helpText && <p className='form-preview-field__help'>{helpText}</p>}
          </div>
        );

      case 'checkbox':
        // Single checkbox
        if (!field.options || field.options.length === 0) {
          return (
            <div key={field.key || index} className='form-preview-field'>
              <label className='form-preview-field__single-checkbox'>
                <input type='checkbox' disabled />
                <span>
                  {label}
                  {required && (
                    <span className='form-preview-field__required'>*</span>
                  )}
                </span>
              </label>
              {helpText && (
                <p className='form-preview-field__help'>{helpText}</p>
              )}
            </div>
          );
        }
        // Multiple checkboxes
        return (
          <div key={field.key || index} className='form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='form-preview-field__required'>*</span>
              )}
            </label>
            <div className='form-preview-field__checkbox-group'>
              {field.options?.map((opt, i) => (
                <label key={i} className='form-preview-field__option'>
                  <input type='checkbox' value={opt.value} disabled />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            {helpText && <p className='form-preview-field__help'>{helpText}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={field.key || index} className='form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='form-preview-field__required'>*</span>
              )}
            </label>
            <input type='date' className='form-preview-field__input' disabled />
            {helpText && <p className='form-preview-field__help'>{helpText}</p>}
          </div>
        );

      case 'time':
        return (
          <div key={field.key || index} className='form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='form-preview-field__required'>*</span>
              )}
            </label>
            <input type='time' className='form-preview-field__input' disabled />
            {helpText && <p className='form-preview-field__help'>{helpText}</p>}
          </div>
        );

      case 'file':
      case 'upload':
        return (
          <div key={field.key || index} className='form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='form-preview-field__required'>*</span>
              )}
            </label>
            <div className='form-preview-field__upload'>
              <p>{__('Click to upload or drag and drop', 'subtleforms')}</p>
            </div>
            {helpText && <p className='form-preview-field__help'>{helpText}</p>}
          </div>
        );

      case 'hidden':
        return null;

      default:
        return (
          <div key={field.key || index} className='form-preview-field'>
            <label>
              {label}
              {required && (
                <span className='form-preview-field__required'>*</span>
              )}
            </label>
            <input
              type='text'
              placeholder={placeholder}
              className='form-preview-field__input'
              disabled
            />
            {helpText && <p className='form-preview-field__help'>{helpText}</p>}
          </div>
        );
    }
  };

  return (
    <Modal
      title={
        <div className='form-preview-modal__header'>
          <span>{__('Form Preview', 'subtleforms')}</span>
          <button onClick={onClose} className='form-preview-modal__close-btn'>
            <Icon.Close />
          </button>
        </div>
      }
      onRequestClose={onClose}
      className='subtleforms-preview-modal'
      style={{ maxWidth: '700px', width: '100%' }}>
      <div className='form-preview-modal__container'>
        {/* Form Header */}
        <div className='form-preview-modal__form-header'>
          <h2>
            {schema.metadata?.title || __('Untitled Form', 'subtleforms')}
          </h2>
          <p className='form-preview-modal__form-header-notice'>
            {isDirty
              ? __(
                  'Preview shows your current draft (including unsaved changes).',
                  'subtleforms'
                )
              : __('Preview shows your current draft.', 'subtleforms')}
          </p>
          {schema.metadata?.description && (
            <p className='form-preview-modal__form-header-description'>
              {schema.metadata.description}
            </p>
          )}
        </div>

        {/* Form Fields */}
        <div className='form-preview-modal__fields'>
          {isConversational ? (
            <div>
              <div className='form-preview-modal__conversational-notice'>
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
            <div className='form-preview-modal__empty'>
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
        <div className='form-preview-modal__submit-section'>
          <Button isPrimary disabled>
            {__('Submit', 'subtleforms')}
          </Button>
          <p className='form-preview-modal__submit-section-note'>
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
