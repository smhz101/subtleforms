import { __ } from '@wordpress/i18n';

/**
 * FileFieldPreview Component
 *
 * Renders file upload field preview
 */
export default function FileFieldPreview({ field, fieldId }) {
  const config = field.config || {};
  const helpText = config.help || '';
  const helpTextId = helpText ? `${fieldId}-help` : undefined;

  return (
    <div
      className='sf-form-preview-field__upload'
      role='button'
      aria-describedby={helpTextId}
      aria-label={__('File upload (disabled in preview)', 'subtleforms')}>
      <p>{__('Click to upload or drag and drop', 'subtleforms')}</p>
    </div>
  );
}
