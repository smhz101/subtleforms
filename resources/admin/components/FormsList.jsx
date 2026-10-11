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
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useDispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import clsx from 'clsx';
import Icon from '../ui/Icon';
import { ContextualTip } from '../ui';
import DataTable from './DataTable';
import { ConfirmModal } from '../modals';
import { enrichSchemaWithProMarkers } from '../utils/schemaEnricher';
import { PRO_TEMPLATE_IDS } from '../utils/proFeatureDetector';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import {
  getFormTypeBadge,
  getFormStatusBadge,
} from '../utils/formMeta';
import { formatRelativeDate, formatDate, isNewForm } from '../utils/formatDate';
import { logger, perfMarkers } from '../diagnostics';
import './FormsList.scss';

export const ALL_FORM_COLUMNS = ['title', 'form_type', 'status', 'id', 'submission_count', 'updated_at', 'actions'];
export const DEFAULT_FORM_VISIBLE = ['title', 'form_type', 'status', 'id', 'submission_count', 'updated_at', 'actions'];
export const FORM_COLUMN_LABELS = {
  title: __('Form Name', 'subtleforms'),
  form_type: __('Type', 'subtleforms'),
  status: __('Status', 'subtleforms'),
  id: __('Shortcode', 'subtleforms'),
  submission_count: __('Entries', 'subtleforms'),
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
    setIsLoading(true);
    setCurrentPage(1);
    try {
      const { rows, total } = await fetchBatch(0);
      setBuffer(rows);
      setPagesLoaded(Math.ceil(rows.length / perPage) || 0);
      setTotalItems(total);
    } catch (err) {
      console.error('FormsList fetch error:', err);
      createErrorNotice(
        err.message || __('Failed to load forms', 'subtleforms'),
        { type: 'snackbar' }
      );
      setBuffer([]);
      setPagesLoaded(0);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
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
  const columns = [
    {
      key: 'title',
      title: __('Form Name', 'subtleforms'),
      sortable: true,
      render: (title, form) => (
        <div className='sf-form-name'>
          <span className='sf-form-name__title'>{title}</span>
          {form.template_id && PRO_TEMPLATE_IDS.includes(form.template_id) && (
            <span className='sf-form-name__pro-badge'>
              {__('Pro', 'subtleforms')}
            </span>
          )}
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
      key: 'updated_at',
      title: __('Last Updated', 'subtleforms'),
      sortable: true,
      render: (updatedAt) => {
        // Relative for the last 48h, then the site's WP date format
        // everywhere (Part B8) — one helper shared with the Dashboard.
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

  const handleDuplicate = async (formId) => {
    const form = buffer.find((f) => f.id === formId);
    if (!form) return;

    setBuffer((prev) => [
      {
        id: `temp-${Date.now()}`,
        title: `${form.title} (Copy)`,
        status: 'draft',
        created_at: new Date().toISOString(),
        _temp: true,
      },
      ...prev,
    ]);

    const { ok, body } = await apiRequest('/forms', {
      method: 'POST',
      body: JSON.stringify({
        title: (() => {
          /* translators: %s: form title */ return sprintf(
            __('%1$s (Copy)', 'subtleforms'),
            form.title
          );
        })(),
        status: 'draft',
      }),
    });

    if (ok && body?.id) {
      const newFormId = body.id;
      const { ok: schemaOk } = await apiRequest(
        `/forms/${formId}/schema?context=builder`
      );

      if (schemaOk) {
        await apiRequest(`/forms/${formId}/schema?context=builder`).then(
          ({ ok: loadOk, body: schemaBody }) => {
            if (loadOk && schemaBody?.schema) {
              // Enrich schema with Pro markers before saving to duplicate
              const enrichedSchema = enrichSchemaWithProMarkers(
                schemaBody.schema
              );
              return apiRequest(`/forms/${newFormId}/schema`, {
                method: 'POST',
                body: JSON.stringify({ schema: enrichedSchema }),
              });
            }
          }
        );
      }

      createSuccessNotice(__('Form duplicated', 'subtleforms'), {
        type: 'snackbar',
      });
      loadFresh();
    } else {
      setBuffer((prev) => prev.filter((f) => !f._temp));
      createErrorNotice(__('Failed to duplicate form', 'subtleforms'), {
        type: 'snackbar',
      });
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

  const handleBulkDelete = async (ids) => {
    if (
      !window.confirm(
        (() => {
          return sprintf(
            /* translators: %1$d: number of forms to delete */
            __('Are you sure you want to delete %1$d forms?', 'subtleforms'),
            ids.length
          );
        })()
      )
    ) {
      return;
    }

    const oldBuffer = [...buffer];
    setBuffer((prev) => prev.filter((f) => !ids.includes(f.id)));
    setSelectedForms([]);

    // In the Trash tab, bulk delete is permanent (force=1). Elsewhere it
    // moves forms to the Trash (move_to_trash=1) (Part B10).
    const inTrash = statusFilter === 'trash';
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
            /* translators: %1$d: number of forms deleted */
            __('%1$d forms deleted', 'subtleforms'),
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
        bulkActions={[
          {
            label: __('Mark as Published', 'subtleforms'),
            onClick: (ids) => handleBulkStatusChange(ids, 'published'),
          },
          {
            label: __('Mark as Draft', 'subtleforms'),
            onClick: (ids) => handleBulkStatusChange(ids, 'draft'),
          },
          {
            label: __('Delete', 'subtleforms'),
            onClick: handleBulkDelete,
            isDestructive: true,
          },
        ]}
        emptyMessage={
          <div className='sf-empty'>
            <span className='sf-empty__icon'>
              {searchTerm ? <Icon.Search size={20} /> : <Icon.FileText size={20} />}
            </span>
            <h3 className='sf-empty__title'>
              {searchTerm
                ? __('No forms match your search', 'subtleforms')
                : __('Create your first form', 'subtleforms')}
            </h3>
            <p className='sf-empty__text'>
              {searchTerm
                ? __('Try a different name, or clear the search.', 'subtleforms')
                : __(
                    'Start from a template or a blank canvas. You can switch layouts any time.',
                    'subtleforms'
                  )}
            </p>
            {!searchTerm && (
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
        }
        onRowClick={(form) => handleEditForm(form.id)}
      />

      <ConfirmModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title={
          (buffer.find((f) => f.id === deleteModal)?.status === 'trash')
            ? __('Delete Form Permanently', 'subtleforms')
            : __('Move Form to Trash', 'subtleforms')
        }
        message={(() => {
          const form = buffer.find((f) => f.id === deleteModal);
          const count = form?.submission_count || 0;
          if (form?.status === 'trash') {
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
          if (form?.status === 'trash') {
            handleDeletePermanently(deleteModal);
          } else {
            handleDelete(deleteModal);
          }
        }}
        confirmText={
          (buffer.find((f) => f.id === deleteModal)?.status === 'trash')
            ? __('Delete Permanently', 'subtleforms')
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
