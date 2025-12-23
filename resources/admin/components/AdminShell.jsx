import { __ } from '@wordpress/i18n';

/**
 * Canonical Admin Shell Layout
 *
 * All SubtleForms admin pages must use this component for consistent UX.
 *
 * Structure:
 * - Top Bar (sticky): Logo, page title, actions
 * - Action Bar (sticky): Filters, tabs, search
 * - Content Area: Calculated height, scrollable
 * - Bottom Bar: Pagination (if provided)
 */
export default function AdminShell({
  title,
  actions,
  tabs,
  filters,
  search,
  children,
  pagination,
}) {
  const TOP_BAR_HEIGHT = 60;
  const ACTION_BAR_HEIGHT = tabs || filters || search ? 56 : 0;
  const WP_ADMIN_BAR_HEIGHT = 32;

  return (
    <div className='subtleforms-admin'>
      {/* Remove default WordPress page wrapper styling */}
      <style>{`
        .subtleforms-admin-page .wrap {
          margin: 0 !important;
          padding: 0 !important;
        }
        .subtleforms-admin-page #wpbody-content {
          padding-bottom: 0 !important;
        }
        .subtleforms-admin-page #wpcontent {
          padding: 0 !important;
        }
      `}</style>

      <div className='flex flex-col bg-white h-screen'>
        {/* TOP BAR - Sticky */}
        <div
          className='flex flex-shrink-0 justify-between items-center bg-white px-6 border-gray-300 border-b'
          style={{
            height: `${TOP_BAR_HEIGHT}px`,
            position: 'sticky',
            top: `${WP_ADMIN_BAR_HEIGHT}px`,
            zIndex: 100,
          }}>
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
                <path
                  d='M8 12h8M12 8v8'
                  stroke='currentColor'
                  strokeWidth='2'
                />
              </svg>
              <h1 className='m-0 font-semibold text-gray-900 text-lg'>
                {title}
              </h1>
            </div>
          </div>

          {actions && <div className='flex items-center gap-2'>{actions}</div>}
        </div>

        {/* ACTION BAR - Sticky */}
        {(tabs || filters || search) && (
          <div
            className='flex flex-shrink-0 justify-between items-center bg-gray-50 px-6 border-gray-200 border-b'
            style={{
              height: `${ACTION_BAR_HEIGHT}px`,
              position: 'sticky',
              top: `${WP_ADMIN_BAR_HEIGHT + TOP_BAR_HEIGHT}px`,
              zIndex: 99,
            }}>
            <div className='flex items-center gap-4'>
              {tabs}
              {filters}
            </div>

            {search && <div className='flex items-center gap-4'>{search}</div>}
          </div>
        )}

        {/* CONTENT AREA - Scrollable */}
        <div
          className='flex-1 overflow-hidden'
          style={{
            height: `calc(100vh - ${
              WP_ADMIN_BAR_HEIGHT + TOP_BAR_HEIGHT + ACTION_BAR_HEIGHT
            }px)`,
          }}>
          <div className='h-full overflow-y-auto'>{children}</div>
        </div>

        {/* BOTTOM BAR - Pagination */}
        {pagination && (
          <div className='flex-shrink-0 bg-white px-6 py-3 border-gray-200 border-t'>
            {pagination}
          </div>
        )}
      </div>
    </div>
  );
}
