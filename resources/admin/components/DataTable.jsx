import { memo } from '@wordpress/element';
import { Button, SelectControl, CheckboxControl } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import TableSkeleton from './TableSkeleton';
import './DataTable.scss';

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
 * @param {Function|null} props.rowClassName - Optional function to get additional classes for row (row)
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
  rowClassName = null,
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
      return (
        <span className='sf-data-table__sort-indicator sf-data-table__sort-indicator--inactive'>
          ⬍
        </span>
      );
    }
    return (
      <span className='sf-data-table__sort-indicator sf-data-table__sort-indicator--active'>
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
      <TableSkeleton 
        rows={perPage > 10 ? 10 : perPage}
        columns={columns.length}
        selectable={selectable}
      />
    );
  }

  if (data.length === 0) {
    return (
      <div className='sf-data-table__empty'>
        <div className='sf-data-table__empty-content'>
          <div className='sf-data-table__empty-content-icon'>📝</div>
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const allSelected =
    data.length > 0 && data.every((item) => selectedItems.includes(item.id));
  const someSelected =
    data.some((item) => selectedItems.includes(item.id)) && !allSelected;

  return (
    <div className='data-table'>
      {/* Bulk Actions Bar */}
      {selectable && selectedItems.length > 0 && (
        <div className='sf-data-table__bulk-actions'>
          <span className='sf-data-table__bulk-actions-selected'>
            {(() => {
              return sprintf(
                /* translators: %1$d: number of selected items */
                __('%1$d items selected', 'subtleforms'),
                selectedItems.length
              );
            })()}
          </span>
          <div className='sf-data-table__bulk-actions-buttons'>
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
      <div className='sf-data-table__scroll-container'>
        <table className='sf-data-table__table'>
          <thead className='sf-data-table__header'>
            <tr>
              {selectable && (
                <th className='sf-data-table__header-cell'>
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
                  className={`${
                    column.sortable ? 'sf-data-table__header-th--sortable' : ''
                  }`}
                  style={{ width: column.width || 'auto' }}
                  onClick={() => handleHeaderClick(column)}>
                  <div className='sf-data-table__header-th-content'>
                    {column.title}
                    {getSortIndicator(column)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='sf-data-table__body'>
            {data.map((row, index) => (
              <tr
                key={row.id || index}
                className={`
                  group transition-all duration-150
                  ${
                    selectedItems.includes(row.id)
                      ? 'sf-data-table__row--selected'
                      : ''
                  }
                  ${onRowClick ? 'sf-data-table__row--clickable' : ''}
                  ${rowClassName ? rowClassName(row) : ''}
                `}
                onClick={() => onRowClick && onRowClick(row)}>
                {selectable && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <CheckboxControl
                      checked={selectedItems.includes(row.id)}
                      onChange={(checked) => handleSelectRow(row.id, checked)}
                    />
                  </td>
                )}
                {columns.map((column) => (
                  <td key={column.key}>
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
        <div className='sf-data-table__pagination'>
          <div className='sf-data-table__pagination-info'>
            <span className='sf-data-table__pagination-info-text'>
              {(() => {
                return sprintf(
                  /* translators: %1$d: starting item number, %2$d: ending item number, %3$d: total items */
                  __('Showing %1$d to %2$d of %3$d', 'subtleforms'),
                  (currentPage - 1) * perPage + 1,
                  Math.min(currentPage * perPage, totalItems),
                  totalItems
                );
              })()}
            </span>

            <div className='sf-data-table__pagination-info-controls'>
              <label>{__('Per page:', 'subtleforms')}</label>
              <SelectControl
                value={perPage.toString()}
                onChange={(value) => onPerPageChange(parseInt(value))}
                options={[
                  { label: '10', value: '10' },
                  { label: '20', value: '20' },
                  { label: '50', value: '50' },
                  { label: '100', value: '100' },
                ]}
              />
            </div>
          </div>

          <div className='sf-data-table__pagination-buttons'>
            <Button
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              isSecondary
              size='small'>
              {__('Previous', 'subtleforms')}
            </Button>

            <span className='sf-data-table__pagination-page-indicator'>
              {(() => {
                return sprintf(
                  /* translators: %1$d: Current page number, %2$d: Total pages */
                  __('Page %1$d of %2$d', 'subtleforms'),
                  currentPage,
                  totalPages
                );
              })()}
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
