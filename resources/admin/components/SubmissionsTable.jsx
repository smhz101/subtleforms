import {
  useState,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from '@wordpress/element';
import {
  Spinner,
  Notice,
  Button,
  SelectControl,
  SearchControl,
  Modal,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import clsx from 'clsx';
import DataTable from './DataTable';
import { ConfirmModal } from '../modals';
import { buildApiUrl } from '../utils/api';
import { apiClient } from '../data';
import { Icon } from './ui';
import './SubmissionsTable.scss';

const restNonce =
  window.subtleformsAdmin && window.subtleformsAdmin.restNonce
    ? window.subtleformsAdmin.restNonce
    : null;

export const ALL_COLUMNS = ['id', 'form_title', 'status', 'browser', 'device', 'created_at', 'actions'];
export const DEFAULT_VISIBLE = ['id', 'form_title', 'status', 'created_at', 'actions'];
export const COLUMN_LABELS = {
  id: __('ID', 'subtleforms'),
  form_title: __('Form', 'subtleforms'),
  status: __('Status', 'subtleforms'),
  browser: __('Browser', 'subtleforms'),
  device: __('Device', 'subtleforms'),
  created_at: __('Submitted', 'subtleforms'),
};

const SubmissionsTable = forwardRef(
  (
    {
      formId,
      showFormColumn = true,
      onRowClick,
      searchTerm,
      statusFilter = 'all',
      dateRange = 'all',
      fieldValue = '',
      processingStatus = '',
      visibleColumns,
    },
    ref
  ) => {
    // Chunked prefetch: buffer accumulates rows; sliced client-side per page.
    // Each API call fetches CHUNK_PAGES pages at once.
    const CHUNK_PAGES = 5;
    const [buffer, setBuffer] = useState([]);
    const [pagesLoaded, setPagesLoaded] = useState(0);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [totalItems, setTotalItems] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [sortBy, setSortBy] = useState('created_at');
    const [sortDirection, setSortDirection] = useState('desc');
    const [deleteModal, setDeleteModal] = useState(null);
    const [selectedSubmissions, setSelectedSubmissions] = useState([]);
    const isPrefetchingRef = useRef(false);
    const { createSuccessNotice, createErrorNotice } =
      useDispatch(noticesStore);

    // Fresh load on any filter, sort, or perPage change
    useEffect(() => {
      loadFresh();
    }, [formId, statusFilter, searchTerm, dateRange, fieldValue, processingStatus, sortBy, sortDirection, perPage]);

    // Prefetch next batch when user reaches 3rd page of loaded window
    useEffect(() => {
      if (pagesLoaded === 0) return;
      const totalPages = Math.ceil(totalItems / perPage);
      if (
        currentPage >= pagesLoaded - 2 &&
        pagesLoaded < totalPages &&
        !isPrefetchingRef.current
      ) {
        prefetchNextChunk();
      }
    }, [currentPage, pagesLoaded, totalItems, perPage]);

    const getDateRangeParams = (range) => {
      const now = new Date();
      let startDate = null;

      switch (range) {
        case 'today':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          break;
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3months':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          return {};
      }

      return startDate ? { after: startDate.toISOString().split('T')[0] } : {};
    };

    const buildFilterParams = () => {
      const params = new URLSearchParams({
        orderby: sortBy,
        order: sortDirection,
      });
      if (formId) params.append('form_id', formId);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (fieldValue) params.append('field_value', fieldValue);
      if (processingStatus) params.append('processing_status', processingStatus);
      const dateParams = getDateRangeParams(dateRange);
      if (dateParams.after) params.append('after', dateParams.after);
      return params;
    };

    // Fetch one batch: batchIndex 0 → rows 1..(CHUNK_PAGES*perPage), index 1 → next batch, etc.
    const fetchBatch = async (batchIndex) => {
      const batchSize = perPage * CHUNK_PAGES;
      const params = buildFilterParams();
      params.set('page', (batchIndex + 1).toString());
      params.set('per_page', batchSize.toString());

      const response = await fetch(buildApiUrl(`/submissions?${params}`), {
        credentials: 'same-origin',
        headers: { 'X-WP-Nonce': restNonce },
      });
      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();
      let rows = [];
      let total = 0;

      if (data && Array.isArray(data.data)) {
        rows = data.data;
        total =
          data.meta && typeof data.meta.total === 'number'
            ? data.meta.total
            : parseInt(response.headers.get('X-WP-Total') || '0');
      } else if (data && data.submissions) {
        rows = data.submissions;
        total = data.total || 0;
      } else if (Array.isArray(data)) {
        rows = data;
        total = parseInt(response.headers.get('X-WP-Total') || '0');
      }
      return { rows, total };
    };

    // Full reset + reload from page 1 (fresh filters/sort)
    const loadFresh = async () => {
      setError(null);
      setLoading(true);
      setCurrentPage(1);

      try {
        const { rows, total } = await fetchBatch(0);
        setBuffer(rows);
        setPagesLoaded(Math.ceil(rows.length / perPage) || 0);
        setTotalItems(total);
      } catch (err) {
        setError(__('Failed to load submissions', 'subtleforms'));
        setBuffer([]);
        setPagesLoaded(0);
        setTotalItems(0);
      } finally {
        setLoading(false);
      }
    };

    // Background prefetch: appends next batch to buffer
    const prefetchNextChunk = async () => {
      if (isPrefetchingRef.current) return;
      isPrefetchingRef.current = true;

      const batchIndex = Math.ceil(pagesLoaded / CHUNK_PAGES);
      try {
        const { rows, total } = await fetchBatch(batchIndex);
        if (rows.length > 0) {
          setBuffer((prev) => [...prev, ...rows]);
          setPagesLoaded((prev) => prev + Math.ceil(rows.length / perPage));
          setTotalItems(total);
        }
      } catch (err) {
        console.warn('SubtleForms: prefetch failed', err);
      } finally {
        isPrefetchingRef.current = false;
      }
    };

    // Expose refresh method via ref for real-time updates
    useImperativeHandle(
      ref,
      () => ({
        refreshData: loadFresh,
      }),
      [loadFresh]
    );

    const handleDelete = async (submissionId) => {
      setDeleteModal(null);
      setBuffer((prev) => prev.filter((s) => s.id !== submissionId));

      try {
        await apiClient.delete(`/submissions/${submissionId}`);
        createSuccessNotice(__('Submission deleted', 'subtleforms'), {
          type: 'snackbar',
        });
      } catch (err) {
        loadFresh(); // Revert on failure
        createErrorNotice(__('Failed to delete submission', 'subtleforms'), {
          type: 'snackbar',
        });
      }
    };

    const handleBulkDelete = async (ids) => {
      if (
        !window.confirm(
          (() => {
            return sprintf(
              /* translators: %1$d: number of submissions to delete */
              __(
                'Are you sure you want to delete %1$d submissions?',
                'subtleforms'
              ),
              ids.length
            );
          })()
        )
      ) {
        return;
      }

      setBuffer((prev) => prev.filter((s) => !ids.includes(s.id)));
      setSelectedSubmissions([]);

      let successCount = 0;
      for (const id of ids) {
        try {
          await apiClient.delete(`/submissions/${id}`);
          successCount++;
        } catch (_err) {
          // individual failure counted below
        }
      }

      if (successCount === ids.length) {
        createSuccessNotice(
          (() => {
            return sprintf(
              /* translators: %1$d: number of submissions deleted */
              __('%1$d submissions deleted', 'subtleforms'),
              successCount
            );
          })(),
          { type: 'snackbar' }
        );
      } else {
        createErrorNotice(
          (() => {
            return sprintf(
              /* translators: %1$d: number deleted, %2$d: total requested */
              __(
                'Failed to delete some submissions (%1$d/%2$d deleted)',
                'subtleforms'
              ),
              successCount,
              ids.length
            );
          })(),
          { type: 'snackbar' }
        );
        loadFresh(); // Reload to sync state
      }
    };

    const handleBulkMarkStatus = async (ids, actionType) => {
      // Map action type to the correct field update
      const isReadActions = { read: 1, unread: 0 };
      const adminStatusActions = ['spam', 'flagged', 'archived'];

      let updatePayload;
      if (actionType in isReadActions) {
        updatePayload = { is_read: isReadActions[actionType] };
        // Optimistic update
        setBuffer((prev) =>
          prev.map((s) =>
            ids.includes(s.id) ? { ...s, is_read: isReadActions[actionType] } : s
          )
        );
      } else if (adminStatusActions.includes(actionType)) {
        updatePayload = { status: actionType };
        setBuffer((prev) =>
          prev.map((s) => (ids.includes(s.id) ? { ...s, status: actionType } : s))
        );
      } else if (actionType === 'restore') {
        // Clear admin status override (unflag/unspam) — server sets status to null
        updatePayload = { status: 'none' };
        setBuffer((prev) =>
          prev.map((s) => (ids.includes(s.id) ? { ...s, status: null } : s))
        );
      } else {
        return;
      }

      setSelectedSubmissions([]);

      let successCount = 0;
      for (const id of ids) {
        try {
          await apiClient.put(`/submissions/${id}`, updatePayload);
          successCount++;
        } catch (_err) {
          // individual failure counted below
        }
      }

      if (successCount === ids.length) {
        createSuccessNotice(
          sprintf(
            /* translators: %1$d: number of submissions updated */
            __('%1$d submissions updated', 'subtleforms'),
            successCount
          ),
          { type: 'snackbar' }
        );
      } else {
        createErrorNotice(
          sprintf(
            /* translators: %1$d: number updated, %2$d: total requested */
            __(
              'Failed to update some submissions (%1$d/%2$d updated)',
              'subtleforms'
            ),
            successCount,
            ids.length
          ),
          { type: 'snackbar' }
        );
        loadFresh(); // Reload to sync state
      }
    };

    const getRowClassName = (submission) => {
      // Priority: spam/flagged > failed > payment_pending > unread
      if (submission.status === 'spam') return 'sf-submissions-table__row--spam';
      if (submission.status === 'flagged') return 'sf-submissions-table__row--flagged';
      if (submission.status === 'failed') return 'sf-submissions-table__row--failed';
      if (submission.status === 'payment_pending') return 'sf-submissions-table__row--payment-pending';
      if (parseInt(submission.is_read, 10) === 0) return 'sf-submissions-table__row--unread';
      return '';
    };

    const handleRowClick = (submission) => {
      if (onRowClick) {
        onRowClick(submission);
      } else {
        window.location.href = `admin.php?page=subtleforms-submissions&submission_id=${
          submission.id
        }${formId ? `&form_id=${formId}` : ''}`;
      }
    };

    const handleSort = (column, direction) => {
      setSortBy(column);
      setSortDirection(direction);
    };

    const handlePageChange = (page) => {
      setCurrentPage(page);
    };

    const handlePerPageChange = (newPerPage) => {
      setPerPage(parseInt(newPerPage));
      setCurrentPage(1);
    };

    const getRelativeTime = (dateString) => {
      const date = new Date(dateString);
      const now = new Date();
      const diff = Math.floor((now - date) / 1000);
      if (diff < 60)
        return (() => {
          /* translators: %1$d: number of seconds */
          return sprintf(__('%1$d seconds ago', 'subtleforms'), diff);
        })();
      if (diff < 3600)
        return (() => {
          /* translators: %1$d: number of minutes */
          return sprintf(
            __('%1$d minutes ago', 'subtleforms'),
            Math.floor(diff / 60)
          );
        })();
      if (diff < 86400)
        return (() => {
          /* translators: %1$d: number of hours ago */
          return sprintf(
            __('%1$d hours ago', 'subtleforms'),
            Math.floor(diff / 3600)
          );
        })();
      return (() => {
        /* translators: %1$d: number of days */
        return sprintf(
          __('%1$d days ago', 'subtleforms'),
          Math.floor(diff / 86400)
        );
      })();
    };

    const getBrowserDevice = (userAgent) => {
      if (!userAgent) return { browser: 'N/A', device: 'N/A' };
      const browser =
        userAgent
          .match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[0]
          ?.split('/')[0] || 'Other';
      const device = userAgent.match(/Mobile|Android|iPhone|iPad/)
        ? 'Mobile'
        : 'Desktop';
      return { browser, device };
    };

    const formatAbsDate = (dateString) => {
      try {
        return new Intl.DateTimeFormat(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(dateString));
      } catch {
        return dateString;
      }
    };

    // Define table columns
    const allColumns = [
      {
        key: 'id',
        title: __('ID', 'subtleforms'),
        sortable: true,
        render: (id) => <strong>#{id}</strong>,
      },
      ...(showFormColumn
        ? [
            {
              key: 'form_title',
              title: __('Form', 'subtleforms'),
              render: (formTitle, submission) =>
                formTitle || submission.form_id,
            },
          ]
        : []),
      {
        key: 'status',
        title: __('Status', 'subtleforms'),
        sortable: true,
        render: (status, submission) => {
          const isUnread = parseInt(submission.is_read, 10) === 0;

          // Null / legacy 'unread' status — show only the read indicator
          if (!status || status === 'unread') {
            return (
              <span className='sf-submissions-table__status-cell'>
                {isUnread && (
                  <span
                    className='sf-submissions-table__unread-dot'
                    title={__('Unread', 'subtleforms')}
                  />
                )}
                <span className='sf-submissions-table__status-badge sf-submissions-table__status-badge--processing'>
                  {'—'}
                </span>
              </span>
            );
          }

          // Admin-override statuses
          if (status === 'spam' || status === 'flagged' || status === 'archived') {
            const adminVariantMap = { spam: 'spam', flagged: 'flagged', archived: 'read' };
            const adminLabelMap = {
              spam: __('Spam', 'subtleforms'),
              flagged: __('Flagged', 'subtleforms'),
              archived: __('Archived', 'subtleforms'),
            };
            return (
              <span
                className={clsx(
                  'sf-submissions-table__status-badge',
                  `sf-submissions-table__status-badge--${adminVariantMap[status]}`
                )}>
                {adminLabelMap[status]}
              </span>
            );
          }

          // Pipeline statuses — show processing result + unread dot
          const pipelineVariantMap = {
            completed: 'completed',
            failed: 'failed',
            payment_pending: 'payment-pending',
            processing: 'processing',
            saved: 'processing',
          };
          const pipelineLabelMap = {
            completed: __('Completed', 'subtleforms'),
            failed: __('Failed', 'subtleforms'),
            payment_pending: __('Awaiting Payment', 'subtleforms'),
            processing: __('Processing', 'subtleforms'),
            saved: __('Saved', 'subtleforms'),
          };
          const variant = pipelineVariantMap[status] || 'processing';
          return (
            <span className='sf-submissions-table__status-cell'>
              {isUnread && (
                <span className='sf-submissions-table__unread-dot' title={__('Unread', 'subtleforms')}></span>
              )}
              <span
                className={clsx(
                  'sf-submissions-table__status-badge',
                  `sf-submissions-table__status-badge--${variant}`
                )}>
                {pipelineLabelMap[status] || status}
              </span>
            </span>
          );
        },
      },
      {
        key: 'browser',
        title: __('Browser', 'subtleforms'),
        render: (_, submission) =>
          getBrowserDevice(submission.user_agent).browser,
      },
      {
        key: 'device',
        title: __('Device', 'subtleforms'),
        render: (_, submission) =>
          getBrowserDevice(submission.user_agent).device,
      },
      {
        key: 'created_at',
        title: __('Submitted', 'subtleforms'),
        sortable: true,
        render: (createdAt) => (
          <span className='sf-sub-time'>
            <span className='sf-sub-time__rel'>{getRelativeTime(createdAt)}</span>
            <span className='sf-sub-time__abs'>{formatAbsDate(createdAt)}</span>
          </span>
        ),
      },
      {
        key: 'actions',
        title: __('Actions', 'subtleforms'),
        render: (_, submission) => (
          <div className='sf-submissions-table__actions'>
            <Button
              isSecondary
              isSmall
              onClick={(e) => {
                e.stopPropagation();
                handleRowClick(submission);
              }}>
              {__('View', 'subtleforms')}
            </Button>
            <Button
              isSmall
              onClick={(e) => {
                e.stopPropagation();
                handleBulkMarkStatus(
                  [submission.id],
                  submission.status === 'flagged' ? 'restore' : 'flagged'
                );
              }}
              title={
                submission.status === 'flagged'
                  ? __('Unflag submission', 'subtleforms')
                  : __('Flag submission', 'subtleforms')
              }
              className={clsx(
                'sf-submissions-table__flag-btn',
                submission.status === 'flagged' &&
                  'sf-submissions-table__flag-btn--active'
              )}>
              <Icon.AlertCircle size={13} />
            </Button>
            <Button
              isDestructive
              isSmall
              onClick={(e) => {
                e.stopPropagation();
                setDeleteModal(submission.id);
              }}>
              {__('Delete', 'subtleforms')}
            </Button>
          </div>
        ),
      },
    ];

    // Filter to visible columns (always show actions)
    const columns = allColumns.filter(
      (col) =>
        col.key === 'actions' ||
        visibleColumns.includes(col.key) ||
        (col.key === 'form_title' && showFormColumn && visibleColumns.includes('form_title'))
    );

    if (error) {
      return <Notice status='error'>{error}</Notice>;
    }

    // Slice the buffer for the current page (client-side pagination)
    const displayedRows = buffer.slice(
      (currentPage - 1) * perPage,
      currentPage * perPage
    );

    return (
      <div className='submissions-table'>
        <DataTable
          columns={columns}
          data={displayedRows}
          totalItems={totalItems}
          currentPage={currentPage}
          perPage={perPage}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={handleSort}
          onPageChange={handlePageChange}
          onPerPageChange={handlePerPageChange}
          loading={loading}
          emptyMessage={__('No submissions found.', 'subtleforms')}
          onRowClick={handleRowClick}
          rowClassName={getRowClassName}
          selectable={true}
          selectedItems={selectedSubmissions}
          onSelectionChange={setSelectedSubmissions}
          bulkActions={[
            {
              label: __('Mark as Read', 'subtleforms'),
              onClick: (ids) => handleBulkMarkStatus(ids, 'read'),
            },
            {
              label: __('Mark as Unread', 'subtleforms'),
              onClick: (ids) => handleBulkMarkStatus(ids, 'unread'),
            },
            {
              label: __('Mark as Spam', 'subtleforms'),
              onClick: (ids) => handleBulkMarkStatus(ids, 'spam'),
            },
            {
              label: __('Mark as Flagged', 'subtleforms'),
              onClick: (ids) => handleBulkMarkStatus(ids, 'flagged'),
            },
            {
              label: __('Delete', 'subtleforms'),
              onClick: handleBulkDelete,
              isDestructive: true,
            },
          ]}
        />
        <ConfirmModal
          isOpen={!!deleteModal}
          onClose={() => setDeleteModal(null)}
          title={__('Delete Submission', 'subtleforms')}
          message={__(
            'Are you sure you want to delete this submission? This action cannot be undone.',
            'subtleforms'
          )}
          onConfirm={() => handleDelete(deleteModal)}
          confirmText={__('Delete Submission', 'subtleforms')}
          confirmVariant='destructive'
        />
      </div>
    );
  }
);

export default SubmissionsTable;
