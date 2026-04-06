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
import Icon from './ui/Icon';
import { ContextualTip } from './ui';
import DataTable from './DataTable';
import { ConfirmModal } from '../modals';
import { enrichSchemaWithProMarkers } from '../utils/schemaEnricher';
import { PRO_TEMPLATE_IDS } from '../utils/proFeatureDetector';
import { buildApiUrl } from '../utils/api';
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

const restBase =
  window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
  '/wp-json/subtleforms/v1';
const restNonce = window.subtleformsAdmin?.restNonce || '';

function apiRequest(path, options = {}) {
  return fetch(buildApiUrl(path), {
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': restNonce,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }).then(async (response) => {
    let body = null;
    try {
      const text = await response.text();
      body = text ? JSON.parse(text) : null;
    } catch (err) {
      body = null;
    }
    return { ok: response.ok, status: response.status, body };
  });
}

export default function FormsList({
  onSelect,
  onEdit,
  onBuild,
  searchTerm,
  statusFilter = 'all',
  visibleColumns = DEFAULT_FORM_VISIBLE,
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

    const response = await fetch(buildApiUrl(`/forms?${params}`), {
      credentials: 'same-origin',
      headers: { 'X-WP-Nonce': restNonce },
    });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);

    const data = await response.json();
    const rows = Array.isArray(data.data) ? data.data : [];
    const total =
      data.meta && typeof data.meta.total === 'number'
        ? data.meta.total
        : parseInt(response.headers.get('X-WP-Total') || '0');
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
          {form.submission_count === 0 && (
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
        // form_type is extracted from schema on the server; fall back to metadata.type for
        // any cached/legacy responses, then default to 'regular'.
        const raw = form.form_type || form.metadata?.type || 'regular';
        // Normalize legacy/alias types to canonical values
        const formType =
          raw === 'multistep' || raw === 'sectioned' ? 'multi-step' : raw;
        const typeConfig = {
          regular: {
            classes: 'sf-form-type-badge--regular',
            label: __('Standard', 'subtleforms'),
            icon: Icon.FileText,
          },
          'multi-step': {
            classes: 'sf-form-type-badge--multistep',
            label: __('Multi-step', 'subtleforms'),
            icon: Icon.Layers,
          },
          conversational: {
            classes: 'sf-form-type-badge--conversational',
            label: __('Conversational', 'subtleforms'),
            icon: Icon.MessageCircle,
          },
        };

        const config = typeConfig[formType] || typeConfig.regular;
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
      render: (status) => {
        const statusConfig = {
          draft: {
            classes: 'sf-status-badge--draft',
            label: __('Draft', 'subtleforms'),
            icon: Icon.Edit,
          },
          published: {
            classes: 'sf-status-badge--published',
            label: __('Published', 'subtleforms'),
            icon: Icon.CheckCircle,
          },
          archived: {
            classes: 'sf-status-badge--archived',
            label: __('Archived', 'subtleforms'),
            icon: Icon.Package,
          },
        };

        const config = statusConfig[status] || statusConfig.draft;

        const IconComponent = config.icon;
        return (
          <span className={clsx('sf-status-badge', config.classes)}>
            <IconComponent />
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
            <Icon.Copy />
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
            {hasUnread && <span className='sf-entries-display__pulse'></span>}
            {hasUnread ? (
              <>
                <span className='sf-entries-display__unread'>
                  {unreadCount}
                </span>
                <span className='sf-entries-display__separator'>/</span>
                <span>{submissionCount}</span>
              </>
            ) : (
              <span>{submissionCount}</span>
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
        const date = new Date(updatedAt);
        const now = new Date();
        const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

        let displayText;
        if (diffInHours < 1) displayText = __('Just now', 'subtleforms');
        else if (diffInHours < 24)
          /* translators: %1$d: number of hours ago */
          displayText = sprintf(
            __('%1$d hours ago', 'subtleforms'),
            diffInHours
          );
        else if (diffInHours < 48) displayText = __('Yesterday', 'subtleforms');
        else displayText = date.toLocaleDateString();

        return (
          <time className='sf-form-date' title={date.toLocaleString()}>
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
            <Icon.Edit />
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
                <Icon.MoreVertical />
              </button>
            )}
            renderContent={({ onClose }) => (
              <MenuGroup>
                <MenuItem
                  onClick={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    setStatusModal(form.id);
                    setStatusValue(form.status);
                    onClose();
                  }}>
                  <div className='sf-menu-item'>
                    <Icon.CheckCircle />
                    {__('Change status', 'subtleforms')}
                  </div>
                </MenuItem>
                <MenuItem
                  onClick={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    handleDuplicate(form.id);
                    onClose();
                  }}>
                  <div className='sf-menu-item'>
                    <Icon.Copy />
                    {__('Duplicate', 'subtleforms')}
                  </div>
                </MenuItem>
                <MenuItem
                  onClick={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    window.location.href = `admin.php?page=subtleforms-submissions&form_id=${form.id}`;
                    onClose();
                  }}>
                  <div className='sf-menu-item'>
                    <Icon.Eye />
                    {__('View submissions', 'subtleforms')}
                  </div>
                </MenuItem>
                <MenuItem
                  onClick={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    setDeleteModal(form.id);
                    onClose();
                  }}
                  isDestructive>
                  <div className='sf-menu-item sf-menu-item--danger'>
                    <Icon.Delete />
                    {__('Delete', 'subtleforms')}
                  </div>
                </MenuItem>
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

    const { ok } = await apiRequest(`/forms/${formId}`, { method: 'DELETE' });

    if (ok) {
      createSuccessNotice(__('Form deleted', 'subtleforms'), {
        type: 'snackbar',
      });
    } else {
      createErrorNotice(__('Failed to delete form', 'subtleforms'), {
        type: 'snackbar',
      });
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

    let successCount = 0;
    for (const id of ids) {
      const { ok } = await apiRequest(`/forms/${id}`, { method: 'DELETE' });
      if (ok) successCount++;
    }

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
          {__('💡 Tip: Click on any form row to edit, or use the menu (⋮) for quick actions like duplicate, export, or delete.', 'subtleforms')}
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
          <div className='sf-empty-state'>
            <div className='sf-empty-state__emoji'>📋</div>
            <h3 className='sf-empty-state__title'>
              {searchTerm
                ? __('No forms found', 'subtleforms')
                : __('Create your first form', 'subtleforms')}
            </h3>
            <p className='sf-empty-state__description'>
              {searchTerm
                ? __('Try adjusting your search terms', 'subtleforms')
                : __(
                    'Build beautiful forms with our drag-and-drop builder',
                    'subtleforms'
                  )}
            </p>
            {!searchTerm && (
              <>
                <Button
                  isPrimary
                  onClick={() =>
                    (window.location.href = 'admin.php?page=subtleforms-new-form')
                  }>
                  <Icon.Add />
                  {__('New Form', 'subtleforms')}
                </Button>
                <ContextualTip 
                  id='first-form-tip' 
                  variant='info'
                  dismissible>
                  {__('💡 Start with a template or build from scratch. You can always switch between them.', 'subtleforms')}
                </ContextualTip>
              </>
            )}
          </div>
        }
        onRowClick={(form) => handleEditForm(form.id)}
      />

      <ConfirmModal
        isOpen={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title={__('Delete Form', 'subtleforms')}
        message={(() => {
          const form = buffer.find((f) => f.id === deleteModal);
          const count = form?.submission_count || 0;
          return count > 0
            ? sprintf(
                /* translators: %1$d: number of submissions belonging to this form */
                __(
                  'Are you sure you want to delete this form? It has %1$d submissions which will also be permanently deleted.',
                  'subtleforms'
                ),
                count
              )
            : __(
                'Are you sure you want to delete this form? This action cannot be undone.',
                'subtleforms'
              );
        })()}
        onConfirm={() => handleDelete(deleteModal)}
        confirmText={__('Delete Form', 'subtleforms')}
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
