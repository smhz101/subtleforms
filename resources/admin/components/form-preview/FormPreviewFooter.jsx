import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * FormPreviewFooter Component
 *
 * Footer section with submit button and preview notice.
 */
export default function FormPreviewFooter() {
  return (
    <div className='sf-form-preview-modal__submit-section'>
      <Button isPrimary disabled aria-label={__('Submit (disabled in preview)', 'subtleforms')}>
        {__('Submit', 'subtleforms')}
      </Button>
      <p className='sf-form-preview-modal__submit-section-note' role='status'>
        {__('This is a preview. The form is not functional.', 'subtleforms')}
      </p>
    </div>
  );
}
