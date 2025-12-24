import { memo } from '@wordpress/element';
import { Button, SelectControl, CheckboxControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

/**
 * DataTable - Single Reusable Table Component
 *
 * Unified table component for all SubtleForms data displays.
 * Replaces AdminTable, old DataTable, and raw table implementations.
 *
 * Features:
 * - Sorting with direction indicators
 * - Pagination with configurable page sizes
 * - Row actions support
 * - Scrollable table height (fits inside layout, not page)
 * - Loading and empty states
 * - Consistent styling across all pages
 * - Memoized for performance
 * - Bulk actions support
 *
 * @param {Object} props
 * @param {Array} props.columns - Column definitions [{key, title, sortable, render, width}]
 * @param {Array} props.data - Row data array
 * @param {number} props.totalItems - Total items for pagination
 * @param {number} props.currentPage - Current page number (1-indexed)
 * @param {number} props.perPage - Items per page
 * @param {string|null} props.sortBy - Current sort column key
 * @param {string} props.sortDirection - Sort direction ('asc' or 'desc')
 * @param {Function} props.onSort - Callback when sort changes (columnKey, direction)
 * @param {Function} props.onPageChange - Callback when page changes (newPage)
 * @param {Function} props.onPerPageChange - Callback when per page changes (newPerPage)
 * @param {boolean} props.loading - Loading state
 * @param {string} props.emptyMessage - Message when no data
 * @param {Function|null} props.onRowClick - Optional row click handler (row)
 * @param {boolean} props.selectable - Enable row selection
 * @param {Array} props.selectedItems - Array of selected item IDs
 * @param {Function} props.onSelectionChange - Callback when selection changes (newSelectedItems)
 * @param {Array} props.bulkActions - Array of bulk actions [{ label, onClick, isDestructive }]
 */
const DataTable = memo(function DataTable({
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
  selectable = false,
  selectedItems = [],
  onSelectionChange = () => {},
  bulkActions = [],
}) {
  const totalPages = Math.ceil(totalItems / perPage);

  const handleSelectAll = (checked) => {
    if (checked) {
      onSelectionChange(data.map((item) => item.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (id, checked) => {
    if (checked) {
      onSelectionChange([...selectedItems, id]);
    } else {
      onSelectionChange(selectedItems.filter((itemId) => itemId !== id));
    }
  };

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

  const allSelected =
    data.length > 0 && data.every((item) => selectedItems.includes(item.id));
  const someSelected =
    data.some((item) => selectedItems.includes(item.id)) && !allSelected;

  return (
    <div className='flex flex-col h-full'>
      {/* Bulk Actions Bar */}
      {selectable && selectedItems.length > 0 && (
        <div className='flex items-center gap-4 bg-blue-50 px-6 py-2 border-blue-100 border-b text-sm'>
          <span className='font-medium text-blue-900'>
            {sprintf(
              __('%d items selected', 'subtleforms'),
              selectedItems.length
            )}
          </span>
          <div className='flex items-center gap-2 h-8'>
            {bulkActions.map((action, index) => (
              <Button
                key={index}
                isSmall
                isDestructive={action.isDestructive}
                isSecondary={!action.isDestructive}
                onClick={() => action.onClick(selectedItems)}>
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Table - Scrollable */}
      <div className='flex-1 overflow-auto'>
        <table className='w-full border-collapse'>
          <thead className='top-0 z-10 sticky bg-gray-50'>
            <tr className='border-gray-200 border-b'>
              {selectable && (
                <th className='px-6 py-3 first:pl-8 w-10 text-left'>
                  <CheckboxControl
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`
                    px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider last:pr-8
                    ${!selectable && 'first:pl-8'}
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
          <tbody className='bg-white divide-y divide-gray-100'>
            {data.map((row, index) => (
              <tr
                key={row.id || index}
                className={`
                  group transition-all duration-150
                  ${selectedItems.includes(row.id) ? 'bg-blue-50' : ''}
                  ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-blue-50 hover:shadow-sm'
                      : ''
                  }
                `}
                onClick={() => onRowClick && onRowClick(row)}>
                {selectable && (
                  <td
                    className='px-6 py-4 first:pl-8 w-10'
                    onClick={(e) => e.stopPropagation()}>
                    <CheckboxControl
                      checked={selectedItems.includes(row.id)}
                      onChange={(checked) => handleSelectRow(row.id, checked)}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-6 py-4 last:pr-8 text-gray-900 text-sm ${
                      !selectable && 'first:pl-8'
                    }`}>
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

      {/* Pagination - Always show if data exists and totalPages > 0 */}
      {totalPages > 0 && (
        <div className='flex flex-shrink-0 justify-between items-center bg-white px-6 py-4 border-gray-200 border-t'>
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
});

export default DataTable;
