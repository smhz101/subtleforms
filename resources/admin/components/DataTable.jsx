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
      return <span className='sf-ml-1 sf-text-gray-400'>⬍</span>;
    }
    return (
      <span className='sf-ml-1 sf-text-gray-900'>
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
      <div className='sf-flex sf-justify-center sf-items-center sf-py-20'>
        <div className='sf-text-center'>
          <div className='sf-inline-block sf-mb-4 sf-border-2 sf-border-gray-300 sf-border-t-gray-900 sf-w-8 sf-h-8 sf-animate-spin'></div>
          <p className='sf-font-medium sf-text-gray-600 sf-text-sm'>
            {__('Loading...', 'subtleforms')}
          </p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className='sf-flex sf-justify-center sf-items-center sf-py-20'>
        <div className='sf-text-gray-500 sf-text-center'>
          <div className='sf-mb-4 sf-text-4xl'>📝</div>
          <p className='sf-font-medium sf-text-lg'>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const allSelected =
    data.length > 0 && data.every((item) => selectedItems.includes(item.id));
  const someSelected =
    data.some((item) => selectedItems.includes(item.id)) && !allSelected;

  return (
    <div className='sf-flex sf-flex-col sf-h-full'>
      {/* Bulk Actions Bar */}
      {selectable && selectedItems.length > 0 && (
        <div className='sf-flex sf-items-center sf-gap-4 sf-bg-blue-50 sf-px-6 sf-py-2 sf-border-blue-100 sf-border-b sf-text-sm'>
          <span className='sf-font-medium sf-text-blue-900'>
            {sprintf(
              __('%d items selected', 'subtleforms'),
              selectedItems.length
            )}
          </span>
          <div className='sf-flex sf-items-center sf-gap-2 sf-h-8'>
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
      <div className='sf-flex-1 sf-overflow-auto'>
        <table className='sf-w-full sf-border-collapse'>
          <thead className='sf-top-0 sf-z-10 sf-sticky sf-bg-gray-50'>
            <tr className='sf-border-gray-300 sf-border-b'>
              {selectable && (
                <th className='sf-px-6 sf-py-3 first:pl-8 sf-w-10 sf-text-left'>
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
                  <div className='sf-flex sf-items-center'>
                    {column.title}
                    {getSortIndicator(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='sf-bg-white sf-divide-y sf-divide-gray-100'>
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
                    className='sf-px-6 sf-py-4 first:pl-8 sf-w-10'
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
                    className={`sf-px-6 sf-py-4 last:sf-pr-8 sf-text-gray-900 sf-text-sm ${
                      !selectable && 'first:sf-pl-8'
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
        <div className='sf-flex sf-flex-shrink-0 sf-justify-between sf-items-center sf-bg-white sf-px-6 sf-py-4 sf-border-gray-300 sf-border-t'>
          <div className='sf-flex sf-items-center sf-gap-4'>
            <span className='sf-text-gray-700 sf-text-sm'>
              {sprintf(
                __('Showing %d to %d of %d', 'subtleforms'),
                (currentPage - 1) * perPage + 1,
                Math.min(currentPage * perPage, totalItems),
                totalItems
              )}
            </span>

            <div className='sf-flex sf-items-center sf-gap-2'>
              <label className='sf-text-gray-700 sf-text-sm'>
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
                className='sf-w-20'
              />
            </div>
          </div>

          <div className='sf-flex sf-items-center sf-gap-2'>
            <Button
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              isSecondary
              size='small'>
              {__('Previous', 'subtleforms')}
            </Button>

            <span className='sf-bg-gray-50 sf-px-3 sf-py-1 sf-border sf-border-gray-300 sf-text-gray-700 sf-text-sm'>
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
