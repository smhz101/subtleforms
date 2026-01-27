/**
 * SubtleForms Extension System
 * 
 * PUBLIC API EXPORTS
 * 
 * This is the stable, versioned interface for third-party extensions.
 * Only these exports are guaranteed to remain backward-compatible.
 * 
 * @version 1.0.0
 * @stability stable
 */

// Core extension API
export { 
  registerExtension, 
  getRegisteredExtensions,
  isExtensionRegistered 
} from './api';

// Hook system
export {
  registerHook,
  doAction,
  applyFilters,
  hasHook,
  getRegisteredHooks,
} from './hooks';

// Builder hooks
export {
  registerBuilderHook,
  BUILDER_HOOKS,
} from './builderHooks';

// UI slots
export {
  registerUISlot,
  UISlot,
  UI_SLOTS,
} from './uiSlots';

// Capability registry
export {
  registerCapability,
  hasCustomCapability,
  getCustomCapability,
} from './capabilityRegistry';

/**
 * Extension API version
 * Follows semantic versioning
 */
export const EXTENSION_API_VERSION = '1.0.0';

/**
 * Extension API compatibility matrix
 * Extensions can check if required version is supported
 */
export const API_COMPATIBILITY = {
  '1.0.0': {
    features: ['hooks', 'ui-slots', 'builder-hooks', 'capabilities'],
    breaking: [],
  },
};

/**
 * Check if extension API version is compatible
 * 
 * @param {string} requiredVersion - Minimum required version
 * @returns {boolean}
 */
export function isAPIVersionSupported(requiredVersion) {
  const [reqMajor, reqMinor] = requiredVersion.split('.').map(Number);
  const [apiMajor, apiMinor] = EXTENSION_API_VERSION.split('.').map(Number);
  
  // Major version must match
  if (reqMajor !== apiMajor) {
    return false;
  }
  
  // Minor version must be <= current
  return reqMinor <= apiMinor;
}
