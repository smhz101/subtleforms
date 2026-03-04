import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from '@wordpress/element';
import {
  Spinner,
  Notice,
} from '@wordpress/components';
import { Button } from '../components/navigation';
import { useNavigate, useParams } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';
import Icon from '../components/ui/Icon';
import AdminShell from '../components/AdminShell';
import CreateFormWizard from '../components/CreateFormWizard';
import {
  apiGet,
  apiPost,
  apiPut,
} from '../utils/api';
import { createInitialSchema } from '../utils/initialSchema';
import useBuilderReducer, {
  BUILDER_ACTIONS,
  BUILDER_STATES,
  HISTORY_BATCH_WINDOW_MS,
} from '../hooks/useBuilderReducer';
import useDraftAutosave from '../hooks/useDraftAutosave';
import useBuilderBoot from '../hooks/builder/useBuilderBoot';
import useBuilderKeyboardShortcuts from '../hooks/builder/useBuilderKeyboardShortcuts';
import useBuilderValidation from '../hooks/builder/useBuilderValidation';
import useBuilderNotices from '../hooks/builder/useBuilderNotices';
import useBuilderOrchestrator from '../hooks/useBuilderOrchestrator';
import {
  BuilderTitle,
  BuilderActions,
} from '../components/builder/layout/BuilderHeaderBar';
import BuilderCanvasArea from '../components/builder/layout/BuilderCanvasArea';
import BuilderModalsController from '../components/builder/layout/BuilderModalsController';
import { enrichSchemaWithProMarkers } from '../utils/schemaEnricher';

function FormBuilderInner({
  formId,
  onClose,
  onSaved,
  bootstrap = null,
  onOpenWizard,
  showWizard = false,
  autoShowTour = false,
}) {
  const navigate = useNavigate();
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
    fieldErrors,
    isRateLimited,
    rateLimitRetryAfter,
    hasConflict,
    conflictData,
    formTitle: stateFormTitle,
    formId: stateFormId,
    lastSaveTime,
    lastAutoSaveTime,
    schemaHistoryPast,
    schemaHistoryFuture,
  } = builderState;

  const canUndo =
    Array.isArray(schemaHistoryPast) && schemaHistoryPast.length > 0;
  const canRedo =
    Array.isArray(schemaHistoryFuture) && schemaHistoryFuture.length > 0;

  // Hook integrations
  const {
    fieldGroups,
    fieldDefinitions,
    loadingFields,
    isHydrating,
    showTour,
    setShowTour,
    tourCompleted,
    setTourCompleted,
    settings,
  } = useBuilderBoot({
    formId,
    bootstrap,
    dispatch,
    autoShowTour,
  });

  const {
    createSuccessNotice,
    createErrorNotice,
    removeNotice,
    SUCCESS_NOTICE_ID,
    ERROR_NOTICE_ID,
  } = useBuilderNotices();

  // Autosave hook - handles automatic draft saving
  const { forceAutosave } = useDraftAutosave({
    builderState,
    dispatch,
    formId: stateFormId || formId,
    enabled: !isHydrating, // Don't autosave during hydration
  });

  // Remaining UI-specific state
  const [formTitle, setFormTitle] = useState(stateFormTitle || '');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [currentFormId, setCurrentFormId] = useState(
    stateFormId || formId || null
  );
  const [showPreview, setShowPreview] = useState(false);
  const titleInputRef = useRef(null);
  const copyTimeoutRef = useRef(null);

  // Orchestrator — save / publish / delete / discard + modal states
  const {
    performSave,
    handleSave,
    handleSaveDraft,
    handlePublish,
    confirmPublish,
    handleSaveAndClose,
    handleDelete,
    handleDiscard,
    confirmDiscard,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showPublishConfirm,
    setShowPublishConfirm,
    showDiscardConfirm,
    setShowDiscardConfirm,
    lastManualSaveRef,
    autoSaveTimeoutRef,
  } = useBuilderOrchestrator({
    builderState,
    dispatch,
    formId,
    currentFormId,
    setCurrentFormId,
    notices: {
      createSuccessNotice,
      createErrorNotice,
      removeNotice,
      SUCCESS_NOTICE_ID,
      ERROR_NOTICE_ID,
    },
    onSaved,
    navigate,
    hasValidationErrors: false, // placeholder — replaced after useBuilderValidation
  });

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

  const {
    hasValidationErrors,
    dismissRecoverableErrors,
    retryAutosave,
    retryLastManualSave,
  } = useBuilderValidation({
    builderState,
    dispatch,
    forceAutosave,
    lastManualSaveRef,
    performSave,
  });

  // Keyboard shortcuts hook
  useBuilderKeyboardShortcuts({
    dispatch,
    isHydrating,
    saving,
    autoSaving,
    canUndo,
    canRedo,
  });

  // Cleanup and navigation protection effects
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
    return sprintf(
      /* translators: %1$d: numeric suffix used to create a unique title */
      __('Untitled Form %1$d', 'subtleforms'),
      suffix
    );
  }

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

  /**
   * HISTORY BATCHING TIMER MANAGEMENT
   *
   * Manages the batch timer for high-frequency operations (drag/reorder).
   * After HISTORY_BATCH_WINDOW_MS of no edits, commits the batch to history.
   *
   * This prevents history spam during drag operations while preserving
   * the ability to undo the entire drag sequence in one step.
   */
  const batchTimerRef = useRef(null);

  useEffect(() => {
    // Access the batch state from builderState
    const { historyBatchPendingSchema } = builderState;

    // Clear any existing timer
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }

    // If there's a pending batch, start the commit timer
    if (historyBatchPendingSchema) {
      batchTimerRef.current = setTimeout(() => {
        dispatch({ type: BUILDER_ACTIONS.COMMIT_HISTORY_BATCH });
        batchTimerRef.current = null;
      }, HISTORY_BATCH_WINDOW_MS);
    }

    // Cleanup on unmount
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, [builderState.historyBatchPendingSchema, dispatch]);

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

  const handleClose = useCallback(() => {
    // For forms with changes, show confirmation
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose, setShowDiscardConfirm]);

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
      return (() => {
        /* translators: %1$s: localized time string (e.g. 12:34 PM) */ return sprintf(
          __('Saving… (last saved at %1$s)', 'subtleforms'),
          time
        );
      })();
    }

    if (effectiveStatus === 'saved') {
      return (() => {
        /* translators: %1$s: localized time string (e.g. 12:34 PM) */ return sprintf(
          __('Last saved at %1$s', 'subtleforms'),
          time
        );
      })();
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

  // Fallback UI if schema has no fields
  const hasFields = Array.isArray(draftSchema?.fields) && draftSchema.fields.length > 0;

  return (
    <>
      <AdminShell
        title={
          <BuilderTitle
            formTitle={formTitle}
            isEditingTitle={isEditingTitle}
            setIsEditingTitle={setIsEditingTitle}
            setFormTitle={setFormTitle}
            onPersistTitle={persistTitle}
            formTypeBadge={formTypeBadge}
            FormTypeIcon={FormTypeIcon}
            draftSchema={draftSchema}
          />
        }
        actions={
          <BuilderActions
            formStatus={formStatus}
            shortcode={shortcode}
            copyState={copyState}
            onCopyShortcode={handleCopyShortcode}
            statusLabel={statusLabel}
            statusDescription={statusDescription}
            effectiveStatus={effectiveStatus}
            autoSaving={autoSaving}
            autoSaveError={autoSaveError}
            saveError={saveError}
            onRetryAutosave={retryAutosave}
            onRetryLastManualSave={retryLastManualSave}
            onDismissErrors={dismissRecoverableErrors}
            canUndo={canUndo}
            canRedo={canRedo}
            saving={saving}
            dispatch={dispatch}
            isDirty={isDirty}
            hasValidationErrors={hasValidationErrors}
            draftSchema={draftSchema}
            onSaveDraft={handleSaveDraft}
            onPublish={handlePublish}
            onSaveAndClose={handleSaveAndClose}
            onDelete={() => setShowDeleteConfirm(true)}
            onPreview={() => {
              dispatch({ type: BUILDER_ACTIONS.OPEN_PREVIEW });
              setShowPreview(true);
            }}
            onStartTour={() => setShowTour(true)}
            onOpenWizard={onOpenWizard}
            showWizard={showWizard}
          />
        }
        noScroll={true}>
        <BuilderCanvasArea
          saveError={saveError}
          validationErrors={validationErrors}
          fieldErrors={fieldErrors}
          hasValidationErrors={hasValidationErrors}
          draftSchema={draftSchema}
          fieldGroups={fieldGroups}
          fieldDefinitions={fieldDefinitions}
          onSchemaChange={handleSchemaChange}
          currentFormId={currentFormId}
          showWelcome={!hasFields}
        />
      </AdminShell>

      <BuilderModalsController
        showDeleteConfirm={showDeleteConfirm}
        showPublishConfirm={showPublishConfirm}
        showDiscardConfirm={showDiscardConfirm}
        showTour={showTour}
        showPreview={showPreview}
        onCloseDeleteConfirm={() => setShowDeleteConfirm(false)}
        onConfirmDelete={handleDelete}
        onClosePublishConfirm={() => setShowPublishConfirm(false)}
        onConfirmPublish={confirmPublish}
        onCloseDiscardConfirm={() => setShowDiscardConfirm(false)}
        onConfirmSaveDraft={handleSaveDraft}
        onConfirmDiscard={confirmDiscard}
        onCloseTour={handleTourComplete}
        onSkipTour={handleTourSkip}
        onClosePreview={() => {
          dispatch({ type: BUILDER_ACTIONS.CLOSE_PREVIEW });
          setShowPreview(false);
        }}
        draftSchema={draftSchema}
        isDirty={isDirty}
      />
    </>
  );
}

export default function FormBuilderPage(props) {
  const { formId: paramFormId } = useParams();
  const formId = paramFormId ? parseInt(paramFormId, 10) : null;
  // Router (navigate/back) used by wizard callbacks
  const navigate = useNavigate();

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
    navigate('/forms');
  }, [navigate]);

  const generateDefaultTitleForWizard = useCallback(() => {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return sprintf(
      /* translators: %1$d: numeric suffix used to create a unique title */
      __('Untitled Form %1$d', 'subtleforms'),
      suffix
    );
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

        // Enrich schema with Pro markers before creating form
        const enrichedSchema = enrichSchemaWithProMarkers(schema);

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
          schema: enrichedSchema,
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

        setCreatedFormId(newId);
        setBootstrap({
          form: { id: newId, title: resolvedTitle, status: 'draft' },
          schema: enrichedSchema,
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
