import { __ } from '@wordpress/i18n';

/**
 * FormPreviewHeader Component
 *
 * Header section for form preview modal with title, description, and notice.
 *
 * @param {Object} props
 * @param {Object} props.metadata - Form metadata (title, description, type)
 * @param {boolean} props.isDirty - Whether form has unsaved changes
 */
export default function FormPreviewHeader({ metadata, isDirty }) {
  const title = metadata?.title || __('Untitled Form', 'subtleforms');
  const description = metadata?.description;

  return (
    <div className='sf-form-preview-modal__form-header'>
      <h2 id='form-preview-title'>{title}</h2>
      <p className='sf-form-preview-modal__form-header-notice'>
        {isDirty
          ? __(
              'Preview shows your current draft (including unsaved changes).',
              'subtleforms'
            )
          : __('Preview shows your current draft.', 'subtleforms')}
      </p>
      {description && (
        <p
          id='form-preview-description'
          className='sf-form-preview-modal__form-header-description'>
          {description}
        </p>
      )}
    </div>
  );
}
