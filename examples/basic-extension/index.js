/**
 * SubtleForms Basic Extension
 * 
 * Demonstrates:
 * - Extension registration
 * - Hook usage (actions and filters)
 * - SDK compatibility checking
 */

import { 
  registerExtension, 
  checkSDKCompatibility,
  BUILDER_HOOKS 
} from '@subtleforms/sdk';

/**
 * Check SDK compatibility
 */
const compatibility = checkSDKCompatibility('1.0.0', {
  hooks: true
});

if (!compatibility.compatible) {
  console.error('[Basic Extension] Incompatible SubtleForms version:', compatibility.reason);
  return;
}

/**
 * Register extension
 */
const api = registerExtension({
  id: 'com.subtleforms.basic-extension',
  name: 'Basic Extension',
  version: '1.0.0',
  description: 'Example extension demonstrating hook usage',
  initialize: () => {
    console.log('[Basic Extension] Initialized');
  },
  cleanup: () => {
    console.log('[Basic Extension] Cleanup');
  }
});

/**
 * ACTION HOOK: Log after form save
 */
api.addBuilderHook(BUILDER_HOOKS.AFTER_SAVE, (payload) => {
  console.log('[Basic Extension] Form saved:', {
    formId: payload.formId,
    status: payload.status,
    fieldCount: Object.keys(payload.schema.nodes).length
  });
});

/**
 * FILTER HOOK: Add timestamp to form metadata
 */
api.addBuilderHook(BUILDER_HOOKS.BEFORE_SAVE, (payload) => {
  console.log('[Basic Extension] Adding timestamp to form');
  
  return {
    ...payload,
    schema: {
      ...payload.schema,
      metadata: {
        ...payload.schema.metadata,
        lastModified: Date.now(),
        modifiedBy: 'basic-extension'
      }
    }
  };
});

/**
 * FILTER HOOK: Validate form name before save
 */
api.addBuilderHook(BUILDER_HOOKS.BEFORE_SAVE, (payload) => {
  const formName = payload.schema.name?.trim();
  
  if (!formName) {
    console.error('[Basic Extension] Form name is required');
    alert('Please enter a form name before saving.');
    return false; // Prevent save
  }
  
  if (formName.length > 200) {
    console.error('[Basic Extension] Form name too long');
    alert('Form name must be 200 characters or less.');
    return false; // Prevent save
  }
  
  return payload;
});

/**
 * ACTION HOOK: Log field insertions
 */
api.addBuilderHook(BUILDER_HOOKS.AFTER_FIELD_INSERT, (payload) => {
  console.log('[Basic Extension] Field inserted:', {
    type: payload.type,
    nodeId: payload.nodeId,
    parentId: payload.parentId
  });
});

/**
 * FILTER HOOK: Add default placeholder to text fields
 */
api.addBuilderHook(BUILDER_HOOKS.BEFORE_FIELD_INSERT, (payload) => {
  if (payload.type === 'text' && !payload.config.placeholder) {
    console.log('[Basic Extension] Adding default placeholder to text field');
    
    return {
      ...payload,
      config: {
        ...payload.config,
        placeholder: 'Enter text here...'
      }
    };
  }
  
  return payload;
});

/**
 * ACTION HOOK: Log validation errors
 */
api.addBuilderHook(BUILDER_HOOKS.AFTER_VALIDATE, (payload) => {
  if (payload.errors && payload.errors.length > 0) {
    console.warn('[Basic Extension] Validation errors:', payload.errors);
  } else {
    console.log('[Basic Extension] Validation passed');
  }
});

/**
 * FILTER HOOK: Prevent deletion of required fields
 */
api.addBuilderHook(BUILDER_HOOKS.BEFORE_FIELD_DELETE, (payload) => {
  const node = payload.schema.nodes[payload.nodeId];
  
  if (node?.config?.required) {
    console.warn('[Basic Extension] Cannot delete required field');
    alert('Cannot delete a required field. Remove the "required" setting first.');
    return false; // Prevent deletion
  }
  
  return payload;
});

console.log('[Basic Extension] Loaded successfully');
