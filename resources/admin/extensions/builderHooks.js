/**
 * Builder Lifecycle Hooks
 * 
 * Extension points for form builder operations.
 * All hooks receive immutable data - return modified copies.
 * 
 * Available Hooks:
 * 
 * builder.beforeFieldInsert - Before inserting a field
 *   Payload: { type, parentId, position, config }
 *   Return: Modified payload or undefined
 * 
 * builder.afterFieldInsert - After inserting a field
 *   Payload: { nodeId, type, parentId, schema }
 * 
 * builder.beforeFieldDelete - Before deleting a field
 *   Payload: { nodeId, schema }
 *   Return: false to prevent deletion
 * 
 * builder.afterFieldDelete - After deleting a field
 *   Payload: { nodeId, schema }
 * 
 * builder.beforeFieldUpdate - Before updating field config
 *   Payload: { nodeId, changes, currentConfig }
 *   Return: Modified changes or undefined
 * 
 * builder.afterFieldUpdate - After updating field config
 *   Payload: { nodeId, config, schema }
 * 
 * builder.beforeSave - Before saving form
 *   Payload: { schema, formId, status }
 *   Return: Modified schema or undefined
 * 
 * builder.afterSave - After saving form
 *   Payload: { formId, schema, status, response }
 * 
 * builder.beforeValidate - Before validating schema
 *   Payload: { schema }
 *   Return: Modified schema or undefined
 * 
 * builder.afterValidate - After validating schema
 *   Payload: { schema, errors }
 * 
 * @version 1.0.0
 */

import { registerHook, doAction, applyFilters } from './hooks';

/**
 * Register a builder-specific hook
 * 
 * @param {string} hookName - Hook name (without 'builder.' prefix)
 * @param {Function} callback - Handler function
 * @param {number} [priority=10] - Execution priority
 * @returns {Function} Unregister function
 */
export function registerBuilderHook(hookName, callback, priority = 10) {
  return registerHook(`builder.${hookName}`, callback, priority);
}

/**
 * Execute builder action hook
 * @private - Use from within builder components only
 */
export async function doBuilderAction(hookName, payload) {
  await doAction(`builder.${hookName}`, payload);
}

/**
 * Execute builder filter hook
 * @private - Use from within builder components only
 */
export async function applyBuilderFilter(hookName, value, context) {
  return await applyFilters(`builder.${hookName}`, value, context);
}

/**
 * Available builder hooks documentation
 */
export const BUILDER_HOOKS = {
  // Field lifecycle
  BEFORE_FIELD_INSERT: 'beforeFieldInsert',
  AFTER_FIELD_INSERT: 'afterFieldInsert',
  BEFORE_FIELD_DELETE: 'beforeFieldDelete',
  AFTER_FIELD_DELETE: 'afterFieldDelete',
  BEFORE_FIELD_UPDATE: 'beforeFieldUpdate',
  AFTER_FIELD_UPDATE: 'afterFieldUpdate',
  BEFORE_FIELD_MOVE: 'beforeFieldMove',
  AFTER_FIELD_MOVE: 'afterFieldMove',
  BEFORE_FIELD_DUPLICATE: 'beforeFieldDuplicate',
  AFTER_FIELD_DUPLICATE: 'afterFieldDuplicate',
  
  // Form lifecycle
  BEFORE_SAVE: 'beforeSave',
  AFTER_SAVE: 'afterSave',
  BEFORE_VALIDATE: 'beforeValidate',
  AFTER_VALIDATE: 'afterValidate',
  
  // Selection
  FIELD_SELECTED: 'fieldSelected',
  FIELD_DESELECTED: 'fieldDeselected',
};
