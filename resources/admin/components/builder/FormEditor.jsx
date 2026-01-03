import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from '@wordpress/element';
import { Popover } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import FieldDock from './FieldDock';
import FieldInspector from './FieldInspector';
import FormBuilder from './FormBuilder';
import ConversationalCanvas from './ConversationalCanvas';
import StepNavigator from './StepNavigator';
import {
  normalizeSchema,
  denormalizeTree,
  createNodeFromDefinition,
  addNodeToTree,
  deleteNode,
  updateNodeConfig,
  moveNode,
  getRootNodeId,
  nodeToField,
  duplicateNode,
} from './utils/schemaTree';

export default function FormEditor({
  schema,
  fieldGroups,
  fieldDefinitions,
  validationErrors = [],
  onChange,
}) {
  const rootId = getRootNodeId();
  const schemaRef = useRef(schema);
  const [tree, setTree] = useState(() => {
    // Initialize with empty tree if schema is null/undefined
    if (!schema) {
      return normalizeSchema({ schema_version: 1, fields: [] });
    }
    // Ensure schema_version exists, default to 1
    const schemaWithVersion = {
      ...schema,
      schema_version: schema.schema_version || 1,
    };

    // Log schema version for debugging
    console.debug(
      '[SubtleForms] FormEditor initialized with schema version:',
      schemaWithVersion.schema_version
    );

    return normalizeSchema(schemaWithVersion);
  });
  const [selectedId, setSelectedId] = useState(null);
  const [insertPicker, setInsertPicker] = useState(null);
  const [selectedStepId, setSelectedStepId] = useState(null);
  const selectedIdRef = useRef(selectedId);

  const validationErrorsByFieldKey = useMemo(() => {
    const map = {};

    if (!Array.isArray(validationErrors)) {
      return map;
    }

    validationErrors.forEach((err) => {
      const fieldKey = err?.fieldKey || err?.field_key || null;
      const message = err?.message || null;
      if (!fieldKey || !message) {
        return;
      }
      if (!map[fieldKey]) {
        map[fieldKey] = [];
      }
      map[fieldKey].push(message);
    });

    return map;
  }, [validationErrors]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    // Skip if schema hasn't changed
    if (schemaRef.current === schema) {
      return;
    }

    // Skip if schema is still null/undefined
    if (!schema) {
      return;
    }

    // If fields array reference is identical, skip tree rebuild
    // This prevents UI reset when only metadata (like version) changes
    if (schemaRef.current && schema.fields === schemaRef.current.fields) {
      schemaRef.current = schema;
      return;
    }

    schemaRef.current = schema;
    // Ensure schema_version exists, default to 1
    const schemaWithVersion = {
      ...schema,
      schema_version: schema.schema_version || 1,
    };

    // Log schema version update
    console.debug(
      '[SubtleForms] FormEditor received new schema version:',
      schemaWithVersion.schema_version
    );

    const newTree = normalizeSchema(schemaWithVersion);
    setTree(newTree);

    // Preserve selection if the node still exists
    if (selectedIdRef.current && newTree.nodes[selectedIdRef.current]) {
      // Keep selection intact
    } else {
      setSelectedId(null);
    }
  }, [schema]);

  const definitionMap = useMemo(
    () => fieldDefinitions || {},
    [fieldDefinitions]
  );

  // Detect form type from schema metadata
  const formType = useMemo(
    () => schema?.metadata?.type || 'regular',
    [schema?.metadata?.type]
  );

  const isConversational = formType === 'conversational';

  const updateTree = useCallback(
    (updater) => {
      setTree((current) => {
        const next = updater(current);
        if (!next || next === current) {
          return current;
        }

        const fields = denormalizeTree(next);
        const updatedSchema = {
          ...schemaRef.current,
          schema_version: schemaRef.current?.schema_version || 1,
          fields,
        };

        schemaRef.current = updatedSchema;
        onChange(updatedSchema);

        return next;
      });
    },
    [onChange]
  );

  const handleInsert = useCallback(
    (type, context) => {
      const definition = definitionMap[type];
      if (!definition) {
        console.warn('Missing field definition for', type);
        return;
      }

      // Guardrail: Prevent nesting steps inside steps
      if (type === 'step' && context.parentId) {
        const parentNode = tree.nodes[context.parentId];
        if (parentNode?.type === 'step') {
          // eslint-disable-next-line no-alert
          alert(
            __(
              'Cannot add a step inside another step. Steps can only be added at the root level.',
              'subtleforms'
            )
          );
          return;
        }
      }

      const node = createNodeFromDefinition(definition);

      // DEBUG: Log field creation
      console.log('[SubtleForms] Creating field:', {
        fieldType: type,
        fieldId: node.id,
        fieldLabel: node.config?.label,
        targetParentId: context.parentId,
        selectedStepId: selectedStepId,
        columnIndex: context.columnIndex,
        position: context.position,
      });

      updateTree((currentTree) => addNodeToTree(currentTree, node, context));
      setSelectedId(node.id);
      setInsertPicker(null);
    },
    [definitionMap, updateTree, tree, selectedStepId]
  );

  const handleDockAdd = useCallback(
    (type) => {
      // If a step is selected, add to that step; otherwise add to root
      const targetParentId = selectedStepId || rootId;

      // DEBUG: Log dock add
      console.log('[SubtleForms] Dock Add:', {
        fieldType: type,
        selectedStepId: selectedStepId,
        targetParentId: targetParentId,
        isStep: targetParentId !== rootId,
      });

      handleInsert(type, {
        parentId: targetParentId,
        columnIndex: null,
        position: null,
      });
    },
    [handleInsert, rootId, selectedStepId]
  );

  const handleDelete = useCallback(
    (nodeId) => {
      const node = tree.nodes[nodeId];

      // Guardrail: Prevent deleting the last step in a multi-step form
      if (node?.type === 'step') {
        const rootNode = tree.nodes[rootId];
        const stepCount = (rootNode?.children || []).filter(
          (id) => tree.nodes[id]?.type === 'step'
        ).length;

        if (stepCount <= 1) {
          // eslint-disable-next-line no-alert
          alert(
            __(
              'Cannot delete the last step. Multi-step forms require at least one step.',
              'subtleforms'
            )
          );
          return;
        }
      }

      updateTree((currentTree) => deleteNode(currentTree, nodeId));
      setSelectedId((prev) => (prev === nodeId ? null : prev));
    },
    [updateTree, tree, rootId]
  );

  const handleUpdate = useCallback(
    (nodeId, changes) => {
      updateTree((currentTree) =>
        updateNodeConfig(currentTree, nodeId, changes)
      );
    },
    [updateTree]
  );

  const handleMove = useCallback(
    (nodeId, destination) => {
      updateTree((currentTree) => {
        const node = currentTree.nodes[nodeId];
        if (!node) {
          return currentTree;
        }

        // Guardrail: Prevent moving fields across steps
        if (node.parentId !== destination.parentId) {
          console.warn(
            '[SubtleForms] Moving fields between different parents (steps) is not supported'
          );
          return currentTree;
        }

        return moveNode(currentTree, nodeId, destination);
      });
    },
    [updateTree]
  );

  const handleRequestInsert = useCallback((context, anchor) => {
    setInsertPicker({ context, anchor });
  }, []);

  const handleCloseInsert = useCallback(() => setInsertPicker(null), []);

  const handleDuplicate = useCallback(
    (nodeId, destination) => {
      if (!destination) {
        return;
      }

      setTree((currentTree) => {
        const { tree: nextTree, newNodeId } = duplicateNode(
          currentTree,
          nodeId,
          destination
        );

        if (!newNodeId || nextTree === currentTree) {
          return currentTree;
        }

        const fields = denormalizeTree(nextTree);
        const updatedSchema = {
          ...schemaRef.current,
          fields,
        };

        schemaRef.current = updatedSchema;
        onChange(updatedSchema);
        setSelectedId(newNodeId);

        return nextTree;
      });
    },
    [onChange]
  );

  const selectedField = useMemo(
    () => (selectedId ? nodeToField(tree, selectedId) : null),
    [selectedId, tree]
  );

  const selectedFieldValidationMessages = useMemo(() => {
    const key = selectedField?.key;
    if (!key) {
      return [];
    }
    return validationErrorsByFieldKey[key] || [];
  }, [selectedField, validationErrorsByFieldKey]);

  // Flatten all fields for condition editor
  const allFields = useMemo(() => {
    const fields = [];
    const traverse = (nodes) => {
      Object.values(nodes).forEach((node) => {
        if (
          node.type &&
          node.type !== 'step' &&
          !node.type.includes('container')
        ) {
          const field = nodeToField(tree, node.id);
          if (field) {
            fields.push({
              key: field.key,
              label: field.label || field.key,
              type: field.type,
            });
          }
        }
      });
    };
    traverse(tree.nodes);
    return fields;
  }, [tree]);

  // Extract step nodes
  const steps = useMemo(() => {
    const rootNode = tree.nodes[rootId];
    if (!rootNode?.children) return [];

    return rootNode.children
      .map((id) => tree.nodes[id])
      .filter((node) => node && node.type === 'step');
  }, [tree, rootId]);

  const handleAddStep = useCallback(() => {
    const definition = definitionMap['step'];
    if (!definition) {
      console.warn('Step field definition not found');
      return;
    }

    const stepNumber = steps.length + 1;
    const node = createNodeFromDefinition(definition);
    node.config = {
      ...node.config,
      title: `Step ${stepNumber}`,
      description: '',
    };

    updateTree((currentTree) =>
      addNodeToTree(currentTree, node, {
        parentId: rootId,
        columnIndex: null,
        position: null,
      })
    );

    setSelectedStepId(node.id);
  }, [definitionMap, steps.length, updateTree, rootId]);

  const handleDeleteStep = useCallback(
    (stepId) => {
      if (steps.length <= 1) return;

      updateTree((currentTree) => deleteNode(currentTree, stepId));

      if (selectedStepId === stepId) {
        const remainingSteps = steps.filter((s) => s.id !== stepId);
        setSelectedStepId(remainingSteps[0]?.id || null);
      }
    },
    [steps, updateTree, selectedStepId]
  );

  const handleSelectStep = useCallback(
    (stepId) => {
      const stepNode = tree.nodes[stepId];
      console.log('[SubtleForms] Step Selected:', {
        stepId: stepId,
        stepTitle: stepNode?.config?.title,
        childrenCount: stepNode?.children?.length || 0,
        childrenIds: stepNode?.children || [],
      });
      setSelectedStepId(stepId);
    },
    [tree]
  );

  // Set initial step if none selected
  useEffect(() => {
    if (!selectedStepId && steps.length > 0) {
      setSelectedStepId(steps[0].id);
    }
  }, [selectedStepId, steps]);

  return (
    <div
      className='sf-grid sf-bg-white sf-h-full sf-overflow-hidden sf-form-editor'
      style={{
        gridTemplateColumns: '280px 1fr 320px',
      }}>
      {/* Field Library (Left Sidebar) */}
      <div
        className='sf-bg-gray-50 sf-border-gray-300 sf-border-r sf-max-h-full sf-overflow-y-auto'
        data-tour='fields-panel'>
        <FieldDock fieldGroups={fieldGroups} onAddField={handleDockAdd} />
      </div>

      {/* Canvas Area (Center) */}
      <div
        className='sf-flex sf-flex-col sf-bg-gray-100 sf-overflow-hidden'
        data-tour='canvas'>
        {steps.length > 0 && !isConversational && (
          <div className='sf-flex-shrink-0 sf-bg-white sf-border-gray-300 sf-border-b'>
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
          <div className='sf-flex-shrink-0 sf-bg-white sf-px-4 sf-py-2 sf-border-gray-200 sf-border-b'>
            <div className='sf-text-gray-600 sf-text-xs'>
              {__(
                'Tip: Click a field (or container) to edit its settings.',
                'subtleforms'
              )}
            </div>
          </div>
        )}

        <div
          className='sf-flex-1 sf-overflow-y-auto'
          style={{ padding: isConversational ? 0 : '1.5rem' }}>
          {isConversational ? (
            <ConversationalCanvas
              tree={tree}
              rootId={rootId}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onRequestInsert={handleRequestInsert}
              validationErrorsByFieldKey={validationErrorsByFieldKey}
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
              validationErrorsByFieldKey={validationErrorsByFieldKey}
            />
          )}
        </div>
      </div>

      {/* Field Inspector (Right Sidebar) */}
      <div
        className='sf-bg-white sf-border-gray-300 sf-border-l sf-max-h-full sf-overflow-y-auto'
        data-tour='field-inspector'>
        <FieldInspector
          field={selectedField}
          allFields={allFields}
          onUpdate={(changes) => {
            if (!selectedId) return;
            handleUpdate(selectedId, changes);
          }}
          onClose={() => setSelectedId(null)}
          validationMessages={selectedFieldValidationMessages}
        />
      </div>

      {/* Insert Picker Popover */}
      {insertPicker?.anchor && (
        <Popover
          anchor={insertPicker.anchor}
          onClose={handleCloseInsert}
          position='bottom center'>
          <div className='sf-p-4 sf-min-w-[240px] sf-max-h-[400px] sf-overflow-auto'>
            <h4 className='sf-m-0 sf-mb-3 sf-font-semibold sf-text-sm'>
              {__('Add Field', 'subtleforms')}
            </h4>
            {Object.entries(fieldGroups).map(([category, categoryFields]) => (
              <div key={category} className='sf-mb-4'>
                <div className='sf-mb-2 sf-font-semibold sf-text-[11px] sf-text-gray-600 uppercase'>
                  {category}
                </div>
                {categoryFields.map((f) => (
                  <button
                    key={f.type}
                    type='button'
                    onClick={() => handleInsert(f.type, insertPicker.context)}
                    className='sf-bg-gray-50 hover:sf-bg-blue-600 sf-mb-1 sf-px-2.5 sf-py-2 sf-border sf-border-gray-300 hover:sf-border-blue-600 sf-w-full sf-text-gray-900 hover:sf-text-white sf-text-xs sf-text-left sf-transition-all sf-cursor-pointer'>
                    {f.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Popover>
      )}
    </div>
  );
}
