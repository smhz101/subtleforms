import { useCallback, useEffect, useMemo, useState, useRef } from '@wordpress/element';
import { Popover, Notice } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import FieldDock from './FieldDock';
import FieldInspector from './FieldInspector';
import FormBuilder from './FormBuilder';
import ConversationalCanvas from './ConversationalCanvas';
import StepNavigator from './StepNavigator';
import { BuilderProvider } from './context/BuilderProvider';
import BuilderDnd from './dnd/BuilderDnd';
import FieldPickerPopover from './FieldPickerPopover';
import { useBuilderState, useSchemaCommands, useInsertPicker } from './state';
import { questionIds } from '../../../shared/conversational';
import { formFieldDefaults } from '../../../shared/fieldDisplay';
import { renameFieldKey } from '../../../shared/fieldKeys';
import { denormalizeTree } from './utils/schemaTree';
import './FormEditor.scss';

export default function FormEditor({
  schema,
  fieldGroups,
  fieldDefinitions,
  validationErrors = [],
  fieldErrors = {},
  onChange,
  isReadOnly = false,
  renderCanvas = null,
  entryCount = 0,
}) {
  // State management
  const builderState = useBuilderState(schema, validationErrors, fieldErrors, onChange, isReadOnly);
  const [conversionsDismissed, setConversionsDismissed] = useState(false);
  const {
    tree,
    setTree,
    selectedId,
    setSelectedId,
    selectedStepId,
    setSelectedStepId,
    isDockCollapsed,
    setIsDockCollapsed,
    rootId,
    formType,
    isConversational,
    validationErrorsByFieldKey,
    selectedField,
    selectedFieldValidationMessages,
    allFields,
    steps,
    updateTree,
    schemaRef,
  } = builderState;

  const definitionMap = useMemo(
    () => fieldDefinitions || {},
    [fieldDefinitions]
  );

  const fieldDefaults = useMemo(
    () => formFieldDefaults(schema?.metadata),
    [schema?.metadata?.labelVisibility, schema?.metadata?.descriptionPlacement, schema?.metadata?.requiredMessage, schema?.metadata?.validationMessage, schema?.metadata?.validationSummary, schema?.metadata?.requiredIndicator, schema?.metadata?.requiredIndicatorText] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Command handlers
  const commands = useSchemaCommands({
    tree,
    updateTree,
    setTree,
    setSelectedId,
    selectedStepId,
    setSelectedStepId,
    rootId,
    definitionMap,
    isReadOnly,
    onChange,
    schemaRef,
  });
  const {
    handleInsert,
    handleDockAdd,
    handleDelete,
    handleUpdate,
    handleMove,
    handleDuplicate,
    handleAddStep,
    handleDeleteStep,
    handleMoveToStep,
    handleAddPanel,
    handleDeletePanel,
  } = commands;
  const [repairsDismissed, setRepairsDismissed] = useState(false);

  // Change a field's ID and every reference to it (2.4.1). The whole schema
  // goes through renameFieldKey(), so form settings outside the field tree
  // (emails, webhooks, confirmations, integrations, add-on settings) follow too, and
  // the change lands in the builder's undo history like any other edit.
  const handleRenameKey = useCallback(
    (nodeId, newKey) => {
      const oldKey = tree.nodes[nodeId]?.config?.key;
      if (isReadOnly || !oldKey || !newKey || oldKey === newKey) {
        return null;
      }
      const current = {
        ...schemaRef.current,
        schema_version: schemaRef.current?.schema_version || 1,
        fields: denormalizeTree(tree),
      };
      // Only the selected field is renamed, in its own namespace (review of #47).
      const { schema: next, references } = renameFieldKey(current, oldKey, newKey, nodeId);
      onChange(next);
      return { oldKey, newKey, references };
    },
    [tree, schemaRef, onChange, isReadOnly]
  );

  // Conversational forms (2.3.2): the current question, or an empty question
  // slot, shared by the canvas and the field panel.
  const [convCursor, setConvCursor] = useState({ index: 0, empty: false });

  // Clicking a field in the panel fills an empty question; otherwise it adds
  // a new question right after the current one.
  const handleConversationalAdd = useCallback(
    (type) => {
      if (type === 'step') {
        return; // Page Breaks do not apply: every question is its own screen.
      }
      const ids = questionIds(tree, rootId);
      let at;
      if (!ids.length) {
        at = 0;
      } else if (convCursor.empty) {
        at = Math.min(convCursor.index, ids.length);
      } else {
        at = Math.min(convCursor.index + 1, ids.length);
      }
      let context = { parentId: rootId, columnIndex: null, position: null };
      if (at < ids.length) {
        const node = tree.nodes[ids[at]];
        const parent = node && tree.nodes[node.parentId];
        if (parent) {
          context = { parentId: parent.id, columnIndex: null, position: (parent.children || []).indexOf(node.id) };
        }
      }
      handleInsert(type, context);
      setConvCursor({ index: at, empty: false });
    },
    [tree, rootId, convCursor, handleInsert]
  );

  // Page Break does not exist in a conversational form.
  const dockFieldGroups = useMemo(() => {
    if (!isConversational || !fieldGroups) return fieldGroups;
    const out = {};
    Object.entries(fieldGroups).forEach(([cat, list]) => {
      out[cat] = (list || []).filter((f) => f.type !== 'step');
    });
    return out;
  }, [fieldGroups, isConversational]);

  // A repaired multi-step form (fields moved into the first step on load) is
  // marked as changed so autosave, Save draft and Publish keep the repair.
  const [repairCount, setRepairCount] = useState(0);
  const repairPushesRef = useRef(0);
  const updateTreeRef = useRef(updateTree);
  updateTreeRef.current = updateTree;
  useEffect(() => {
    if (tree.repairs?.orphansMoved > 0 && !isReadOnly) {
      setRepairCount(tree.repairs.orphansMoved);
      setRepairsDismissed(false);
      repairPushesRef.current = 3;
    }
  }, [tree, isReadOnly]);
  // The builder ignores changes while it is still loading the form, so the
  // repaired schema is offered again whenever the change handler is renewed
  // (a few times at most; identical schemas are ignored upstream).
  useEffect(() => {
    if (repairPushesRef.current <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => {
      repairPushesRef.current -= 1;
      updateTreeRef.current((current) => {
        const { repairs, ...rest } = current;
        return rest;
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [onChange, repairCount]);

  // Insert picker state
  const insertPickerState = useInsertPicker();
  const { insertPicker, setInsertPicker, handleRequestInsert, handleCloseInsert } =
    insertPickerState;

  // Close insert picker after insertion
  const handleInsertWithClose = useCallback(
    (type, context) => {
      handleInsert(type, context);
      setInsertPicker(null);
    },
    [handleInsert, setInsertPicker]
  );

  const handleSelectStep = useCallback(
    (stepId) => {
      setSelectedStepId(stepId);
      setSelectedId(stepId);
    },
    [setSelectedStepId, setSelectedId]
  );

  return (
    <BuilderProvider
      tree={tree}
      selectedId={selectedId}
      setSelectedId={setSelectedId}
      selectedStepId={selectedStepId}
      setSelectedStepId={setSelectedStepId}
      validationErrors={validationErrors}
      validationErrorsByFieldKey={validationErrorsByFieldKey}
      fieldDefinitions={definitionMap}
      formType={formType}
      fieldDefaults={fieldDefaults}
      onInsert={handleInsert}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
      onMove={handleMove}
      onDuplicate={handleDuplicate}
      onRequestInsert={handleRequestInsert}
      onMoveToStep={handleMoveToStep}
      onAddPanel={handleAddPanel}
      onDeletePanel={handleDeletePanel}
      onRenameKey={handleRenameKey}
      entryCount={entryCount}
      isReadOnly={isReadOnly}>
      <BuilderDnd
        tree={tree}
        onInsert={handleInsert}
        onMove={handleMove}
        onMoveToStep={handleMoveToStep}>
      <div
        className={`sf-form-editor ${
          isDockCollapsed ? 'sf-form-editor--dock-collapsed' : ''
        } ${isReadOnly ? 'sf-form-editor--read-only' : ''} ${
          selectedField ? 'has-selection' : ''
        }`}>
        {/* Field Library (Left Sidebar) - Hidden in read-only mode */}
        {!isReadOnly && (
        <div className='sf-form-editor__dock' data-tour='fields-panel'>
          <FieldDock
            fieldGroups={dockFieldGroups}
            onAddField={isConversational ? handleConversationalAdd : handleDockAdd}
            onCollapsedChange={setIsDockCollapsed}
          />
        </div>
        )}

        {/* Canvas Area (Center) */}
        <div className='sf-form-editor__canvas' data-tour='canvas'>
          {steps.length > 0 && !isConversational && (
            <div className='sf-form-editor__canvas-step-nav'>
              <StepNavigator
                steps={steps}
                selectedStepId={selectedStepId}
                onSelectStep={handleSelectStep}
                onAddStep={handleAddStep}
                onDeleteStep={handleDeleteStep}
              />
            </div>
          )}

          {!conversionsDismissed && tree.conversions?.length > 0 && (
            <div className='sf-form-editor__conversions'>
              <Notice status='info' onRemove={() => setConversionsDismissed(true)}>
                {tree.conversions.map((c) => (
                  <p key={c.key}>
                    {sprintf(
                      /* translators: %s: field label */
                      __('"%s" was a single checkbox with a list of options, so it is now a Multiple choice field where visitors can tick any of them. Publish to update the live form.', 'subtleforms'),
                      c.label
                    )}
                  </p>
                ))}
              </Notice>
            </div>
          )}

          {!repairsDismissed && repairCount > 0 && (
            <div className='sf-form-editor__conversions'>
              <Notice status='warning' onRemove={() => setRepairsDismissed(true)}>
                <p>
                  {sprintf(
                    /* translators: %d: number of fields */
                    _n(
                      '%d field was outside every step, so it was moved into the first step. Save or publish to keep this.',
                      '%d fields were outside every step, so they were moved into the first step. Save or publish to keep this.',
                      repairCount,
                      'subtleforms'
                    ),
                    repairCount
                  )}
                </p>
              </Notice>
            </div>
          )}

          {!selectedField && allFields.length > 0 && !isConversational && (
            <div className='sf-form-editor__canvas-tip'>
              <div className='sf-form-editor__canvas-tip-text'>
                {__(
                  'Tip: Click a field (or container) to edit its settings.',
                  'subtleforms'
                )}
              </div>
            </div>
          )}

          <div
            className='sf-form-editor__canvas-scroll'
            style={{ padding: isConversational ? 0 : 0 }}>
            {renderCanvas ? (
              renderCanvas()
            ) : isConversational ? (
              <ConversationalCanvas cursor={convCursor} setCursor={setConvCursor} />
            ) : (
              <FormBuilder
                appearance={schema?.metadata?.appearance}
                tree={tree}
                rootId={rootId}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={handleDelete}
                onMove={handleMove}
                onDuplicate={handleDuplicate}
                onRequestInsert={handleRequestInsert}
                selectedStepId={selectedStepId}
              />
            )}
          </div>
        </div>

        {/* Field Inspector (Right Sidebar) */}
        <div className='sf-form-editor__inspector' data-tour='field-inspector'>
          <FieldInspector
            field={selectedField}
            allFields={allFields}
            formAppearance={schema?.metadata?.appearance}
            isReadOnly={isReadOnly}
          />
        </div>

        {/* Insert Picker Popover */}
        {insertPicker?.anchor && (
          <Popover
            anchor={insertPicker.anchor}
            onClose={handleCloseInsert}
            position='bottom center'
            resize={false}
            focusOnMount>
            <FieldPickerPopover
              fieldGroups={dockFieldGroups}
              context={insertPicker.context}
              tree={tree}
              rootId={rootId}
              onInsert={handleInsertWithClose}
            />
          </Popover>
        )}
      </div>
      </BuilderDnd>
    </BuilderProvider>
  );
}
