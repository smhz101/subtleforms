import { Button, SelectControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Standardized DataTable
 * Sharp, minimal table with sorting and pagination
 */
export default function DataTable({
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
    if (sortBy !== column.key) {
      return <span className='ml-1 text-gray-400'>⬍</span>;
    }
    return (
      <span className='ml-1 text-gray-900'>
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const handleHeaderClick = (column) => {
    if (!column.sortable) return;
    const newDirection =
      sortBy === column.key && sortDirection === 'desc' ? 'asc' : 'desc';
    onSort(column.key, newDirection);
  };

  if (loading) {
    return (
      <div className='flex justify-center items-center py-20'>
        <div className='text-center'>
          <div className='inline-block mb-4 border-2 border-gray-300 border-t-gray-900 w-8 h-8 animate-spin'></div>
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
          <p className='font-medium text-lg'>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Table */}
      <div className='flex-1 overflow-auto'>
        <table className='w-full border-collapse'>
          <thead className='top-0 z-10 sticky bg-gray-50'>
            <tr className='border-gray-300 border-b'>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider
                    ${
                      column.sortable
                        ? 'cursor-pointer hover:bg-gray-100 select-none'
                        : ''
                    }
                  `}
                  style={{ width: column.width || 'auto' }}
                  onClick={() => handleHeaderClick(column)}>
                  <div className='flex items-center'>
                    {column.title}
                    {getSortIndicator(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='bg-white'>
            {data.map((row, index) => (
              <tr
                key={row.id || index}
                className={`
                  border-b border-gray-200 transition-colors
                  ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                `}
                onClick={() => onRowClick && onRowClick(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className='px-6 py-4 text-gray-900 text-sm'>
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

      {/* Pagination */}
      {totalPages > 0 && (
        <div className='flex flex-shrink-0 justify-between items-center bg-white px-6 py-3 border-gray-300 border-t'>
          <div className='flex items-center gap-4'>
            <span className='text-gray-700 text-sm'>
              {sprintf(
                __('Showing %d to %d of %d', 'subtleforms'),
                (currentPage - 1) * perPage + 1,
                Math.min(currentPage * perPage, totalItems),
                totalItems
              )}
            </span>

            <div className='flex items-center gap-2'>
              <label className='text-gray-700 text-sm'>
                {__('Per page:', 'subtleforms')}
              </label>
              <SelectControl
                value={perPage.toString()}
                onChange={(value) => onPerPageChange(parseInt(value))}
                options={[
                  { label: '10', value: '10' },
                  { label: '20', value: '20' },
                  { label: '50', value: '50' },
                  { label: '100', value: '100' },
                ]}
                className='w-20'
              />
            </div>
          </div>

          <div className='flex items-center gap-2'>
            <Button
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              isSecondary
              size='small'>
              {__('Previous', 'subtleforms')}
            </Button>

            <span className='bg-gray-50 px-3 py-1 border border-gray-300 text-gray-700 text-sm'>
              {sprintf(
                __('Page %d of %d', 'subtleforms'),
                currentPage,
                totalPages
              )}
            </span>

            <Button
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              isSecondary
              size='small'>
              {__('Next', 'subtleforms')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
