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

      const node = createNodeFromDefinition(definition);
      updateTree((currentTree) => addNodeToTree(currentTree, node, context));
      setSelectedId(node.id);
      setInsertPicker(null);
    },
    [definitionMap, updateTree]
  );

  const handleDockAdd = useCallback(
    (type) => {
      // If a step is selected, add to that step; otherwise add to root
      const targetParentId = selectedStepId || rootId;

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
      updateTree((currentTree) => deleteNode(currentTree, nodeId));
      setSelectedId((prev) => (prev === nodeId ? null : prev));
    },
    [updateTree]
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

        if (node.parentId !== destination.parentId) {
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

  const handleSelectStep = useCallback((stepId) => {
    setSelectedStepId(stepId);
  }, []);

  // Set initial step if none selected
  useEffect(() => {
    if (!selectedStepId && steps.length > 0) {
      setSelectedStepId(steps[0].id);
    }
  }, [selectedStepId, steps]);

  return (
    <div
      className='grid bg-white h-full overflow-hidden'
      style={{
        gridTemplateColumns: selectedField ? '280px 1fr 320px' : '280px 1fr',
      }}>
      {/* Field Library (Left Sidebar) */}
      <div className='bg-gray-50 border-gray-300 border-r max-h-full overflow-y-auto'>
        <FieldDock fieldGroups={fieldGroups} onAddField={handleDockAdd} />
      </div>

      {/* Canvas Area (Center) */}
      <div className='flex flex-col bg-gray-100 overflow-hidden'>
        {steps.length > 0 && !isConversational && (
          <div className='flex-shrink-0 bg-white border-gray-300 border-b'>
            <StepNavigator
              steps={steps}
              selectedStepId={selectedStepId}
              onSelectStep={handleSelectStep}
              onAddStep={handleAddStep}
              onDeleteStep={handleDeleteStep}
            />
          </div>
        )}

        <div className='flex-1 overflow-hidden' style={{ padding: isConversational ? 0 : '1.5rem' }}>
          {isConversational ? (
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
      {selectedField && (
        <div className='bg-white border-gray-300 border-l max-h-full overflow-y-auto'>
          <FieldInspector
            field={selectedField}
            allFields={allFields}
            onUpdate={(changes) => handleUpdate(selectedId, changes)}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}

      {/* Insert Picker Popover */}
      {insertPicker?.anchor && (
        <Popover
          anchor={insertPicker.anchor}
          onClose={handleCloseInsert}
          position='bottom center'>
          <div className='p-4 min-w-[240px] max-h-[400px] overflow-auto'>
            <h4 className='m-0 mb-3 font-semibold text-sm'>
              {__('Add Field', 'subtleforms')}
            </h4>
            {Object.entries(fieldGroups).map(([category, categoryFields]) => (
              <div key={category} className='mb-4'>
                <div className='mb-2 font-semibold text-[11px] text-gray-600 uppercase'>
                  {category}
                </div>
                {categoryFields.map((f) => (
                  <button
                    key={f.type}
                    type='button'
                    onClick={() => handleInsert(f.type, insertPicker.context)}
                    className='bg-gray-50 hover:bg-blue-600 mb-1 px-2.5 py-2 border border-gray-300 hover:border-blue-600 w-full text-gray-900 hover:text-white text-xs text-left transition-all cursor-pointer'>
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
