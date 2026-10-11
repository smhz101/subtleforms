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
import { __, _n, sprintf } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import clsx from 'clsx';
import DataTable from './DataTable';
import { ConfirmModal } from '../modals';
import { apiGet } from '../utils/api';
import { apiClient } from '../data';
import { Icon } from '../ui';
import { requirePro } from '../utils/featureGate';
import { downloadCsv } from '../utils/csvDownload';
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
      visibleColumns = DEFAULT_VISIBLE,
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
    const [bulkDelete, setBulkDelete] = useState(null);
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

      const { ok, body, headers } = await apiGet(`/submissions?${params}`);
      if (!ok) throw new Error('API request failed');

      const data = body || {};
      let rows = [];
      let total = 0;

      if (data && Array.isArray(data.data)) {
        rows = data.data;
        total =
          data.meta && typeof data.meta.total === 'number'
            ? data.meta.total
            : parseInt(headers?.get('X-WP-Total') || '0');
      } else if (data && data.submissions) {
        rows = data.submissions;
        total = data.total || 0;
      } else if (Array.isArray(data)) {
        rows = data;
        total = parseInt(headers?.get('X-WP-Total') || '0');
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

    // One request for any number of entries (2.3.0).
    const runBulk = async (ids, action) => {
      const res = await apiClient.post('/submissions/bulk', { ids, action });
      return Array.isArray(res?.updated) ? res.updated.length : 0;
    };

    const notifyBulk = (done, total, verb) => {
      if (done === total) {
        createSuccessNotice(
          sprintf(
            /* translators: %1$d: number of entries, %2$s: what happened, e.g. "updated" */
            _n('%1$d entry %2$s', '%1$d entries %2$s', done, 'subtleforms'),
            done,
            verb
          ),
          { type: 'snackbar' }
        );
      } else {
        createErrorNotice(
          sprintf(
            /* translators: %1$d: number done, %2$d: total requested */
            __('Some entries could not be changed (%1$d of %2$d done)', 'subtleforms'),
            done,
            total
          ),
          { type: 'snackbar' }
        );
        loadFresh();
      }
    };

    const handleBulkDelete = (ids) => setBulkDelete(ids);

    const confirmBulkDelete = async () => {
      const ids = bulkDelete || [];
      setBulkDelete(null);
      setBuffer((prev) => prev.filter((s) => !ids.includes(s.id)));
      setSelectedSubmissions([]);
      try {
        notifyBulk(await runBulk(ids, 'delete'), ids.length, __('deleted', 'subtleforms'));
      } catch (_err) {
        notifyBulk(0, ids.length, '');
      }
    };

    const handleBulkMarkStatus = async (ids, actionType) => {
      const patch = {
        read: { is_read: 1 },
        unread: { is_read: 0 },
        star: { starred: 1 },
        unstar: { starred: 0 },
        spam: { status: 'spam' },
        flagged: { status: 'flagged' },
        restore: { status: null },
      }[actionType];
      if (!patch) {
        return;
      }
      // Optimistic update
      setBuffer((prev) => prev.map((s) => (ids.includes(s.id) ? { ...s, ...patch } : s)));
      setSelectedSubmissions([]);
      try {
        notifyBulk(await runBulk(ids, actionType), ids.length, __('updated', 'subtleforms'));
      } catch (_err) {
        notifyBulk(0, ids.length, '');
      }
    };

    // Export the selected entries (CSV export is part of SubtleForms Pro).
    const handleExportSelected = (ids) =>
      requirePro('submissions.export', async () => {
        try {
          const res = await apiClient.post('/submissions/export', { ids });
          if (!downloadCsv(res)) {
            createErrorNotice(res?.message || __('Nothing to export', 'subtleforms'), { type: 'snackbar' });
          }
        } catch (err) {
          createErrorNotice(__('Failed to export submissions', 'subtleforms'), { type: 'snackbar' });
        }
      });

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

    // Stored timestamps are UTC without a zone suffix; parse them as UTC so
    // relative times match the dashboard in every browser timezone.
    const parseUtc = (value) => {
      const raw = String(value || '');
      return new Date(raw && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw);
    };

    const getRelativeTime = (dateString) => {
      const date = parseUtc(dateString);
      const now = new Date();
      const diff = Math.max(0, Math.floor((now - date) / 1000));
      if (diff < 60) return __('Just now', 'subtleforms');
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
        }).format(parseUtc(dateString));
      } catch {
        return dateString;
      }
    };

    // Pull a human summary out of the payload: a name and an email when the
    // form collects them, otherwise the first short answers.
    const summarize = (submission) => {
      const payload =
        submission.payload && typeof submission.payload === 'object'
          ? submission.payload
          : {};
      const entries = Object.entries(payload);
      const flat = (v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') {
          if (v.first_name || v.last_name) {
            return [v.first_name, v.last_name].filter(Boolean).join(' ');
          }
          return '';
        }
        return String(v);
      };
      const byKey = (re) => {
        const hit = entries.find(([k, v]) => re.test(k) && flat(v).trim());
        return hit ? flat(hit[1]).trim() : '';
      };
      const email = byKey(/e-?mail/i);
      const name =
        byKey(/^(full_?)?name$|name_group|your_name|first_name/i) ||
        entries.map(([, v]) => flat(v)).find(
          (v) => v && !v.includes('@') && v.length <= 60
        ) ||
        '';
      return { name, email };
    };

    const STATUS = {
      completed: { label: __('Completed', 'subtleforms'), cls: 'sf-pill--success' },
      saved: { label: __('Saved', 'subtleforms'), cls: '' },
      processing: { label: __('Processing', 'subtleforms'), cls: 'sf-pill--info' },
      failed: { label: __('Failed', 'subtleforms'), cls: 'sf-pill--danger' },
      payment_pending: { label: __('Awaiting payment', 'subtleforms'), cls: 'sf-pill--warning' },
      spam: { label: __('Spam', 'subtleforms'), cls: 'sf-pill--danger' },
      flagged: { label: __('Flagged', 'subtleforms'), cls: 'sf-pill--warning' },
      archived: { label: __('Archived', 'subtleforms'), cls: '' },
    };

    // Define table columns
    const allColumns = [
      {
        key: 'id',
        title: __('Submission', 'subtleforms'),
        sortable: true,
        render: (id, submission) => {
          const isUnread = parseInt(submission.is_read, 10) === 0;
          const { name, email } = summarize(submission);
          return (
            <span
              className={clsx('sf-sub-entry', { 'is-unread': isUnread })}>
              <span className='sf-sub-entry__dot' aria-hidden='true' />
              <span className='sf-sub-entry__avatar' aria-hidden='true'>
                {(name || email || '#').trim().charAt(0).toUpperCase()}
              </span>
              <span className='sf-sub-entry__text'>
                <span className='sf-sub-entry__name'>
                  {name || email || sprintf(
                    /* translators: %d: submission id */
                    __('Submission #%d', 'subtleforms'),
                    id
                  )}
                  {isUnread && (
                    <span className='screen-reader-text'>
                      {' '}
                      {__('(unread)', 'subtleforms')}
                    </span>
                  )}
                </span>
                <span className='sf-sub-entry__meta'>
                  {email && name ? <span>{email}</span> : null}
                  <span className='sf-sub-entry__id'>#{id}</span>
                </span>
              </span>
            </span>
          );
        },
      },
      ...(showFormColumn
        ? [
            {
              key: 'form_title',
              title: __('Form', 'subtleforms'),
              render: (formTitle, submission) => (
                <span className='sf-sub-form'>{formTitle || `#${submission.form_id}`}</span>
              ),
            },
          ]
        : []),
      {
        key: 'status',
        title: __('Status', 'subtleforms'),
        sortable: true,
        render: (status) => {
          const config = STATUS[status] || {
            label: __('Received', 'subtleforms'),
            cls: '',
          };
          return (
            <span className={clsx('sf-pill', 'sf-pill--dot', config.cls)}>
              {config.label}
            </span>
          );
        },
      },
      {
        key: 'browser',
        title: __('Browser', 'subtleforms'),
        render: (_, submission) => (
          <span className='sf-sub-muted'>{getBrowserDevice(submission.user_agent).browser}</span>
        ),
      },
      {
        key: 'device',
        title: __('Device', 'subtleforms'),
        render: (_, submission) => (
          <span className='sf-sub-muted'>{getBrowserDevice(submission.user_agent).device}</span>
        ),
      },
      {
        key: 'created_at',
        title: __('Received', 'subtleforms'),
        sortable: true,
        render: (createdAt) => (
          <time className='sf-sub-time' title={formatAbsDate(createdAt)} dateTime={createdAt}>
            {getRelativeTime(createdAt)}
          </time>
        ),
      },
      {
        key: 'actions',
        title: null,
        render: (_, submission) => (
          <div className='subtleforms-row-actions sf-submissions-table__actions'>
            <Button
              size='compact'
              icon={<Icon.Eye size={16} />}
              label={__('Open', 'subtleforms')}
              showTooltip
              onClick={(e) => {
                e.stopPropagation();
                handleRowClick(submission);
              }}
            />
            <Button
              size='compact'
              icon={<Icon.Star size={16} fill={parseInt(submission.starred, 10) === 1 ? 'currentColor' : 'none'} />}
              label={
                parseInt(submission.starred, 10) === 1
                  ? __('Remove star', 'subtleforms')
                  : __('Star', 'subtleforms')
              }
              showTooltip
              isPressed={parseInt(submission.starred, 10) === 1}
              className={clsx(
                'sf-submissions-table__star-btn',
                parseInt(submission.starred, 10) === 1 && 'sf-submissions-table__star-btn--active'
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleBulkMarkStatus(
                  [submission.id],
                  parseInt(submission.starred, 10) === 1 ? 'unstar' : 'star'
                );
              }}
            />
            <Button
              size='compact'
              icon={<Icon.AlertCircle size={16} />}
              label={
                submission.status === 'flagged'
                  ? __('Remove flag', 'subtleforms')
                  : __('Flag for follow-up', 'subtleforms')
              }
              showTooltip
              isPressed={submission.status === 'flagged'}
              className={clsx(
                'sf-submissions-table__flag-btn',
                submission.status === 'flagged' && 'sf-submissions-table__flag-btn--active'
              )}
              onClick={(e) => {
                e.stopPropagation();
                handleBulkMarkStatus(
                  [submission.id],
                  submission.status === 'flagged' ? 'restore' : 'flagged'
                );
              }}
            />
            <Button
              size='compact'
              isDestructive
              icon={<Icon.Trash size={16} />}
              label={__('Delete', 'subtleforms')}
              showTooltip
              onClick={(e) => {
                e.stopPropagation();
                setDeleteModal(submission.id);
              }}
            />
          </div>
        ),
      },
    ];

    // Filter to visible columns (always show actions).
    // A default alone isn't enough: an explicit `visibleColumns={undefined}` from
    // a caller skips the default, and this runs on every render.
    const visible = Array.isArray(visibleColumns) ? visibleColumns : DEFAULT_VISIBLE;
    const columns = allColumns.filter(
      (col) =>
        col.key === 'actions' ||
        (col.key === 'form_title'
          ? showFormColumn && visible.includes('form_title')
          : visible.includes(col.key))
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
      <div className='sf-submissions-table'>
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
          emptyMessage={
            <div className='sf-empty'>
              <span className='sf-empty__icon'>
                <Icon.Inbox size={20} />
              </span>
              <p className='sf-empty__title'>
                {formId ? __('No entries yet', 'subtleforms') : __('No submissions here', 'subtleforms')}
              </p>
              <p className='sf-empty__text'>
                {formId
                  ? __('Publish the form and add it to a page with the SubtleForms block or its shortcode. Entries appear here as they arrive.', 'subtleforms')
                  : __('Entries show up the moment a visitor sends one of your forms. Try another tab or clear the filters.', 'subtleforms')}
              </p>
            </div>
          }
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
              label: __('Star', 'subtleforms'),
              onClick: (ids) => handleBulkMarkStatus(ids, 'star'),
            },
            {
              label: __('Remove star', 'subtleforms'),
              onClick: (ids) => handleBulkMarkStatus(ids, 'unstar'),
            },
            {
              label: __('Export selected (CSV)', 'subtleforms'),
              onClick: handleExportSelected,
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
          isOpen={!!bulkDelete}
          onClose={() => setBulkDelete(null)}
          title={__('Delete entries', 'subtleforms')}
          message={sprintf(
            /* translators: %d: number of entries */
            _n(
              'Delete %d entry permanently? Its uploaded files are deleted too. This cannot be undone.',
              'Delete %d entries permanently? Their uploaded files are deleted too. This cannot be undone.',
              bulkDelete?.length || 0,
              'subtleforms'
            ),
            bulkDelete?.length || 0
          )}
          onConfirm={confirmBulkDelete}
          confirmText={__('Delete', 'subtleforms')}
          confirmVariant='destructive'
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
