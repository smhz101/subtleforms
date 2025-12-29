import { Modal, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { FiX } from 'react-icons/fi';

export default function FormPreviewModal({ schema, onClose }) {
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

    const baseClasses =
      'sf-w-full sf-px-4 sf-py-2 sf-border sf-border-gray-300 sf-rounded-md focus:sf-outline-none focus:sf-ring-2 focus:sf-ring-blue-500';

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return (
          <div key={field.key || index} className='sf-mb-4'>
            <label className='sf-block sf-mb-1 sf-font-medium sf-text-gray-700 sf-text-sm'>
              {label}
              {required && <span className='sf-ml-1 sf-text-red-500'>*</span>}
            </label>
            <input
              type={field.type}
              placeholder={placeholder}
              className={baseClasses}
              disabled
            />
            {helpText && (
              <p className='sf-mt-1 sf-text-gray-500 sf-text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field.key || index} className='sf-mb-4'>
            <label className='sf-block sf-mb-1 sf-font-medium sf-text-gray-700 sf-text-sm'>
              {label}
              {required && <span className='sf-ml-1 sf-text-red-500'>*</span>}
            </label>
            <input
              type='number'
              placeholder={placeholder}
              min={config.min}
              max={config.max}
              step={config.step}
              className={baseClasses}
              disabled
            />
            {helpText && (
              <p className='sf-mt-1 sf-text-gray-500 sf-text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.key || index} className='sf-mb-4'>
            <label className='sf-block sf-mb-1 sf-font-medium sf-text-gray-700 sf-text-sm'>
              {label}
              {required && <span className='sf-ml-1 sf-text-red-500'>*</span>}
            </label>
            <textarea
              placeholder={placeholder}
              rows={config.rows || 4}
              className={baseClasses}
              disabled
            />
            {helpText && (
              <p className='sf-mt-1 sf-text-gray-500 sf-text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'select':
      case 'dropdown':
        return (
          <div key={field.key || index} className='sf-mb-4'>
            <label className='sf-block sf-mb-1 sf-font-medium sf-text-gray-700 sf-text-sm'>
              {label}
              {required && <span className='sf-ml-1 sf-text-red-500'>*</span>}
            </label>
            <select className={baseClasses} disabled>
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
              <p className='sf-mt-1 sf-text-gray-500 sf-text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'radio':
        return (
          <div key={field.key || index} className='sf-mb-4'>
            <label className='sf-block sf-mb-2 sf-font-medium sf-text-gray-700 sf-text-sm'>
              {label}
              {required && <span className='sf-ml-1 sf-text-red-500'>*</span>}
            </label>
            <div className='sf-space-y-2'>
              {field.options?.map((opt, i) => (
                <label key={i} className='sf-flex sf-items-center'>
                  <input
                    type='radio'
                    name={field.key}
                    value={opt.value}
                    className='sf-mr-2'
                    disabled
                  />
                  <span className='sf-text-gray-700 sf-text-sm'>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            {helpText && (
              <p className='sf-mt-1 sf-text-gray-500 sf-text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'checkbox':
        // Single checkbox
        if (!field.options || field.options.length === 0) {
          return (
            <div key={field.key || index} className='sf-mb-4'>
              <label className='sf-flex sf-items-center'>
                <input type='checkbox' className='sf-mr-2' disabled />
                <span className='sf-font-medium sf-text-gray-700 sf-text-sm'>
                  {label}
                  {required && (
                    <span className='sf-ml-1 sf-text-red-500'>*</span>
                  )}
                </span>
              </label>
              {helpText && (
                <p className='sf-mt-1 sf-text-gray-500 sf-text-xs'>
                  {helpText}
                </p>
              )}
            </div>
          );
        }
        // Multiple checkboxes
        return (
          <div key={field.key || index} className='sf-mb-4'>
            <label className='sf-block sf-mb-2 sf-font-medium sf-text-gray-700 sf-text-sm'>
              {label}
              {required && <span className='sf-ml-1 sf-text-red-500'>*</span>}
            </label>
            <div className='sf-space-y-2'>
              {field.options?.map((opt, i) => (
                <label key={i} className='sf-flex sf-items-center'>
                  <input
                    type='checkbox'
                    value={opt.value}
                    className='sf-mr-2'
                    disabled
                  />
                  <span className='sf-text-gray-700 sf-text-sm'>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            {helpText && (
              <p className='sf-mt-1 sf-text-gray-500 sf-text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'date':
        return (
          <div key={field.key || index} className='sf-mb-4'>
            <label className='sf-block sf-mb-1 sf-font-medium sf-text-gray-700 sf-text-sm'>
              {label}
              {required && <span className='sf-ml-1 sf-text-red-500'>*</span>}
            </label>
            <input type='date' className={baseClasses} disabled />
            {helpText && (
              <p className='sf-mt-1 sf-text-gray-500 sf-text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'time':
        return (
          <div key={field.key || index} className='sf-mb-4'>
            <label className='sf-block sf-mb-1 sf-font-medium sf-text-gray-700 sf-text-sm'>
              {label}
              {required && <span className='sf-ml-1 sf-text-red-500'>*</span>}
            </label>
            <input type='time' className={baseClasses} disabled />
            {helpText && (
              <p className='sf-mt-1 sf-text-gray-500 sf-text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'file':
      case 'upload':
        return (
          <div key={field.key || index} className='sf-mb-4'>
            <label className='sf-block sf-mb-1 sf-font-medium sf-text-gray-700 sf-text-sm'>
              {label}
              {required && <span className='sf-ml-1 sf-text-red-500'>*</span>}
            </label>
            <div className='sf-p-6 sf-border-2 sf-border-gray-300 sf-border-dashed sf-rounded-md sf-text-center'>
              <p className='sf-text-gray-500 sf-text-sm'>
                {__('Click to upload or drag and drop', 'subtleforms')}
              </p>
            </div>
            {helpText && (
              <p className='sf-mt-1 sf-text-gray-500 sf-text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'hidden':
        return null;

      default:
        return (
          <div key={field.key || index} className='sf-mb-4'>
            <label className='sf-block sf-mb-1 sf-font-medium sf-text-gray-700 sf-text-sm'>
              {label}
              {required && <span className='sf-ml-1 sf-text-red-500'>*</span>}
            </label>
            <input
              type='text'
              placeholder={placeholder}
              className={baseClasses}
              disabled
            />
            {helpText && (
              <p className='sf-mt-1 sf-text-gray-500 sf-text-xs'>{helpText}</p>
            )}
          </div>
        );
    }
  };

  return (
    <Modal
      title={
        <div className='sf-flex sf-justify-between sf-items-center'>
          <span>{__('Form Preview', 'subtleforms')}</span>
          <button
            onClick={onClose}
            className='sf-p-2 sf-text-gray-400 hover:sf-text-gray-600'>
            <FiX className='sf-w-5 sf-h-5' />
          </button>
        </div>
      }
      onRequestClose={onClose}
      className='subtleforms-preview-modal'
      style={{ maxWidth: '700px', width: '100%' }}>
      <div className='sf-bg-gray-50 -mx-6 -mt-4 -mb-6 sf-p-6'>
        {/* Form Header */}
        <div className='sf-bg-white sf-shadow-sm sf-mb-4 sf-p-6 sf-rounded-lg'>
          <h2 className='sf-mb-2 sf-font-bold sf-text-gray-900 sf-text-2xl'>
            {schema.metadata?.title || __('Untitled Form', 'subtleforms')}
          </h2>
          {schema.metadata?.description && (
            <p className='sf-text-gray-600'>{schema.metadata.description}</p>
          )}
        </div>

        {/* Form Fields */}
        <div className='sf-bg-white sf-shadow-sm sf-p-6 sf-rounded-lg sf-max-h-[60vh] sf-overflow-y-auto'>
          {isConversational ? (
            <div className='sf-space-y-6'>
              <div className='sf-bg-blue-50 sf-p-4 sf-border-blue-500 sf-border-l-4 sf-rounded'>
                <p className='sf-text-blue-800 sf-text-sm'>
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
            <div className='sf-py-12 sf-text-center'>
              <p className='sf-text-gray-500'>
                {__(
                  'No fields added yet. Add fields to see the preview.',
                  'subtleforms'
                )}
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className='sf-bg-white sf-shadow-sm sf-mt-4 sf-p-6 sf-rounded-lg'>
          <Button isPrimary disabled className='sf-justify-center sf-w-full'>
            {__('Submit', 'subtleforms')}
          </Button>
          <p className='sf-mt-2 sf-text-gray-500 sf-text-xs sf-text-center'>
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
