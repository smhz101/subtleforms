import { memo, useRef } from '@wordpress/element';
import { Button, SelectControl, CheckboxControl, DropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useVirtualizer } from '@tanstack/react-virtual';
import usePhoneLayout from '../hooks/usePhoneLayout';
import Icon from '../ui/Icon';
import TableSkeleton from './TableSkeleton';
import IconAction from './IconAction';
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
 * @param {boolean} props.alwaysShowPagination - Keep the footer ("0 results", disabled page buttons, rows per page) when there are no rows
 * @param {Function|null} props.onRowClick - Optional row click handler (row)
 * @param {boolean} props.selectable - Enable row selection
 * @param {Array} props.selectedItems - Array of selected item IDs
 * @param {Function} props.onSelectionChange - Callback when selection changes (newSelectedItems)
 * @param {Array} props.bulkActions - Array of bulk actions [{ label, onClick, isDestructive, icon, inMenu }].
 *   An action with an icon is an icon-only button with a tooltip; `inMenu` moves it to the More menu.
 * @param {Function|null} props.rowClassName - Optional function to get additional classes for row (row)
 * @param {boolean} props.compact - Draw each row as a compact two-line item (renderCompactRow) instead of a
 *   table row, for a narrow list pane. The footer is compact too.
 * @param {Function|null} props.renderCompactRow - Content of a compact row (row)
 */

/**
 * Text of the compact footer: "1 to 20 of 739".
 *
 * @param {number} page Current page.
 * @param {number} perPage Rows per page.
 * @param {number} total Total rows.
 * @return {string} Range text.
 */
export function rangeText(page, perPage, total) {
  if (!total) {
    return __('0 results', 'subtleforms');
  }
  return sprintf(
    /* translators: %1$d: first item number, %2$d: last item number, %3$d: total items */
    __('%1$d to %2$d of %3$d', 'subtleforms'),
    (page - 1) * perPage + 1,
    Math.min(page * perPage, total),
    total
  );
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

/**
 * Bulk action bar: how many are selected, then the actions. Actions with an
 * icon are icon-only ghost buttons with tooltips; the rest sit in a More menu.
 * The bar wraps instead of scrolling.
 */
function BulkBar({ count, actions, selectedItems, onClear, children }) {
  const inline = actions.filter((action) => !action.inMenu);
  const menu = actions.filter((action) => action.inMenu);
  return (
    <div className='sf-data-table__bulk-actions' role='toolbar' aria-label={__('Bulk actions', 'subtleforms')}>
      {children}
      <span className='sf-data-table__bulk-actions-selected'>
        {sprintf(
          /* translators: %1$d: number of selected items */
          _n('%1$d selected', '%1$d selected', count, 'subtleforms'),
          count
        )}
      </span>
      <div className='sf-data-table__bulk-actions-buttons'>
        {inline.map((action, index) =>
          action.icon ? (
            <IconAction
              key={action.key || index}
              label={action.label}
              icon={action.icon}
              isDestructive={action.isDestructive}
              onClick={() => action.onClick(selectedItems)}
            />
          ) : (
            <Button
              key={action.key || index}
              size='compact'
              variant='link'
              isDestructive={action.isDestructive}
              onClick={() => action.onClick(selectedItems)}>
              {action.label}
            </Button>
          )
        )}
        {menu.length > 0 && (
          <DropdownMenu
            icon={<Icon.Ellipsis size={16} />}
            label={__('More actions', 'subtleforms')}
            className='sf-data-table__bulk-more'
            toggleProps={{ size: 'compact' }}
            popoverProps={{ placement: 'bottom-end' }}>
            {({ onClose }) => (
              <MenuGroup>
                {menu.map((action, index) => (
                  <MenuItem
                    key={action.key || index}
                    isDestructive={action.isDestructive}
                    onClick={() => {
                      onClose();
                      action.onClick(selectedItems);
                    }}>
                    {action.label}
                  </MenuItem>
                ))}
              </MenuGroup>
            )}
          </DropdownMenu>
        )}
        <Button variant='link' size='compact' className='sf-data-table__bulk-clear' onClick={onClear}>
          {__('Clear', 'subtleforms')}
        </Button>
      </div>
    </div>
  );
}

/**
 * Compact footer: previous, "1 to 20 of 739", next, and a small rows-per-page
 * select. One line, never wider than its pane.
 */
function CompactPagination({ currentPage, totalPages, perPage, totalItems, onPageChange, onPerPageChange }) {
  return (
    <div className='sf-data-table__pagination sf-data-table__pagination--compact'>
      <div className='sf-data-table__pagination-pager'>
        <IconAction
          label={__('Previous page', 'subtleforms')}
          icon={<Icon.ChevronLeft size={16} />}
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        />
        <span className='sf-data-table__pagination-info-text' aria-live='polite'>
          {rangeText(currentPage, perPage, totalItems)}
        </span>
        <IconAction
          label={__('Next page', 'subtleforms')}
          icon={<Icon.ChevronRight size={16} />}
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        />
      </div>
      <select
        className='sf-data-table__per-page'
        aria-label={__('Rows per page', 'subtleforms')}
        title={__('Rows per page', 'subtleforms')}
        value={String(perPage)}
        onChange={(event) => onPerPageChange(parseInt(event.target.value, 10))}>
        {PER_PAGE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Full footer: "1–20 of 739" with the rows-per-page select, then previous,
 * "Page 1 of 37" and next.
 */
function FullPagination({ currentPage, totalPages, perPage, totalItems, onPageChange, onPerPageChange }) {
  return (
    <div className='sf-data-table__pagination'>
      <div className='sf-data-table__pagination-info'>
        <span className='sf-data-table__pagination-info-text' aria-live='polite'>
          {totalItems
            ? sprintf(
                /* translators: %1$d: starting item number, %2$d: ending item number, %3$d: total items */
                __('%1$d–%2$d of %3$d', 'subtleforms'),
                (currentPage - 1) * perPage + 1,
                Math.min(currentPage * perPage, totalItems),
                totalItems
              )
            : rangeText(currentPage, perPage, totalItems)}
        </span>

        <div className='sf-data-table__pagination-info-controls'>
          <SelectControl
            label={__('Rows per page', 'subtleforms')}
            __nextHasNoMarginBottom
            __next40pxDefaultSize={false}
            size='compact'
            value={perPage.toString()}
            onChange={(value) => onPerPageChange(parseInt(value))}
            options={PER_PAGE_OPTIONS.map((size) => ({ label: String(size), value: String(size) }))}
          />
        </div>
      </div>

      <div className='sf-data-table__pagination-buttons'>
        <Button
          disabled={currentPage <= 1}
          accessibleWhenDisabled
          onClick={() => onPageChange(currentPage - 1)}
          variant='tertiary'
          size='compact'
          className='sf-data-table__page-button'
          icon={<Icon.ChevronLeft size={16} />}
          label={__('Previous page', 'subtleforms')}
        />

        <span className='sf-data-table__pagination-page-indicator'>
          {sprintf(
            /* translators: %1$d: Current page number, %2$d: Total pages */
            __('Page %1$d of %2$d', 'subtleforms'),
            currentPage,
            totalPages
          )}
        </span>

        <Button
          disabled={currentPage >= totalPages}
          accessibleWhenDisabled
          onClick={() => onPageChange(currentPage + 1)}
          variant='tertiary'
          size='compact'
          className='sf-data-table__page-button'
          icon={<Icon.ChevronRight size={16} />}
          label={__('Next page', 'subtleforms')}
        />
      </div>
    </div>
  );
}

/**
 * Cell attributes. On a phone each row is a card and every cell but the
 * first shows its column name before the value (UX2-19).
 *
 * @param {Object} column Column.
 * @param {number} index  Column position.
 * @return {Object} Props for the <td>.
 */
export function cellProps(column, index) {
  const label = typeof column.title === 'string' ? column.title : column.label || '';
  return {
    role: 'cell',
    'data-column': column.key,
    'data-label': index > 0 && label ? label : undefined,
    'data-primary': index === 0 ? 'true' : undefined,
  };
}

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
  compact = false,
  renderCompactRow = null,
  alwaysShowPagination = false,
}) {
  const totalPages = Math.ceil(totalItems / perPage);
  
  // Virtualization setup - only for large lists
  const parentRef = useRef(null);
  // On a phone the rows become cards of varying height (UX2-19), which the
  // fixed-height virtual rows cannot hold.
  const isPhone = usePhoneLayout();
  const shouldVirtualize = data.length > 20 && !isPhone && !compact;
  
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? data.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height in pixels
    overscan: 5, // Render 5 extra rows above/below viewport
    enabled: shouldVirtualize,
  });

  // Dev warning for large datasets without pagination
  if (process.env.NODE_ENV === 'development' && data.length > 200 && !shouldVirtualize) {
    console.warn(
      `[SubtleForms Performance] Large dataset detected (${data.length} rows) without virtualization. Consider increasing perPage or enabling virtualization.`
    );
  }

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
          <Icon.ChevronsUpDown size={12} />
        </span>
      );
    }
    return (
      <span className='sf-data-table__sort-indicator sf-data-table__sort-indicator--active'>
        {sortDirection === 'asc' ? <Icon.ChevronUp size={12} /> : <Icon.ChevronDown size={12} />}
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
    const empty = (
      <div className='sf-data-table__empty'>
        <div className='sf-data-table__empty-content'>
          {typeof emptyMessage === 'string' ? (
            <>
              <span className='sf-data-table__empty-content-icon'>
                <Icon.FileText size={20} />
              </span>
              <p>{emptyMessage}</p>
            </>
          ) : (
            emptyMessage
          )}
        </div>
      </div>
    );
    if (!alwaysShowPagination) {
      return empty;
    }
    // The footer stays, so the rows-per-page choice can be changed and the
    // page does not change shape between a tab with entries and an empty one.
    const FooterComponent = compact ? CompactPagination : FullPagination;
    return (
      <div className={`sf-data-table sf-data-table--empty${compact ? ' sf-data-table--compact' : ''}`}>
        {empty}
        <FooterComponent
          currentPage={1}
          totalPages={1}
          perPage={perPage}
          totalItems={0}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
        />
      </div>
    );
  }

  const allSelected =
    data.length > 0 && data.every((item) => selectedItems.includes(item.id));
  const someSelected =
    data.some((item) => selectedItems.includes(item.id)) && !allSelected;

  if (compact && renderCompactRow) {
    const sortable = columns.filter((column) => column.sortable);
    return (
      <div className='sf-data-table sf-data-table--compact'>
        {selectable && selectedItems.length > 0 ? (
          <BulkBar
            count={selectedItems.length}
            actions={bulkActions}
            selectedItems={selectedItems}
            onClear={() => onSelectionChange([])}>
            <CheckboxControl
              className='sf-data-table__compact-all'
              checked={allSelected}
              indeterminate={someSelected}
              onChange={handleSelectAll}
              aria-label={__('Select all', 'subtleforms')}
            />
          </BulkBar>
        ) : (
          <div className='sf-data-table__compact-head'>
            {selectable && (
              <CheckboxControl
                className='sf-data-table__compact-all'
                checked={allSelected}
                indeterminate={someSelected}
                onChange={handleSelectAll}
                aria-label={__('Select all', 'subtleforms')}
              />
            )}
            {sortable.length > 0 && (
              <div className='sf-data-table__compact-sort'>
                <select
                  className='sf-data-table__per-page'
                  aria-label={__('Sort by', 'subtleforms')}
                  value={sortBy || ''}
                  onChange={(event) => onSort(event.target.value, sortDirection)}>
                  {sortable.map((column) => (
                    <option key={column.key} value={column.key}>
                      {column.sortLabel || column.title}
                    </option>
                  ))}
                </select>
                <IconAction
                  label={
                    sortDirection === 'asc'
                      ? __('Ascending, switch to descending', 'subtleforms')
                      : __('Descending, switch to ascending', 'subtleforms')
                  }
                  icon={sortDirection === 'asc' ? <Icon.ChevronUp size={16} /> : <Icon.ChevronDown size={16} />}
                  onClick={() => onSort(sortBy || sortable[0].key, sortDirection === 'asc' ? 'desc' : 'asc')}
                />
              </div>
            )}
          </div>
        )}

        <ul className='sf-data-table__compact-list' role='list'>
          {data.map((row, index) => {
            const isSelected = selectedItems.includes(row.id);
            return (
              <li
                key={row.id || index}
                className={`sf-data-table__row--compact${
                  isSelected ? ' sf-data-table__row--selected' : ''
                }${onRowClick ? ' sf-data-table__row--clickable' : ''} ${rowClassName ? rowClassName(row) : ''}`}
                onClick={() => onRowClick && onRowClick(row)}>
                {selectable && (
                  <div className='sf-data-table__compact-check' onClick={(event) => event.stopPropagation()}>
                    <CheckboxControl
                      checked={isSelected}
                      onChange={(checked) => handleSelectRow(row.id, checked)}
                      aria-label={sprintf(
                        /* translators: %s: row number */
                        __('Select row %s', 'subtleforms'),
                        row.id
                      )}
                    />
                  </div>
                )}
                <div className='sf-data-table__compact-body'>{renderCompactRow(row)}</div>
              </li>
            );
          })}
        </ul>

        {totalPages > 0 && (
          <CompactPagination
            currentPage={currentPage}
            totalPages={totalPages}
            perPage={perPage}
            totalItems={totalItems}
            onPageChange={onPageChange}
            onPerPageChange={onPerPageChange}
          />
        )}
      </div>
    );
  }

  return (
    <div className='sf-data-table'>
      {/* Bulk Actions Bar */}
      {selectable && selectedItems.length > 0 && (
        <BulkBar
          count={selectedItems.length}
          actions={bulkActions}
          selectedItems={selectedItems}
          onClear={() => onSelectionChange([])}
        />
      )}

      {/* Table - Scrollable */}
      <div 
        className='sf-data-table__scroll-container'
        ref={parentRef}
        style={{
          height: shouldVirtualize ? '600px' : 'auto',
          overflow: shouldVirtualize ? 'auto' : 'visible',
        }}
      >
        <table className='sf-data-table__table' role='table'>
          <thead className='sf-data-table__header' role='rowgroup'>
            <tr role='row'>
              {selectable && (
                <th className='sf-data-table__header-cell sf-data-table__check-cell' role='columnheader'>
                  <CheckboxControl
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={handleSelectAll}
                    aria-label={__('Select all', 'subtleforms')}
                  />
                </th>
              )}
              {columns.map((column) => {
                let ariaSortValue;
                if (column.sortable) {
                  if (sortBy === column.key) {
                    ariaSortValue = sortDirection === 'asc' ? 'ascending' : 'descending';
                  } else {
                    ariaSortValue = 'none';
                  }
                }
                return (
                  <th
                    key={column.key}
                    scope='col'
                    className={`sf-data-table__th ${
                      column.sortable ? 'sf-data-table__th--sortable' : ''
                    } ${sortBy === column.key ? 'is-sorted' : ''}`}
                    data-column={column.key}
                    style={{ width: column.width || 'auto' }}
                    aria-sort={ariaSortValue}
                    role='columnheader'
                    tabIndex={column.sortable ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (column.sortable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleHeaderClick(column);
                      }
                    }}
                    onClick={() => handleHeaderClick(column)}>
                    <div className='sf-data-table__header-th-content'>
                      {column.title}
                      {getSortIndicator(column)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody
            role='rowgroup'
            className='sf-data-table__body'
            style={{
              height: shouldVirtualize ? `${rowVirtualizer.getTotalSize()}px` : 'auto',
              position: 'relative',
            }}
          >
            {shouldVirtualize ? (
              // Virtualized rendering for large lists
              rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = data[virtualRow.index];
                return (
                  <tr
                    role='row'
                    key={row.id || virtualRow.index}
                    className={`
                      sf-data-table__row
                      ${
                        selectedItems.includes(row.id)
                          ? 'sf-data-table__row--selected'
                          : ''
                      }
                      ${onRowClick ? 'sf-data-table__row--clickable' : ''}
                      ${rowClassName ? rowClassName(row) : ''}
                    `}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => onRowClick && onRowClick(row)}>
                    {selectable && (
                      <td className='sf-data-table__check-cell' role='cell' onClick={(e) => e.stopPropagation()}>
                        <CheckboxControl
                          checked={selectedItems.includes(row.id)}
                          onChange={(checked) => handleSelectRow(row.id, checked)}
                          aria-label={sprintf(
                            /* translators: %s: row number */
                            __('Select row %s', 'subtleforms'),
                            row.id
                          )}
                        />
                      </td>
                    )}
                    {columns.map((column, i) => (
                      <td key={column.key} {...cellProps(column, i)}>
                        {column.render
                          ? column.render(row[column.key], row)
                          : row[column.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              // Standard rendering for small lists
              data.map((row, index) => (
                <tr
                  role='row'
                  key={row.id || index}
                  className={`
                    sf-data-table__row
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
                    <td className='sf-data-table__check-cell' role='cell' onClick={(e) => e.stopPropagation()}>
                      <CheckboxControl
                        checked={selectedItems.includes(row.id)}
                        onChange={(checked) => handleSelectRow(row.id, checked)}
                        aria-label={sprintf(
                          /* translators: %s: row number */
                          __('Select row %s', 'subtleforms'),
                          row.id
                        )}
                      />
                    </td>
                  )}
                  {columns.map((column, i) => (
                    <td key={column.key} {...cellProps(column, i)}>
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 0 && (
        <FullPagination
          currentPage={currentPage}
          totalPages={totalPages}
          perPage={perPage}
          totalItems={totalItems}
          onPageChange={onPageChange}
          onPerPageChange={onPerPageChange}
        />
      )}
    </div>
  );
});

export default DataTable;
