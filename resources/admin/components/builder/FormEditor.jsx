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
      return normalizeSchema({ fields: [] });
    }
    return normalizeSchema(schema);
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

    schemaRef.current = schema;
    const newTree = normalizeSchema(schema);
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
      style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        height: '100%',
      }}>
      <FieldDock fieldGroups={fieldGroups} onAddField={handleDockAdd} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        }}>
        {steps.length > 0 && (
          <StepNavigator
            steps={steps}
            selectedStepId={selectedStepId}
            onSelectStep={handleSelectStep}
            onAddStep={handleAddStep}
            onDeleteStep={handleDeleteStep}
          />
        )}

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
      </div>

      {selectedField && (
        <FieldInspector
          field={selectedField}
          allFields={allFields}
          onUpdate={(changes) => handleUpdate(selectedId, changes)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {insertPicker?.anchor && (
        <Popover
          anchor={insertPicker.anchor}
          onClose={handleCloseInsert}
          position='bottom center'>
          <div
            style={{
              padding: '16px',
              minWidth: '240px',
              maxHeight: '400px',
              overflow: 'auto',
            }}>
            <h4
              style={{
                margin: '0 0 12px 0',
                fontSize: '14px',
                fontWeight: 600,
              }}>
              {__('Add Field', 'subtleforms')}
            </h4>
            {Object.entries(fieldGroups).map(([category, categoryFields]) => (
              <div key={category} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#757575',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}>
                  {category}
                </div>
                {categoryFields.map((f) => (
                  <button
                    key={f.type}
                    type='button'
                    onClick={() => handleInsert(f.type, insertPicker.context)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      marginBottom: 4,
                      background: '#f9f9f9',
                      border: '1px solid #e5e5e5',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#1e1e1e',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#2271b1';
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.borderColor = '#2271b1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f9f9f9';
                      e.currentTarget.style.color = '#1e1e1e';
                      e.currentTarget.style.borderColor = '#e5e5e5';
                    }}>
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
