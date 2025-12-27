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
      'w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'url':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block mb-1 font-medium text-gray-700 text-sm'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </label>
            <input
              type={field.type}
              placeholder={placeholder}
              className={baseClasses}
              disabled
            />
            {helpText && (
              <p className='mt-1 text-gray-500 text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block mb-1 font-medium text-gray-700 text-sm'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
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
              <p className='mt-1 text-gray-500 text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block mb-1 font-medium text-gray-700 text-sm'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </label>
            <textarea
              placeholder={placeholder}
              rows={config.rows || 4}
              className={baseClasses}
              disabled
            />
            {helpText && (
              <p className='mt-1 text-gray-500 text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'select':
      case 'dropdown':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block mb-1 font-medium text-gray-700 text-sm'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
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
              <p className='mt-1 text-gray-500 text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'radio':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block mb-2 font-medium text-gray-700 text-sm'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </label>
            <div className='space-y-2'>
              {field.options?.map((opt, i) => (
                <label key={i} className='flex items-center'>
                  <input
                    type='radio'
                    name={field.key}
                    value={opt.value}
                    className='mr-2'
                    disabled
                  />
                  <span className='text-gray-700 text-sm'>{opt.label}</span>
                </label>
              ))}
            </div>
            {helpText && (
              <p className='mt-1 text-gray-500 text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'checkbox':
        // Single checkbox
        if (!field.options || field.options.length === 0) {
          return (
            <div key={field.key || index} className='mb-4'>
              <label className='flex items-center'>
                <input type='checkbox' className='mr-2' disabled />
                <span className='font-medium text-gray-700 text-sm'>
                  {label}
                  {required && <span className='ml-1 text-red-500'>*</span>}
                </span>
              </label>
              {helpText && (
                <p className='mt-1 text-gray-500 text-xs'>{helpText}</p>
              )}
            </div>
          );
        }
        // Multiple checkboxes
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block mb-2 font-medium text-gray-700 text-sm'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </label>
            <div className='space-y-2'>
              {field.options?.map((opt, i) => (
                <label key={i} className='flex items-center'>
                  <input
                    type='checkbox'
                    value={opt.value}
                    className='mr-2'
                    disabled
                  />
                  <span className='text-gray-700 text-sm'>{opt.label}</span>
                </label>
              ))}
            </div>
            {helpText && (
              <p className='mt-1 text-gray-500 text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'date':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block mb-1 font-medium text-gray-700 text-sm'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </label>
            <input type='date' className={baseClasses} disabled />
            {helpText && (
              <p className='mt-1 text-gray-500 text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'time':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block mb-1 font-medium text-gray-700 text-sm'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </label>
            <input type='time' className={baseClasses} disabled />
            {helpText && (
              <p className='mt-1 text-gray-500 text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'file':
      case 'upload':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block mb-1 font-medium text-gray-700 text-sm'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </label>
            <div className='p-6 border-2 border-gray-300 border-dashed rounded-md text-center'>
              <p className='text-gray-500 text-sm'>
                {__('Click to upload or drag and drop', 'subtleforms')}
              </p>
            </div>
            {helpText && (
              <p className='mt-1 text-gray-500 text-xs'>{helpText}</p>
            )}
          </div>
        );

      case 'hidden':
        return null;

      default:
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block mb-1 font-medium text-gray-700 text-sm'>
              {label}
              {required && <span className='ml-1 text-red-500'>*</span>}
            </label>
            <input
              type='text'
              placeholder={placeholder}
              className={baseClasses}
              disabled
            />
            {helpText && (
              <p className='mt-1 text-gray-500 text-xs'>{helpText}</p>
            )}
          </div>
        );
    }
  };

  return (
    <Modal
      title={
        <div className='flex justify-between items-center'>
          <span>{__('Form Preview', 'subtleforms')}</span>
          <button
            onClick={onClose}
            className='p-2 text-gray-400 hover:text-gray-600'>
            <FiX className='w-5 h-5' />
          </button>
        </div>
      }
      onRequestClose={onClose}
      className='subtleforms-preview-modal'
      style={{ maxWidth: '700px', width: '100%' }}>
      <div className='bg-gray-50 -mx-6 -mt-4 -mb-6 p-6'>
        {/* Form Header */}
        <div className='bg-white shadow-sm mb-4 p-6 rounded-lg'>
          <h2 className='mb-2 font-bold text-gray-900 text-2xl'>
            {schema.metadata?.title || __('Untitled Form', 'subtleforms')}
          </h2>
          {schema.metadata?.description && (
            <p className='text-gray-600'>{schema.metadata.description}</p>
          )}
        </div>

        {/* Form Fields */}
        <div className='bg-white shadow-sm p-6 rounded-lg max-h-[60vh] overflow-y-auto'>
          {isConversational ? (
            <div className='space-y-6'>
              <div className='bg-blue-50 p-4 border-blue-500 border-l-4 rounded'>
                <p className='text-blue-800 text-sm'>
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
            <div className='py-12 text-center'>
              <p className='text-gray-500'>
                {__(
                  'No fields added yet. Add fields to see the preview.',
                  'subtleforms'
                )}
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className='bg-white shadow-sm mt-4 p-6 rounded-lg'>
          <Button isPrimary disabled className='justify-center w-full'>
            {__('Submit', 'subtleforms')}
          </Button>
          <p className='mt-2 text-gray-500 text-xs text-center'>
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
