/**
 * Abilities Policy Layer
 *
 * Centralized access control for Pro features and capabilities.
 * UI components query abilities instead of checking license state directly.
 * 
 * STABLE API - This interface is considered stable for extension/customization.
 * 
 * Usage Pattern:
 *   const { can, loading, ready, reason, upgrade } = useAbility('templates.pro');
 *   if (!ready) return <Loading />;
 *   if (!can) return <UpgradePrompt />;
 *   return <ProFeature />;
 * 
 * React Components:
 *   <Can do="templates.pro" fallback={<UpgradePrompt />}>
 *     <ProFeature />
 *   </Can>
 * 
 * Adding New Capabilities:
 * 1. Add to CAPABILITIES object with user-friendly description
 * 2. Ensure backend returns capability in license.capabilities
 * 3. Use useAbility() hook in UI components
 * 4. Consider grace period behavior (limited access during renewal)
 * 
 * @see useLicense in data/queries/license.js for license state
 * @see UpgradePrompt component for upgrade messaging
 */

import { useLicense } from '../data';
import { 
  hasCustomCapability, 
  getCustomCapability, 
  checkCustomCapability,
  getCustomCapabilityMessage 
} from '../extensions/capabilityRegistry';

/**
 * Feature capability definitions
 * 
 * Key format: 'domain.action' (e.g., 'templates.pro', 'fields.conditional')
 * Value: User-friendly description for upgrade messaging
 */
const CAPABILITIES = {
  // Templates
  'templates.pro': 'Access Pro templates',
  'templates.import': 'Import templates',
  'templates.export': 'Export templates',

  // Forms
  'forms.unlimited': 'Create unlimited forms',
  'forms.duplicate': 'Duplicate forms',
  'forms.import': 'Import forms',
  'forms.export': 'Export forms',

  // Fields
  'fields.advanced': 'Use advanced field types',
  'fields.conditional': 'Use conditional logic',
  'fields.calculations': 'Use calculations',
  'fields.file_upload': 'Use file upload fields',
  'fields.signature': 'Use signature fields',
  'fields.payment': 'Use payment fields',

  // Submissions
  'submissions.export': 'Export submissions',
  'submissions.bulk_actions': 'Use bulk actions',

  // Integrations
  'integrations.webhooks': 'Use webhooks',
  'integrations.api': 'Use API access',
  'integrations.zapier': 'Use Zapier integration',
  'integrations.mailchimp': 'Use Mailchimp integration',

  // Analytics
  'analytics.advanced': 'Access advanced analytics',
  'analytics.conversion': 'Track conversions',

  // Support
  'support.priority': 'Priority support',
};

/**
 * Hook to check if user can perform an action
 */
export function useAbility(capabilityKey) {
  const { data: license, isLoading, isError } = useLicense();

  // Loading state - prevent capability flicker
  if (isLoading) {
    return { 
      can: false, 
      loading: true, 
      ready: false,
      reason: 'Loading license...' 
    };
  }

  // Error state - fail closed
  if (isError) {
    return {
      can: false,
      loading: false,
      ready: false,
      error: true,
      reason: 'Unable to verify license',
    };
  }

  // Free tier - no capabilities
  if (!license?.active) {
    return {
      can: false,
      loading: false,
      ready: true,
      reason: 'Pro license required',
      upgrade: true,
    };
  }

  // Grace period - limited access
  if (license.status === 'grace_period') {
    const limitedCapabilities = [
      'templates.pro',
      'forms.export',
      'submissions.export',
    ];
    
    const can = limitedCapabilities.includes(capabilityKey);
    return {
      can,
      loading: false,
      ready: true,
      reason: can ? null : 'Not available in grace period',
      gracePeriod: true,
    };
  }

  // Check custom capabilities first
  if (hasCustomCapability(capabilityKey)) {
    const can = checkCustomCapability(capabilityKey, license);
    return {
      can,
      loading: false,
      ready: true,
      reason: can ? null : getCustomCapabilityMessage(capabilityKey),
      upgrade: !can,
      custom: true,
    };
  }

  // Active license - check specific capabilities
  const capabilities = license.capabilities || {};
  const can = capabilities[capabilityKey] === true;

  return {
    can,
    loading: false,
    ready: true,
    reason: can ? null : 'Feature not available in your plan',
    upgrade: !can,
  };
}

/**
 * Hook to check multiple abilities at once
 */
export function useAbilities(capabilityKeys) {
  const { data: license, isLoading } = useLicense();

  if (isLoading) {
    return { loading: true, abilities: {} };
  }

  const abilities = {};
  capabilityKeys.forEach((key) => {
    abilities[key] = checkAbility(key, license);
  });

  return { loading: false, abilities };
}

/**
 * Check ability without hook (for class components or utilities)
 */
function checkAbility(capabilityKey, license) {
  if (!license?.active) {
    return false;
  }

  if (license.status === 'grace_period') {
    const limitedCapabilities = [
      'templates.pro',
      'forms.export',
      'submissions.export',
    ];
    return limitedCapabilities.includes(capabilityKey);
  }

  // Check custom capabilities
  if (hasCustomCapability(capabilityKey)) {
    return checkCustomCapability(capabilityKey, license);
  }

  const capabilities = license.capabilities || {};
  return capabilities[capabilityKey] === true;
}

/**
 * Get user-friendly reason for denied access
 */
export function getUpgradeMessage(capabilityKey) {
  // Check custom capabilities first
  if (hasCustomCapability(capabilityKey)) {
    return getCustomCapabilityMessage(capabilityKey);
  }
  
  const description = CAPABILITIES[capabilityKey] || 'This feature';
  return `${description} requires an active Pro license.`;
}

/**
 * Hook to get all available capabilities
 */
export function useAvailableCapabilities() {
  const { data: license, isLoading } = useLicense();

  if (isLoading) {
    return { loading: true, capabilities: [] };
  }

  if (!license?.active) {
    return { loading: false, capabilities: [] };
  }

  const capabilities = license.capabilities || {};
  const available = Object.keys(capabilities).filter(
    (key) => capabilities[key] === true
  );

  return { loading: false, capabilities: available };
}

/**
 * React component wrapper for conditional rendering based on ability
 */
export function Can({ do: capabilityKey, fallback = null, loading = null, children }) {
  const ability = useAbility(capabilityKey);

  if (!ability.ready) {
    return loading !== undefined ? loading : fallback;
  }

  return ability.can ? children : fallback;
}

/**
 * Inverse: render only if user cannot do something
 */
export function Cannot({ do: capabilityKey, fallback = null, loading = null, children }) {
  const ability = useAbility(capabilityKey);

  if (!ability.ready) {
    return loading !== undefined ? loading : fallback;
  }

  return !ability.can ? children : fallback;
}
