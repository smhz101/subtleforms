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
import Icon from '../components/ui/Icon';
import AdminShell from '../components/AdminShell';
import FormEditor from '../components/builder/FormEditor';
import FormSettings from '../components/builder/FormSettings';
import SubmissionsTable from '../components/SubmissionsTable';
import BuilderTour from '../components/BuilderTour';
import FormPreviewModal from '../components/FormPreviewModal';
import HelpMenu from '../components/HelpMenu';
import CreateFormWizard from '../components/CreateFormWizard';
import { ConfirmModal } from '../modals';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';
import { createInitialSchema } from '../utils/initialSchema';
import useBuilderReducer, {
  BUILDER_ACTIONS,
  BUILDER_STATES,
} from '../hooks/useBuilderReducer';
import useDraftAutosave from '../hooks/useDraftAutosave';

function FormBuilderInner({
  formId,
  onClose,
  onSaved,
  bootstrap = null,
  onOpenWizard,
  showWizard = false,
  autoShowTour = false,
}) {
  // Builder FSM State (replaces individual useState calls)
  const [builderState, dispatch] = useBuilderReducer(formId);

  // Extract commonly used state for convenience
  const {
    state: fsmState,
    loading,
    draftSchema,
    isDirty,
    saving,
    autoSaving,
    formStatus,
    error,
    saveError,
    autoSaveError,
    validationErrors,
    formTitle: stateFormTitle,
    formId: stateFormId,
    lastSaveTime,
    lastAutoSaveTime,
    schemaHistoryPast,
    schemaHistoryFuture,
  } = builderState;

  const hasValidationErrors =
    Array.isArray(validationErrors) && validationErrors.length > 0;

  const canUndo =
    Array.isArray(schemaHistoryPast) && schemaHistoryPast.length > 0;
  const canRedo =
    Array.isArray(schemaHistoryFuture) && schemaHistoryFuture.length > 0;

  // UI-specific state (not part of FSM)
  const [fieldGroups, setFieldGroups] = useState({});
  const [fieldDefinitions, setFieldDefinitions] = useState({});
  const [loadingFields, setLoadingFields] = useState(true);
  const [formTitle, setFormTitle] = useState(stateFormTitle || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [currentFormId, setCurrentFormId] = useState(
    stateFormId || formId || null
  );
  const [isHydrating, setIsHydrating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const titleInputRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  const { createSuccessNotice, createErrorNotice, removeNotice } =
    useDispatch(noticesStore);
  const SUCCESS_NOTICE_ID = 'subtleforms-form-save-success';
  const ERROR_NOTICE_ID = 'subtleforms-form-save-error';

  // Legacy status mapping for UI components
  const status = useMemo(() => {
    switch (fsmState) {
      case BUILDER_STATES.AUTOSAVING:
      case BUILDER_STATES.PUBLISHING:
        return 'saving';
      case BUILDER_STATES.SAVED:
      case BUILDER_STATES.PUBLISHED:
        return 'saved';
      case BUILDER_STATES.DIRTY:
        return 'dirty';
      case BUILDER_STATES.ERROR:
        return 'error';
      default:
        return 'saved';
    }
  }, [fsmState]);

  const effectiveStatus = useMemo(() => {
    // Task 5.6: Keep FSM stable, but still surface recoverable errors.
    if (autoSaveError || saveError) {
      return 'error';
    }
    return status;
  }, [autoSaveError, saveError, status]);

  // Autosave hook - handles automatic draft saving
  const { forceAutosave } = useDraftAutosave({
    builderState,
    dispatch,
    formId: currentFormId,
    enabled: !isHydrating, // Don't autosave during hydration
  });

  const lastManualSaveRef = useRef({ targetStatus: null });

  const dismissRecoverableErrors = useCallback(() => {
    dispatch({ type: BUILDER_ACTIONS.DISMISS_ERROR });
  }, [dispatch]);

  const retryAutosave = useCallback(() => {
    if (typeof forceAutosave === 'function') {
      forceAutosave();
    }
  }, [forceAutosave]);

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
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

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
        // Auto-show tour once per user when caller opts in (e.g. first-run/new form)
        if (autoShowTour && !data.completed) {
          setTimeout(() => setShowTour(true), 1000);
        }
      } catch (error) {
        console.error('Failed to check tour status:', error);
      }
    };

    checkTourStatus();
  }, [autoShowTour, formId]);

  useEffect(() => {
    if (!formId) {
      return;
    }

    if (bootstrap?.form?.id === formId && bootstrap?.schema) {
      const payload = { ...bootstrap.schema };
      payload.fields = Array.isArray(payload.fields) ? payload.fields : [];
      payload.schema_version = payload.schema_version || 1;
      if (!payload.metadata) payload.metadata = {};
      if (!payload.metadata.name) payload.metadata.name = 'form_schema';

      const title =
        bootstrap.form?.title ||
        payload.metadata?.title ||
        generateDefaultTitle();
      payload.metadata.title = title;

      setFormTitle(title || '');
      setCurrentFormId(formId);
      setIsHydrating(true);

      dispatch({
        type: BUILDER_ACTIONS.LOAD_SUCCESS,
        payload: {
          form: {
            id: formId,
            title,
            status: bootstrap.form?.status || 'draft',
          },
          schema: payload,
        },
      });

      setTimeout(() => setIsHydrating(false), 0);
      return;
    }

    dispatch({ type: BUILDER_ACTIONS.INIT_BUILDER, payload: { formId } });
    setIsHydrating(true);

    // Load both schema and form metadata
    Promise.all([
      apiGet(`/forms/${formId}/schema?context=builder`),
      apiGet(`/forms/${formId}`),
    ]).then(([schemaRes, formRes]) => {
      if (!schemaRes.ok) {
        dispatch({
          type: BUILDER_ACTIONS.AUTOSAVE_ERROR,
          payload: {
            error:
              schemaRes.body?.message ||
              __('Failed to load schema', 'subtleforms'),
          },
        });
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

      setFormTitle(payload.metadata.title || '');
      setCurrentFormId(formId);

      dispatch({
        type: BUILDER_ACTIONS.LOAD_SUCCESS,
        payload: {
          form: {
            id: formId,
            title: payload.metadata.title,
            status:
              formRes.ok && formRes.body
                ? formRes.body.status || 'draft'
                : 'draft',
          },
          schema: payload,
        },
      });

      // Clear hydrating flag after next render to allow FormEditor to initialize
      setTimeout(() => setIsHydrating(false), 0);
    });
  }, [formId, bootstrap]);

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

  useEffect(() => {
    function isTypingTarget(target) {
      if (!target) {
        return false;
      }

      const tagName = target.tagName ? target.tagName.toLowerCase() : '';
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select'
      ) {
        return true;
      }

      if (target.isContentEditable) {
        return true;
      }

      return false;
    }

    function onKeyDown(event) {
      if (event.defaultPrevented) {
        return;
      }

      if (isHydrating || saving || autoSaving) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const key = String(event.key || '').toLowerCase();
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier) {
        return;
      }

      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo =
        (key === 'z' && event.shiftKey) ||
        (key === 'y' && event.ctrlKey && !event.metaKey);

      if (isUndo && canUndo) {
        event.preventDefault();
        dispatch({ type: BUILDER_ACTIONS.UNDO_SCHEMA });
      }

      if (isRedo && canRedo) {
        event.preventDefault();
        dispatch({ type: BUILDER_ACTIONS.REDO_SCHEMA });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [autoSaving, canRedo, canUndo, dispatch, isHydrating, saving]);

  const markDirty = useCallback(() => {
    if (isHydrating) {
      return;
    }
    dispatch({
      type: BUILDER_ACTIONS.EDIT_SCHEMA,
      payload: { schema: draftSchema },
    });
  }, [isHydrating, draftSchema, dispatch]);

  const handleSchemaChange = useCallback(
    (nextSchema) => {
      if (isHydrating) {
        return;
      }
      dispatch({
        type: BUILDER_ACTIONS.EDIT_SCHEMA,
        payload: { schema: nextSchema },
      });
    },
    [dispatch, isHydrating]
  );

  function persistTitle(nextTitle) {
    if (!draftSchema) {
      setIsEditingTitle(false);
      return;
    }

    const trimmed = nextTitle.trim() || generateDefaultTitle();
    setFormTitle(trimmed);

    const metadata = {
      ...(draftSchema.metadata || {}),
      title: trimmed,
    };

    if (!metadata.name) {
      metadata.name = 'form_schema';
    }

    const updatedSchema = {
      ...draftSchema,
      metadata,
    };

    dispatch({
      type: BUILDER_ACTIONS.EDIT_SCHEMA,
      payload: { schema: updatedSchema },
    });

    setIsEditingTitle(false);

    // Update both the schema (via autosave) and the form title (via direct API call)
    const updateTitleAsync = async () => {
      try {
        // Update form title at the top level
        if (currentFormId) {
          await apiPut(`/forms/${currentFormId}`, {
            title: trimmed,
          });
        }

        // Force autosave to persist the schema title change
        if (typeof forceAutosave === 'function') {
          forceAutosave();
        }
      } catch (error) {
        console.error('Failed to update form title:', error);
        // Still attempt autosave even if form title update fails
        if (typeof forceAutosave === 'function') {
          forceAutosave();
        }
      }
    };

    // Small delay to ensure the schema update is processed first
    setTimeout(updateTitleAsync, 100);
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

      // Save to existing form (no ephemeral mode)
      const resolvedFormId = currentFormId ?? formId;
      if (!resolvedFormId) {
        const message = __('Form identifier missing', 'subtleforms');

        dispatch({
          type: auto
            ? BUILDER_ACTIONS.AUTOSAVE_ERROR
            : BUILDER_ACTIONS.PUBLISH_ERROR,
          payload: { error: message },
        });

        if (!auto) {
          removeNotice(SUCCESS_NOTICE_ID);
          createErrorNotice(message, {
            id: ERROR_NOTICE_ID,
            isDismissible: true,
            type: 'snackbar',
          });
        }
        return;
      }

      // Dispatch start actions
      if (auto) {
        dispatch({ type: BUILDER_ACTIONS.START_AUTOSAVE });
      } else if (targetStatus === 'published') {
        dispatch({ type: BUILDER_ACTIONS.START_PUBLISH });
      }

      if (!auto) {
        lastManualSaveRef.current = { targetStatus };
      }

      try {
        // Save schema (activate only on manual save or publish, not autosave)
        const {
          ok,
          body,
          status: saveStatus,
        } = await apiPost(`/forms/${resolvedFormId}/schema`, {
          schema: draftSchema,
          activate: auto ? false : true, // Autosave: draft only, Manual save: activate
        });

        if (!ok) {
          const maybeValidationErrors =
            saveStatus === 422
              ? body?.data?.errors || body?.errors || null
              : null;

          if (
            !auto &&
            Array.isArray(maybeValidationErrors) &&
            maybeValidationErrors.length > 0
          ) {
            dispatch({
              type: BUILDER_ACTIONS.PUBLISH_ERROR,
              payload: {
                error: __(
                  'Fix validation errors before publishing.',
                  'subtleforms'
                ),
                validationErrors: maybeValidationErrors,
              },
            });

            removeNotice(SUCCESS_NOTICE_ID);
            createErrorNotice(
              __(
                'Validation failed. Please fix the highlighted fields.',
                'subtleforms'
              ),
              {
                id: ERROR_NOTICE_ID,
                isDismissible: true,
                type: 'snackbar',
                actions: [],
              }
            );
            return;
          }

          const message =
            body?.message ||
            body?.data?.message ||
            __('Failed to save form', 'subtleforms');
          throw new Error(message);
        }

        // Update status if specified
        if (targetStatus && targetStatus !== formStatus) {
          const {
            ok: statusOk,
            body: statusBody,
            status: statusCode,
          } = await apiPut(`/forms/${resolvedFormId}`, {
            status: targetStatus,
          });

          if (!statusOk) {
            const maybeValidationErrors =
              statusCode === 422
                ? statusBody?.data?.errors || statusBody?.errors || null
                : null;

            if (
              targetStatus === 'published' &&
              Array.isArray(maybeValidationErrors) &&
              maybeValidationErrors.length > 0
            ) {
              dispatch({
                type: BUILDER_ACTIONS.PUBLISH_ERROR,
                payload: {
                  error: __(
                    'Fix validation errors before publishing.',
                    'subtleforms'
                  ),
                  validationErrors: maybeValidationErrors,
                },
              });

              removeNotice(SUCCESS_NOTICE_ID);
              createErrorNotice(
                __(
                  'Validation failed. Please fix the highlighted fields.',
                  'subtleforms'
                ),
                {
                  id: ERROR_NOTICE_ID,
                  isDismissible: true,
                  type: 'snackbar',
                  actions: [],
                }
              );
              return;
            }

            // Handle other publish errors
            const errorMessage =
              statusBody?.message ||
              __('Failed to update form status', 'subtleforms');
            throw new Error(errorMessage);
          }
        }

        setCurrentFormId(resolvedFormId);

        // Dispatch success actions
        if (targetStatus === 'published') {
          dispatch({ type: BUILDER_ACTIONS.PUBLISH_SUCCESS });
        } else if (auto) {
          // Check if still dirty (user edited during autosave)
          dispatch({
            type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
            payload: { stillDirty: false }, // TODO: track concurrent edits
          });
        } else {
          dispatch({
            type: BUILDER_ACTIONS.AUTOSAVE_SUCCESS,
            payload: { stillDirty: false },
          });
        }

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

        dispatch({
          type: auto
            ? BUILDER_ACTIONS.AUTOSAVE_ERROR
            : BUILDER_ACTIONS.PUBLISH_ERROR,
          payload: { error: message },
        });

        if (!auto) {
          removeNotice(SUCCESS_NOTICE_ID);
          createErrorNotice(message, {
            id: ERROR_NOTICE_ID,
            isDismissible: true,
            type: 'snackbar',
            actions: [],
          });
        }
      }
    },
    [
      draftSchema,
      saving,
      autoSaving,
      currentFormId,
      formId,
      formStatus,
      dispatch,
      removeNotice,
      createSuccessNotice,
      createErrorNotice,
      onSaved,
    ]
  );

  const retryLastManualSave = useCallback(() => {
    performSave({
      auto: false,
      targetStatus: lastManualSaveRef.current.targetStatus,
    });
  }, [performSave]);

  const handleSave = useCallback(() => {
    performSave({ auto: false });
  }, [performSave]);

  const handleSaveDraft = useCallback(() => {
    performSave({ auto: false, targetStatus: 'draft' });
  }, [performSave]);

  const handlePublish = useCallback(() => {
    if (hasValidationErrors) {
      removeNotice(SUCCESS_NOTICE_ID);
      createErrorNotice(
        __('Fix validation errors before publishing.', 'subtleforms'),
        {
          id: ERROR_NOTICE_ID,
          isDismissible: true,
          type: 'snackbar',
          actions: [],
        }
      );
      return;
    }

    if (formStatus === 'draft') {
      setShowPublishConfirm(true);
    } else {
      performSave({ auto: false, targetStatus: 'published' });
    }
  }, [
    createErrorNotice,
    formStatus,
    hasValidationErrors,
    performSave,
    removeNotice,
  ]);

  const confirmPublish = useCallback(() => {
    setShowPublishConfirm(false);
    performSave({ auto: false, targetStatus: 'published' });
  }, [performSave]);

  const handleSaveAndClose = useCallback(async () => {
    if (!isDirty) {
      // No changes, just close
      window.location.href = 'admin.php?page=subtleforms-forms';
      return;
    }

    // Save first, then redirect on success
    try {
      await performSave({ auto: false });
      // Redirect after successful save
      setTimeout(() => {
        window.location.href = 'admin.php?page=subtleforms-forms';
      }, 300);
    } catch (err) {
      // Error already handled in performSave
    }
  }, [isDirty, performSave]);

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

  const handleDiscard = useCallback(async () => {
    // If no changes made, delete the draft form and navigate away
    if (!isDirty && currentFormId) {
      try {
        await apiDelete(`/forms/${currentFormId}`);
      } catch (err) {
        console.error('Failed to delete draft form:', err);
      }
      window.location.href = 'admin.php?page=subtleforms-forms';
      return;
    }

    // If changes were made, show confirmation
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      window.location.href = 'admin.php?page=subtleforms-forms';
    }
  }, [isDirty, currentFormId]);

  const confirmDiscard = useCallback(async () => {
    setShowDiscardConfirm(false);

    // Clear autosave timer
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    // Delete the draft form if it was never saved with edits
    if (currentFormId && !isDirty) {
      try {
        await apiDelete(`/forms/${currentFormId}`);
      } catch (err) {
        console.error('Failed to delete draft form:', err);
      }
    }

    // Redirect without saving
    window.location.href = 'admin.php?page=subtleforms-forms';
  }, [currentFormId, isDirty]);

  const handleClose = useCallback(() => {
    // For forms with changes, show confirmation
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

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
    if (effectiveStatus === 'saving') return __('Saving…', 'subtleforms');
    if (effectiveStatus === 'saved') return __('Saved', 'subtleforms');
    return __('Unsaved changes', 'subtleforms');
  }, [effectiveStatus, autoSaving]);

  const statusDescription = useMemo(() => {
    if (effectiveStatus === 'error') {
      return autoSaveError || saveError || null;
    }

    const lastTime = lastSaveTime || lastAutoSaveTime;
    if (!lastTime) {
      return null;
    }

    const time = new Date(lastTime).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (autoSaving || effectiveStatus === 'saving') {
      return sprintf(__('Saving… (last saved at %s)', 'subtleforms'), time);
    }

    if (effectiveStatus === 'saved') {
      return sprintf(__('Last saved at %s', 'subtleforms'), time);
    }

    return null;
  }, [
    autoSaveError,
    autoSaving,
    effectiveStatus,
    lastAutoSaveTime,
    lastSaveTime,
    saveError,
  ]);

  if (loadingFields) return <Spinner />;
  if (loading) return <Spinner />;
  if (error) return <Notice status='error'>{error}</Notice>;

  // Get form type badge config
  const formType = draftSchema?.metadata?.type || 'regular';
  const formTypeBadgeConfig = {
    regular: {
      icon: Icon.FileText,
      label: __('Regular', 'subtleforms'),
      color: 'gray',
    },
    multistep: {
      icon: Icon.Layers,
      label: __('Multi-step', 'subtleforms'),
      color: 'purple',
    },
    sectioned: {
      icon: Icon.List,
      label: __('Sectioned', 'subtleforms'),
      color: 'indigo',
    },
    conversational: {
      icon: Icon.MessageCircle,
      label: __('Conversational', 'subtleforms'),
      color: 'blue',
    },
    payment: {
      icon: Icon.CreditCard,
      label: __('Payment', 'subtleforms'),
      color: 'green',
    },
  };
  const formTypeBadge =
    formTypeBadgeConfig[formType] || formTypeBadgeConfig.regular;
  const FormTypeIcon = formTypeBadge.icon;

  // Construct title with editable inline input
  const titleElement = (
    <div className='sf-flex sf-items-center sf-gap-3' data-tour='header'>
      <span
        className={`sf-inline-flex sf-items-center sf-gap-1.5 sf-px-2.5 sf-py-1 sf-text-xs sf-font-medium sf-border ${
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
        <FormTypeIcon className='sf-w-3 sf-h-3' />
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
          className='sf-bg-white sf-px-2 sf-py-1 sf-border sf-border-blue-600 sf-outline-none sf-min-w-[200px] sf-font-semibold sf-text-gray-900 sf-text-base'
        />
      ) : (
        <button
          type='button'
          onClick={() => setIsEditingTitle(true)}
          className='sf-bg-transparent sf-px-2 sf-py-1 sf-border-none sf-outline-none sf-font-semibold sf-text-gray-900 hover:sf-text-blue-600 sf-text-base sf-cursor-pointer'
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
    <div className='sf-flex sf-items-center sf-gap-3'>
      {/* Status Badge - More prominent */}
      <span
        data-tour='status-badge'
        className={`sf-inline-flex sf-items-center sf-px-3 sf-py-1.5 sf-text-xs sf-font-semibold sf-uppercase sf-tracking-wide sf-text-white ${
          formStatus === 'published' ? 'bg-green-600' : 'bg-yellow-500'
        }`}
        style={{ borderRadius: '4px' }}
        title={
          formStatus === 'published'
            ? __('Form is live and visible to users', 'subtleforms')
            : __('Form is saved but not published', 'subtleforms')
        }>
        {formStatus === 'published'
          ? __('Published', 'subtleforms')
          : __('Draft', 'subtleforms')}
      </span>

      {/* Shortcode Pill - only show for saved forms */}
      {shortcode && (
        <button
          type='button'
          onClick={() => handleCopyShortcode(shortcode)}
          className={`sf-inline-flex sf-items-center sf-gap-1.5 sf-px-3 sf-py-1.5 sf-text-xs sf-font-medium sf-font-mono sf-cursor-pointer sf-outline-none sf-transition-all ${
            copyState === 'copied'
              ? 'text-green-700 bg-green-50 border border-green-500'
              : 'sf-text-gray-700 sf-bg-gray-50 sf-border sf-border-gray-300 hover:sf-border-blue-500 hover:sf-bg-blue-50'
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
        className='sf-flex sf-items-center sf-gap-2 sf-px-2 sf-py-1 sf-text-xs'
        title={statusDescription || undefined}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background:
              autoSaving || effectiveStatus === 'saving'
                ? '#2271b1'
                : effectiveStatus === 'saved'
                ? '#00a32a'
                : effectiveStatus === 'error'
                ? '#d63638'
                : '#f0b849',
            boxShadow:
              autoSaving || effectiveStatus === 'saving'
                ? '0 0 4px rgba(34, 113, 177, 0.5)'
                : 'none',
          }}
        />
        <span
          className={
            effectiveStatus === 'error'
              ? 'text-red-600 font-medium'
              : 'text-gray-700'
          }>
          {statusLabel}
        </span>
      </div>

      {(autoSaveError || saveError) && (
        <div className='sf-flex sf-items-center sf-gap-1'>
          {autoSaveError && (
            <Button
              variant='secondary'
              isSmall
              onClick={retryAutosave}
              className='sf-h-7'>
              {__('Retry autosave', 'subtleforms')}
            </Button>
          )}
          {saveError && (
            <Button
              variant='secondary'
              isSmall
              onClick={retryLastManualSave}
              className='sf-h-7'>
              {__('Retry save', 'subtleforms')}
            </Button>
          )}
          <Button
            variant='tertiary'
            isSmall
            onClick={dismissRecoverableErrors}
            className='sf-h-7'>
            {__('Dismiss', 'subtleforms')}
          </Button>
        </div>
      )}

      <div
        style={{
          width: '1px',
          height: '24px',
          background: '#ddd',
          margin: '0 4px',
        }}
      />

      {/* Primary Actions Group */}
      <div className='sf-flex sf-items-center sf-gap-2'>
        <Button
          variant='tertiary'
          onClick={() => dispatch({ type: BUILDER_ACTIONS.UNDO_SCHEMA })}
          disabled={!canUndo || saving || autoSaving}
          className='sf-px-3 sf-h-9 sf-font-medium sf-text-sm'
          title={__('Undo (Ctrl/Cmd+Z)', 'subtleforms')}>
          <Icon.Undo className='sf-mr-2 sf-w-4 sf-h-4' />
          {__('Undo', 'subtleforms')}
        </Button>

        <Button
          variant='tertiary'
          onClick={() => dispatch({ type: BUILDER_ACTIONS.REDO_SCHEMA })}
          disabled={!canRedo || saving || autoSaving}
          className='sf-px-3 sf-h-9 sf-font-medium sf-text-sm'
          title={__('Redo (Shift+Ctrl/Cmd+Z)', 'subtleforms')}>
          <Icon.Redo className='sf-mr-2 sf-w-4 sf-h-4' />
          {__('Redo', 'subtleforms')}
        </Button>

        {/* Help Menu */}
        <HelpMenu
          onStartTour={() => setShowTour(true)}
          onOpenWizard={onOpenWizard}
          showWizard={showWizard}
        />
        {/* Preview Button */}
        {/* TASK 5.4: Preview uses draftSchema from builder state (not active) */}
        <Button
          variant='secondary'
          onClick={() => {
            dispatch({ type: BUILDER_ACTIONS.OPEN_PREVIEW });
            setShowPreview(true);
          }}
          disabled={!draftSchema || draftSchema.fields?.length === 0}
          className='sf-px-4 sf-h-9 sf-font-medium sf-text-sm'>
          {__('Preview', 'subtleforms')}
        </Button>
        {/* Save Draft Button - Always visible when dirty */}
        {isDirty && (
          <Button
            variant='secondary'
            onClick={handleSaveDraft}
            disabled={saving || autoSaving}
            className='sf-px-4 sf-h-9 sf-font-medium sf-text-sm'>
            {saving && !formStatus
              ? __('Saving…', 'subtleforms')
              : __('Save Draft', 'subtleforms')}
          </Button>
        )}
        {/* Publish/Update Button - Primary action */}
        <Button
          variant='primary'
          data-tour='publish-button'
          onClick={handlePublish}
          disabled={saving || autoSaving || hasValidationErrors}
          className='sf-px-4 sf-h-9 sf-font-medium sf-text-sm'>
          {formStatus === 'published'
            ? __('Update', 'subtleforms')
            : __('Publish', 'subtleforms')}
        </Button>

        {/* Save & Close Button - Quick action */}
        <Button
          variant='secondary'
          onClick={handleSaveAndClose}
          disabled={saving || autoSaving}
          className='sf-px-4 sf-h-9 sf-font-medium sf-text-sm'
          title={__('Save changes and return to forms list', 'subtleforms')}>
          {__('Save & Close', 'subtleforms')}
        </Button>

        {/* Delete Button - Danger action */}
        <Button
          variant='secondary'
          onClick={() => setShowDeleteConfirm(true)}
          isDestructive
          className='sf-px-4 sf-h-9 sf-font-medium sf-text-sm'
          title={__('Delete this form permanently', 'subtleforms')}>
          {__('Delete', 'subtleforms')}
        </Button>
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
          <div className='sf-bg-red-50 sf-mb-4 sf-px-6 sf-py-3 sf-border-yellow-500 sf-border-b'>
            <span className='sf-text-red-600 sf-text-xs'>{saveError}</span>
          </div>
        )}

        {hasValidationErrors && (
          <div className='sf-mb-4 sf-px-6'>
            <Notice status='warning' isDismissible={false}>
              <p className='sf-m-0 sf-text-sm'>
                {__(
                  'Validation issues detected. Publishing is blocked until these are fixed:',
                  'subtleforms'
                )}
              </p>
              <ul className='sf-m-0 sf-mt-2 sf-pl-5 sf-text-sm'>
                {validationErrors.slice(0, 6).map((err, idx) => (
                  <li key={idx}>
                    {err?.message || __('Validation error', 'subtleforms')}
                  </li>
                ))}
                {validationErrors.length > 6 && (
                  <li>
                    {sprintf(
                      __('…and %d more', 'subtleforms'),
                      validationErrors.length - 6
                    )}
                  </li>
                )}
              </ul>
            </Notice>
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
                  validationErrors={validationErrors}
                  onChange={handleSchemaChange}
                />
              )}
              {tab.name === 'settings' && (
                <FormSettings
                  schema={draftSchema}
                  validationErrors={validationErrors}
                  onChange={handleSchemaChange}
                />
              )}
              {tab.name === 'entries' && currentFormId && (
                <div className='sf-p-6 sf-h-full sf-overflow-y-auto'>
                  <SubmissionsTable
                    formId={currentFormId}
                    showFormColumn={false}
                  />
                </div>
              )}
              {tab.name === 'entries' && !currentFormId && (
                <div className='sf-p-6 sf-h-full sf-overflow-y-auto'>
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
        message={__(
          'Your recent edits have not been saved. Would you like to save your changes before leaving, or discard them?',
          'subtleforms'
        )}
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

      {/* Form Preview Modal */}
      {/* TASK 5.4: Preview modal receives draftSchema (never active schema) */}
      {showPreview && (
        <FormPreviewModal
          schema={draftSchema}
          isDirty={isDirty}
          onClose={() => {
            dispatch({ type: BUILDER_ACTIONS.CLOSE_PREVIEW });
            setShowPreview(false);
          }}
        />
      )}
    </>
  );
}

export default function FormBuilderPage(props) {
  const { formId } = props;

  const [wizardStatusLoaded, setWizardStatusLoaded] = useState(!!formId);
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [createdFormId, setCreatedFormId] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);

  const [showQuickWizard, setShowQuickWizard] = useState(false);
  const [quickWizardInitialTitle, setQuickWizardInitialTitle] = useState('');

  const isNewForm = !formId;

  const effectiveFormId = createdFormId || formId;

  const handleCancelWizard = useCallback(() => {
    window.location.href = 'admin.php?page=subtleforms-forms';
  }, []);

  const generateDefaultTitleForWizard = useCallback(() => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return sprintf(__('Untitled Form %d', 'subtleforms'), suffix);
  }, []);

  const openQuickWizard = useCallback(() => {
    setQuickWizardInitialTitle(generateDefaultTitleForWizard());
    setShowQuickWizard(true);
  }, [generateDefaultTitleForWizard]);

  useEffect(() => {
    if (!isNewForm) {
      return;
    }

    let cancelled = false;
    apiGet('/create-wizard/status').then(({ ok, body }) => {
      if (cancelled) {
        return;
      }

      // Fail-open: if endpoint fails, show wizard.
      const dismissed = ok ? !!body?.dismissed : false;
      setWizardDismissed(dismissed);
      setWizardStatusLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isNewForm]);

  const createDraftFormWithSchema = useCallback(
    async ({ title, description, formType, startingPoint, dontShowAgain }) => {
      setCreateError(null);
      setCreating(true);

      try {
        const resolvedTitle =
          (title || '').trim() || generateDefaultTitleForWizard();
        const resolvedDescription = (description || '').trim();

        const schema = createInitialSchema({
          title: resolvedTitle,
          description: resolvedDescription,
          formType,
          startingPoint,
        });

        const formRes = await apiPost('/forms', {
          title: resolvedTitle,
          status: 'draft',
          config: {
            description: resolvedDescription,
            type: formType,
          },
        });

        if (!formRes.ok) {
          throw new Error(
            formRes.body?.message ||
              __('Failed to create draft form', 'subtleforms')
          );
        }

        const newId = formRes.body?.id;
        if (!newId) {
          throw new Error(__('Failed to create draft form', 'subtleforms'));
        }

        const schemaRes = await apiPost(`/forms/${newId}/schema`, {
          schema,
          activate: false,
        });

        if (!schemaRes.ok) {
          throw new Error(
            schemaRes.body?.message ||
              __('Failed to initialize draft schema', 'subtleforms')
          );
        }

        if (dontShowAgain) {
          // Best-effort (do not block creation).
          apiPost('/create-wizard/dismiss', {});
        }

        // Update URL to include form_id
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('form_id', newId);
        window.history.replaceState({}, '', newUrl.toString());

        setCreatedFormId(newId);
        setBootstrap({
          form: { id: newId, title: resolvedTitle, status: 'draft' },
          schema,
        });
      } catch (e) {
        setCreateError(
          e?.message || __('Failed to create form', 'subtleforms')
        );
        throw e;
      } finally {
        setCreating(false);
      }
    },
    [generateDefaultTitleForWizard]
  );

  // If user opted out of the wizard, still create a sensible starter form before mounting the builder.
  useEffect(() => {
    if (!isNewForm) {
      return;
    }
    if (!wizardStatusLoaded) {
      return;
    }
    if (!wizardDismissed) {
      return;
    }
    if (effectiveFormId || creating) {
      return;
    }

    createDraftFormWithSchema({
      title: generateDefaultTitleForWizard(),
      description: '',
      formType: 'regular',
      startingPoint: 'minimal',
      dontShowAgain: false,
    }).catch((e) => {
      setCreateError(e?.message || __('Failed to create form', 'subtleforms'));
      setCreating(false);
    });
  }, [
    creating,
    createDraftFormWithSchema,
    effectiveFormId,
    generateDefaultTitleForWizard,
    isNewForm,
    wizardDismissed,
    wizardStatusLoaded,
  ]);

  if (showQuickWizard) {
    return (
      <AdminShell>
        <CreateFormWizard
          initialTitle={
            quickWizardInitialTitle || generateDefaultTitleForWizard()
          }
          onCancel={() => setShowQuickWizard(false)}
          onComplete={async (data) => {
            await createDraftFormWithSchema(data);
            setShowQuickWizard(false);
          }}
        />
      </AdminShell>
    );
  }

  if (!isNewForm) {
    return (
      <FormBuilderInner
        {...props}
        formId={effectiveFormId}
        bootstrap={bootstrap?.form?.id === effectiveFormId ? bootstrap : null}
        onOpenWizard={openQuickWizard}
        showWizard={true}
        autoShowTour={false}
      />
    );
  }

  if (!wizardStatusLoaded) {
    return <Spinner />;
  }

  if (!effectiveFormId && !wizardDismissed) {
    return (
      <AdminShell>
        <CreateFormWizard
          initialTitle={generateDefaultTitleForWizard()}
          onCancel={handleCancelWizard}
          onComplete={createDraftFormWithSchema}
        />
      </AdminShell>
    );
  }

  if (!effectiveFormId) {
    return (
      <AdminShell>
        {createError ? (
          <Notice status='error' isDismissible={false}>
            {createError}
          </Notice>
        ) : (
          <Spinner />
        )}
      </AdminShell>
    );
  }

  return (
    <FormBuilderInner
      {...props}
      formId={effectiveFormId}
      bootstrap={bootstrap?.form?.id === effectiveFormId ? bootstrap : null}
      onOpenWizard={openQuickWizard}
      showWizard={true}
      autoShowTour={true}
    />
  );
}
