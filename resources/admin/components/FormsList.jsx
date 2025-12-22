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
} from '@wordpress/icons';

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

function FormRow({
  form,
  onEdit,
  onDuplicate,
  onDelete,
  onStatusChange,
  onRefresh,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(form.title);
  const [saving, setSaving] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const inputRef = useRef(null);
  const { createSuccessNotice, createErrorNotice } = useDispatch(noticesStore);

  const shortcode = `[subtleforms id="${form.id}"]`;
  const submissionCount = form.submission_count || 0;
  const unreadCount = form.unread_count || 0;
  const updatedAt = form.updated_at || form.created_at || '';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveTitle = async () => {
    if (!title.trim() || title === form.title) {
      setIsEditing(false);
      setTitle(form.title);
      return;
    }

    setSaving(true);
    const { ok, body } = await apiRequest(`/forms/${form.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: title.trim() }),
    });

    setSaving(false);

    if (ok) {
      setIsEditing(false);
      createSuccessNotice(__('Form renamed', 'subtleforms'), {
        type: 'snackbar',
        isDismissible: true,
      });
      onRefresh();
    } else {
      createErrorNotice(
        body?.message || __('Failed to rename form', 'subtleforms'),
        { type: 'snackbar', isDismissible: true }
      );
      setTitle(form.title);
    }
  };

  const handleCopyShortcode = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shortcode).then(() => {
        setCopyState('copied');
        createSuccessNotice(__('Shortcode copied', 'subtleforms'), {
          type: 'snackbar',
          isDismissible: true,
        });
        setTimeout(() => setCopyState('idle'), 2000);
      });
    }
  };

  const statusBadgeClass =
    {
      draft: 'subtleforms-status-badge subtleforms-status-draft',
      published: 'subtleforms-status-badge subtleforms-status-published',
      archived: 'subtleforms-status-badge subtleforms-status-archived',
    }[form.status] || 'subtleforms-status-badge';

  return (
    <tr>
      <td className='subtleforms-form-title'>
        {isEditing ? (
          <div className='subtleforms-inline-edit'>
            <input
              ref={inputRef}
              type='text'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setTitle(form.title);
                }
              }}
              disabled={saving}
              className='subtleforms-title-input'
            />
          </div>
        ) : (
          <button
            type='button'
            className='subtleforms-title-button'
            onClick={() => setIsEditing(true)}>
            <strong>{form.title}</strong>
          </button>
        )}
      </td>
      <td>
        <span className={statusBadgeClass}>
          {form.status === 'draft' && __('Draft', 'subtleforms')}
          {form.status === 'published' && __('Published', 'subtleforms')}
          {form.status === 'archived' && __('Archived', 'subtleforms')}
        </span>
      </td>
      <td className='subtleforms-shortcode-cell'>
        <button
          type='button'
          className='subtleforms-shortcode-button'
          onClick={handleCopyShortcode}
          title={__('Click to copy', 'subtleforms')}>
          <code>{shortcode}</code>
        </button>
      </td>
      <td className='subtleforms-count-cell'>
        <a
          href={`admin.php?page=subtleforms-submissions&form_id=${form.id}`}
          className='subtleforms-submission-count'
          title={sprintf(
            __('%d unread, %d total entries', 'subtleforms'),
            unreadCount,
            submissionCount
          )}>
          {unreadCount > 0
            ? `${unreadCount}/${submissionCount}`
            : submissionCount}
        </a>
      </td>
      <td className='subtleforms-date-cell'>
        <time>{new Date(updatedAt).toLocaleDateString()}</time>
      </td>
      <td className='subtleforms-actions-cell'>
        <div className='subtleforms-row-actions'>
          <Button
            icon={pencil}
            label={__('Edit', 'subtleforms')}
            onClick={() => onEdit(form.id)}
            isSmall
          />
          <Dropdown
            renderToggle={({ onToggle }) => (
              <Button
                icon={moreVertical}
                label={__('More actions', 'subtleforms')}
                onClick={onToggle}
                isSmall
              />
            )}
            renderContent={({ onClose }) => (
              <MenuGroup>
                <MenuItem
                  icon={published}
                  onClick={() => {
                    onStatusChange(form.id, form.status);
                    onClose();
                  }}>
                  {__('Change status', 'subtleforms')}
                </MenuItem>
                <MenuItem
                  icon={copy}
                  onClick={() => {
                    onDuplicate(form.id);
                    onClose();
                  }}>
                  {__('Duplicate', 'subtleforms')}
                </MenuItem>
                <MenuItem
                  icon={help}
                  onClick={() => {
                    if (window.open) {
                      window.open(
                        `admin.php?page=subtleforms-submissions&form_id=${form.id}`,
                        '_self'
                      );
                    }
                    onClose();
                  }}>
                  {__('View submissions', 'subtleforms')}
                </MenuItem>
                <MenuItem
                  icon={trash}
                  onClick={() => {
                    onDelete(form.id);
                    onClose();
                  }}
                  isDestructive>
                  {__('Delete', 'subtleforms')}
                </MenuItem>
              </MenuGroup>
            )}
          />
        </div>
      </td>
    </tr>
  );
}

export default function FormsList({ onSelect, onEdit, onBuild, searchTerm }) {
  const [forms, setForms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [statusValue, setStatusValue] = useState('draft');
  const { createSuccessNotice, createErrorNotice } = useDispatch(noticesStore);

  // Filter forms based on search term
  const filteredForms = forms.filter((form) => {
    if (!searchTerm) return true;
    return form.title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleEditForm = (formId) => {
    window.location.href = `admin.php?page=subtleforms-new-form&form_id=${formId}`;
  };

  const fetchForms = useCallback(async () => {
    setIsLoading(true);
    try {
      const { ok, body } = await apiRequest('/forms?per_page=100');
      if (ok && Array.isArray(body)) {
        setForms(body);
      }
    } catch (err) {
      createErrorNotice(__('Failed to load forms', 'subtleforms'), {
        type: 'snackbar',
      });
    } finally {
      setIsLoading(false);
    }
  }, [createErrorNotice]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

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

  if (isLoading && forms.length === 0) {
    return (
      <div className='subtleforms-loading'>
        <Spinner />
      </div>
    );
  }

  if (filteredForms.length === 0) {
    return (
      <div className='subtleforms-empty-state'>
        <div className='subtleforms-empty-state__icon'>📝</div>
        <h2>
          {searchTerm
            ? __('No forms found', 'subtleforms')
            : __('No forms yet', 'subtleforms')}
        </h2>
        <p>
          {searchTerm
            ? __('Try adjusting your search terms', 'subtleforms')
            : __('Create your first form to get started', 'subtleforms')}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className='subtleforms-forms-table-wrapper'>
        <table className='subtleforms-admin-table'>
          <thead>
            <tr>
              <th className='subtleforms-col-title'>
                {__('Form Name', 'subtleforms')}
              </th>
              <th className='subtleforms-col-status'>
                {__('Status', 'subtleforms')}
              </th>
              <th className='subtleforms-col-shortcode'>
                {__('Shortcode', 'subtleforms')}
              </th>
              <th className='subtleforms-col-count'>
                {__('Entries', 'subtleforms')}
              </th>
              <th className='subtleforms-col-date'>
                {__('Last Updated', 'subtleforms')}
              </th>
              <th className='subtleforms-col-actions'>
                {__('Actions', 'subtleforms')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredForms.map((form) => (
              <FormRow
                key={form.id}
                form={form}
                onEdit={handleEditForm}
                onDuplicate={handleDuplicate}
                onDelete={(id) => setDeleteModal(id)}
                onStatusChange={(id, currentStatus) => {
                  setStatusModal(id);
                  setStatusValue(currentStatus);
                }}
                onRefresh={fetchForms}
              />
            ))}
          </tbody>
        </table>
      </div>

      {deleteModal && (
        <Modal
          title={__('Delete Form', 'subtleforms')}
          onRequestClose={() => setDeleteModal(null)}
          className='subtleforms-delete-modal'>
          <p>
            {__(
              'Are you sure you want to delete this form? This action cannot be undone.',
              'subtleforms'
            )}
          </p>
          <div className='subtleforms-modal-actions'>
            <Button isSecondary onClick={() => setDeleteModal(null)}>
              {__('Cancel', 'subtleforms')}
            </Button>
            <Button
              isDestructive
              isPrimary
              onClick={() => handleDelete(deleteModal)}>
              {__('Delete', 'subtleforms')}
            </Button>
          </div>
        </Modal>
      )}

      {statusModal && (
        <Modal
          title={__('Change Status', 'subtleforms')}
          onRequestClose={() => setStatusModal(null)}
          className='subtleforms-status-modal'>
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
          <div className='subtleforms-modal-actions'>
            <Button isSecondary onClick={() => setStatusModal(null)}>
              {__('Cancel', 'subtleforms')}
            </Button>
            <Button isPrimary onClick={handleStatusChange}>
              {__('Update', 'subtleforms')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
