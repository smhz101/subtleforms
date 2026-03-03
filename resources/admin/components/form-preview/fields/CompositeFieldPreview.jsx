import { __ } from '@wordpress/i18n';

/**
 * CompositeFieldPreview Component
 *
 * Renders composite fields: name_group, address_group
 */
export default function CompositeFieldPreview({ field, fieldId }) {
  const config = field.config || {};
  const required = config.required || false;

  // Name Group
  if (field.type === 'name_group') {
    return (
      <div className='sf-form-preview-field__name-group'>
        {/* First Name */}
        {field.enable_first_name !== false && config.enable_first_name !== false && (
          <div className='sf-form-preview-field__name-part'>
            <label htmlFor={`${fieldId}-first`}>
              {__('First Name', 'subtleforms')}
              {required && <span className='sf-form-preview-field__required'>*</span>}
            </label>
            <input
              id={`${fieldId}-first`}
              type='text'
              placeholder={__('First Name', 'subtleforms')}
              className='sf-form-preview-field__input'
              aria-required={required}
              disabled
            />
          </div>
        )}

        {/* Middle Name */}
        {(field.enable_middle_name || config.enable_middle_name) && (
          <div className='sf-form-preview-field__name-part'>
            <label htmlFor={`${fieldId}-middle`}>{__('Middle Name', 'subtleforms')}</label>
            <input
              id={`${fieldId}-middle`}
              type='text'
              placeholder={__('Middle Name', 'subtleforms')}
              className='sf-form-preview-field__input'
              disabled
            />
          </div>
        )}

        {/* Last Name */}
        {field.enable_last_name !== false && config.enable_last_name !== false && (
          <div className='sf-form-preview-field__name-part'>
            <label htmlFor={`${fieldId}-last`}>
              {__('Last Name', 'subtleforms')}
              {required && <span className='sf-form-preview-field__required'>*</span>}
            </label>
            <input
              id={`${fieldId}-last`}
              type='text'
              placeholder={__('Last Name', 'subtleforms')}
              className='sf-form-preview-field__input'
              aria-required={required}
              disabled
            />
          </div>
        )}
      </div>
    );
  }

  // Address Group
  if (field.type === 'address_group') {
    return (
      <div className='sf-form-preview-field__address-group'>
        {/* Street Address */}
        <div className='sf-form-preview-field__address-part'>
          <label htmlFor={`${fieldId}-street`}>
            {__('Street Address', 'subtleforms')}
            {required && <span className='sf-form-preview-field__required'>*</span>}
          </label>
          <input
            id={`${fieldId}-street`}
            type='text'
            placeholder={__('Street Address', 'subtleforms')}
            className='sf-form-preview-field__input'
            aria-required={required}
            disabled
          />
        </div>

        {/* City, State, ZIP in a row */}
        <div className='sf-form-preview-field__address-row'>
          <div className='sf-form-preview-field__address-part'>
            <label htmlFor={`${fieldId}-city`}>{__('City', 'subtleforms')}</label>
            <input
              id={`${fieldId}-city`}
              type='text'
              placeholder={__('City', 'subtleforms')}
              className='sf-form-preview-field__input'
              disabled
            />
          </div>
          <div className='sf-form-preview-field__address-part'>
            <label htmlFor={`${fieldId}-state`}>{__('State', 'subtleforms')}</label>
            <input
              id={`${fieldId}-state`}
              type='text'
              placeholder={__('State', 'subtleforms')}
              className='sf-form-preview-field__input'
              disabled
            />
          </div>
          <div className='sf-form-preview-field__address-part'>
            <label htmlFor={`${fieldId}-zip`}>{__('ZIP', 'subtleforms')}</label>
            <input
              id={`${fieldId}-zip`}
              type='text'
              placeholder={__('ZIP', 'subtleforms')}
              className='sf-form-preview-field__input'
              disabled
            />
          </div>
        </div>

        {/* Country */}
        {(field.enable_country || config.enable_country) && (
          <div className='sf-form-preview-field__address-part'>
            <label htmlFor={`${fieldId}-country`}>{__('Country', 'subtleforms')}</label>
            <select id={`${fieldId}-country`} className='sf-form-preview-field__input' disabled>
              <option>{__('Select Country', 'subtleforms')}</option>
              <option>United States</option>
              <option>Canada</option>
              <option>United Kingdom</option>
            </select>
          </div>
        )}
      </div>
    );
  }

  return null;
}
