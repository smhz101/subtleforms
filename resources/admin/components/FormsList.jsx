import { useState, useEffect, useRef } from '@wordpress/element';
import {
  Spinner,
  Button,
  Dropdown,
  MenuGroup,
  MenuItem,
  Modal,
  TextControl,
  SelectControl,
  Notice,
} from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import clsx from 'clsx';
import Icon from '../ui/Icon';
import { ContextualTip } from '../ui';
import DataTable from './DataTable';
import PerformanceCell from './analytics/PerformanceCell';
import { useAnalyticsSummary } from './analytics/useAnalytics';
import { ConfirmModal, askConfirm } from '../modals';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { deletesPermanently } from '../utils/deleteBehavior';
import { useSettings } from '../data';
import {
  getFormTypeBadge,
  getFormStatusBadge,
} from '../utils/formMeta';
import { formatRelativeDate, formatDate, isNewForm } from '../utils/formatDate';
import { logger, perfMarkers } from '../diagnostics';
import './FormsList.scss';
import { formsEmptyState } from './formsEmptyState';
import { keepRowsAfterFailedLoad, listQueryKey } from '../utils/failedLoad';

export const ALL_FORM_COLUMNS = ['title', 'form_type', 'status', 'id', 'submission_count', 'performance', 'updated_at', 'actions'];
export const DEFAULT_FORM_VISIBLE = ['title', 'form_type', 'status', 'id', 'submission_count', 'performance', 'updated_at', 'actions'];
export const FORM_COLUMN_LABELS = {
  title: __('Form Name', 'subtleforms'),
  form_type: __('Type', 'subtleforms'),
  status: __('Status', 'subtleforms'),
  id: __('Shortcode', 'subtleforms'),
  submission_count: __('Entries', 'subtleforms'),
  performance: __('Conversion (30 days)', 'subtleforms'),
  updated_at: __('Last Updated', 'subtleforms'),
};

/**
 * fetch-style shim over the shared REST helpers.
 *
 * Call sites here pass `{ method, body: JSON.stringify(...) }`, so this
 * translates that to the helper signatures rather than hand-rolling a second
 * transport with its own nonce handling.
 */
function apiRequest(path, options = {}) {
  const { method = 'GET', body } = options;
  const payload = typeof body === 'string' ? JSON.parse(body) : body;

  switch (method.toUpperCase()) {
    case 'POST':
      return apiPost(path, payload);
    case 'PUT':
      return apiPut(path, payload);
    case 'DELETE':
      return apiDelete(path);
    default:
      return apiGet(path);
  }
}

export default function FormsList({
  onSelect,
  onEdit,
  onBuild,
  searchTerm,
  statusFilter = 'all',
  visibleColumns = DEFAULT_FORM_VISIBLE,
  onFormsChanged,
}) {
  // Chunked prefetch: buffer accumulates rows; sliced client-side per page.
  // Each API call fetches CHUNK_PAGES pages at once.
  const CHUNK_PAGES = 5;
  const [buffer, setBuffer] = useState([]);
  const [loadError, setLoadError] = useState('');
  const loadedQueryRef = useRef('');
  const loadGenerationRef = useRef(0);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [deleteModal, setDeleteModal] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [statusValue, setStatusValue] = useState('draft');
  const [selectedForms, setSelectedForms] = useState([]);
  const isPrefetchingRef = useRef(false);
  const { createSuccessNotice, createErrorNotice } = useDispatch(noticesStore);
  const { data: siteSettings } = useSettings();
  const hardDelete = siteSettings?.delete_behavior === 'hard';

  const handleCopyShortcode = (shortcode) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(shortcode)
        .then(() => {
          createSuccessNotice(
            __('Shortcode copied to clipboard', 'subtleforms'),
            {
              type: 'snackbar',
              isDismissible: true,
            }
          );
        })
        .catch(() => {
          createErrorNotice(__('Failed to copy shortcode', 'subtleforms'), {
            type: 'snackbar',
            isDismissible: true,
          });
        });
    }
  };

  const handleEditForm = (formId) => {
    window.location.href = `admin.php?page=subtleforms-new-form&form_id=${formId}`;
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

  const buildFilterParams = () => {
    const params = new URLSearchParams({
      orderby: sortBy,
      order: sortDirection,
    });
    if (searchTerm) params.append('search', searchTerm);
    if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
    return params;
  };

  // Fetch one batch: batchIndex 0 → rows 1..(CHUNK_PAGES*perPage), index 1 → next batch, etc.
  const fetchBatch = async (batchIndex) => {
    const batchSize = perPage * CHUNK_PAGES;
    const params = buildFilterParams();
    params.set('page', (batchIndex + 1).toString());
    params.set('per_page', batchSize.toString());

    const { ok, status, body, headers } = await apiGet(`/forms?${params}`);
    if (!ok) throw new Error(`API request failed: ${status}`);

    const data = body || {};
    const rows = Array.isArray(data.data) ? data.data : [];
    const total =
      data.meta && typeof data.meta.total === 'number'
        ? data.meta.total
        : parseInt(headers?.get('X-WP-Total') || '0');
    return { rows, total };
  };

  // Full reset + reload from page 1 (fresh filters/sort)
  const loadFresh = async () => {
    const requestQuery = listQueryKey([statusFilter, searchTerm, sortBy, sortDirection, perPage]);
    const generation = ++loadGenerationRef.current;
    setIsLoading(true);
    setCurrentPage(1);
    try {
      const { rows, total } = await fetchBatch(0);
      if (generation !== loadGenerationRef.current) return;
      loadedQueryRef.current = requestQuery;
      setLoadError('');
      setBuffer(rows);
      setPagesLoaded(Math.ceil(rows.length / perPage) || 0);
      setTotalItems(total);
    } catch (err) {
      if (generation !== loadGenerationRef.current) return;
      console.error('FormsList fetch error:', err);
      // Keep rows only for the same tab, search, and sort. A failed switch
      // to Trash must not leave the Published forms on screen.
      setLoadError(__('Forms could not be loaded.', 'subtleforms'));
      if (!keepRowsAfterFailedLoad(loadedQueryRef.current, requestQuery)) {
        setBuffer([]);
        setPagesLoaded(0);
        setTotalItems(0);
      }
    } finally {
      if (generation === loadGenerationRef.current) setIsLoading(false);
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
      console.warn('SubtleForms: forms prefetch failed', err);
    } finally {
      isPrefetchingRef.current = false;
    }
  };

  // Fresh load on any filter, sort, or perPage change
  useEffect(() => {
    loadFresh();
  }, [statusFilter, searchTerm, sortBy, sortDirection, perPage]);

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

  // Define table columns
  // Views, submissions and conversion per form (2.1).
  const analytics = useAnalyticsSummary(30);
  const formStats = analytics.data?.forms || {};

  const columns = [
    {
      key: 'title',
      title: __('Form Name', 'subtleforms'),
      sortable: true,
      render: (title, form) => (
        <div className='sf-form-name'>
          <span className='sf-form-name__title'>{title}</span>
          {isNewForm(form) && (
            <span className='sf-form-name__new-badge'>
              {__('New', 'subtleforms')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'form_type',
      title: __('Type', 'subtleforms'),
      render: (_, form) => {
        const config = getFormTypeBadge(form);
        const IconComponent = config.icon;

        return (
          <span className={clsx('sf-form-type-badge', config.classes)}>
            <IconComponent />
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'status',
      title: __('Status', 'subtleforms'),
      sortable: true,
      render: (status, form) => {
        const config = getFormStatusBadge(form);
        const IconComponent = config.icon;

        void IconComponent;
        return (
          <span className={clsx('sf-status-badge', config.classes)}>
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'id',
      title: __('Shortcode', 'subtleforms'),
      render: (id, form) => {
        const shortcode = `[subtleforms id="${id}"]`;
        return (
          <button
            type='button'
            className='sf-shortcode-btn'
            onClick={(e) => {
              e.stopPropagation();
              handleCopyShortcode(shortcode);
            }}
            title={__('Click to copy', 'subtleforms')}>
            <code>{shortcode}</code>
            <Icon.Copy size={13} />
          </button>
        );
      },
    },
    {
      key: 'submission_count',
      title: __('Entries', 'subtleforms'),
      render: (submissionCount, form) => {
        const unreadCount = form.unread_count || 0;
        const hasUnread = unreadCount > 0;
        return (
          <a
            href={`admin.php?page=subtleforms-submissions&form_id=${form.id}`}
            className={clsx('sf-entries-display', {
              'sf-entries-display--unread': hasUnread,
              'sf-entries-display--read': !hasUnread,
            })}
            onClick={(e) => e.stopPropagation()}
            title={(() => {
              return sprintf(
                /* translators: %1$d: unread count, %2$d: total submissions */
                __('%1$d unread, %2$d total entries', 'subtleforms'),
                unreadCount,
                submissionCount
              );
            })()}>
            <span className='sf-entries-display__total'>{submissionCount}</span>
            {hasUnread && (
              <span className='sf-entries-display__new'>
                {sprintf(
                  /* translators: %d: number of unread entries */
                  __('%d new', 'subtleforms'),
                  unreadCount
                )}
              </span>
            )}
          </a>
        );
      },
    },
    {
      key: 'performance',
      title: __('Conversion (30 days)', 'subtleforms'),
      render: (_value, form) => (
        <PerformanceCell
          stats={formStats[form.id] || formStats[String(form.id)]}
          loading={analytics.isLoading}
        />
      ),
    },
    {
      key: 'updated_at',
      title: __('Last Updated', 'subtleforms'),
      sortable: true,
      render: (updatedAt) => {
        // Relative for the last 48h, then the site's WP date format
        // everywhere (Part B8), one helper shared with the Dashboard.
        const displayText = formatRelativeDate(updatedAt);
        const absolute = formatDate(updatedAt);
        return (
          <time className='sf-form-date' title={absolute}>
            {displayText}
          </time>
        );
      },
    },
    {
      key: 'actions',
      title: null,
      render: (_, form) => (
        <div className='subtleforms-row-actions'>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditForm(form.id);
            }}
            className='sf-row-action-btn'
            title={__('Edit', 'subtleforms')}>
            <Icon.Edit size={16} />
          </button>
          <Dropdown
            renderToggle={({ onToggle }) => (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className='sf-row-action-btn'
                title={__('More actions', 'subtleforms')}>
                <Icon.MoreVertical size={16} />
              </button>
            )}
            renderContent={({ onClose }) => (
              <MenuGroup>
                {form.status === 'trash' ? (
                  <>
                    <MenuItem
                      icon={<Icon.CheckCircle size={16} />}
                      onClick={(e) => {
                        if (e && e.stopPropagation) e.stopPropagation();
                        handleRestore(form.id);
                        onClose();
                      }}>
                      {__('Restore', 'subtleforms')}
                    </MenuItem>
                    <MenuItem
                      icon={<Icon.Delete size={16} />}
                      onClick={(e) => {
                        if (e && e.stopPropagation) e.stopPropagation();
                        setDeleteModal(form.id);
                        onClose();
                      }}
                      isDestructive>
                      {__('Delete permanently', 'subtleforms')}
                    </MenuItem>
                  </>
                ) : (
                  <>
                    <MenuItem
                      icon={<Icon.CheckCircle size={16} />}
                      onClick={(e) => {
                        if (e && e.stopPropagation) e.stopPropagation();
                        setStatusModal(form.id);
                        setStatusValue(form.status);
                        onClose();
                      }}>
                      {__('Change status', 'subtleforms')}
                    </MenuItem>
                    <MenuItem
                      icon={<Icon.Copy size={16} />}
                      onClick={(e) => {
                        if (e && e.stopPropagation) e.stopPropagation();
                        handleDuplicate(form.id);
                        onClose();
                      }}>
                      {__('Duplicate', 'subtleforms')}
                    </MenuItem>
                    <MenuItem
                      icon={<Icon.Eye size={16} />}
                      onClick={(e) => {
                        if (e && e.stopPropagation) e.stopPropagation();
                        window.location.href = `admin.php?page=subtleforms-submissions&form_id=${form.id}`;
                        onClose();
                      }}>
                      {__('View submissions', 'subtleforms')}
                    </MenuItem>
                    <MenuItem
                      icon={<Icon.Delete size={16} />}
                      onClick={(e) => {
                        if (e && e.stopPropagation) e.stopPropagation();
                        setDeleteModal(form.id);
                        onClose();
                      }}
                      isDestructive>
                      {__('Move to Trash', 'subtleforms')}
                    </MenuItem>
                  </>
                )}
              </MenuGroup>
            )}
          />
        </div>
      ),
    },
  ];

  useEffect(() => {
    const handleFormSaved = () => loadFresh();
    window.addEventListener('subtleforms:form-saved', handleFormSaved);
    return () =>
      window.removeEventListener('subtleforms:form-saved', handleFormSaved);
  }, []);

  // Duplicate on the server in one request (QA-12): the copy is a draft
  // with a new ID and no entries; a failure shows the real reason and
  // leaves no half-made copy behind.
  const handleDuplicate = async (formId) => {
    const form = buffer.find((f) => f.id === formId);
    if (!form) return;

    const tempId = `temp-${Date.now()}`;
    setBuffer((prev) => [
      {
        id: tempId,
        title: sprintf(
          /* translators: %s: form title */
          __('%s (copy)', 'subtleforms'),
          form.title
        ),
        status: 'draft',
        created_at: new Date().toISOString(),
        _temp: true,
      },
      ...prev,
    ]);

    const { ok, body } = await apiPost(`/forms/${formId}/duplicate`, {});
    const newId = body?.id ?? body?.data?.id;

    if (ok && newId) {
      createSuccessNotice(__('Form duplicated', 'subtleforms'), {
        type: 'snackbar',
      });
      onFormsChanged?.();
      loadFresh();
    } else {
      setBuffer((prev) => prev.filter((f) => f.id !== tempId));
      const reason = body?.error?.message || body?.message || '';
      createErrorNotice(
        reason
          ? sprintf(
              /* translators: %s: reason the copy failed */
              __('Failed to duplicate form: %s', 'subtleforms'),
              reason
            )
          : __('Failed to duplicate form. Please try again.', 'subtleforms'),
        { type: 'snackbar', explicitDismiss: true }
      );
    }
  };

  const handleDelete = async (formId) => {
    setDeleteModal(null);
    setBuffer((prev) => prev.filter((f) => f.id !== formId));

    // Move to Trash (soft delete) so the form can be restored or permanently
    // deleted from the Trash tab (Part B10).
    const { ok } = await apiRequest(`/forms/${formId}?move_to_trash=1`, {
      method: 'DELETE',
    });

    if (ok) {
      createSuccessNotice(__('Form moved to Trash', 'subtleforms'), {
        type: 'snackbar',
      });
      onFormsChanged?.();
    } else {
      createErrorNotice(__('Failed to delete form', 'subtleforms'), {
        type: 'snackbar',
      });
      loadFresh();
    }
  };

  const handleRestore = async (formId) => {
    setBuffer((prev) => prev.filter((f) => f.id !== formId));
    const { ok } = await apiPost(`/forms/${formId}/restore`);
    if (ok) {
      createSuccessNotice(__('Form restored from Trash', 'subtleforms'), {
        type: 'snackbar',
      });
      onFormsChanged?.();
    } else {
      createErrorNotice(__('Failed to restore form', 'subtleforms'), {
        type: 'snackbar',
      });
      loadFresh();
    }
  };

  const handleDeletePermanently = async (formId) => {
    setDeleteModal(null);
    setBuffer((prev) => prev.filter((f) => f.id !== formId));
    const { ok } = await apiRequest(`/forms/${formId}?force=1`, {
      method: 'DELETE',
    });
    if (ok) {
      createSuccessNotice(__('Form permanently deleted', 'subtleforms'), {
        type: 'snackbar',
      });
      onFormsChanged?.();
    } else {
      createErrorNotice(
        __('Failed to permanently delete form', 'subtleforms'),
        { type: 'snackbar' }
      );
      loadFresh();
    }
  };

  const handleStatusChange = async () => {
    if (!statusModal) return;

    setStatusModal(null);
    const formId = statusModal;
    const oldBuffer = [...buffer];

    setBuffer((prev) =>
      prev.map((f) => (f.id === formId ? { ...f, status: statusValue } : f))
    );

    const { ok } = await apiRequest(`/forms/${formId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: statusValue }),
    });

    if (ok) {
      createSuccessNotice(__('Status updated', 'subtleforms'), {
        type: 'snackbar',
      });
    } else {
      setBuffer(oldBuffer);
      createErrorNotice(__('Failed to update status', 'subtleforms'), {
        type: 'snackbar',
      });
    }
  };

  // Restore several trashed forms, each to the status it had (QA-11).
  const handleBulkRestore = async (ids) => {
    setBuffer((prev) => prev.filter((f) => !ids.includes(f.id)));
    setSelectedForms([]);
    let successCount = 0;
    for (const id of ids) {
      const { ok } = await apiPost(`/forms/${id}/restore`);
      if (ok) successCount++;
    }
    onFormsChanged?.();
    if (successCount === ids.length) {
      createSuccessNotice(
        sprintf(
          /* translators: %d: number of forms */
          _n('%d form restored', '%d forms restored', successCount, 'subtleforms'),
          successCount
        ),
        { type: 'snackbar' }
      );
    } else {
      createErrorNotice(
        sprintf(
          /* translators: 1: restored, 2: selected */
          __('Some forms could not be restored (%1$d of %2$d restored).', 'subtleforms'),
          successCount,
          ids.length
        ),
        { type: 'snackbar' }
      );
      loadFresh();
    }
  };

  const handleBulkDelete = async (ids) => {
    const permanent = deletesPermanently(hardDelete ? 'hard' : 'soft', statusFilter === 'trash');
    const message = permanent
      ? sprintf(
          /* translators: %d: number of forms */
          _n(
            'Delete %d form permanently? Its entries are deleted too. This cannot be undone.',
            'Delete %d forms permanently? Their entries are deleted too. This cannot be undone.',
            ids.length,
            'subtleforms'
          ),
          ids.length
        )
      : sprintf(
          /* translators: %d: number of forms */
          _n(
            'Move %d form to the Trash? You can restore it from the Trash tab.',
            'Move %d forms to the Trash? You can restore them from the Trash tab.',
            ids.length,
            'subtleforms'
          ),
          ids.length
        );
    const ok = await askConfirm({
      title: permanent
        ? __('Delete forms permanently', 'subtleforms')
        : __('Move forms to Trash', 'subtleforms'),
      message,
      confirmText: permanent
        ? __('Delete permanently', 'subtleforms')
        : __('Move to Trash', 'subtleforms'),
      confirmVariant: 'destructive',
    });
    if (!ok) {
      return;
    }

    const oldBuffer = [...buffer];
    setBuffer((prev) => prev.filter((f) => !ids.includes(f.id)));
    setSelectedForms([]);

    // In the Trash tab, bulk delete is permanent (force=1). Elsewhere it
    // moves forms to the Trash (move_to_trash=1) (Part B10).
    const inTrash = permanent;
    const query = inTrash ? '?force=1' : '?move_to_trash=1';

    let successCount = 0;
    for (const id of ids) {
      const { ok } = await apiRequest(`/forms/${id}${query}`, {
        method: 'DELETE',
      });
      if (ok) successCount++;
    }

    onFormsChanged?.();

    if (successCount === ids.length) {
      createSuccessNotice(
        (() => {
          return sprintf(
            /* translators: %1$d: number of forms */
            inTrash
              ? _n('%1$d form permanently deleted', '%1$d forms permanently deleted', successCount, 'subtleforms')
              : _n('%1$d form moved to the Trash', '%1$d forms moved to the Trash', successCount, 'subtleforms'),
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
              'Failed to delete some forms (%1$d/%2$d deleted)',
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

  const handleBulkStatusChange = async (ids, status) => {
    const oldBuffer = [...buffer];
    setBuffer((prev) =>
      prev.map((f) => (ids.includes(f.id) ? { ...f, status } : f))
    );
    setSelectedForms([]);

    let successCount = 0;
    for (const id of ids) {
      const { ok } = await apiRequest(`/forms/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      if (ok) successCount++;
    }

    if (successCount === ids.length) {
      createSuccessNotice(
        (() => {
          /* translators: %1$d: number of forms updated */ return sprintf(
            __('%1$d forms updated', 'subtleforms'),
            successCount
          );
        })(),
        { type: 'snackbar' }
      );
    } else {
      createErrorNotice(
        (() => {
          return sprintf(
            /* translators: %1$d: number updated, %2$d: total requested */
            __(
              'Failed to update some forms (%1$d/%2$d updated)',
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

  // Filter allColumns to visible columns (always show actions)
  const allColumns = columns;
  const displayColumns = allColumns.filter(
    (col) => col.key === 'actions' || visibleColumns.includes(col.key)
  );

  // Slice the buffer for the current page (client-side pagination)
  const displayedRows = buffer.slice(
    (currentPage - 1) * perPage,
    currentPage * perPage
  );

  const emptyState = formsEmptyState(searchTerm, statusFilter);

  return (
    <div className='sf-forms-list'>
      {buffer.length > 0 && buffer.length <= 3 && (
        <ContextualTip 
          id='forms-list-shortcuts' 
          variant='info'
          dismissible>
          {__('Tip: click any row to open the builder, or use the ⋮ menu to duplicate, export or delete.', 'subtleforms')}
        </ContextualTip>
      )}
      
      {loadError && buffer.length > 0 && (
        <Notice status='error' isDismissible={false}>
          {loadError}{' '}
          <Button variant='link' onClick={loadFresh}>
            {__('Retry', 'subtleforms')}
          </Button>
        </Notice>
      )}
      <DataTable
        columns={displayColumns}
        data={displayedRows}
        totalItems={totalItems}
        currentPage={currentPage}
        perPage={perPage}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={handleSort}
        onPageChange={handlePageChange}
        onPerPageChange={handlePerPageChange}
        loading={isLoading}
        selectable={true}
        selectedItems={selectedForms}
        onSelectionChange={setSelectedForms}
        bulkActions={
          statusFilter === 'trash'
            ? [
                {
                  label: __('Restore', 'subtleforms'),
                  onClick: handleBulkRestore,
                },
                {
                  label: __('Delete permanently', 'subtleforms'),
                  onClick: handleBulkDelete,
                  isDestructive: true,
                },
              ]
            : [
                {
                  label: __('Mark as Published', 'subtleforms'),
                  onClick: (ids) => handleBulkStatusChange(ids, 'published'),
                },
                {
                  label: __('Mark as Draft', 'subtleforms'),
                  onClick: (ids) => handleBulkStatusChange(ids, 'draft'),
                },
                {
                  label: __('Move to Trash', 'subtleforms'),
                  onClick: handleBulkDelete,
                  isDestructive: true,
                },
              ]
        }
        emptyMessage={
          loadError && buffer.length === 0 ? (
            <div className='sf-empty' role='alert'>
              <h3 className='sf-empty__title'>{__('Forms could not be loaded.', 'subtleforms')}</h3>
              <p className='sf-empty__text'>{__('Check your connection, then try again.', 'subtleforms')}</p>
              <div className='sf-empty__actions'>
                <Button variant='primary' onClick={loadFresh}>
                  {__('Retry', 'subtleforms')}
                </Button>
              </div>
            </div>
          ) : (
          <div className='sf-empty'>
            <span className='sf-empty__icon'>
              {searchTerm ? <Icon.Search size={20} /> : <Icon.FileText size={20} />}
            </span>
            <h3 className='sf-empty__title'>{emptyState.title}</h3>
            <p className='sf-empty__text'>{emptyState.text}</p>
            {emptyState.showCreate && (
              <div className='sf-empty__actions'>
                <Button
                  variant='primary'
                  icon={<Icon.Plus size={16} />}
                  onClick={() =>
                    (window.location.href = 'admin.php?page=subtleforms-new-form')
                  }>
                  {__('New form', 'subtleforms')}
                </Button>
              </div>
            )}
          </div>
          )
        }
        onRowClick={(form) => handleEditForm(form.id)}
      />

      <ConfirmModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title={
          deletesPermanently(hardDelete ? 'hard' : 'soft', buffer.find((f) => f.id === deleteModal)?.status === 'trash')
            ? __('Delete form permanently', 'subtleforms')
            : __('Move Form to Trash', 'subtleforms')
        }
        message={(() => {
          const form = buffer.find((f) => f.id === deleteModal);
          const count = form?.submission_count || 0;
          if (deletesPermanently(hardDelete ? 'hard' : 'soft', form?.status === 'trash')) {
            return count > 0
              ? sprintf(
                  /* translators: %1$d: number of submissions belonging to this form */
                  __(
                    'Are you sure you want to permanently delete this form? It has %1$d submissions which will also be permanently deleted. This action cannot be undone.',
                    'subtleforms'
                  ),
                  count
                )
              : __(
                  'Are you sure you want to permanently delete this form? This action cannot be undone.',
                  'subtleforms'
                );
          }
          return count > 0
            ? sprintf(
                /* translators: %1$d: number of submissions belonging to this form */
                __(
                  'Move this form to the Trash? It has %1$d submissions, which will be kept with the form and can be restored.',
                  'subtleforms'
                ),
                count
              )
            : __(
                'Move this form to the Trash? You can restore it or delete it permanently from the Trash tab.',
                'subtleforms'
              );
        })()}
        onConfirm={() => {
          const form = buffer.find((f) => f.id === deleteModal);
          if (deletesPermanently(hardDelete ? 'hard' : 'soft', form?.status === 'trash')) {
            handleDeletePermanently(deleteModal);
          } else {
            handleDelete(deleteModal);
          }
        }}
        confirmText={
          deletesPermanently(hardDelete ? 'hard' : 'soft', buffer.find((f) => f.id === deleteModal)?.status === 'trash')
            ? __('Delete permanently', 'subtleforms')
            : __('Move to Trash', 'subtleforms')
        }
        confirmVariant='destructive'
      />

      {statusModal && (
        <Modal
          title={__('Change Status', 'subtleforms')}
          onRequestClose={() => setStatusModal(null)}
          className='subtleforms-status-modal'>
          <div className='subtleforms-admin'>
            <SelectControl
              label={__('Status', 'subtleforms')}
              value={statusValue}
              onChange={setStatusValue}
              options={[
                { label: __('Draft', 'subtleforms'), value: 'draft' },
                { label: __('Published', 'subtleforms'), value: 'published' },
                { label: __('Archived', 'subtleforms'), value: 'archived' },
              ]}
            />
            <div className='sf-modal-actions'>
              <Button variant='tertiary' onClick={() => setStatusModal(null)}>
                {__('Cancel', 'subtleforms')}
              </Button>
              <Button variant='primary' onClick={handleStatusChange}>
                {__('Update', 'subtleforms')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
