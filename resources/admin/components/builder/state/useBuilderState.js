/**
 * useBuilderState.js
 * 
 * Manages core builder state: tree, selection, validation errors
 * Extracted from FormEditor.jsx to reduce component size and improve testability
 */

import { useState, useRef, useEffect, useMemo } from '@wordpress/element';
import {
  normalizeSchema,
  denormalizeTree,
  getRootNodeId,
  nodeToField,
} from '../utils/schemaTree';

/**
 * Custom hook for managing builder state
 * 
 * @param {Object} schema - Form schema from props
 * @param {Array} validationErrors - Validation errors from props
 * @param {Object} fieldErrors - Field-level validation errors { fieldId: 'error message' }
 * @param {Function} onChange - Schema change callback
 * @param {boolean} isReadOnly - Whether builder is in read-only mode
 * @returns {Object} State and helpers
 */
export function useBuilderState(schema, validationErrors, fieldErrors, onChange, isReadOnly) {
  const rootId = getRootNodeId();
  const schemaRef = useRef(schema);
  
  // Core state
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
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [isDockCollapsed, setIsDockCollapsed] = useState(false);
  const selectedIdRef = useRef(selectedId);

  // Keep selectedIdRef in sync
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Sync tree when schema prop changes
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

  // Validation errors by field key (both from validationErrors array and fieldErrors object)
  const validationErrorsByFieldKey = useMemo(() => {
    const map = {};

    // Process array-based validation errors
    if (Array.isArray(validationErrors)) {
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
    }

    // Merge field-level errors from fieldErrors object
    if (fieldErrors && typeof fieldErrors === 'object') {
      Object.entries(fieldErrors).forEach(([fieldId, errorMsg]) => {
        if (!errorMsg) return;
        if (!map[fieldId]) {
          map[fieldId] = [];
        }
        // Avoid duplicates
        if (!map[fieldId].includes(errorMsg)) {
          map[fieldId].push(errorMsg);
        }
      });
    }

    return map;
  }, [validationErrors, fieldErrors]);

  // Detect form type from schema metadata — normalize legacy/alias types to canonical values
  const formType = useMemo(() => {
    const raw = schema?.metadata?.type || 'regular';
    if (raw === 'multistep' || raw === 'sectioned') return 'multi-step';
    return raw;
  }, [schema?.metadata?.type]);

  const isConversational = formType === 'conversational';

  // Selected field details
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

  // Set initial step if none selected
  useEffect(() => {
    if (!selectedStepId && steps.length > 0) {
      setSelectedStepId(steps[0].id);
    }
  }, [selectedStepId, steps]);

  // Update tree helper - calls onChange and persists to schema
  const updateTree = (updater) => {
    // Block updates in read-only mode
    if (isReadOnly) {
      console.warn('[SubtleForms] Cannot edit form - Pro license required');
      return;
    }

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
  };

  return {
    // Core state
    tree,
    setTree,
    selectedId,
    setSelectedId,
    selectedStepId,
    setSelectedStepId,
    isDockCollapsed,
    setIsDockCollapsed,

    // Derived state
    rootId,
    formType,
    isConversational,
    validationErrorsByFieldKey,
    selectedField,
    selectedFieldValidationMessages,
    allFields,
    steps,

    // Helpers
    updateTree,
    schemaRef,
    selectedIdRef,
  };
}
