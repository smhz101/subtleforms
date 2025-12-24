import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import { Spinner, Notice, Button, TabPanel } from '@wordpress/components';
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

export default function FormBuilderPage({ formId, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
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
  const [status, setStatus] = useState('saved');
  const [isDirty, setIsDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState(null);
  const [isHydrating, setIsHydrating] = useState(false);
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

  useEffect(() => {
    setCurrentFormId(formId ?? null);
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
    if (!formId) return;
    setLoading(true);
    setIsHydrating(true);
    apiGet(`/forms/${formId}/schema`).then(({ ok, body }) => {
      if (!ok) {
        setError(body?.message || __('Failed to load schema', 'subtleforms'));
        setLoading(false);
        return;
      }
      const rawPayload = body?.schema ?? body ?? {};
      const payload =
        rawPayload && typeof rawPayload === 'object' ? { ...rawPayload } : {};
      // Ensure fields array exists
      payload.fields = Array.isArray(payload.fields) ? payload.fields : [];
      // Ensure metadata.name exists (required by backend validator)
      if (!payload.metadata) payload.metadata = {};
      if (!payload.metadata.name) payload.metadata.name = 'form_schema';

      // Load title from form metadata if available
      const loadedTitle = body?.form?.title || payload.metadata?.title;
      if (loadedTitle) {
        payload.metadata.title = loadedTitle;
      } else if (!payload.metadata.title) {
        payload.metadata.title = generateDefaultTitle();
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
    async ({ auto = false } = {}) => {
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
          createSuccessNotice(__('Form saved', 'subtleforms'), {
            id: SUCCESS_NOTICE_ID,
            isDismissible: true,
            type: 'snackbar',
            actions: [],
          });
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

  useEffect(() => {
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
  }, [isDirty, draftSchema, saving, autoSaving, status, performSave]);

  const shortcode = formId ? `[subtleforms id="${formId}"]` : '';
  const statusLabel = useMemo(() => {
    if (status === 'saving') {
      return __('Saving…', 'subtleforms');
    }

    if (status === 'saved') {
      return __('Saved', 'subtleforms');
    }

    return __('Unsaved changes', 'subtleforms');
  }, [status]);

  const statusDescription = status === 'error' ? autoSaveError : null;

  if (!formId)
    return (
      <Notice status='info'>{__('Select a form first', 'subtleforms')}</Notice>
    );
  if (loading || loadingFields) return <Spinner />;
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      {/* Shortcode Pill */}
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

      {/* Save Status */}
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
                : '#f0b849',
          }}
        />
        {statusLabel}
      </div>

      {/* Manual Save Button */}
      {status !== 'saved' && (
        <Button
          variant='primary'
          onClick={handleSave}
          disabled={saving}
          style={{ height: '36px', padding: '0 16px' }}>
          {saving ? __('Saving…', 'subtleforms') : __('Save', 'subtleforms')}
        </Button>
      )}

      {/* Close Button */}
      <Button
        variant='secondary'
        onClick={onClose}
        style={{ height: '36px', padding: '0 16px' }}>
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
                style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
                <SubmissionsTable
                  formId={currentFormId}
                  showFormColumn={false}
                />
              </div>
            )}
            {tab.name === 'entries' && !currentFormId && (
              <div
                style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
                <Notice status='info'>
                  {__('Save the form first to view entries', 'subtleforms')}
                </Notice>
              </div>
            )}
          </>
        )}
      </TabPanel>
    </AdminShell>
  );
}
