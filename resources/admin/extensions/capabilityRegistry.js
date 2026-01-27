/**
 * Capability Registry
 * 
 * Allows extensions to register custom Pro capabilities.
 * Integrates with the existing policy layer.
 * 
 * @version 1.0.0
 */

/**
 * Custom capability registry
 * @private
 */
const customCapabilities = new Map();

/**
 * Register a custom capability
 * 
 * @param {string} capabilityKey - Capability key (namespaced, e.g., 'myext.feature')
 * @param {Object} config - Capability configuration
 * @param {string} config.description - User-friendly description
 * @param {Function} [config.check] - Custom check function (license) => boolean
 * @param {string} [config.upgradeMessage] - Custom upgrade message
 * @returns {Function} Unregister function
 * 
 * @example
 * registerCapability('analytics.advanced', {
 *   description: 'Advanced analytics reports',
 *   check: (license) => license.plan === 'business',
 *   upgradeMessage: 'Upgrade to Business for advanced analytics'
 * });
 */
export function registerCapability(capabilityKey, config) {
  if (!capabilityKey || typeof capabilityKey !== 'string') {
    throw new Error('Capability key must be a string');
  }
  
  if (!capabilityKey.includes('.')) {
    throw new Error('Capability key must be namespaced (e.g., "myext.feature")');
  }
  
  if (!config.description) {
    throw new Error('Capability must have a description');
  }
  
  if (customCapabilities.has(capabilityKey)) {
    throw new Error(`Capability "${capabilityKey}" is already registered`);
  }
  
  customCapabilities.set(capabilityKey, {
    description: config.description,
    check: config.check,
    upgradeMessage: config.upgradeMessage,
  });
  
  return () => {
    customCapabilities.delete(capabilityKey);
  };
}

/**
 * Check if capability is registered
 * 
 * @param {string} capabilityKey - Capability key
 * @returns {boolean}
 */
export function hasCustomCapability(capabilityKey) {
  return customCapabilities.has(capabilityKey);
}

/**
 * Get custom capability config
 * 
 * @param {string} capabilityKey - Capability key
 * @returns {Object|null}
 */
export function getCustomCapability(capabilityKey) {
  return customCapabilities.get(capabilityKey) || null;
}

/**
 * Check custom capability
 * 
 * @param {string} capabilityKey - Capability key
 * @param {Object} license - License data
 * @returns {boolean}
 */
export function checkCustomCapability(capabilityKey, license) {
  const capability = customCapabilities.get(capabilityKey);
  if (!capability) {
    return false;
  }
  
  if (typeof capability.check === 'function') {
    try {
      return capability.check(license);
    } catch (error) {
      console.error(`[SubtleForms] Custom capability "${capabilityKey}" check error:`, error);
      return false;
    }
  }
  
  // Default: check if license is active
  return license?.active === true;
}

/**
 * Get upgrade message for custom capability
 * 
 * @param {string} capabilityKey - Capability key
 * @returns {string}
 */
export function getCustomCapabilityMessage(capabilityKey) {
  const capability = customCapabilities.get(capabilityKey);
  if (!capability) {
    return 'Pro license required';
  }
  
  return capability.upgradeMessage || `${capability.description} requires a Pro license.`;
}
