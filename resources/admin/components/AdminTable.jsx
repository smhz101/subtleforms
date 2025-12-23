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
      <div className='flex justify-center items-center py-20'>
        <div className='text-center'>
          <div className='inline-block mb-4 border-4 border-gray-200 border-t-blue-600 rounded-full w-8 h-8 animate-spin'></div>
          <p className='font-medium text-gray-600 text-sm'>
            {__('Loading...', 'subtleforms')}
          </p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className='flex justify-center items-center py-20'>
        <div className='text-gray-500 text-center'>
          <div className='mb-4 text-4xl'>📝</div>
          <p className='mb-2 font-medium text-lg'>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden'>
      <div className='overflow-x-auto'>
        <table className='divide-y divide-gray-200 min-w-full'>
          <thead className='bg-gray-50'>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
                    ${
                      column.sortable
                        ? 'cursor-pointer hover:bg-gray-100 select-none'
                        : ''
                    }
                  `}
                  style={{
                    width: column.width || 'auto',
                    ...column.headerStyle,
                  }}
                  onClick={() => handleHeaderClick(column)}>
                  <div className='flex items-center gap-1'>
                    {column.title}
                    {getSortIndicator(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='bg-white divide-y divide-gray-200'>
            {data.map((row, index) => (
              <tr
                key={row.id || index}
                className={`
                  hover:bg-gray-50 transition-colors duration-150
                  ${onRowClick ? 'cursor-pointer' : ''}
                `}
                onClick={() => onRowClick && onRowClick(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className='px-6 py-4 text-gray-900 text-sm whitespace-nowrap'
                    style={column.cellStyle}>
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className='bg-gray-50 px-6 py-3 border-gray-200 border-t'>
          <div className='flex justify-between items-center'>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2 text-gray-600 text-sm'>
                <span>{__('Show', 'subtleforms')}</span>
                <SelectControl
                  value={perPage}
                  onChange={onPerPageChange}
                  options={[
                    { label: '10', value: 10 },
                    { label: '25', value: 25 },
                    { label: '50', value: 50 },
                    { label: '100', value: 100 },
                  ]}
                  className='w-20 min-w-0'
                />
                <span>{__('items', 'subtleforms')}</span>
              </div>

              <div className='text-gray-600 text-sm'>
                {sprintf(
                  __('Showing %1$d to %2$d of %3$d items', 'subtleforms'),
                  (currentPage - 1) * perPage + 1,
                  Math.min(currentPage * perPage, totalItems),
                  totalItems
                )}
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <Button
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                isSecondary
                size='small'>
                {__('← Previous', 'subtleforms')}
              </Button>

              <span className='flex items-center bg-white px-3 py-1 border border-gray-300 rounded text-gray-600 text-sm'>
                {sprintf(
                  __('Page %1$d of %2$d', 'subtleforms'),
                  currentPage,
                  totalPages
                )}
              </span>

              <Button
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                isSecondary
                size='small'>
                {__('Next →', 'subtleforms')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
