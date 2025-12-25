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
          {/* SubtleForms Logo */}
          <svg
            width='28'
            height='28'
            viewBox='0 0 32 32'
            fill='none'
            xmlns='http://www.w3.org/2000/svg'
            className='flex-shrink-0'>
            <rect
              x='4'
              y='4'
              width='24'
              height='24'
              rx='2'
              stroke='#2271b1'
              strokeWidth='2.5'
              fill='none'
            />
            <path
              d='M12 16h8M16 12v8'
              stroke='#2271b1'
              strokeWidth='2.5'
              strokeLinecap='round'
            />
          </svg>
          <h1 className='m-0 font-semibold text-gray-900 text-lg leading-none'>
            {title}
          </h1>
        </div>
      </div>

      {/* Right Side: Action Buttons (Context-Aware) */}
      {actions && <div className='flex items-center gap-2'>{actions}</div>}
    </div>
  );
});

export default AdminHeader;
