/**
 * SubtleForms Hook System
 * 
 * Predictable, versioned hook mechanism for extensions.
 * Follows WordPress action/filter pattern with guarantees.
 * 
 * Hook Lifecycle Guarantees:
 * - Hooks are executed in registration order
 * - Async hooks are awaited sequentially
 * - Exceptions in hooks are caught and logged (non-fatal)
 * - Core state is never exposed directly
 * 
 * @version 1.0.0
 */

import { safeCallback, validateSchemaModification } from './safetyGuards';

/**
 * Hook registry
 * @private
 */
const hooks = new Map();

/**
 * Register a hook handler
 * 
 * @param {string} hookName - Namespaced hook name (e.g., 'builder.beforeSave')
 * @param {Function} callback - Handler function
 * @param {number} [priority=10] - Lower runs first
 * @returns {Function} Unregister function
 * 
 * @example
 * const unregister = registerHook('builder.beforeSave', (schema) => {
 *   console.log('About to save:', schema.name);
 * });
 */
export function registerHook(hookName, callback, priority = 10) {
  if (typeof hookName !== 'string' || !hookName.includes('.')) {
    throw new Error('Hook name must be namespaced (e.g., "builder.beforeSave")');
  }
  
  if (typeof callback !== 'function') {
    throw new Error('Hook callback must be a function');
  }
  
  if (!hooks.has(hookName)) {
    hooks.set(hookName, []);
  }
  
  const handlers = hooks.get(hookName);
  const wrappedCallback = safeCallback(callback, `hook:${hookName}`);
  handlers.push({ callback: wrappedCallback, priority });
  handlers.sort((a, b) => a.priority - b.priority);
  
  return () => {
    const index = handlers.findIndex(h => h.callback === wrappedCallback);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  };
}

/**
 * Execute action hooks (no return value)
 * 
 * @param {string} hookName - Hook to execute
 * @param {...any} args - Arguments passed to handlers
 * 
 * @example
 * await doAction('builder.afterSave', { formId: 123, status: 'published' });
 */
export async function doAction(hookName, ...args) {
  const handlers = hooks.get(hookName) || [];
  
  for (const { callback } of handlers) {
    try {
      await Promise.resolve(callback(...args));
    } catch (error) {
      console.error(`[SubtleForms] Hook "${hookName}" error:`, error);
      
      if (window.subtleformsAdmin?.dev) {
        throw error;
      }
    }
  }
}

/**
 * Execute filter hooks (transforms value)
 * 
 * @param {string} hookName - Hook to execute
 * @param {any} value - Initial value to transform
 * @param {...any} args - Additional arguments for context
 * @returns {Promise<any>} Transformed value
 * 
 * @example
 * const schema = await applyFilters('builder.beforeValidate', schema, { formId });
 */
export async function applyFilters(hookName, value, ...args) {
  const handlers = hooks.get(hookName) || [];
  let result = value;
  
  for (const { callback } of handlers) {
    try {
      const transformed = await Promise.resolve(callback(result, ...args));
      if (transformed !== undefined) {
        // Validate schema modifications
        if (hookName.includes('builder') && transformed?.nodes) {
          result = validateSchemaModification(transformed, result);
        } else {
          result = transformed;
        }
      }
    } catch (error) {
      console.error(`[SubtleForms] Filter "${hookName}" error:`, error);
      
      if (window.subtleformsAdmin?.dev) {
        throw error;
      }
    }
  }
  
  return result;
}

/**
 * Remove all hooks for a namespace
 * Useful for cleanup when extension unloads
 * 
 * @param {string} namespace - Namespace prefix (e.g., 'builder')
 */
export function removeHooksForNamespace(namespace) {
  const prefix = `${namespace}.`;
  for (const [hookName] of hooks) {
    if (hookName.startsWith(prefix)) {
      hooks.delete(hookName);
    }
  }
}

/**
 * Check if hook has any handlers
 * 
 * @param {string} hookName - Hook name to check
 * @returns {boolean}
 */
export function hasHook(hookName) {
  return hooks.has(hookName) && hooks.get(hookName).length > 0;
}

/**
 * Get all registered hook names
 * Useful for debugging and documentation
 * 
 * @returns {string[]}
 */
export function getRegisteredHooks() {
  return Array.from(hooks.keys());
}
