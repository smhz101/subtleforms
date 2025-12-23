import { __ } from '@wordpress/i18n';

export default function AdminLayout({
  title,
  actions,
  filters,
  search,
  children,
  pagination,
  headerActions,
}) {
  return (
    <div className='subtleforms-admin'>
      <div className='flex flex-col bg-gray-50 min-h-screen'>
        {/* Sticky top header */}
        <header className='top-8 z-wp-admin sticky bg-white shadow-sm border-gray-200 border-b'>
          <div className='px-6 py-4'>
            <div className='flex justify-between items-center'>
              <h1 className='m-0 font-semibold text-gray-900 text-2xl'>
                {title}
              </h1>
              {headerActions && (
                <div className='flex items-center gap-3'>{headerActions}</div>
              )}
            </div>
          </div>

          {/* Filters/search row - part of sticky header */}
          {(filters || search) && (
            <div className='bg-gray-50 px-6 py-3 border-gray-100 border-t'>
              <div className='flex justify-between items-center gap-4'>
                <div className='flex items-center gap-4'>{filters}</div>
                <div className='flex items-center gap-4'>{search}</div>
              </div>
            </div>
          )}
        </header>

        {/* Main content area with calculated height */}
        <main className='flex-1 px-6 py-6'>
          <div
            className='h-full subtleforms-scrollable'
            style={{
              height: `calc(100vh - ${
                32 + // WordPress admin bar
                (headerActions ? 80 : 80) + // Header height
                (filters || search ? 60 : 0) + // Filters row
                48 + // Main padding
                (pagination ? 60 : 0) // Pagination height
              }px)`,
            }}>
            <div className='subtleforms-card'>{children}</div>
          </div>
        </main>

        {/* Pagination - always visible at bottom */}
        {pagination && (
          <footer className='bottom-0 sticky bg-white px-6 py-3 border-gray-200 border-t'>
            {pagination}
          </footer>
        )}
      </div>
    </div>
  );
}
