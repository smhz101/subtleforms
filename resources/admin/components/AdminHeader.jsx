import { memo } from '@wordpress/element';

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
      className='flex flex-shrink-0 justify-between items-center bg-white px-6 border-gray-200 border-b'
      style={{
        height: `${HEADER_HEIGHT}px`,
        position: 'sticky',
        top: `${WP_ADMIN_BAR_HEIGHT}px`,
        zIndex: 100,
      }}>
      {/* Left Side: Logo + Title */}
      <div className='flex items-center gap-4'>
        <div className='flex items-center gap-3'>
          <svg
            width='24'
            height='24'
            viewBox='0 0 24 24'
            fill='none'
            className='text-gray-900'>
            <rect
              x='3'
              y='3'
              width='18'
              height='18'
              stroke='currentColor'
              strokeWidth='2'
            />
            <path d='M8 12h8M12 8v8' stroke='currentColor' strokeWidth='2' />
          </svg>
          <h1 className='m-0 font-semibold text-gray-900 text-lg'>{title}</h1>
        </div>
      </div>

      {/* Right Side: Action Buttons (Context-Aware) */}
      {actions && <div className='flex items-center gap-2'>{actions}</div>}
    </div>
  );
});

export default AdminHeader;
