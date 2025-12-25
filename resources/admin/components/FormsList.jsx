import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
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
import {
  moreVertical,
  pencil,
  trash,
  copy,
  help,
  published,
  plus,
} from '@wordpress/icons';
import DataTable from './DataTable';
import ConfirmModal from './ConfirmModal';

const restBase =
  window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
  '/wp-json/subtleforms/v1';
const restNonce = window.subtleformsAdmin?.restNonce || '';

function apiRequest(path, options = {}) {
  return fetch(restBase + path, {
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
}) {
  const [forms, setForms] = useState([]);
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
    setCurrentPage(1); // Reset to first page
  };

  // Define table columns
  const columns = [
    {
      key: 'title',
      title: __('Form Name', 'subtleforms'),
      sortable: true,
      width: '28%',
      render: (title, form) => (
        <div className='flex items-center gap-2'>
          <span className='font-semibold text-gray-900 group-hover:text-blue-600 text-base transition-colors'>
            {title}
          </span>
          {form.submission_count === 0 && (
            <span className='bg-gray-50 px-1.5 py-0.5 border border-gray-200 text-gray-400 text-xs'>
              {__('New', 'subtleforms')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      title: __('Status', 'subtleforms'),
      sortable: true,
      width: '12%',
      render: (status) => {
        const statusConfig = {
          draft: {
            classes: 'bg-amber-50 text-amber-700 border-amber-200',
            label: __('Draft', 'subtleforms'),
            icon: '📝',
          },
          published: {
            classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            label: __('Published', 'subtleforms'),
            icon: '✓',
          },
          archived: {
            classes: 'bg-gray-50 text-gray-600 border-gray-200',
            label: __('Archived', 'subtleforms'),
            icon: '📦',
          },
        };

        const config = statusConfig[status] || statusConfig.draft;

        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 border text-xs font-medium ${config.classes}`}>
            <span>{config.icon}</span>
            {config.label}
          </span>
        );
      },
    },
    {
      key: 'id',
      title: __('Shortcode', 'subtleforms'),
      width: '20%',
      render: (id, form) => {
        const shortcode = `[subtleforms id="${id}"]`;
        return (
          <button
            type='button'
            className='group flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-xs transition-colors'
            onClick={(e) => {
              e.stopPropagation();
              handleCopyShortcode(shortcode);
            }}
            title={__('Click to copy', 'subtleforms')}>
            <code className='font-mono text-gray-600 group-hover:text-gray-900'>
              {shortcode}
            </code>
            <svg
              className='flex-shrink-0 w-3 h-3 text-gray-400 group-hover:text-gray-600'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
              />
            </svg>
          </button>
        );
      },
    },
    {
      key: 'submission_count',
      title: __('Entries', 'subtleforms'),
      width: '12%',
      render: (submissionCount, form) => {
        const unreadCount = form.unread_count || 0;
        const hasUnread = unreadCount > 0;
        return (
          <a
            href={`admin.php?page=subtleforms-submissions&form_id=${form.id}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 font-medium text-sm transition-colors ${
              hasUnread
                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={(e) => e.stopPropagation()}
            title={sprintf(
              __('%d unread, %d total entries', 'subtleforms'),
              unreadCount,
              submissionCount
            )}>
            {hasUnread && (
              <span className='bg-blue-500 w-2 h-2 animate-pulse'></span>
            )}
            {hasUnread ? (
              <>
                <span className='font-semibold'>{unreadCount}</span>
                <span className='text-gray-400'>/</span>
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
      width: '13%',
      render: (updatedAt) => {
        const date = new Date(updatedAt);
        const now = new Date();
        const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));

        let displayText;
        if (diffInHours < 1) displayText = __('Just now', 'subtleforms');
        else if (diffInHours < 24)
          displayText = sprintf(__('%d hours ago', 'subtleforms'), diffInHours);
        else if (diffInHours < 48) displayText = __('Yesterday', 'subtleforms');
        else displayText = date.toLocaleDateString();

        return (
          <time className='text-gray-600 text-sm' title={date.toLocaleString()}>
            {displayText}
          </time>
        );
      },
    },
    {
      key: 'actions',
      title: __('Actions', 'subtleforms'),
      width: '10%',
      render: (_, form) => (
        <div className='subtleforms-row-actions'>
          <Button
            icon={pencil}
            label={__('Edit', 'subtleforms')}
            onClick={(e) => {
              e.stopPropagation();
              handleEditForm(form.id);
            }}
            isSmall
          />
          <Dropdown
            renderToggle={({ onToggle }) => (
              <Button
                icon={moreVertical}
                label={__('More actions', 'subtleforms')}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                isSmall
              />
            )}
            renderContent={({ onClose }) => (
              <MenuGroup>
                <MenuItem
                  icon={published}
                  onClick={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    setStatusModal(form.id);
                    setStatusValue(form.status);
                    onClose();
                  }}>
                  {__('Change status', 'subtleforms')}
                </MenuItem>
                <MenuItem
                  icon={copy}
                  onClick={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    handleDuplicate(form.id);
                    onClose();
                  }}>
                  {__('Duplicate', 'subtleforms')}
                </MenuItem>
                <MenuItem
                  icon={help}
                  onClick={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    window.location.href = `admin.php?page=subtleforms-submissions&form_id=${form.id}`;
                    onClose();
                  }}>
                  {__('View submissions', 'subtleforms')}
                </MenuItem>
                <MenuItem
                  icon={trash}
                  onClick={(e) => {
                    if (e && e.stopPropagation) e.stopPropagation();
                    setDeleteModal(form.id);
                    onClose();
                  }}
                  isDestructive>
                  {__('Delete', 'subtleforms')}
                </MenuItem>
              </MenuGroup>
            )}
          />
        </div>
      ),
    },
  ];

  const fetchForms = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        per_page: perPage.toString(),
        orderby: sortBy,
        order: sortDirection,
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`${restBase}/forms?${params}`, {
        credentials: 'same-origin',
        headers: {
          'X-WP-Nonce': restNonce,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const total = parseInt(response.headers.get('X-WP-Total') || '0');

        setForms(Array.isArray(data) ? data : []);
        setTotalItems(total);
      } else {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status}`);
      }
    } catch (err) {
      console.error('FormsList fetch error:', err);
      createErrorNotice(
        err.message || __('Failed to load forms', 'subtleforms'),
        { type: 'snackbar' }
      );
      setForms([]);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    currentPage,
    perPage,
    sortBy,
    sortDirection,
    searchTerm,
    statusFilter,
    createErrorNotice,
  ]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  useEffect(() => {
    // Reset to first page when search or status filter changes
    if (searchTerm !== undefined || statusFilter !== undefined) {
      setCurrentPage(1);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const handleFormSaved = () => fetchForms();
    window.addEventListener('subtleforms:form-saved', handleFormSaved);
    return () =>
      window.removeEventListener('subtleforms:form-saved', handleFormSaved);
  }, [fetchForms]);

  const handleDuplicate = async (formId) => {
    const form = forms.find((f) => f.id === formId);
    if (!form) return;

    setForms((prev) => [
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
        title: sprintf(__('%s (Copy)', 'subtleforms'), form.title),
        status: 'draft',
      }),
    });

    if (ok && body?.id) {
      const newFormId = body.id;
      const { ok: schemaOk } = await apiRequest(`/forms/${formId}/schema`);

      if (schemaOk) {
        await apiRequest(`/forms/${formId}/schema`).then(
          ({ ok: loadOk, body: schemaBody }) => {
            if (loadOk && schemaBody?.schema) {
              return apiRequest(`/forms/${newFormId}/schema`, {
                method: 'POST',
                body: JSON.stringify({ schema: schemaBody.schema }),
              });
            }
          }
        );
      }

      createSuccessNotice(__('Form duplicated', 'subtleforms'), {
        type: 'snackbar',
      });
      fetchForms();
    } else {
      setForms((prev) => prev.filter((f) => !f._temp));
      createErrorNotice(__('Failed to duplicate form', 'subtleforms'), {
        type: 'snackbar',
      });
    }
  };

  const handleDelete = async (formId) => {
    setDeleteModal(null);
    setForms((prev) => prev.filter((f) => f.id !== formId));

    const { ok } = await apiRequest(`/forms/${formId}`, { method: 'DELETE' });

    if (ok) {
      createSuccessNotice(__('Form deleted', 'subtleforms'), {
        type: 'snackbar',
      });
    } else {
      createErrorNotice(__('Failed to delete form', 'subtleforms'), {
        type: 'snackbar',
      });
      fetchForms();
    }
  };

  const handleStatusChange = async () => {
    if (!statusModal) return;

    setStatusModal(null);
    const formId = statusModal;
    const oldForms = [...forms];

    setForms((prev) =>
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
      setForms(oldForms);
      createErrorNotice(__('Failed to update status', 'subtleforms'), {
        type: 'snackbar',
      });
    }
  };

  const handleBulkDelete = async (ids) => {
    if (
      !window.confirm(
        sprintf(
          __('Are you sure you want to delete %d forms?', 'subtleforms'),
          ids.length
        )
      )
    ) {
      return;
    }

    const oldForms = [...forms];
    setForms((prev) => prev.filter((f) => !ids.includes(f.id)));
    setSelectedForms([]);

    let successCount = 0;
    for (const id of ids) {
      const { ok } = await apiRequest(`/forms/${id}`, { method: 'DELETE' });
      if (ok) successCount++;
    }

    if (successCount === ids.length) {
      createSuccessNotice(
        sprintf(__('%d forms deleted', 'subtleforms'), successCount),
        { type: 'snackbar' }
      );
    } else {
      createErrorNotice(
        sprintf(
          __('Failed to delete some forms (%d/%d deleted)', 'subtleforms'),
          successCount,
          ids.length
        ),
        { type: 'snackbar' }
      );
      fetchForms(); // Reload to sync state
    }
  };

  const handleBulkStatusChange = async (ids, status) => {
    const oldForms = [...forms];
    setForms((prev) =>
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
        sprintf(__('%d forms updated', 'subtleforms'), successCount),
        { type: 'snackbar' }
      );
    } else {
      createErrorNotice(
        sprintf(
          __('Failed to update some forms (%d/%d updated)', 'subtleforms'),
          successCount,
          ids.length
        ),
        { type: 'snackbar' }
      );
      fetchForms(); // Reload to sync state
    }
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={forms}
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
          <div className='py-12 text-center'>
            <div className='mb-4 text-6xl'>📋</div>
            <h3 className='mb-2 font-semibold text-gray-900 text-lg'>
              {searchTerm
                ? __('No forms found', 'subtleforms')
                : __('Create your first form', 'subtleforms')}
            </h3>
            <p className='mb-6 text-gray-600 text-sm'>
              {searchTerm
                ? __('Try adjusting your search terms', 'subtleforms')
                : __(
                    'Build beautiful forms with our drag-and-drop builder',
                    'subtleforms'
                  )}
            </p>
            {!searchTerm && (
              <Button
                isPrimary
                icon={plus}
                onClick={() =>
                  (window.location.href = 'admin.php?page=subtleforms-new-form')
                }>
                {__('New Form', 'subtleforms')}
              </Button>
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
          const form = forms.find((f) => f.id === deleteModal);
          const count = form?.submission_count || 0;
          return count > 0
            ? sprintf(
                __(
                  'Are you sure you want to delete this form? It has %d submissions which will also be permanently deleted.',
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
            <div className='flex justify-end items-center gap-3 mt-6'>
              <Button
                variant='tertiary'
                onClick={() => setStatusModal(null)}
                className='h-9 px-4 text-sm'>
                {__('Cancel', 'subtleforms')}
              </Button>
              <Button
                variant='primary'
                onClick={handleStatusChange}
                className='h-9 px-4 text-sm'>
                {__('Update', 'subtleforms')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
