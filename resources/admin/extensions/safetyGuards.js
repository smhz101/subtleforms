/**
 * Extension Safety Guards
 * 
 * Protective wrappers and validation for extension APIs.
 * Ensures extensions cannot crash core or access internals.
 */

/**
 * Wrap extension callback with error boundary
 * Catches exceptions and prevents core crashes
 * 
 * @param {Function} callback - Extension callback
 * @param {string} context - Context for error reporting
 * @returns {Function} Wrapped callback
 */
export function safeCallback(callback, context) {
  return async function wrappedCallback(...args) {
    try {
      return await Promise.resolve(callback(...args));
    } catch (error) {
      console.error(`[SubtleForms] Extension error in ${context}:`, error);
      
      // In dev mode, show more details
      if (window.subtleformsAdmin?.dev) {
        console.error('Extension callback:', callback);
        console.error('Arguments:', args);
        throw error;
      }
      
      return undefined;
    }
  };
}

/**
 * Validate schema modifications from extensions
 * Ensures extensions don't corrupt form schema
 * 
 * @param {Object} schema - Modified schema
 * @param {Object} original - Original schema
 * @returns {Object} Validated schema or original if invalid
 */
export function validateSchemaModification(schema, original) {
  // Must be an object
  if (!schema || typeof schema !== 'object') {
    console.warn('[SubtleForms] Extension returned invalid schema (not an object)');
    return original;
  }
  
  // Must have required properties
  const required = ['nodes', 'metadata'];
  for (const prop of required) {
    if (!(prop in schema)) {
      console.warn(`[SubtleForms] Extension schema missing required property: ${prop}`);
      return original;
    }
  }
  
  // Nodes must be an object
  if (typeof schema.nodes !== 'object') {
    console.warn('[SubtleForms] Extension schema.nodes must be an object');
    return original;
  }
  
  // Metadata must be an object
  if (typeof schema.metadata !== 'object') {
    console.warn('[SubtleForms] Extension schema.metadata must be an object');
    return original;
  }
  
  return schema;
}

/**
 * Sanitize extension-provided data
 * Removes potentially dangerous properties
 * 
 * @param {any} data - Data from extension
 * @returns {any} Sanitized data
 */
export function sanitizeExtensionData(data) {
  if (data === null || data === undefined) {
    return data;
  }
  
  // Primitives are safe
  if (typeof data !== 'object') {
    return data;
  }
  
  // Arrays
  if (Array.isArray(data)) {
    return data.map(sanitizeExtensionData);
  }
  
  // Objects - remove dangerous props
  const dangerous = ['__proto__', 'constructor', 'prototype'];
  const sanitized = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (!dangerous.includes(key)) {
      sanitized[key] = sanitizeExtensionData(value);
    }
  }
  
  return sanitized;
}

/**
 * Rate limit for extension callbacks
 * Prevents extensions from spamming hooks
 */
export class RateLimiter {
  constructor(maxCalls = 100, windowMs = 1000) {
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
    this.calls = [];
  }
  
  /**
   * Check if operation is allowed
   * 
   * @param {string} key - Identifier for rate limiting
   * @returns {boolean}
   */
  check(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Remove old calls
    this.calls = this.calls.filter(call => call.time > windowStart);
    
    // Count calls for this key
    const keyCalls = this.calls.filter(call => call.key === key);
    
    if (keyCalls.length >= this.maxCalls) {
      console.warn(`[SubtleForms] Extension "${key}" exceeded rate limit`);
      return false;
    }
    
    this.calls.push({ key, time: now });
    return true;
  }
}

/**
 * Validate component for UI slots
 * Ensures component is safe to render
 * 
 * @param {any} component - Component to validate
 * @returns {boolean}
 */
export function isValidSlotComponent(component) {
  if (!component) {
    return false;
  }
  
  // Must be function or class
  if (typeof component !== 'function') {
    return false;
  }
  
  // Must not be dangerous constructors
  const dangerous = ['Function', 'eval', 'setTimeout', 'setInterval'];
  if (dangerous.includes(component.name)) {
    console.warn('[SubtleForms] Blocked dangerous component:', component.name);
    return false;
  }
  
  return true;
}

/**
 * Deep freeze object to prevent mutation
 * Used for data passed to extension hooks
 * 
 * @param {Object} obj - Object to freeze
 * @returns {Object} Frozen object
 */
export function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  Object.freeze(obj);
  
  Object.values(obj).forEach(value => {
    if (typeof value === 'object' && value !== null) {
      deepFreeze(value);
    }
  });
  
  return obj;
}
