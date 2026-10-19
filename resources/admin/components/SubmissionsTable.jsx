import { submissionStatus } from '../utils/submissionStatus';
import { loadUntilFound } from '../utils/loadUntil';
import { markRowRead } from '../utils/markRowRead';
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
import { apiClient, useSettings } from '../data';
import { deletesPermanently } from '../utils/deleteBehavior';
import { Icon } from '../ui';
import { downloadCsv } from '../utils/csvDownload';
import { entrySender } from '../utils/entrySender';
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

/** Rows with each entry once, first occurrence kept. */
function uniqueRows(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const id = String(row?.id ?? '');
    if (!id || seen.has(id)) return !id;
    seen.add(id);
    return true;
  });
}

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
      readingId = null,
      density = 'default',
      onNeighbors = null,
      onMarkedRead = null,
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
    const { data: siteSettings } = useSettings();
    const hardDelete = deletesPermanently(siteSettings?.delete_behavior, false);
    const isPrefetchingRef = useRef(false);
    const prefetchPromiseRef = useRef(null);
    const stepRef = useRef(async () => ({ id: null }));
    const prefetchRef = useRef(async () => []);
    const bufferRef = useRef([]);
    const totalRef = useRef(0);
    const perPageRef = useRef(perPage);
    const pagesLoadedRef = useRef(0);
    bufferRef.current = buffer;
    totalRef.current = totalItems;
    perPageRef.current = perPage;
    pagesLoadedRef.current = pagesLoaded;
    // Each fresh load starts a new generation; answers from an older one
    // (another tab, filter or a slower request) are ignored so rows are
    // never shown twice or put back after a change (2.3.3).
    const generationRef = useRef(0);
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
      const generation = ++generationRef.current;

      try {
        const { rows, total } = await fetchBatch(0);
        if (generation !== generationRef.current) return;
        setBuffer(uniqueRows(rows));
        setPagesLoaded(Math.ceil(rows.length / perPage) || 0);
        setTotalItems(total);
      } catch (err) {
        if (generation !== generationRef.current) return;
        setError(__('Entries could not be loaded.', 'subtleforms'));
      } finally {
        if (generation === generationRef.current) setLoading(false);
      }
    };

    // Background prefetch: appends next batch to buffer.
    // Returns the buffer after the fetch so Previous/Next can cross a page
    // that has not been loaded yet. Concurrent callers share one request.
    const prefetchNextChunk = () => {
      if (prefetchPromiseRef.current) {
        return prefetchPromiseRef.current;
      }
      if (bufferRef.current.length >= totalRef.current) {
        return Promise.resolve(bufferRef.current);
      }

      isPrefetchingRef.current = true;
      const batchIndex = Math.ceil(pagesLoadedRef.current / CHUNK_PAGES);
      const generation = generationRef.current;
      const pending = (async () => {
        try {
          const { rows, total } = await fetchBatch(batchIndex);
          if (generation !== generationRef.current) {
            return bufferRef.current;
          }
          if (rows.length > 0) {
            const next = uniqueRows([...bufferRef.current, ...rows]);
            bufferRef.current = next;
            pagesLoadedRef.current += Math.ceil(rows.length / perPageRef.current);
            totalRef.current = total;
            setBuffer(next);
            setPagesLoaded(pagesLoadedRef.current);
            setTotalItems(total);
          }
          return bufferRef.current;
        } catch (err) {
          console.warn('SubtleForms: prefetch failed', err);
          return bufferRef.current;
        } finally {
          isPrefetchingRef.current = false;
          prefetchPromiseRef.current = null;
        }
      })();
      prefetchPromiseRef.current = pending;
      return pending;
    };

    // Move to the previous or next entry in the filtered list, loading the
    // next batch and turning the page when the neighbour is not on screen.
    const stepEntry = async (id, direction) => {
      let rows = bufferRef.current;
      const index = rows.findIndex((row) => String(row.id) === String(id));
      if (index < 0) {
        return { id: null };
      }
      let target = index + (direction === 'next' ? 1 : -1);
      while (target >= rows.length && direction === 'next' && rows.length < totalRef.current) {
        const before = rows.length;
        rows = await prefetchNextChunk();
        if (!rows || rows.length <= before) {
          break;
        }
        target = index + 1;
      }
      if (target < 0 || target >= rows.length) {
        return { id: null };
      }
      setCurrentPage(Math.floor(target / perPageRef.current) + 1);
      return { id: rows[target].id };
    };

    stepRef.current = stepEntry;
    prefetchRef.current = prefetchNextChunk;

    const removeEntry = (id) => {
      const next = bufferRef.current.filter((row) => String(row.id) !== String(id));
      if (next.length === bufferRef.current.length) {
        return;
      }
      bufferRef.current = next;
      totalRef.current = Math.max(0, totalRef.current - 1);
      setBuffer(next);
      setTotalItems(totalRef.current);
    };

    // Expose refresh method via ref for real-time updates.
    // step goes through a ref so the handle does not change on every render.
    useImperativeHandle(
      ref,
      () => ({
        refreshData: loadFresh,
        step: (id, direction) => stepRef.current(id, direction),
        removeEntry: (id) => removeEntry(id),
      }),
      [loadFresh]
    );

    // Tell the page whether the open entry has a neighbour in this list.
    useEffect(() => {
      if (!onNeighbors) {
        return;
      }
      const index = readingId
        ? buffer.findIndex((row) => String(row.id) === String(readingId))
        : -1;
      onNeighbors({
        hasPrev: index > 0,
        hasNext: index >= 0 && (index < buffer.length - 1 || buffer.length < totalItems),
      });
    }, [buffer, readingId, totalItems, onNeighbors]);

    // The first time an entry opens, show the page that contains its row.
    // Later page changes are the admin's, so this does not pull them back.
    const revealedRef = useRef(null);
    useEffect(() => {
      if (!readingId) {
        revealedRef.current = null;
        return;
      }
      if (String(revealedRef.current) === String(readingId)) {
        return;
      }
      const index = buffer.findIndex((row) => String(row.id) === String(readingId));
      if (index < 0) {
        return;
      }
      revealedRef.current = readingId;
      setCurrentPage(Math.floor(index / perPage) + 1);
    }, [readingId, buffer, perPage]);

    // A direct link can point past the first loaded batch. Keep fetching
    // until that row is in the list, so it can be highlighted and browsed.
    useEffect(() => {
      if (!readingId || loading || totalItems === 0) {
        return undefined;
      }
      let cancelled = false;
      loadUntilFound({
        readingId,
        getRows: () => bufferRef.current,
        getTotal: () => totalRef.current,
        prefetch: () => prefetchRef.current(),
      }).then(() => {
        if (!cancelled) {
          setBuffer(bufferRef.current.slice());
        }
      });
      return () => {
        cancelled = true;
      };
    }, [readingId, loading, totalItems]);

    useEffect(() => {
      if (!readingId) {
        return;
      }
      const marked = markRowRead(bufferRef.current, readingId);
      if (!marked.changed) {
        return;
      }
      bufferRef.current = marked.rows;
      setBuffer(marked.rows);
      onMarkedRead?.(readingId);
    }, [readingId, onMarkedRead]);

    const inTrash = statusFilter === 'trash';

    // Restore entries from the Trash to their previous status (2.3.1).
    const restoreEntries = async (ids) => {
      setBuffer((prev) => prev.filter((s) => !ids.includes(s.id)));
      setSelectedSubmissions([]);
      try {
        const done = await runBulk(ids, 'untrash');
        notifyBulk(done, ids.length, __('restored', 'subtleforms'));
      } catch (_err) {
        notifyBulk(0, ids.length, '');
      }
    };

    // Deleting moves entries to the Trash; the snackbar offers Undo (2.3.1).
    const trashEntries = async (ids) => {
      setBuffer((prev) => prev.filter((s) => !ids.includes(s.id)));
      setSelectedSubmissions([]);
      try {
        const done = await runBulk(ids, 'trash');
        if (done === ids.length) {
          createSuccessNotice(
            sprintf(
              /* translators: %d: number of entries */
              _n('%d entry moved to the Trash', '%d entries moved to the Trash', done, 'subtleforms'),
              done
            ),
            {
              type: 'snackbar',
              actions: [
                {
                  label: __('Undo', 'subtleforms'),
                  onClick: async () => {
                    await runBulk(ids, 'untrash');
                    loadFresh();
                  },
                },
              ],
            }
          );
        } else {
          notifyBulk(done, ids.length, '');
        }
      } catch (_err) {
        notifyBulk(0, ids.length, '');
      }
    };

    const handleDelete = async (submissionId) => {
      setDeleteModal(null);
      setBuffer((prev) => prev.filter((s) => s.id !== submissionId));

      try {
        await apiClient.delete(`/submissions/${submissionId}?force=1`);
        createSuccessNotice(__('Entry deleted permanently', 'subtleforms'), {
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
        notifyBulk(await runBulk(ids, 'delete'), ids.length, __('deleted permanently', 'subtleforms'));
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

    // Export the selected entries as CSV.
    const handleExportSelected = async (ids) => {
      try {
        const res = await apiClient.post('/submissions/export', { ids });
        if (!downloadCsv(res)) {
          createErrorNotice(res?.message || __('Nothing to export', 'subtleforms'), { type: 'snackbar' });
        }
      } catch (err) {
        createErrorNotice(__('Failed to export submissions', 'subtleforms'), { type: 'snackbar' });
      }
    };

    const getRowClassName = (submission) => {
      const classes = [];
      if (readingId && String(submission.id) === String(readingId)) {
        classes.push('sf-submissions-table__row--reading');
      }
      // Priority: spam/flagged > failed > payment_pending > unread
      if (submission.status === 'spam') classes.push('sf-submissions-table__row--spam');
      else if (submission.status === 'flagged') classes.push('sf-submissions-table__row--flagged');
      else if (submission.status === 'failed' || submission.status === 'payment_failed') classes.push('sf-submissions-table__row--failed');
      else if (submission.status === 'payment_pending') classes.push('sf-submissions-table__row--payment-pending');
      else if (parseInt(submission.is_read, 10) === 0) classes.push('sf-submissions-table__row--unread');
      return classes.join(' ');
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

    // Who sent it: a name answer, else an email answer, else Anonymous.
    // Other answers are never used as the sender (PAY2-06).
    const summarize = (submission) => entrySender(submission.payload);


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
                {(name || email || __('Anonymous', 'subtleforms')).trim().charAt(0).toUpperCase()}
              </span>
              <span className='sf-sub-entry__text'>
                <span className='sf-sub-entry__name'>
                  {name || email || __('Anonymous', 'subtleforms')}
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
          const config = submissionStatus(status);
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
            {submission.status === 'trash' ? (
              <>
                <Button
                  size='compact'
                  icon={<Icon.Undo size={16} />}
                  label={__('Restore', 'subtleforms')}
                  showTooltip
                  className='sf-submissions-table__restore-btn'
                  onClick={(e) => {
                    e.stopPropagation();
                    restoreEntries([submission.id]);
                  }}
                />
                <Button
                  size='compact'
                  isDestructive
                  icon={<Icon.Trash size={16} />}
                  label={__('Delete permanently', 'subtleforms')}
                  showTooltip
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteModal(submission.id);
                  }}
                />
              </>
            ) : (
              <Button
                size='compact'
                isDestructive
                icon={<Icon.Trash size={16} />}
                label={hardDelete ? __('Delete permanently', 'subtleforms') : __('Move to Trash', 'subtleforms')}
                showTooltip
                onClick={(e) => {
                  e.stopPropagation();
                  if (hardDelete) {
                    setDeleteModal(submission.id);
                  } else {
                    trashEntries([submission.id]);
                  }
                }}
              />
            )}
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

    if (error && buffer.length === 0) {
      return (
        <div className='sf-submissions-table__error' role='alert'>
          <Notice status='error' isDismissible={false}>{error}</Notice>
          <Button variant='primary' onClick={loadFresh}>
            {__('Retry', 'subtleforms')}
          </Button>
        </div>
      );
    }

    // Slice the buffer for the current page (client-side pagination)
    const displayedRows = buffer.slice(
      (currentPage - 1) * perPage,
      currentPage * perPage
    );

    return (
      <div className={`sf-submissions-table${
        density === 'comfortable' || density === 'compact' ? ` sf-submissions-table--${density}` : ''
      }`}>
        {error && buffer.length > 0 && (
          <Notice status='error' isDismissible={false}>
            {error}{' '}
            <Button variant='link' onClick={loadFresh}>
              {__('Retry', 'subtleforms')}
            </Button>
          </Notice>
        )}
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
          bulkActions={
            inTrash
              ? [
                  {
                    label: __('Restore', 'subtleforms'),
                    onClick: restoreEntries,
                  },
                  {
                    label: __('Delete permanently', 'subtleforms'),
                    onClick: handleBulkDelete,
                    isDestructive: true,
                  },
                ]
              : [
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
                    label: hardDelete ? __('Delete permanently', 'subtleforms') : __('Move to Trash', 'subtleforms'),
                    onClick: hardDelete ? handleBulkDelete : trashEntries,
                    isDestructive: true,
                  },
                ]
          }
        />
        <ConfirmModal
          isOpen={!!bulkDelete}
          onClose={() => setBulkDelete(null)}
          title={__('Delete entries permanently', 'subtleforms')}
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
          confirmText={__('Delete permanently', 'subtleforms')}
          confirmVariant='destructive'
        />
        <ConfirmModal
          isOpen={!!deleteModal}
          onClose={() => setDeleteModal(null)}
          title={__('Delete entry permanently', 'subtleforms')}
          message={__(
            'Delete this entry permanently? Its uploaded files are deleted too. This cannot be undone.',
            'subtleforms'
          )}
          onConfirm={() => handleDelete(deleteModal)}
          confirmText={__('Delete permanently', 'subtleforms')}
          confirmVariant='destructive'
        />
      </div>
    );
  }
);

export default SubmissionsTable;
