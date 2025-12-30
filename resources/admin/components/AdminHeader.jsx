import { memo } from '@wordpress/element';
import Icon from './ui/Icon';

/**
 * AdminHeader - Sticky Header Component
 *
 * Single reusable header for all SubtleForms admin pages.
 *
 * Features:
 * - Fixed height (60px) across all pages
 * - Flat design (no shadow, no rounded corners)
 * - Never scrolls away (sticky positioning)
 * - Context-aware action buttons
 * - Memoized to prevent unnecessary re-renders
 *
 * @param {Object} props
 * @param {string} props.title - Page title
 * @param {React.ReactNode} props.actions - Action buttons (context-aware per page)
 */
const AdminHeader = memo(function AdminHeader({ title, actions }) {
  const HEADER_HEIGHT = 60;
  const WP_ADMIN_BAR_HEIGHT = 32;

  return (
    <div
      className='sf-flex sf-flex-shrink-0 sf-justify-between sf-items-center sf-bg-blue-200 sf-px-6 sf-border-gray-300 sf-border-b'
      style={{
        height: `${HEADER_HEIGHT}px`,
        position: 'sticky',
        // top: `${WP_ADMIN_BAR_HEIGHT}px`,
        zIndex: 100,
      }}>
      {/* Left Side: Logo + Title */}
      <div className='sf-flex sf-items-center sf-gap-4'>
        <div className='sf-flex sf-items-center sf-gap-3'>
          {/* SubtleForms Logo */}

          <div
            class='sf-inline-flex sf-justify-center sf-items-center sf-bg-white sf-shadow-sm sf-border sf-border-gray-200 sf-rounded-md sf-w-8 sf-h-8 sf-font-semibold sf-text-gray-800 sf-text-xs'
            aria-label='SubtleForms'
            title='SubtleForms'>
            SF
          </div>

          <h1 className='sf-m-0 sf-font-semibold sf-text-gray-900 sf-text-lg sf-leading-none'>
            {title}
          </h1>
        </div>
      </div>

      {/* Right Side: Action Buttons (Context-Aware) */}
      {actions && (
        <div className='sf-flex sf-items-center sf-gap-2'>{actions}</div>
      )}
    </div>
  );
});

export default AdminHeader;
