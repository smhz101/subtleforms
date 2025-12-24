import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import {
  Spinner,
  Notice,
  Button,
  TabPanel,
  Modal,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';
import AdminShell from '../AdminShell';
import FormEditor from './FormEditor';
import SubmissionsTable from '../SubmissionsTable';

const restBase =
  window.subtleformsAdmin && window.subtleformsAdmin.restUrl
    ? window.subtleformsAdmin.restUrl.replace(/\/$/, '')
    : '/wp-json/subtleforms/v1';
const restNonce =
  window.subtleformsAdmin && window.subtleformsAdmin.restNonce
    ? window.subtleformsAdmin.restNonce
    : null;

async function parseJsonResponse(response) {
  if (!response) {
    return null;
  }

  if (response.status === 204) {
    return null;
  }

  const contentLength = response.headers?.get('Content-Length');
  if (contentLength === '0') {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn('Failed to parse JSON response', err);
    return null;
  }
}

async function apiGet(path) {
  const response = await fetch(restBase + path, {
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': restNonce,
      'Content-Type': 'application/json',
    },
  });

  const body = await parseJsonResponse(response);
  return { ok: response.ok, body };
}

async function apiPost(path, payload) {
  const response = await fetch(restBase + path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': restNonce,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await parseJsonResponse(response);
  return { ok: response.ok, body };
}

async function apiPut(path, payload) {
  const response = await fetch(restBase + path, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': restNonce,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await parseJsonResponse(response);
  return { ok: response.ok, body };
}

async function apiDelete(path) {
  const response = await fetch(restBase + path, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: {
      'X-WP-Nonce': restNonce,
      'Content-Type': 'application/json',
    },
  });

  const body = await parseJsonResponse(response);
  return { ok: response.ok, body };
}

export default function FormBuilderPage({ formId, onClose, onSaved }) {
  const [loading, setLoading] = useState(!!formId);
  const [draftSchema, setDraftSchema] = useState(null);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [fieldGroups, setFieldGroups] = useState({});
  const [fieldDefinitions, setFieldDefinitions] = useState({});
  const [loadingFields, setLoadingFields] = useState(true);
  const [formTitle, setFormTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [currentFormId, setCurrentFormId] = useState(formId ?? null);
  const [formStatus, setFormStatus] = useState('draft');
  const [status, setStatus] = useState('saved');
  const [isDirty, setIsDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState(null);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isEphemeral, setIsEphemeral] = useState(!formId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const titleInputRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const { createSuccessNotice, createErrorNotice, removeNotice } =
    useDispatch(noticesStore);
  const SUCCESS_NOTICE_ID = 'subtleforms-form-save-success';
  const ERROR_NOTICE_ID = 'subtleforms-form-save-error';

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    },
    []
  );

  // Navigation protection
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty && !isEphemeral) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isEphemeral]);

  useEffect(() => {
    setCurrentFormId(formId ?? null);
    setIsEphemeral(!formId);
  }, [formId]);

  function generateDefaultTitle() {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return sprintf(__('Untitled Form %d', 'subtleforms'), suffix);
  }

  // Load field definitions from API
  useEffect(() => {
    apiGet('/fields?grouped=true').then(({ ok, body }) => {
      if (!ok) {
        console.error('Failed to load field definitions');
        setLoadingFields(false);
        return;
      }
      // Transform API response to component format
      const groups = {};
      const definitions = {};
      Object.entries(body).forEach(([category, categoryFields]) => {
        groups[category] = categoryFields.map((field) => {
          definitions[field.type] = field;
          return {
            type: field.type,
            label: field.label,
            icon: field.icon || 'text', // Default to text icon key
            kind: field.kind || 'input',
          };
        });
      });
      setFieldGroups(groups);
      setFieldDefinitions(definitions);
      setLoadingFields(false);
    });
  }, []);

  useEffect(() => {
    if (!formId) {
      // Ephemeral mode: initialize empty schema
      setLoading(false);
      setDraftSchema({
        fields: [],
        metadata: {
          name: 'form_schema',
          title: generateDefaultTitle(),
          description: '',
        },
      });
      setFormTitle(generateDefaultTitle());
      setStatus('saved');
      setIsDirty(false);
      setFormStatus('draft');
      return;
    }

    setLoading(true);
    setIsHydrating(true);

    // Load both schema and form metadata
    Promise.all([
      apiGet(`/forms/${formId}/schema`),
      apiGet(`/forms/${formId}`),
    ]).then(([schemaRes, formRes]) => {
      if (!schemaRes.ok) {
        setError(
          schemaRes.body?.message || __('Failed to load schema', 'subtleforms')
        );
        setLoading(false);
        return;
      }

      const rawPayload = schemaRes.body?.schema ?? schemaRes.body ?? {};
      const payload =
        rawPayload && typeof rawPayload === 'object' ? { ...rawPayload } : {};

      // Ensure fields array exists
      payload.fields = Array.isArray(payload.fields) ? payload.fields : [];

      // Ensure metadata.name exists (required by backend validator)
      if (!payload.metadata) payload.metadata = {};
      if (!payload.metadata.name) payload.metadata.name = 'form_schema';

      // Load title from form metadata if available
      const loadedTitle =
        schemaRes.body?.form?.title || payload.metadata?.title;
      if (loadedTitle) {
        payload.metadata.title = loadedTitle;
      } else if (!payload.metadata.title) {
        payload.metadata.title = generateDefaultTitle();
      }

      // Load form status
      if (formRes.ok && formRes.body) {
        setFormStatus(formRes.body.status || 'draft');
      }

      setDraftSchema(payload);
      setFormTitle(payload.metadata.title || '');
      setStatus('saved');
      setIsDirty(false);
      setAutoSaveError(null);
      setLoading(false);

      // Clear hydrating flag after next render to allow FormEditor to initialize
      setTimeout(() => setIsHydrating(false), 0);
    });
  }, [formId]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (!draftSchema) {
      return;
    }
    const currentTitle = draftSchema.metadata?.title || '';
    if (!isEditingTitle && currentTitle && currentTitle !== formTitle) {
      setFormTitle(currentTitle);
    }
  }, [draftSchema, formTitle, isEditingTitle]);

  const markDirty = useCallback(() => {
    if (isHydrating) {
      return;
    }
    setIsDirty(true);
    setStatus('dirty');
    setAutoSaveError(null);
    setSaveError(null);
  }, [isHydrating]);

  const handleSchemaChange = useCallback(
    (nextSchema) => {
      setDraftSchema(nextSchema);
      markDirty();
    },
    [markDirty]
  );

  function persistTitle(nextTitle) {
    if (!draftSchema) {
      setIsEditingTitle(false);
      return;
    }

    const trimmed = nextTitle.trim() || generateDefaultTitle();
    setFormTitle(trimmed);
    setDraftSchema((current) => {
      if (!current) {
        return current;
      }

      const metadata = {
        ...(current.metadata || {}),
        title: trimmed,
      };

      if (!metadata.name) {
        metadata.name = 'form_schema';
      }

      return {
        ...current,
        metadata,
      };
    });

    markDirty();
    setIsEditingTitle(false);
  }

  function handleCopyShortcode(shortcode) {
    if (!shortcode) {
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shortcode).then(() => {
        setCopyState('copied');
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => setCopyState('idle'), 2000);
      });
    }
  }

  const performSave = useCallback(
    async ({ auto = false, targetStatus = null } = {}) => {
      if (!draftSchema) {
        return;
      }

      if (saving || autoSaving) {
        return;
      }

      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }

      // In ephemeral mode, must create form first (only on manual save)
      if (isEphemeral && !auto) {
        const finalStatus = targetStatus || 'draft';

        if (auto) {
          setAutoSaving(true);
        } else {
          setSaving(true);
          setSaveError(null);
          setAutoSaveError(null);
          removeNotice(ERROR_NOTICE_ID);
        }

        setStatus('saving');

        try {
          // Create new form
          const { ok: createOk, body: createBody } = await apiPost('/forms', {
            title: formTitle || generateDefaultTitle(),
            status: finalStatus,
            schema: draftSchema,
          });

          if (!createOk) {
            throw new Error(
              createBody?.message || __('Failed to create form', 'subtleforms')
            );
          }

          const newFormId = createBody.id;
          setCurrentFormId(newFormId);
          setIsEphemeral(false);
          setFormStatus(finalStatus);
          setIsDirty(false);
          setStatus('saved');
          setSaveError(null);
          setAutoSaveError(null);

          // Update URL to include form_id
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('form_id', newFormId);
          window.history.replaceState({}, '', newUrl.toString());

          const detail = {
            id: newFormId,
            version: null,
          };
          window.dispatchEvent(
            new CustomEvent('subtleforms:form-saved', { detail })
          );
          onSaved?.(detail);

          removeNotice(ERROR_NOTICE_ID);
          createSuccessNotice(
            finalStatus === 'published'
              ? __('Form published', 'subtleforms')
              : __('Form saved as draft', 'subtleforms'),
            {
              id: SUCCESS_NOTICE_ID,
              isDismissible: true,
              type: 'snackbar',
              actions: [],
            }
          );
        } catch (err) {
          const message =
            err?.message || __('Failed to save form', 'subtleforms');
          setStatus('error');
          setIsDirty(true);
          setSaveError(message);
          removeNotice(SUCCESS_NOTICE_ID);
          createErrorNotice(message, {
            id: ERROR_NOTICE_ID,
            isDismissible: true,
            type: 'snackbar',
            actions: [],
          });
        } finally {
          setSaving(false);
        }
        return;
      }

      // Regular save for existing forms
      const resolvedFormId = currentFormId ?? formId;
      if (!resolvedFormId) {
        const message = __('Form identifier missing', 'subtleforms');
        setStatus('error');
        setIsDirty(true);
        if (auto) {
          setAutoSaveError(message);
        } else {
          setSaveError(message);
          removeNotice(SUCCESS_NOTICE_ID);
          createErrorNotice(message, {
            id: ERROR_NOTICE_ID,
            isDismissible: true,
            type: 'snackbar',
          });
        }
        return;
      }

      if (auto) {
        setAutoSaving(true);
      } else {
        setSaving(true);
        setSaveError(null);
        setAutoSaveError(null);
        removeNotice(ERROR_NOTICE_ID);
      }

      setStatus('saving');

      try {
        // Save schema
        const { ok, body } = await apiPost(`/forms/${resolvedFormId}/schema`, {
          schema: draftSchema,
        });

        if (!ok) {
          const message =
            body?.message ||
            body?.data?.message ||
            __('Failed to save form', 'subtleforms');
          throw new Error(message);
        }

        // Update status if specified
        if (targetStatus && targetStatus !== formStatus) {
          const { ok: statusOk } = await apiPut(`/forms/${resolvedFormId}`, {
            status: targetStatus,
          });

          if (statusOk) {
            setFormStatus(targetStatus);
          }
        }

        setCurrentFormId(resolvedFormId);
        setDraftSchema((current) =>
          current
            ? {
                ...current,
                version: body?.version ?? current.version,
              }
            : current
        );
        setIsDirty(false);
        setStatus('saved');
        setSaveError(null);
        setAutoSaveError(null);

        const detail = {
          id: resolvedFormId,
          version: body?.version ?? null,
        };
        window.dispatchEvent(
          new CustomEvent('subtleforms:form-saved', { detail })
        );
        onSaved?.(detail);

        if (!auto) {
          removeNotice(ERROR_NOTICE_ID);
          createSuccessNotice(
            targetStatus === 'published'
              ? __('Form published', 'subtleforms')
              : __('Form saved', 'subtleforms'),
            {
              id: SUCCESS_NOTICE_ID,
              isDismissible: true,
              type: 'snackbar',
              actions: [],
            }
          );
        }
      } catch (err) {
        const message =
          err?.message || __('Failed to save form', 'subtleforms');
        setStatus('error');
        setIsDirty(true);
        if (auto) {
          setAutoSaveError(message);
        } else {
          setSaveError(message);
          removeNotice(SUCCESS_NOTICE_ID);
          createErrorNotice(message, {
            id: ERROR_NOTICE_ID,
            isDismissible: true,
            type: 'snackbar',
            actions: [],
          });
        }
      } finally {
        if (auto) {
          setAutoSaving(false);
        } else {
          setSaving(false);
        }
      }
    },
    [
      draftSchema,
      saving,
      autoSaving,
      currentFormId,
      formId,
      formTitle,
      formStatus,
      isEphemeral,
      removeNotice,
      createErrorNotice,
      createSuccessNotice,
      onSaved,
      SUCCESS_NOTICE_ID,
      ERROR_NOTICE_ID,
    ]
  );

  const handleSave = useCallback(() => {
    performSave({ auto: false });
  }, [performSave]);

  const handleSaveDraft = useCallback(() => {
    performSave({ auto: false, targetStatus: 'draft' });
  }, [performSave]);

  const handlePublish = useCallback(() => {
    if (formStatus === 'draft') {
      setShowPublishConfirm(true);
    } else {
      performSave({ auto: false, targetStatus: 'published' });
    }
  }, [formStatus, performSave]);

  const confirmPublish = useCallback(() => {
    setShowPublishConfirm(false);
    performSave({ auto: false, targetStatus: 'published' });
  }, [performSave]);

  const handleDelete = useCallback(async () => {
    if (!currentFormId) return;

    setShowDeleteConfirm(false);

    try {
      const { ok } = await apiDelete(`/forms/${currentFormId}`);

      if (!ok) {
        throw new Error(__('Failed to delete form', 'subtleforms'));
      }

      // Clear autosave timer
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }

      createSuccessNotice(__('Form deleted', 'subtleforms'), {
        id: SUCCESS_NOTICE_ID,
        isDismissible: true,
        type: 'snackbar',
      });

      // Redirect to forms list
      window.location.href = 'admin.php?page=subtleforms-forms';
    } catch (err) {
      createErrorNotice(
        err?.message || __('Failed to delete form', 'subtleforms'),
        {
          id: ERROR_NOTICE_ID,
          isDismissible: true,
          type: 'snackbar',
        }
      );
    }
  }, [
    currentFormId,
    createSuccessNotice,
    createErrorNotice,
    SUCCESS_NOTICE_ID,
    ERROR_NOTICE_ID,
  ]);

  const handleDiscard = useCallback(() => {
    if (isEphemeral || !isDirty) {
      // Just close if ephemeral or no changes
      window.location.href = 'admin.php?page=subtleforms-forms';
      return;
    }
    setShowDiscardConfirm(true);
  }, [isEphemeral, isDirty]);

  const confirmDiscard = useCallback(() => {
    setShowDiscardConfirm(false);

    // Clear autosave timer
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    // Redirect without saving
    window.location.href = 'admin.php?page=subtleforms-forms';
  }, []);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Autosave effect - ONLY runs if form is NOT ephemeral
  useEffect(() => {
    // Guard: never autosave in ephemeral mode
    if (isEphemeral) {
      return;
    }

    if (!isDirty || !draftSchema || isHydrating) {
      return;
    }

    if (saving || autoSaving || status === 'error') {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      performSave({ auto: true });
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [
    isEphemeral,
    isDirty,
    draftSchema,
    saving,
    autoSaving,
    status,
    performSave,
    isHydrating,
  ]);

  const shortcode = currentFormId ? `[subtleforms id="${currentFormId}"]` : '';
  const statusLabel = useMemo(() => {
    if (autoSaving) return __('Saving...', 'subtleforms');
    if (status === 'saving') return __('Saving…', 'subtleforms');
    if (status === 'saved') return __('Saved', 'subtleforms');
    if (isEphemeral) return __('Not saved yet', 'subtleforms');
    return __('Unsaved changes', 'subtleforms');
  }, [status, autoSaving, isEphemeral]);

  const statusDescription = status === 'error' ? autoSaveError : null;

  if (loadingFields) return <Spinner />;
  if (loading) return <Spinner />;
  if (error) return <Notice status='error'>{error}</Notice>;

  // Construct title with editable inline input
  const titleElement = isEditingTitle ? (
    <input
      ref={titleInputRef}
      type='text'
      value={formTitle}
      onChange={(event) => setFormTitle(event.target.value)}
      onBlur={() => persistTitle(formTitle)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          persistTitle(formTitle);
        }
        if (event.key === 'Escape') {
          setIsEditingTitle(false);
          setFormTitle(draftSchema?.metadata?.title || formTitle);
        }
      }}
      style={{
        fontSize: '16px',
        fontWeight: 600,
        color: '#1e1e1e',
        border: '1px solid #2271b1',
        padding: '4px 8px',
        outline: 'none',
        minWidth: '200px',
        background: '#fff',
      }}
    />
  ) : (
    <button
      type='button'
      onClick={() => setIsEditingTitle(true)}
      style={{
        fontSize: '16px',
        fontWeight: 600,
        color: '#1e1e1e',
        border: 'none',
        background: 'transparent',
        padding: '4px 8px',
        cursor: 'pointer',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = '#2271b1';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = '#1e1e1e';
      }}>
      {formTitle || __('Untitled Form', 'subtleforms')}
    </button>
  );

  // Build actions section with save status, shortcode, and buttons
  const actions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {/* Status Badge */}
      {!isEphemeral && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            borderRadius: '3px',
            background: formStatus === 'published' ? '#00a32a' : '#f0b849',
            color: '#fff',
          }}>
          {formStatus === 'published'
            ? __('Published', 'subtleforms')
            : __('Draft', 'subtleforms')}
        </span>
      )}

      {/* Shortcode Pill - only show for saved forms */}
      {shortcode && (
        <button
          type='button'
          onClick={() => handleCopyShortcode(shortcode)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: 500,
            fontFamily: 'monospace',
            color: copyState === 'copied' ? '#00a32a' : '#50575e',
            background: copyState === 'copied' ? '#f0f6fc' : '#f6f7f7',
            border:
              copyState === 'copied'
                ? '1px solid #00a32a'
                : '1px solid #dcdcde',
            borderRadius: '3px',
            cursor: 'pointer',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            if (copyState !== 'copied') {
              e.currentTarget.style.borderColor = '#2271b1';
            }
          }}
          onMouseLeave={(e) => {
            if (copyState !== 'copied') {
              e.currentTarget.style.borderColor = '#dcdcde';
            }
          }}>
          {copyState === 'copied' ? __('Copied!', 'subtleforms') : shortcode}
        </button>
      )}

      {/* Save Status Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: '#50575e',
        }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background:
              autoSaving || status === 'saving'
                ? '#2271b1'
                : status === 'saved'
                ? '#00a32a'
                : isEphemeral
                ? '#999'
                : '#f0b849',
          }}
        />
        {statusLabel}
      </div>

      {/* Save Draft Button */}
      {(isDirty || isEphemeral) && (
        <Button
          variant='secondary'
          onClick={handleSaveDraft}
          disabled={saving}
          style={{ height: '32px', padding: '0 12px', fontSize: '13px' }}>
          {saving
            ? __('Saving…', 'subtleforms')
            : __('Save Draft', 'subtleforms')}
        </Button>
      )}

      {/* Publish Button */}
      <Button
        variant='primary'
        onClick={handlePublish}
        disabled={saving || (isEphemeral && !isDirty)}
        style={{ height: '32px', padding: '0 12px', fontSize: '13px' }}>
        {formStatus === 'published'
          ? __('Update', 'subtleforms')
          : __('Publish', 'subtleforms')}
      </Button>

      {/* Delete Button - only show for existing forms */}
      {!isEphemeral && (
        <Button
          variant='secondary'
          onClick={() => setShowDeleteConfirm(true)}
          isDestructive
          style={{ height: '32px', padding: '0 12px', fontSize: '13px' }}>
          {__('Delete', 'subtleforms')}
        </Button>
      )}

      {/* Close Button */}
      <Button
        variant='tertiary'
        onClick={handleClose}
        style={{ height: '32px', padding: '0 12px', fontSize: '13px' }}>
        {__('Close', 'subtleforms')}
      </Button>
    </div>
  );

  // Tabs for Build/Entries
  const tabs = (
    <div className='subtleforms-builder-tabs-wrapper'>
      <TabPanel
        className='subtleforms-builder-tabs'
        activeClass='is-active'
        tabs={[
          {
            name: 'build',
            title: __('Build', 'subtleforms'),
          },
          {
            name: 'entries',
            title: __('Entries', 'subtleforms'),
          },
        ]}>
        {(tab) => (
          <div style={{ display: 'none' }}>
            {/* Tabs rendered below in children */}
          </div>
        )}
      </TabPanel>
    </div>
  );

  return (
    <>
      <AdminShell
        title={titleElement}
        actions={actions}
        tabs={tabs}
        noScroll={true}>
        <style>{`
          .subtleforms-builder-tabs-content {
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          .subtleforms-builder-tabs-content > div[role="tabpanel"] {
            flex: 1;
            height: 100%;
            overflow: hidden;
          }
        `}</style>
        {saveError && (
          <div
            style={{
              padding: '12px 24px',
              background: '#fcf3f3',
              borderBottom: '1px solid #f0b849',
              marginBottom: '16px',
            }}>
            <span style={{ color: '#d63638', fontSize: '13px' }}>
              {saveError}
            </span>
          </div>
        )}

        <TabPanel
          className='subtleforms-builder-tabs-content'
          activeClass='is-active'
          tabs={[
            {
              name: 'build',
              title: __('Build', 'subtleforms'),
            },
            {
              name: 'entries',
              title: __('Entries', 'subtleforms'),
            },
          ]}>
          {(tab) => (
            <>
              {tab.name === 'build' && (
                <FormEditor
                  schema={draftSchema}
                  fieldGroups={fieldGroups}
                  fieldDefinitions={fieldDefinitions}
                  onChange={handleSchemaChange}
                />
              )}
              {tab.name === 'entries' && currentFormId && (
                <div
                  style={{
                    padding: '24px',
                    height: '100%',
                    overflowY: 'auto',
                  }}>
                  <SubmissionsTable
                    formId={currentFormId}
                    showFormColumn={false}
                  />
                </div>
              )}
              {tab.name === 'entries' && !currentFormId && (
                <div
                  style={{
                    padding: '24px',
                    height: '100%',
                    overflowY: 'auto',
                  }}>
                  <Notice status='info'>
                    {__('Save the form first to view entries', 'subtleforms')}
                  </Notice>
                </div>
              )}
            </>
          )}
        </TabPanel>
      </AdminShell>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          title={__('Delete Form', 'subtleforms')}
          onRequestClose={() => setShowDeleteConfirm(false)}>
          <p>
            {__(
              'Are you sure you want to delete this form? This action cannot be undone.',
              'subtleforms'
            )}
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <Button variant='primary' isDestructive onClick={handleDelete}>
              {__('Delete', 'subtleforms')}
            </Button>
            <Button
              variant='secondary'
              onClick={() => setShowDeleteConfirm(false)}>
              {__('Cancel', 'subtleforms')}
            </Button>
          </div>
        </Modal>
      )}

      {/* Publish Confirmation Modal */}
      {showPublishConfirm && (
        <Modal
          title={__('Publish Form', 'subtleforms')}
          onRequestClose={() => setShowPublishConfirm(false)}>
          <p>
            {__(
              'Publishing this form will make it visible on the frontend. Are you ready to publish?',
              'subtleforms'
            )}
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <Button variant='primary' onClick={confirmPublish}>
              {__('Publish', 'subtleforms')}
            </Button>
            <Button
              variant='secondary'
              onClick={() => setShowPublishConfirm(false)}>
              {__('Cancel', 'subtleforms')}
            </Button>
          </div>
        </Modal>
      )}

      {/* Discard Changes Confirmation Modal */}
      {showDiscardConfirm && (
        <Modal
          title={__('Unsaved Changes', 'subtleforms')}
          onRequestClose={() => setShowDiscardConfirm(false)}>
          <p>
            {__(
              'You have unsaved changes. Do you want to save before leaving?',
              'subtleforms'
            )}
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <Button variant='primary' onClick={handleSaveDraft}>
              {__('Save Draft', 'subtleforms')}
            </Button>
            <Button variant='secondary' onClick={confirmDiscard} isDestructive>
              {__('Discard Changes', 'subtleforms')}
            </Button>
            <Button
              variant='tertiary'
              onClick={() => setShowDiscardConfirm(false)}>
              {__('Cancel', 'subtleforms')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
