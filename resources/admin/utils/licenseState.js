/**
 * License State Normalization
 *
 * Central utility for normalizing license states across the admin.
 * Does NOT alter license logic - only provides consistent state representation.
 *
 * @package SubtleForms
 * @since   1.8.0
 */

/**
 * License states (normalized)
 *
 * @typedef {'active'|'grace'|'expired'|'inactive'} LicenseState
 */

/**
 * Get normalized license state
 *
 * Derives state from window.subtleformsAdmin.capabilities (set by PHP).
 * Does NOT query license server or modify license behavior.
 *
 * @returns {LicenseState} Normalized license state
 */
export function getLicenseState() {
  const capabilities = window.subtleformsAdmin?.capabilities || {};
  
  // Check if Pro plugin is active
  const hasProPlugin = window.subtleformsAdmin?.hasProPlugin === true;
  
  if (!hasProPlugin) {
    return 'inactive'; // No Pro plugin installed
  }

  // Check capabilities to determine state
  const hasProTemplates = capabilities['templates.pro'] === true;
  const hasProFeatures = capabilities['pro_features'] === true;
  const hasWebhooks = capabilities['actions.webhook'] === true;

  // Active: Full Pro features available
  if (hasProTemplates && hasProFeatures) {
    return 'active';
  }

  // Grace: Limited Pro features (templates + webhooks but not full access)
  if (hasProFeatures && (hasProTemplates || hasWebhooks)) {
    return 'grace';
  }

  // Expired: Pro plugin active but no capabilities
  // (This state occurs when license was active but expired)
  if (hasProPlugin && !hasProFeatures) {
    // Check if there was ever a license (stored in Pro plugin state)
    const licenseKey = window.subtleformsAdmin?.licenseKey;
    if (licenseKey && licenseKey.length > 0) {
      return 'expired';
    }
  }

  // Inactive: Pro plugin active but no license activated
  return 'inactive';
}

/**
 * Get license state label (human-readable)
 *
 * @param {LicenseState} state License state
 * @returns {string} Display label
 */
export function getLicenseStateLabel(state) {
  switch (state) {
    case 'active':
      return 'Pro Active';
    case 'grace':
      return 'Grace Period';
    case 'expired':
      return 'License Expired';
    case 'inactive':
      return 'No License';
    default:
      return 'Unknown';
  }
}

/**
 * Get license state description
 *
 * @param {LicenseState} state License state
 * @returns {string} Description text
 */
export function getLicenseStateDescription(state) {
  switch (state) {
    case 'active':
      return 'All Pro features available';
    case 'grace':
      return 'Limited Pro access - renew soon';
    case 'expired':
      return 'License expired - existing Pro forms are read-only';
    case 'inactive':
      return 'Activate a license to unlock Pro features';
    default:
      return '';
  }
}

/**
 * Get license state color (for styling)
 *
 * @param {LicenseState} state License state
 * @returns {string} Color indicator ('success'|'warning'|'error'|'default')
 */
export function getLicenseStateColor(state) {
  switch (state) {
    case 'active':
      return 'success';
    case 'grace':
      return 'warning';
    case 'expired':
      return 'error';
    case 'inactive':
      return 'default';
    default:
      return 'default';
  }
}

/**
 * Check if user can edit Pro forms
 *
 * @returns {boolean} True if editing is allowed
 */
export function canEditProForms() {
  const state = getLicenseState();
  return state === 'active' || state === 'grace';
}

/**
 * Check if user can create Pro forms
 *
 * @returns {boolean} True if creation is allowed
 */
export function canCreateProForms() {
  const state = getLicenseState();
  return state === 'active' || state === 'grace';
}

/**
 * Get Pro license page URL
 *
 * @returns {string} URL to license settings page
 */
export function getProLicenseUrl() {
  return window.subtleformsAdmin?.proLicenseUrl || 'admin.php?page=subtleforms-pro';
}
