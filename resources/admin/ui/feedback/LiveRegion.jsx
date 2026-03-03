import { useEffect, useRef, useState } from '@wordpress/element';
import './LiveRegion.scss';

/**
 * LiveRegion Component
 *
 * WCAG 2.1 AA compliant live region for screen reader announcements.
 * Announces dynamic content changes to assistive technologies.
 *
 * @param {Object} props
 * @param {string} props.message - Message to announce
 * @param {string} props.level - 'polite' | 'assertive' (default: 'polite')
 * @param {boolean} props.atomic - Announce entire region vs incremental (default: true)
 * @param {number} props.clearAfter - Auto-clear message after ms (default: 3000, 0 = no clear)
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.visible - Show message visually (default: false, screen reader only)
 */
export default function LiveRegion({
  message,
  level = 'polite',
  atomic = true,
  clearAfter = 3000,
  className = '',
  visible = false,
}) {
  const [displayMessage, setDisplayMessage] = useState(message);
  const timerRef = useRef(null);

  useEffect(() => {
    // Update message immediately
    if (message) {
      setDisplayMessage(message);

      // Clear after timeout
      if (clearAfter > 0) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
          setDisplayMessage('');
        }, clearAfter);
      }
    } else {
      setDisplayMessage('');
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [message, clearAfter]);

  if (!displayMessage) {
    return null;
  }

  const regionClassName = `sf-live-region ${
    visible ? 'sf-live-region--visible' : 'sf-sr-only'
  } ${className}`.trim();

  return (
    <div
      className={regionClassName}
      role='status'
      aria-live={level}
      aria-atomic={atomic ? 'true' : 'false'}>
      {displayMessage}
    </div>
  );
}

/**
 * Multiple LiveRegion containers for different message types
 *
 * Best practice: Use separate regions for different types of announcements
 * to prevent screen readers from interrupting important messages.
 */
export function LiveRegionContainer() {
  return (
    <div className='sf-live-region-container'>
      {/* Polite announcements - non-critical updates */}
      <LiveRegion
        id='sf-live-polite'
        level='polite'
        className='sf-live-polite'
      />

      {/* Assertive announcements - errors, critical updates */}
      <LiveRegion
        id='sf-live-assertive'
        level='assertive'
        className='sf-live-assertive'
      />

      {/* Status announcements - loading, progress */}
      <LiveRegion
        id='sf-live-status'
        level='polite'
        atomic={false}
        className='sf-live-status'
      />
    </div>
  );
}

/**
 * Screen reader only CSS class
 * Hides content visually but keeps it accessible to screen readers
 */
export const srOnlyClass = 'sf-sr-only';
