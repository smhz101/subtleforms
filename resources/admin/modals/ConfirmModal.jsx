import { Modal, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Standardized confirmation modal with flat UI design.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {string} props.title - Modal title
 * @param {string} props.message - Confirmation message
 * @param {Function} props.onConfirm - Primary action handler
 * @param {string} props.confirmText - Primary button text
 * @param {string} props.confirmVariant - Button variant: 'primary' | 'destructive'
 * @param {Function} props.onSecondary - Optional secondary action
 * @param {string} props.secondaryText - Optional secondary button text
 * @param {string} props.cancelText - Cancel button text
 * @param {boolean} props.isLoading - Loading state for primary button
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  confirmText = __('Confirm', 'subtleforms'),
  confirmVariant = 'primary',
  onSecondary,
  secondaryText,
  cancelText = __('Cancel', 'subtleforms'),
  isLoading = false,
}) {
  if (!isOpen) return null;

  return (
    <Modal
      title={title}
      onRequestClose={onClose}
      className='subtleforms-confirm-modal'
      shouldCloseOnClickOutside={!isLoading}
      shouldCloseOnEsc={!isLoading}>
      <div className='subtleforms-admin'>
        <p className='sf-mb-6 sf-text-gray-700 sf-text-sm sf-leading-relaxed'>{message}</p>

        <div className='sf-flex sf-justify-end sf-items-center sf-gap-3'>
          {onSecondary && secondaryText && (
            <Button
              variant='secondary'
              onClick={onSecondary}
              disabled={isLoading}
              isDestructive={confirmVariant === 'primary'}
              className='sf-px-4 sf-h-9 sf-text-sm'>
              {secondaryText}
            </Button>
          )}

          <Button
            variant='tertiary'
            onClick={onClose}
            disabled={isLoading}
            className='sf-px-4 sf-h-9 sf-text-sm'>
            {cancelText}
          </Button>

          <Button
            variant={confirmVariant === 'destructive' ? 'primary' : 'primary'}
            onClick={onConfirm}
            disabled={isLoading}
            isDestructive={confirmVariant === 'destructive'}
            className='sf-px-4 sf-h-9 sf-text-sm'>
            {isLoading ? __('Processing...', 'subtleforms') : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
