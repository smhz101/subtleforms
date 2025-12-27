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
import {
  FiFileText,
  FiLayers,
  FiList,
  FiMessageCircle,
  FiCreditCard,
} from 'react-icons/fi';
import AdminShell from '../components/AdminShell';
import FormEditor from '../components/builder/FormEditor';
import FormSettings from '../components/builder/FormSettings';
import SubmissionsTable from '../components/SubmissionsTable';
import BuilderTour from '../components/BuilderTour';
import { ConfirmModal } from '../modals';
import { apiGet, apiPost, apiPut } from '../utils/api';

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
  const [hasUserMutation, setHasUserMutation] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(true);
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

  // Check if tour should be shown
  useEffect(() => {
    const checkTourStatus = async () => {
      try {
        const response = await fetch(
          (window.subtleformsAdmin?.restUrl?.replace(/\/$/, '') ||
            '/wp-json/subtleforms/v1') + '/tour/status',
          {
            credentials: 'same-origin',
            headers: {
              'X-WP-Nonce': window.subtleformsAdmin?.restNonce || '',
            },
          }
        );
        const data = await response.json();
        setTourCompleted(data.completed);
        // Auto-show tour for first-time users
        if (!data.completed && !formId) {
          // Only show for new forms to avoid interrupting existing workflows
          setTimeout(() => setShowTour(true), 1000);
        }
      } catch (error) {
        console.error('Failed to check tour status:', error);
      }
    };

    checkTourStatus();
  }, [formId]);

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
    setHasUserMutation(true); // Track that user made a change
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

      // In ephemeral mode, prevent autosave unless user has made changes
      if (isEphemeral && auto && !hasUserMutation) {
        return;
      }

      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }

      // In ephemeral mode, create form first (only if user has made changes)
      if (isEphemeral && hasUserMutation) {
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
      hasUserMutation,
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
    // For ephemeral forms without user changes, just close
    if (isEphemeral && !hasUserMutation) {
      window.location.href = 'admin.php?page=subtleforms-forms';
      return;
    }

    // For ephemeral forms with changes or saved forms with changes, show confirmation
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      window.location.href = 'admin.php?page=subtleforms-forms';
    }
  }, [isEphemeral, hasUserMutation, isDirty]);

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
    // For ephemeral forms without changes, just close
    if (isEphemeral && !hasUserMutation) {
      onClose();
      return;
    }

    // For forms with changes, show confirmation
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, isEphemeral, hasUserMutation, onClose]);

  // Autosave effect - ONLY runs if form is NOT ephemeral OR if user has made changes
  useEffect(() => {
    // Guard: never autosave in ephemeral mode unless user has made changes
    if (isEphemeral && !hasUserMutation) {
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
    hasUserMutation,
    isDirty,
    draftSchema,
    saving,
    autoSaving,
    status,
    performSave,
    isHydrating,
  ]);

  const handleTourComplete = useCallback(() => {
    setShowTour(false);
    setTourCompleted(true);
  }, []);

  const handleTourSkip = useCallback(() => {
    setShowTour(false);
  }, []);

  const shortcode = currentFormId ? `[subtleforms id="${currentFormId}"]` : '';
  const statusLabel = useMemo(() => {
    if (autoSaving) return __('Saving...', 'subtleforms');
    if (status === 'saving') return __('Saving…', 'subtleforms');
    if (status === 'saved') return __('Saved', 'subtleforms');
    if (isEphemeral && !hasUserMutation)
      return __('No changes yet', 'subtleforms');
    if (isEphemeral) return __('Not saved', 'subtleforms');
    return __('Unsaved changes', 'subtleforms');
  }, [status, autoSaving, isEphemeral, hasUserMutation]);

  const statusDescription = status === 'error' ? autoSaveError : null;

  if (loadingFields) return <Spinner />;
  if (loading) return <Spinner />;
  if (error) return <Notice status='error'>{error}</Notice>;

  // Get form type badge config
  const formType = draftSchema?.metadata?.type || 'regular';
  const formTypeBadgeConfig = {
    regular: {
      icon: FiFileText,
      label: __('Regular', 'subtleforms'),
      color: 'gray',
    },
    multistep: {
      icon: FiLayers,
      label: __('Multi-step', 'subtleforms'),
      color: 'purple',
    },
    sectioned: {
      icon: FiList,
      label: __('Sectioned', 'subtleforms'),
      color: 'indigo',
    },
    conversational: {
      icon: FiMessageCircle,
      label: __('Conversational', 'subtleforms'),
      color: 'blue',
    },
    payment: {
      icon: FiCreditCard,
      label: __('Payment', 'subtleforms'),
      color: 'green',
    },
  };
  const formTypeBadge =
    formTypeBadgeConfig[formType] || formTypeBadgeConfig.regular;
  const FormTypeIcon = formTypeBadge.icon;

  // Construct title with editable inline input
  const titleElement = (
    <div className='flex items-center gap-3' data-tour='header'>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border ${
          formTypeBadge.color === 'gray'
            ? 'bg-gray-50 text-gray-700 border-gray-200'
            : formTypeBadge.color === 'purple'
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : formTypeBadge.color === 'indigo'
            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
            : formTypeBadge.color === 'blue'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-green-50 text-green-700 border-green-200'
        }`}
        style={{ borderRadius: '4px' }}
        title={formTypeBadge.label}>
        <FormTypeIcon className='w-3 h-3' />
        {formTypeBadge.label}
      </span>
      {isEditingTitle ? (
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
          className='bg-white px-2 py-1 border border-blue-600 outline-none min-w-[200px] font-semibold text-gray-900 text-base'
        />
      ) : (
        <button
          type='button'
          onClick={() => setIsEditingTitle(true)}
          className='bg-transparent px-2 py-1 border-none outline-none font-semibold text-gray-900 hover:text-blue-600 text-base cursor-pointer'
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#2271b1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#1e1e1e';
          }}>
          {formTitle || __('Untitled Form', 'subtleforms')}
        </button>
      )}
    </div>
  );

  // Build actions section with save status, shortcode, and buttons
  const actions = (
    <div className='flex items-center gap-3'>
      {/* Status Badge - More prominent */}
      <span
        className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white ${
          isEphemeral
            ? 'bg-gray-400'
            : formStatus === 'published'
            ? 'bg-green-600'
            : 'bg-yellow-500'
        }`}
        style={{ borderRadius: '4px' }}
        title={
          isEphemeral
            ? __('Form not saved yet', 'subtleforms')
            : formStatus === 'published'
            ? __('Form is live and visible to users', 'subtleforms')
            : __('Form is saved but not published', 'subtleforms')
        }>
        {isEphemeral
          ? __('Unsaved', 'subtleforms')
          : formStatus === 'published'
          ? __('Published', 'subtleforms')
          : __('Draft', 'subtleforms')}
      </span>

      {/* Shortcode Pill - only show for saved forms */}
      {shortcode && (
        <button
          type='button'
          onClick={() => handleCopyShortcode(shortcode)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium font-mono cursor-pointer outline-none transition-all ${
            copyState === 'copied'
              ? 'text-green-700 bg-green-50 border border-green-500'
              : 'text-gray-700 bg-gray-50 border border-gray-300 hover:border-blue-500 hover:bg-blue-50'
          }`}
          style={{ borderRadius: '4px' }}
          title={
            copyState === 'copied'
              ? __('Copied to clipboard!', 'subtleforms')
              : __('Click to copy shortcode', 'subtleforms')
          }>
          {copyState === 'copied' ? (
            <>
              <span>✓</span>
              {__('Copied!', 'subtleforms')}
            </>
          ) : (
            shortcode
          )}
        </button>
      )}

      {/* Save Status Indicator */}
      <div
        className='flex items-center gap-2 px-2 py-1 text-xs'
        title={statusDescription || undefined}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background:
              autoSaving || status === 'saving'
                ? '#2271b1'
                : status === 'saved'
                ? '#00a32a'
                : status === 'error'
                ? '#d63638'
                : isEphemeral
                ? '#999'
                : '#f0b849',
            boxShadow:
              autoSaving || status === 'saving'
                ? '0 0 4px rgba(34, 113, 177, 0.5)'
                : 'none',
          }}
        />
        <span
          className={
            status === 'error' ? 'text-red-600 font-medium' : 'text-gray-700'
          }>
          {statusLabel}
        </span>
      </div>

      <div
        style={{
          width: '1px',
          height: '24px',
          background: '#ddd',
          margin: '0 4px',
        }}
      />

      {/* Primary Actions Group */}
      <div className='flex items-center gap-2'>
        {/* Save Draft Button - Always visible for new forms or when dirty */}
        {(isDirty || isEphemeral) && (
          <Button
            variant='secondary'
            onClick={handleSaveDraft}
            disabled={saving || autoSaving}
            className='px-4 h-9 font-medium text-sm'>
            {saving && !formStatus
              ? __('Saving…', 'subtleforms')
              : __('Save Draft', 'subtleforms')}
          </Button>
        )}

        {/* Publish/Update Button - Primary action */}
        <Button
          variant='primary'
          onClick={handlePublish}
          disabled={saving || autoSaving || (isEphemeral && !isDirty)}
          className='px-4 h-9 font-medium text-sm'>
          {formStatus === 'published'
            ? __('Update', 'subtleforms')
            : __('Publish', 'subtleforms')}
        </Button>

        {/* Delete Button - Danger action, only for existing forms */}
        {!isEphemeral && (
          <Button
            variant='secondary'
            onClick={() => setShowDeleteConfirm(true)}
            isDestructive
            className='px-4 h-9 font-medium text-sm'
            title={__('Delete this form permanently', 'subtleforms')}>
            {__('Delete', 'subtleforms')}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <AdminShell title={titleElement} actions={actions} noScroll={true}>
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
          <div className='bg-red-50 mb-4 px-6 py-3 border-yellow-500 border-b'>
            <span className='text-red-600 text-xs'>{saveError}</span>
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
              name: 'settings',
              title: __('Settings', 'subtleforms'),
            },
            {
              name: 'entries',
              title: __('Entries', 'subtleforms'),
              className: 'data-tour-submissions-tab',
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
              {tab.name === 'settings' && (
                <FormSettings
                  schema={draftSchema}
                  onChange={handleSchemaChange}
                />
              )}
              {tab.name === 'entries' && currentFormId && (
                <div className='p-6 h-full overflow-y-auto'>
                  <SubmissionsTable
                    formId={currentFormId}
                    showFormColumn={false}
                  />
                </div>
              )}
              {tab.name === 'entries' && !currentFormId && (
                <div className='p-6 h-full overflow-y-auto'>
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
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={__('Delete Form', 'subtleforms')}
        message={__(
          'Are you sure you want to delete this form? This action cannot be undone.',
          'subtleforms'
        )}
        onConfirm={handleDelete}
        confirmText={__('Delete', 'subtleforms')}
        confirmVariant='destructive'
      />

      {/* Publish Confirmation Modal */}
      <ConfirmModal
        isOpen={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        title={__('Publish Form', 'subtleforms')}
        message={__(
          'Publishing this form will make it visible on the frontend. Are you ready to publish?',
          'subtleforms'
        )}
        onConfirm={confirmPublish}
        confirmText={__('Publish', 'subtleforms')}
        confirmVariant='primary'
      />

      {/* Discard Changes Confirmation Modal */}
      <ConfirmModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title={__('You have unsaved changes', 'subtleforms')}
        message={
          isEphemeral
            ? __(
                'This form has not been saved yet. All changes will be lost if you leave.',
                'subtleforms'
              )
            : __(
                'Your recent edits have not been saved. Would you like to save your changes before leaving, or discard them?',
                'subtleforms'
              )
        }
        onConfirm={handleSaveDraft}
        confirmText={__('Save Draft', 'subtleforms')}
        confirmVariant='primary'
        onSecondary={confirmDiscard}
        secondaryText={__('Discard Changes', 'subtleforms')}
        cancelText={__('Cancel', 'subtleforms')}
      />

      {/* Builder Tour */}
      {showTour && (
        <BuilderTour onComplete={handleTourComplete} onSkip={handleTourSkip} />
      )}
    </>
  );
}
