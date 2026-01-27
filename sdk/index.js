/**
 * SubtleForms Extension SDK
 * 
 * PUBLIC API v1.0.0
 * 
 * This is the ONLY supported interface for external extensions.
 * Do NOT import from other locations - those are internal and may change.
 * 
 * @packageDocumentation
 * @module @subtleforms/sdk
 * @version 1.0.0
 * @stability stable
 */

// Re-export public APIs from extension system
export {
  // Core extension registration
  registerExtension,
  getRegisteredExtensions,
  isExtensionRegistered,
  
  // Hook system
  registerHook,
  doAction,
  applyFilters,
  hasHook,
  getRegisteredHooks,
  
  // Builder-specific hooks
  registerBuilderHook,
  BUILDER_HOOKS,
  
  // UI component injection
  registerUISlot,
  UISlot,
  UI_SLOTS,
  
  // Custom capabilities
  registerCapability,
  hasCustomCapability,
  getCustomCapability,
  
  // Versioning
  EXTENSION_API_VERSION,
  isAPIVersionSupported,
} from '../resources/admin/extensions';

// Re-export policy hooks for capability checks
export {
  useAbility,
  Can,
  Cannot,
  getUpgradeMessage,
} from '../resources/admin/policies';

// Re-export data hooks for extensions that need server state
export {
  useForms,
  useForm,
  useTemplates,
  useLicense,
} from '../resources/admin/data';

/**
 * SDK Version
 * Follows semantic versioning
 */
export const SDK_VERSION = '1.0.0';

/**
 * Minimum WordPress version required
 */
export const MIN_WP_VERSION = '6.0';

/**
 * Minimum PHP version required
 */
export const MIN_PHP_VERSION = '7.4';

/**
 * SDK feature flags
 * Indicates which features are available in this version
 */
export const SDK_FEATURES = {
  hooks: true,
  builderHooks: true,
  uiSlots: true,
  customCapabilities: true,
  dataHooks: true,
  submissionHooks: false, // Future: Phase 6+
  customFieldTypes: false, // Future: Phase 6+
  restEndpoints: false, // Future: Phase 6+
};

/**
 * Check if SDK version is compatible with extension requirements
 * 
 * @param {string} requiredVersion - Minimum SDK version required (e.g., "1.0.0")
 * @param {string[]} requiredFeatures - Required features (e.g., ["hooks", "uiSlots"])
 * @returns {Object} Compatibility result
 * 
 * @example
 * const compat = checkSDKCompatibility('1.0.0', ['hooks', 'uiSlots']);
 * if (!compat.compatible) {
 *   throw new Error(compat.reason);
 * }
 */
export function checkSDKCompatibility(requiredVersion, requiredFeatures = []) {
  const [reqMajor, reqMinor] = requiredVersion.split('.').map(Number);
  const [sdkMajor, sdkMinor] = SDK_VERSION.split('.').map(Number);
  
  // Major version must match
  if (reqMajor !== sdkMajor) {
    return {
      compatible: false,
      reason: `SDK major version mismatch. Required: ${reqMajor}.x, Available: ${sdkMajor}.x`,
    };
  }
  
  // Minor version must be >= required
  if (sdkMinor < reqMinor) {
    return {
      compatible: false,
      reason: `SDK version too old. Required: ${requiredVersion}+, Available: ${SDK_VERSION}`,
    };
  }
  
  // Check feature availability
  const missingFeatures = requiredFeatures.filter(feature => !SDK_FEATURES[feature]);
  if (missingFeatures.length > 0) {
    return {
      compatible: false,
      reason: `Missing required features: ${missingFeatures.join(', ')}`,
    };
  }
  
  return {
    compatible: true,
    version: SDK_VERSION,
    features: SDK_FEATURES,
  };
}

/**
 * Get SDK information
 * Useful for debugging and support
 * 
 * @returns {Object} SDK metadata
 */
export function getSDKInfo() {
  return {
    version: SDK_VERSION,
    apiVersion: EXTENSION_API_VERSION,
    features: SDK_FEATURES,
    wordpress: {
      minVersion: MIN_WP_VERSION,
    },
    php: {
      minVersion: MIN_PHP_VERSION,
    },
  };
}

// Expose SDK globally for debugging
if (typeof window !== 'undefined' && window.subtleformsAdmin?.dev) {
  window.SubtleFormsSDK = {
    version: SDK_VERSION,
    info: getSDKInfo,
    checkCompatibility: checkSDKCompatibility,
  };
}
