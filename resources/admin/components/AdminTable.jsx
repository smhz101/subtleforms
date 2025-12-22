import { useState } from '@wordpress/element';
import { Button, SelectControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

export default function AdminTable({
  columns = [],
  data = [],
  totalItems = 0,
  currentPage = 1,
  perPage = 20,
  sortBy = null,
  sortDirection = 'desc',
  onSort = () => {},
  onPageChange = () => {},
  onPerPageChange = () => {},
  loading = false,
  emptyMessage = __('No items found', 'subtleforms'),
  onRowClick = null,
}) {
  const totalPages = Math.ceil(totalItems / perPage);

  const getSortIndicator = (column) => {
    if (!column.sortable) return null;

    if (sortBy === column.key) {
      return (
        <span className='sort-indicator'>
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      );
    }

    return (
      <span className='sort-indicator' style={{ color: '#c3c4c7' }}>
        ⬍
      </span>
    );
  };

  const handleHeaderClick = (column) => {
    if (!column.sortable) return;

    let newDirection = 'desc';
    if (sortBy === column.key && sortDirection === 'desc') {
      newDirection = 'asc';
    }

    onSort(column.key, newDirection);
  };

  if (loading) {
    return (
      <div className='subtleforms-loading-container'>
        <div className='subtleforms-loading-content'>
          <div className='subtleforms-spinner'></div>
          <p className='subtleforms-loading-text'>
            {__('Loading...', 'subtleforms')}
          </p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className='subtleforms-empty-state'
        style={{ padding: '40px', textAlign: 'center' }}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <table className='subtleforms-admin-table'>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.sortable ? 'sortable' : ''}
                style={{ width: column.width || 'auto', ...column.headerStyle }}
                onClick={() => handleHeaderClick(column)}>
                {column.title}
                {getSortIndicator(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={row.id || index}
              className={onRowClick ? 'clickable' : ''}
              onClick={() => onRowClick && onRowClick(row)}>
              {columns.map((column) => (
                <td key={column.key} style={column.cellStyle}>
                  {column.render
                    ? column.render(row[column.key], row)
                    : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className='subtleforms-admin-pagination'>
          <div className='subtleforms-admin-pagination-controls'>
            <div className='subtleforms-admin-page-size'>
              <label>
                {__('Show', 'subtleforms')}
                <SelectControl
                  value={perPage}
                  onChange={onPerPageChange}
                  options={[
                    { label: '10', value: 10 },
                    { label: '25', value: 25 },
                    { label: '50', value: 50 },
                    { label: '100', value: 100 },
                  ]}
                />
                {__('items', 'subtleforms')}
              </label>
            </div>

            <div className='subtleforms-admin-pagination-info'>
              {sprintf(
                __('Showing %1$d to %2$d of %3$d items', 'subtleforms'),
                (currentPage - 1) * perPage + 1,
                Math.min(currentPage * perPage, totalItems),
                totalItems
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                isSecondary>
                {__('← Previous', 'subtleforms')}
              </Button>

              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '13px',
                }}>
                {sprintf(
                  __('Page %1$d of %2$d', 'subtleforms'),
                  currentPage,
                  totalPages
                )}
              </span>

              <Button
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                isSecondary>
                {__('Next →', 'subtleforms')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
