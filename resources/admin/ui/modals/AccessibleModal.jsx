import { Modal } from '@wordpress/components';
import { useEffect, useRef, useCallback, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import clsx from 'clsx';
import './AccessibleModal.scss';

/**
 * AccessibleModal Component
 *
 * Enhanced modal with built-in accessibility features following WCAG 2.1 AA standards.
 * Extends WordPress Modal with:
 * - Auto-generated ARIA attributes
 * - Focus management and return
 * - Screen reader announcements
 * - Keyboard shortcuts
 * - Loading state handling
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {string} props.title - Modal title (auto-linked to aria-labelledby)
 * @param {string} props.description - Optional description (aria-describedby)
 * @param {string} props.size - Modal size: 'small' | 'medium' | 'large' | 'full'
 * @param {boolean} props.closeOnEscape - Allow Escape key to close (default: true)
 * @param {boolean} props.closeOnOutsideClick - Allow outside click to close (default: true)
 * @param {boolean} props.focusOnMount - Focus modal on mount (default: true)
 * @param {boolean} props.returnFocusOnClose - Return focus to trigger on close (default: true)
 * @param {boolean} props.announceClose - Announce "Dialog closed" to screen readers (default: true)
 * @param {boolean} props.isLoading - Loading state (disables close actions)
 * @param {string} props.loadingMessage - Custom loading message for screen readers
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Modal content
 */
export default function AccessibleModal({
  isOpen,
  onClose,
  title,
  description,
  size = 'medium',
  closeOnEscape = true,
  closeOnOutsideClick = true,
  focusOnMount = true,
  returnFocusOnClose = true,
  announceClose = true,
  isLoading = false,
  loadingMessage,
  className,
  children,
}) {
  const [announcement, setAnnouncement] = useState('');
  const triggerElementRef = useRef(null);
  const titleId = `modal-title-${Math.random().toString(36).substr(2, 9)}`;
  const descId = description
    ? `modal-desc-${Math.random().toString(36).substr(2, 9)}`
    : undefined;

  // Store the element that triggered the modal
  useEffect(() => {
    if (isOpen && returnFocusOnClose) {
      triggerElementRef.current = document.activeElement;
    }
  }, [isOpen, returnFocusOnClose]);

  // Return focus when modal closes
  useEffect(() => {
    if (!isOpen && returnFocusOnClose && triggerElementRef.current) {
      // Delay to ensure modal is fully removed from DOM
      const timer = setTimeout(() => {
        if (
          triggerElementRef.current &&
          typeof triggerElementRef.current.focus === 'function'
        ) {
          triggerElementRef.current.focus();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isOpen, returnFocusOnClose]);

  // Announce close to screen readers
  useEffect(() => {
    if (!isOpen && announceClose) {
      setAnnouncement(__('Dialog closed', 'subtleforms'));
      const timer = setTimeout(() => setAnnouncement(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, announceClose]);

  // Handle close with loading check
  const handleClose = useCallback(() => {
    if (!isLoading) {
      onClose();
    }
  }, [isLoading, onClose]);

  // Announce loading state changes
  useEffect(() => {
    if (isLoading) {
      const message =
        loadingMessage || __('Processing, please wait...', 'subtleforms');
      setAnnouncement(message);
    } else {
      setAnnouncement('');
    }
  }, [isLoading, loadingMessage]);

  if (!isOpen) {
    return announcement ? (
      <div
        className='sf-sr-only'
        role='status'
        aria-live='polite'
        aria-atomic='true'>
        {announcement}
      </div>
    ) : null;
  }

  const modalClassName = clsx(
    'subtleforms-accessible-modal',
    `sf-modal--${size}`,
    {
      'sf-modal--loading': isLoading,
    },
    className
  );

  return (
    <>
      <Modal
        title={title}
        onRequestClose={handleClose}
        className={modalClassName}
        shouldCloseOnClickOutside={closeOnOutsideClick && !isLoading}
        shouldCloseOnEsc={closeOnEscape && !isLoading}
        focusOnMount={focusOnMount}
        aria-labelledby={titleId}
        aria-describedby={descId}>
        <div className='subtleforms-admin'>
          {/* Hidden title for ARIA (WordPress Modal already renders title) */}
          <h1 id={titleId} className='sf-sr-only'>
            {title}
          </h1>

          {/* Optional description */}
          {description && (
            <p id={descId} className='sf-modal__description'>
              {description}
            </p>
          )}

          {/* Modal content */}
          <div className='sf-modal__content'>{children}</div>

          {/* Loading overlay with announcement */}
          {isLoading && (
            <div className='sf-modal__loading-overlay' aria-busy='true'>
              <span className='sf-sr-only' role='status' aria-live='polite'>
                {loadingMessage || __('Processing...', 'subtleforms')}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Live region for announcements */}
      {announcement && (
        <div
          className='sf-sr-only'
          role='status'
          aria-live='polite'
          aria-atomic='true'>
          {announcement}
        </div>
      )}
    </>
  );
}

/**
 * Hook for managing focus return manually
 * Useful for complex modal flows
 */
export function useFocusReturn() {
  const previousFocusRef = useRef(null);

  const capture = useCallback(() => {
    previousFocusRef.current = document.activeElement;
  }, []);

  const restore = useCallback(() => {
    if (
      previousFocusRef.current &&
      typeof previousFocusRef.current.focus === 'function'
    ) {
      previousFocusRef.current.focus();
    }
  }, []);

  return { capture, restore };
}
