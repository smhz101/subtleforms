/**
 * BuilderModalsController Component
 *
 * Pure UI component for managing all builder modals (confirmation, tour, preview).
 */

import { __ } from '@wordpress/i18n';
import ConfirmModal from '../../../modals/ConfirmModal';
import BuilderTour from '../../BuilderTour';
import FormPreviewModal from '../../FormPreviewModal';

export default function BuilderModalsController({
  // Delete modal
  showDeleteConfirm,
  onCloseDeleteConfirm,
  onConfirmDelete,

  // Publish modal
  showPublishConfirm,
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
        title={__('Publish Form', 'subtleforms')}
        message={__(
          'Publishing this form will make it visible on the frontend. Are you ready to publish?',
          'subtleforms'
        )}
        onConfirm={onConfirmPublish}
        confirmText={__('Publish', 'subtleforms')}
        confirmVariant='primary'
      />

      {/* Discard Changes Confirmation Modal */}
      <ConfirmModal
        isOpen={showDiscardConfirm}
        onClose={onCloseDiscardConfirm}
        title={__('You have unsaved changes', 'subtleforms')}
        message={__(
          'Your recent edits have not been saved. Would you like to save your changes before leaving, or discard them?',
          'subtleforms'
        )}
        onConfirm={onConfirmSaveDraft}
        confirmText={__('Save Draft', 'subtleforms')}
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
          isDirty={isDirty}
          onClose={onClosePreview}
        />
      )}
    </>
  );
}
