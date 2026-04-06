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

const ALL_COLUMNS = ['id', 'form_title', 'status', 'browser', 'device', 'created_at', 'actions'];
const DEFAULT_VISIBLE = ['id', 'form_title', 'status', 'created_at', 'actions'];

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
    },
    ref
  ) => {
    const [submissions, setSubmissions] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [totalItems, setTotalItems] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [sortBy, setSortBy] = useState('created_at');
    const [sortDirection, setSortDirection] = useState('desc');
    const [deleteModal, setDeleteModal] = useState(null);
    const [selectedSubmissions, setSelectedSubmissions] = useState([]);
    const [showColPicker, setShowColPicker] = useState(false);
    const colPickerRef = useRef(null);
    const [visibleColumns, setVisibleColumns] = useState(() => {
      try {
        const saved = localStorage.getItem('sf_visible_cols');
        return saved ? JSON.parse(saved) : DEFAULT_VISIBLE;
      } catch {
        return DEFAULT_VISIBLE;
      }
    });
    const { createSuccessNotice, createErrorNotice } =
      useDispatch(noticesStore);

    // Close column picker when clicking outside
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (colPickerRef.current && !colPickerRef.current.contains(e.target)) {
          setShowColPicker(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
      loadSubmissions();
    }, [
      formId,
      statusFilter,
      searchTerm,
      dateRange,
      fieldValue,
      currentPage,
      perPage,
      sortBy,
      sortDirection,
    ]);

    useEffect(() => {
      // Reset to first page when filters change
      setCurrentPage(1);
    }, [statusFilter, searchTerm, dateRange, fieldValue]);

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

    const loadSubmissions = async () => {
      setError(null);
      setLoading(true);

      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          per_page: perPage.toString(),
          orderby: sortBy,
          order: sortDirection,
        });

        if (formId) {
          params.append('form_id', formId);
        }

        if (statusFilter && statusFilter !== 'all') {
          params.append('status', statusFilter);
        }

        if (searchTerm) {
          params.append('search', searchTerm);
        }

        if (fieldValue) {
          params.append('field_value', fieldValue);
        }

        // Add date range filter
        const dateParams = getDateRangeParams(dateRange);
        if (dateParams.after) {
          params.append('after', dateParams.after);
        }

        const response = await fetch(buildApiUrl(`/submissions?${params}`), {
          credentials: 'same-origin',
          headers: {
            'X-WP-Nonce': restNonce,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const total = parseInt(response.headers.get('X-WP-Total') || '0');

          // Patch: Use data.data for submissions array (API returns { data: [...], meta: {...} })
          if (data && Array.isArray(data.data)) {
            setSubmissions(data.data);
            setTotalItems(
              (data.meta && typeof data.meta.total === 'number') ? data.meta.total : total
            );
          } else if (data && data.submissions) {
            setSubmissions(data.submissions);
            setTotalItems(data.total || 0);
          } else if (Array.isArray(data)) {
            setSubmissions(data);
            setTotalItems(total);
          } else {
            setError(__('Invalid response format', 'subtleforms'));
          }
        } else {
          throw new Error('API request failed');
        }
      } catch (err) {
        setError(__('Failed to load submissions', 'subtleforms'));
        setSubmissions([]);
        setTotalItems(0);
      } finally {
        setLoading(false);
      }
    };

    // Expose refresh method via ref for real-time updates
    useImperativeHandle(
      ref,
      () => ({
        refreshData: loadSubmissions,
      }),
      [loadSubmissions]
    );

    const handleDelete = async (submissionId) => {
      setDeleteModal(null);
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));

      try {
        await apiClient.delete(`/submissions/${submissionId}`);
        createSuccessNotice(__('Submission deleted', 'subtleforms'), {
          type: 'snackbar',
        });
      } catch (err) {
        loadSubmissions(); // Revert on failure
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

      setSubmissions((prev) => prev.filter((s) => !ids.includes(s.id)));
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
        loadSubmissions(); // Reload to sync state
      }
    };

    const handleBulkMarkStatus = async (ids, status) => {
      setSubmissions((prev) =>
        prev.map((s) => (ids.includes(s.id) ? { ...s, status } : s))
      );
      setSelectedSubmissions([]);

      let successCount = 0;
      for (const id of ids) {
        try {
          await apiClient.put(`/submissions/${id}`, { status });
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
        loadSubmissions(); // Reload to sync state
      }
    };

    const toggleColumn = (key) => {
      setVisibleColumns((prev) => {
        const next = prev.includes(key)
          ? prev.filter((c) => c !== key)
          : [...prev, key];
        try {
          localStorage.setItem('sf_visible_cols', JSON.stringify(next));
        } catch {}
        return next;
      });
    };

    const getRowClassName = (submission) => {
      if (submission.status === 'unread') {
        return 'sf-submissions-table__row--unread';
      }
      if (submission.status === 'spam') {
        return 'sf-submissions-table__row--spam';
      }
      if (submission.status === 'flagged') {
        return 'sf-submissions-table__row--flagged';
      }
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
        width: '8%',
        render: (id) => <strong>#{id}</strong>,
      },
      ...(showFormColumn
        ? [
            {
              key: 'form_title',
              title: __('Form', 'subtleforms'),
              width: '18%',
              render: (formTitle, submission) =>
                formTitle || submission.form_id,
            },
          ]
        : []),
      {
        key: 'status',
        title: __('Status', 'subtleforms'),
        sortable: true,
        width: '10%',
        render: (status) => {
          const variantMap = {
            unread: 'unread',
            read: 'read',
            spam: 'spam',
            flagged: 'flagged',
            archived: 'read',
          };
          const labelMap = {
            unread: __('New', 'subtleforms'),
            read: __('Read', 'subtleforms'),
            spam: __('Spam', 'subtleforms'),
            flagged: __('Flagged', 'subtleforms'),
            archived: __('Archived', 'subtleforms'),
          };
          const variant = variantMap[status] || 'read';
          return (
            <span
              className={clsx(
                'sf-submissions-table__status-badge',
                `sf-submissions-table__status-badge--${variant}`
              )}>
              {status === 'unread' && (
                <span className='sf-submissions-table__status-badge-indicator'></span>
              )}
              {labelMap[status] || status}
            </span>
          );
        },
      },
      {
        key: 'browser',
        title: __('Browser', 'subtleforms'),
        width: '12%',
        render: (_, submission) =>
          getBrowserDevice(submission.user_agent).browser,
      },
      {
        key: 'device',
        title: __('Device', 'subtleforms'),
        width: '10%',
        render: (_, submission) =>
          getBrowserDevice(submission.user_agent).device,
      },
      {
        key: 'created_at',
        title: __('Submitted', 'subtleforms'),
        sortable: true,
        width: '18%',
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
        width: '15%',
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
                  submission.status === 'flagged' ? 'unread' : 'flagged'
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

    const columnLabels = {
      id: __('ID', 'subtleforms'),
      form_title: __('Form', 'subtleforms'),
      status: __('Status', 'subtleforms'),
      browser: __('Browser', 'subtleforms'),
      device: __('Device', 'subtleforms'),
      created_at: __('Submitted', 'subtleforms'),
    };

    return (
      <div className='submissions-table'>
        <div className='sf-submissions-table__toolbar'>
          <div ref={colPickerRef} className='sf-col-picker'>
            <button
              className='sf-col-picker__toggle'
              onClick={() => setShowColPicker((v) => !v)}
              title={__('Show/hide columns', 'subtleforms')}>
              <Icon.Columns size={14} />
              <span>{__('Columns', 'subtleforms')}</span>
              <Icon.ChevronDown size={12} />
            </button>
            {showColPicker && (
              <div className='sf-col-picker__dropdown'>
                {ALL_COLUMNS.filter((k) => k !== 'actions').map((key) => (
                  <label key={key} className='sf-col-picker__item'>
                    <input
                      type='checkbox'
                      checked={visibleColumns.includes(key)}
                      onChange={() => toggleColumn(key)}
                    />
                    <span>{columnLabels[key] || key}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DataTable
          columns={columns}
          data={submissions}
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
