/**
 * SubtleForms Extension API
 * 
 * PUBLIC STABLE API for third-party extensions.
 * 
 * This is the ONLY supported way to extend SubtleForms.
 * Direct access to internal components is unsupported and may break.
 * 
 * @version 1.0.0
 * @stability stable
 */

import { registerHook, doAction, applyFilters, removeHooksForNamespace } from './hooks';
import { registerBuilderHook } from './builderHooks';
import { registerUISlot } from './uiSlots';
import { registerCapability } from './capabilityRegistry';

/**
 * Extension registry
 * @private
 */
const extensions = new Map();

/**
 * Register an extension
 * 
 * Extensions must register before using any APIs.
 * This enables version checking, conflict detection, and cleanup.
 * 
 * @param {Object} config - Extension configuration
 * @param {string} config.id - Unique extension ID (reverse domain notation)
 * @param {string} config.name - Human-readable name
 * @param {string} config.version - Semantic version
 * @param {string} [config.description] - Brief description
 * @param {Function} [config.initialize] - Called when extension loads
 * @param {Function} [config.cleanup] - Called when extension unloads
 * @param {string[]} [config.requires] - Required core features
 * @returns {Object} Extension API
 * 
 * @example
 * const api = registerExtension({
 *   id: 'com.example.analytics',
 *   name: 'Form Analytics',
 *   version: '1.0.0',
 *   initialize: () => {
 *     console.log('Analytics extension loaded');
 *   }
 * });
 */
export function registerExtension(config) {
  const { id, name, version, description, initialize, cleanup, requires = [] } = config;
  
  // Validation
  if (!id || typeof id !== 'string') {
    throw new Error('Extension must have a unique string ID');
  }
  
  if (extensions.has(id)) {
    throw new Error(`Extension "${id}" is already registered`);
  }
  
  if (!name || typeof name !== 'string') {
    throw new Error('Extension must have a name');
  }
  
  if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error('Extension must have a semantic version (e.g., "1.0.0")');
  }
  
  // Check requirements
  const coreFeatures = getCoreFeatures();
  const missingFeatures = requires.filter(feature => !coreFeatures.includes(feature));
  if (missingFeatures.length > 0) {
    throw new Error(
      `Extension "${name}" requires features not available: ${missingFeatures.join(', ')}`
    );
  }
  
  const extension = {
    id,
    name,
    version,
    description: description || '',
    registered: Date.now(),
    hooks: [],
    uiSlots: [],
    capabilities: [],
  };
  
  extensions.set(id, extension);
  
  // Initialize if provided
  if (typeof initialize === 'function') {
    try {
      initialize();
    } catch (error) {
      console.error(`[SubtleForms] Extension "${name}" failed to initialize:`, error);
      extensions.delete(id);
      throw error;
    }
  }
  
  // Return extension API
  return {
    /**
     * Register a hook for this extension
     */
    addHook: (hookName, callback, priority) => {
      const unregister = registerHook(hookName, callback, priority);
      extension.hooks.push({ hookName, unregister });
      return unregister;
    },
    
    /**
     * Register a builder lifecycle hook
     */
    addBuilderHook: (hookName, callback, priority) => {
      const unregister = registerBuilderHook(hookName, callback, priority);
      extension.hooks.push({ hookName: `builder.${hookName}`, unregister });
      return unregister;
    },
    
    /**
     * Register a UI extension slot
     */
    addUISlot: (slotName, component, options) => {
      const unregister = registerUISlot(slotName, component, options);
      extension.uiSlots.push({ slotName, unregister });
      return unregister;
    },
    
    /**
     * Register a custom capability
     */
    addCapability: (capabilityKey, config) => {
      const unregister = registerCapability(capabilityKey, config);
      extension.capabilities.push({ capabilityKey, unregister });
      return unregister;
    },
    
    /**
     * Unregister this extension and cleanup
     */
    unregister: () => {
      // Cleanup hooks
      extension.hooks.forEach(({ unregister }) => unregister());
      extension.uiSlots.forEach(({ unregister }) => unregister());
      extension.capabilities.forEach(({ unregister }) => unregister());
      
      // Call cleanup function
      if (typeof cleanup === 'function') {
        try {
          cleanup();
        } catch (error) {
          console.error(`[SubtleForms] Extension "${name}" cleanup error:`, error);
        }
      }
      
      extensions.delete(id);
    },
  };
}

/**
 * Get list of registered extensions
 * 
 * @returns {Array<Object>} Extension info
 */
export function getRegisteredExtensions() {
  return Array.from(extensions.values()).map(ext => ({
    id: ext.id,
    name: ext.name,
    version: ext.version,
    description: ext.description,
    registered: ext.registered,
    hooks: ext.hooks.length,
    uiSlots: ext.uiSlots.length,
    capabilities: ext.capabilities.length,
  }));
}

/**
 * Get core features available for extensions
 * 
 * @returns {string[]}
 */
function getCoreFeatures() {
  return [
    'builder',
    'validation',
    'templates',
    'submissions',
    'policies',
    'hooks',
    'ui-slots',
  ];
}

/**
 * Check if extension is registered
 * 
 * @param {string} extensionId - Extension ID
 * @returns {boolean}
 */
export function isExtensionRegistered(extensionId) {
  return extensions.has(extensionId);
}

// Expose in dev mode for debugging
if (window.subtleformsAdmin?.dev) {
  window.subtleformsExtensions = {
    registered: getRegisteredExtensions,
    register: registerExtension,
  };
}
