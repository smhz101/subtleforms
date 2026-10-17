/**
 * BuilderModalsController Component
 *
 * Pure UI component for managing all builder modals (confirmation, tour, preview).
 */

import { __ } from '@wordpress/i18n';
import ConfirmModal from '../../../modals/ConfirmModal';
import BuilderTour from '../../BuilderTour';
import { FormPreviewModal } from '../../form-preview';

export default function BuilderModalsController({
  // Delete modal
  showDeleteConfirm,
  onCloseDeleteConfirm,
  onConfirmDelete,

  // Publish modal
  showPublishConfirm,
  isPublished = false,
  onClosePublishConfirm,
  onConfirmPublish,

  // Discard modal
  showDiscardConfirm,
  onCloseDiscardConfirm,
  onConfirmSaveDraft,
  onConfirmDiscard,

  // Tour
  showTour,
  onCloseTour,
  onSkipTour,

  // Preview
  showPreview,
  draftSchema,
  formId = null,
  isDirty,
  onClosePreview,
}) {
  return (
    <>
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={onCloseDeleteConfirm}
        title={__('Delete Form', 'subtleforms')}
        message={__(
          'Are you sure you want to delete this form? This action cannot be undone.',
          'subtleforms'
        )}
        onConfirm={onConfirmDelete}
        confirmText={__('Delete', 'subtleforms')}
        confirmVariant='destructive'
      />

      {/* Publish Confirmation Modal */}
      <ConfirmModal
        isOpen={showPublishConfirm}
        onClose={onClosePublishConfirm}
        title={
          isPublished
            ? __('Update live form', 'subtleforms')
            : __('Publish Form', 'subtleforms')
        }
        message={
          // A live form is already visible; the question is whether to push
          // the edits (2.2.1, bug 12).
          isPublished
            ? __('Push your changes live?', 'subtleforms')
            : __(
                'Publishing this form will make it visible on the frontend. Are you ready to publish?',
                'subtleforms'
              )
        }
        onConfirm={onConfirmPublish}
        confirmText={isPublished ? __('Update', 'subtleforms') : __('Publish', 'subtleforms')}
        confirmVariant='primary'
      />

      {/* Discard Changes Confirmation Modal */}
      <ConfirmModal
        isOpen={showDiscardConfirm}
        onClose={onCloseDiscardConfirm}
        title={__('You have unsaved changes', 'subtleforms')}
        message={__(
          'Your most recent edits have not reached the server yet. Save them as a draft before leaving, or discard them?',
          'subtleforms'
        )}
        onConfirm={onConfirmSaveDraft}
        confirmText={__('Save draft', 'subtleforms')}
        confirmVariant='primary'
        onSecondary={onConfirmDiscard}
        secondaryText={__('Discard Changes', 'subtleforms')}
        cancelText={__('Cancel', 'subtleforms')}
      />

      {/* Builder Tour */}
      {showTour && <BuilderTour onComplete={onCloseTour} onSkip={onSkipTour} />}

      {/* Form Preview Modal */}
      {showPreview && (
        <FormPreviewModal
          schema={draftSchema}
          formId={formId}
          isDirty={isDirty}
          onClose={onClosePreview}
        />
      )}
    </>
  );
}
