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
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {label}
              {required && <span className='text-red-500 ml-1'>*</span>}
            </label>
            <input
              type={field.type}
              placeholder={placeholder}
              className={baseClasses}
              disabled
            />
            {helpText && <p className='text-xs text-gray-500 mt-1'>{helpText}</p>}
          </div>
        );

      case 'number':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {label}
              {required && <span className='text-red-500 ml-1'>*</span>}
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
            {helpText && <p className='text-xs text-gray-500 mt-1'>{helpText}</p>}
          </div>
        );

      case 'textarea':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {label}
              {required && <span className='text-red-500 ml-1'>*</span>}
            </label>
            <textarea
              placeholder={placeholder}
              rows={config.rows || 4}
              className={baseClasses}
              disabled
            />
            {helpText && <p className='text-xs text-gray-500 mt-1'>{helpText}</p>}
          </div>
        );

      case 'select':
      case 'dropdown':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {label}
              {required && <span className='text-red-500 ml-1'>*</span>}
            </label>
            <select className={baseClasses} disabled>
              <option value=''>{placeholder || __('Select...', 'subtleforms')}</option>
              {field.options?.map((opt, i) => (
                <option key={i} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {helpText && <p className='text-xs text-gray-500 mt-1'>{helpText}</p>}
          </div>
        );

      case 'radio':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              {label}
              {required && <span className='text-red-500 ml-1'>*</span>}
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
                  <span className='text-sm text-gray-700'>{opt.label}</span>
                </label>
              ))}
            </div>
            {helpText && <p className='text-xs text-gray-500 mt-1'>{helpText}</p>}
          </div>
        );

      case 'checkbox':
        // Single checkbox
        if (!field.options || field.options.length === 0) {
          return (
            <div key={field.key || index} className='mb-4'>
              <label className='flex items-center'>
                <input type='checkbox' className='mr-2' disabled />
                <span className='text-sm font-medium text-gray-700'>
                  {label}
                  {required && <span className='text-red-500 ml-1'>*</span>}
                </span>
              </label>
              {helpText && <p className='text-xs text-gray-500 mt-1'>{helpText}</p>}
            </div>
          );
        }
        // Multiple checkboxes
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              {label}
              {required && <span className='text-red-500 ml-1'>*</span>}
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
                  <span className='text-sm text-gray-700'>{opt.label}</span>
                </label>
              ))}
            </div>
            {helpText && <p className='text-xs text-gray-500 mt-1'>{helpText}</p>}
          </div>
        );

      case 'date':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {label}
              {required && <span className='text-red-500 ml-1'>*</span>}
            </label>
            <input type='date' className={baseClasses} disabled />
            {helpText && <p className='text-xs text-gray-500 mt-1'>{helpText}</p>}
          </div>
        );

      case 'time':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {label}
              {required && <span className='text-red-500 ml-1'>*</span>}
            </label>
            <input type='time' className={baseClasses} disabled />
            {helpText && <p className='text-xs text-gray-500 mt-1'>{helpText}</p>}
          </div>
        );

      case 'file':
      case 'upload':
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {label}
              {required && <span className='text-red-500 ml-1'>*</span>}
            </label>
            <div className='border-2 border-dashed border-gray-300 rounded-md p-6 text-center'>
              <p className='text-sm text-gray-500'>
                {__('Click to upload or drag and drop', 'subtleforms')}
              </p>
            </div>
            {helpText && <p className='text-xs text-gray-500 mt-1'>{helpText}</p>}
          </div>
        );

      case 'hidden':
        return null;

      default:
        return (
          <div key={field.key || index} className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {label}
              {required && <span className='text-red-500 ml-1'>*</span>}
            </label>
            <input
              type='text'
              placeholder={placeholder}
              className={baseClasses}
              disabled
            />
            {helpText && <p className='text-xs text-gray-500 mt-1'>{helpText}</p>}
          </div>
        );
    }
  };

  return (
    <Modal
      title={
        <div className='flex items-center justify-between'>
          <span>{__('Form Preview', 'subtleforms')}</span>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 p-2'>
            <FiX className='w-5 h-5' />
          </button>
        </div>
      }
      onRequestClose={onClose}
      className='subtleforms-preview-modal'
      style={{ maxWidth: '700px', width: '100%' }}>
      <div className='bg-gray-50 -mx-6 -mt-4 -mb-6 p-6'>
        {/* Form Header */}
        <div className='bg-white rounded-lg shadow-sm p-6 mb-4'>
          <h2 className='text-2xl font-bold text-gray-900 mb-2'>
            {schema.metadata?.title || __('Untitled Form', 'subtleforms')}
          </h2>
          {schema.metadata?.description && (
            <p className='text-gray-600'>{schema.metadata.description}</p>
          )}
        </div>

        {/* Form Fields */}
        <div className='bg-white rounded-lg shadow-sm p-6 max-h-[60vh] overflow-y-auto'>
          {isConversational ? (
            <div className='space-y-6'>
              <div className='bg-blue-50 border-l-4 border-blue-500 p-4 rounded'>
                <p className='text-sm text-blue-800'>
                  {__(
                    'Conversational forms display one question at a time. This preview shows all fields together.',
                    'subtleforms'
                  )}
                </p>
              </div>
              {schema.fields.map((field, index) => renderField(field, index))}
            </div>
          ) : (
            <div>{schema.fields.map((field, index) => renderField(field, index))}</div>
          )}

          {schema.fields.length === 0 && (
            <div className='text-center py-12'>
              <p className='text-gray-500'>
                {__('No fields added yet. Add fields to see the preview.', 'subtleforms')}
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className='bg-white rounded-lg shadow-sm p-6 mt-4'>
          <Button isPrimary disabled className='w-full justify-center'>
            {__('Submit', 'subtleforms')}
          </Button>
          <p className='text-xs text-gray-500 text-center mt-2'>
            {__('This is a preview. The form is not functional.', 'subtleforms')}
          </p>
        </div>
      </div>
    </Modal>
  );
}
