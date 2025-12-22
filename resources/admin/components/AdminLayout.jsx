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
    <div className='wrap subtleforms-admin-layout'>
      {/* Sticky top bar/header */}
      <div className='subtleforms-admin-header'>
        <div className='subtleforms-admin-header__meta'>
          <h1 className='subtleforms-admin-title'>{title}</h1>
          {headerActions && (
            <div className='subtleforms-admin-header__actions'>
              {headerActions}
            </div>
          )}
        </div>
      </div>

      {/* Filters row */}
      {(filters || search) && (
        <div className='subtleforms-admin-filters'>
          <div className='subtleforms-admin-filters__left'>{filters}</div>
          <div className='subtleforms-admin-filters__right'>{search}</div>
        </div>
      )}

      {/* Main content area (table/datatable) */}
      <div className='subtleforms-admin-content'>{children}</div>

      {/* Pagination row */}
      {pagination && (
        <div className='subtleforms-admin-pagination'>{pagination}</div>
      )}
    </div>
  );
}
