import { useCallback, useMemo } from '@wordpress/element';
import { Popover } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldDock from './FieldDock';
import FieldInspector from './FieldInspector';
import FormBuilder from './FormBuilder';
import ConversationalCanvas from './ConversationalCanvas';
import StepNavigator from './StepNavigator';
import { BuilderProvider } from './context/BuilderProvider';
import { useBuilderState, useSchemaCommands, useInsertPicker } from './state';
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
}) {
  // State management
  const builderState = useBuilderState(schema, validationErrors, fieldErrors, onChange, isReadOnly);
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

  // Command handlers
  const commands = useSchemaCommands({
    tree,
    updateTree,
    setTree,
    setSelectedId,
    selectedStepId,
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
  } = commands;

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
    },
    [setSelectedStepId]
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
      onInsert={handleInsert}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
      onMove={handleMove}
      onDuplicate={handleDuplicate}
      onRequestInsert={handleRequestInsert}
      isReadOnly={isReadOnly}>
      <div
        className={`sf-form-editor ${
          isDockCollapsed ? 'sf-form-editor--dock-collapsed' : ''
        } ${isReadOnly ? 'sf-form-editor--read-only' : ''}`}>
        {/* Field Library (Left Sidebar) - Hidden in read-only mode */}
        {!isReadOnly && (
        <div className='sf-form-editor__dock' data-tour='fields-panel'>
          <FieldDock
            fieldGroups={fieldGroups}
            onAddField={handleDockAdd}
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

          {!selectedField && allFields.length > 0 && (
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
              <ConversationalCanvas
                tree={tree}
                rootId={rootId}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onRequestInsert={handleRequestInsert}
              />
            ) : (
              <FormBuilder
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
            <div
              className='sf-field-picker-popover'
              role='dialog'
              aria-label={__('Add Field', 'subtleforms')}>
              <h4 className='sf-field-picker-popover__title'>
                {__('Add Field', 'subtleforms')}
              </h4>
              {Object.entries(fieldGroups).map(([category, categoryFields]) => (
                <div
                  key={category}
                  className='sf-field-picker-popover__category'>
                  <div className='sf-field-picker-popover__category-label'>
                    {category}
                  </div>
                  {categoryFields
                    .filter(f => !f.is_pro_locked)
                    .map((f) => (
                    <button
                      key={f.type}
                      type='button'
                      onClick={() => handleInsertWithClose(f.type, insertPicker.context)}
                      className='sf-field-picker-popover__button'>
                      {f.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </Popover>
        )}
      </div>
    </BuilderProvider>
  );
}
