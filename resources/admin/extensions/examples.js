/**
 * SubtleForms Extension Examples
 * 
 * Example extensions demonstrating the public API.
 * These are for development/testing only - not loaded in production.
 * 
 * @internal
 */

import { registerExtension, BUILDER_HOOKS, UI_SLOTS } from '../extensions';
import React from 'react';

/**
 * Example 1: Simple Analytics Extension
 * 
 * Tracks form builder events without modifying core behavior.
 */
export function exampleAnalyticsExtension() {
  const api = registerExtension({
    id: 'com.example.analytics',
    name: 'Form Analytics',
    version: '1.0.0',
    description: 'Track form builder usage',
    initialize: () => {
      console.log('[Analytics] Extension loaded');
    },
  });

  // Track when fields are added
  api.addBuilderHook(BUILDER_HOOKS.AFTER_FIELD_INSERT, (payload) => {
    console.log('[Analytics] Field inserted:', payload.type);
  });

  // Track when forms are saved
  api.addBuilderHook(BUILDER_HOOKS.AFTER_SAVE, (payload) => {
    console.log('[Analytics] Form saved:', payload.formId, payload.status);
  });

  return api;
}

/**
 * Example 2: Custom Field Validator Extension
 * 
 * Adds custom validation logic before form save.
 */
export function exampleValidatorExtension() {
  const api = registerExtension({
    id: 'com.example.validator',
    name: 'Custom Validator',
    version: '1.0.0',
    description: 'Add custom validation rules',
  });

  // Validate before save
  api.addBuilderHook(BUILDER_HOOKS.BEFORE_SAVE, async (schema) => {
    const fieldCount = Object.keys(schema.nodes).length;
    
    if (fieldCount > 50) {
      console.warn('[Validator] Form has many fields:', fieldCount);
    }
    
    // Return unmodified schema
    return schema;
  });

  return api;
}

/**
 * Example 3: Custom Toolbar Button
 * 
 * Adds a UI component to the builder toolbar.
 */
export function exampleToolbarExtension() {
  const api = registerExtension({
    id: 'com.example.toolbar',
    name: 'Custom Toolbar',
    version: '1.0.0',
    description: 'Add toolbar button',
  });

  // Custom toolbar component
  const ToolbarButton = ({ context }) => {
    return (
      <button
        className="components-button"
        onClick={() => {
          console.log('[Toolbar] Custom button clicked', context);
        }}
      >
        Custom Action
      </button>
    );
  };

  // Register in toolbar slot
  api.addUISlot(UI_SLOTS.BUILDER_TOOLBAR_ACTIONS, ToolbarButton, {
    priority: 5,
  });

  return api;
}

/**
 * Example 4: Custom Capability Extension
 * 
 * Registers a custom Pro feature capability.
 */
export function exampleCapabilityExtension() {
  const api = registerExtension({
    id: 'com.example.capability',
    name: 'Custom Capability',
    version: '1.0.0',
    description: 'Add custom Pro feature',
  });

  // Register custom capability
  api.addCapability('example.advanced', {
    description: 'Advanced example feature',
    check: (license) => {
      // Custom logic: only for business plan
      return license.plan === 'business';
    },
    upgradeMessage: 'Upgrade to Business plan for advanced features',
  });

  return api;
}

/**
 * Example 5: Schema Transform Extension
 * 
 * Modifies schema before validation.
 */
export function exampleTransformExtension() {
  const api = registerExtension({
    id: 'com.example.transform',
    name: 'Schema Transform',
    version: '1.0.0',
    description: 'Transform schema before validation',
  });

  // Transform schema
  api.addBuilderHook(BUILDER_HOOKS.BEFORE_VALIDATE, (schema) => {
    // Add custom metadata
    return {
      ...schema,
      metadata: {
        ...schema.metadata,
        customField: 'added by extension',
      },
    };
  });

  return api;
}

/**
 * Load all example extensions in development
 */
export function loadExampleExtensions() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  console.log('[SubtleForms] Loading example extensions');

  const extensions = [
    exampleAnalyticsExtension(),
    exampleValidatorExtension(),
    exampleToolbarExtension(),
    exampleCapabilityExtension(),
    exampleTransformExtension(),
  ];

  // Expose for testing
  window.subtleformsExampleExtensions = extensions;

  return extensions;
}
