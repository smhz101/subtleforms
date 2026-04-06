import { useCallback, useMemo, useState, useRef } from '@wordpress/element';
import { Popover } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { getIcon } from './utils/iconMap';
import Icon from '../ui/Icon';
import FieldDock from './FieldDock';
import FieldInspector from './FieldInspector';
import FormBuilder from './FormBuilder';
import ConversationalCanvas from './ConversationalCanvas';
import StepNavigator from './StepNavigator';
import { BuilderProvider } from './context/BuilderProvider';
import { useBuilderState, useSchemaCommands, useInsertPicker } from './state';
import './FormEditor.scss';

function FieldPickerPopover({ fieldGroups, context, onInsert }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const flatSearchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const results = [];
    Object.values(fieldGroups).forEach((fields) =>
      fields.forEach((f) => {
        if (
          !f.is_pro_locked &&
          (f.label.toLowerCase().includes(q) || f.type.toLowerCase().includes(q))
        ) {
          results.push(f);
        }
      })
    );
    return results;
  }, [query, fieldGroups]);

  const groupedFields = useMemo(() => {
    if (query.trim()) return null;
    const result = {};
    Object.entries(fieldGroups).forEach(([cat, fields]) => {
      const visible = fields.filter((f) => !f.is_pro_locked);
      if (visible.length) result[cat] = visible;
    });
    return result;
  }, [query, fieldGroups]);

  return (
    <div
      className='sf-field-picker-popover'
      role='dialog'
      aria-label={__('Add Field', 'subtleforms')}>
      {/* Search */}
      <div className='sf-field-picker-popover__search'>
        <span className='sf-field-picker-popover__search-icon' aria-hidden='true'>
          <Icon.Search size={14} />
        </span>
        <input
          ref={inputRef}
          type='text'
          className='sf-field-picker-popover__search-input'
          placeholder={__('Search fields…', 'subtleforms')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
          }}
          autoFocus
          aria-label={__('Search fields', 'subtleforms')}
        />
        {query && (
          <button
            type='button'
            className='sf-field-picker-popover__search-clear'
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label={__('Clear search', 'subtleforms')}>
            ×
          </button>
        )}
      </div>

      {/* Body */}
      <div className='sf-field-picker-popover__body'>
        {flatSearchResults !== null ? (
          flatSearchResults.length === 0 ? (
            <div className='sf-field-picker-popover__empty'>
              {__('No fields match', 'subtleforms')} &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className='sf-field-picker-popover__grid'>
              {flatSearchResults.map((f) => {
                const FieldIcon = getIcon(f.type);
                return (
                  <button
                    key={f.type}
                    type='button'
                    onClick={() => onInsert(f.type, context)}
                    className='sf-field-picker-popover__item'
                    title={f.label}>
                    <span className='sf-field-picker-popover__item-icon'>
                      <FieldIcon size={18} />
                    </span>
                    <span className='sf-field-picker-popover__item-label'>{f.label}</span>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          groupedFields &&
          Object.entries(groupedFields).map(([cat, fields]) => (
            <div key={cat} className='sf-field-picker-popover__category'>
              <div className='sf-field-picker-popover__category-label'>{cat}</div>
              <div className='sf-field-picker-popover__grid'>
                {fields.map((f) => {
                  const FieldIcon = getIcon(f.type);
                  return (
                    <button
                      key={f.type}
                      type='button'
                      onClick={() => onInsert(f.type, context)}
                      className='sf-field-picker-popover__item'
                      title={f.label}>
                      <span className='sf-field-picker-popover__item-icon'>
                        <FieldIcon size={18} />
                      </span>
                      <span className='sf-field-picker-popover__item-label'>{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

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
            <FieldPickerPopover
              fieldGroups={fieldGroups}
              context={insertPicker.context}
              onInsert={handleInsertWithClose}
            />
          </Popover>
        )}
      </div>
    </BuilderProvider>
  );
}
