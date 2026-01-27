/**
 * SubtleForms UI Panel Extension
 * 
 * Demonstrates:
 * - UI slot registration
 * - React component integration
 * - Data hooks usage
 * - Capability-gated features
 */

import React from 'react';
import { 
  registerExtension, 
  checkSDKCompatibility,
  UI_SLOTS,
  useForm,
  Can,
  Cannot,
  useAbility
} from '@subtleforms/sdk';

/**
 * Check SDK compatibility
 */
const compatibility = checkSDKCompatibility('1.0.0', {
  hooks: true,
  uiSlots: true
});

if (!compatibility.compatible) {
  console.error('[UI Panel Extension] Incompatible SubtleForms version:', compatibility.reason);
  return;
}

/**
 * Register extension
 */
const api = registerExtension({
  id: 'com.subtleforms.ui-panel-extension',
  name: 'UI Panel Extension',
  version: '1.0.0',
  description: 'Example UI panel with capability checks',
  initialize: () => {
    console.log('[UI Panel Extension] Initialized');
  }
});

/**
 * Form Stats Panel Component
 */
const FormStatsPanel = ({ schema, formId }) => {
  const { data: form, loading, error } = useForm(formId);
  const analytics = useAbility('use', 'advanced_analytics');

  // Loading state
  if (loading) {
    return (
      <div className="sf-panel ui-panel-stats">
        <div className="sf-panel-header">
          <h3 className="sf-panel-title">Form Stats</h3>
        </div>
        <div className="sf-panel-body">
          <div className="sf-loading">Loading...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="sf-panel ui-panel-stats">
        <div className="sf-panel-header">
          <h3 className="sf-panel-title">Form Stats</h3>
        </div>
        <div className="sf-panel-body">
          <div className="sf-error">
            Failed to load form data: {error.message}
          </div>
        </div>
      </div>
    );
  }

  // Calculate stats
  const fieldCount = Object.keys(schema.nodes || {}).length;
  const lastModified = schema.metadata?.lastModified 
    ? new Date(schema.metadata.lastModified).toLocaleDateString()
    : 'Unknown';

  return (
    <div className="sf-panel ui-panel-stats">
      <div className="sf-panel-header">
        <h3 className="sf-panel-title">📊 Form Stats</h3>
      </div>
      <div className="sf-panel-body">
        {/* Basic Stats - Always visible */}
        <div className="stats-section">
          <div className="sf-stat">
            <label>Form Name</label>
            <strong>{form.name}</strong>
          </div>
          <div className="sf-stat">
            <label>Total Fields</label>
            <strong>{fieldCount}</strong>
          </div>
          <div className="sf-stat">
            <label>Last Modified</label>
            <strong>{lastModified}</strong>
          </div>
        </div>

        {/* Pro Stats - Capability gated */}
        <Can I="use" a="advanced_analytics">
          <div className="stats-section stats-pro">
            <div className="sf-stat">
              <label>Total Submissions</label>
              <strong>{form.submission_count || 0}</strong>
            </div>
            <div className="sf-stat">
              <label>Conversion Rate</label>
              <strong>{form.conversion_rate || 0}%</strong>
            </div>
            <button className="sf-button sf-button-link">
              View Detailed Analytics →
            </button>
          </div>
        </Can>

        {/* Upgrade Prompt - Shows when Pro not available */}
        <Cannot I="use" a="advanced_analytics">
          <div className="sf-upgrade-prompt">
            <div className="upgrade-icon">🔒</div>
            <h4>Advanced Analytics</h4>
            <p>Upgrade to Pro for detailed submission tracking and conversion metrics.</p>
            <button className="sf-button sf-button-primary">
              Upgrade to Pro
            </button>
          </div>
        </Cannot>
      </div>
    </div>
  );
};

/**
 * Register UI slot
 */
api.addUISlot(UI_SLOTS.BUILDER_SIDEBAR_BOTTOM, FormStatsPanel, {
  priority: 10,
  shouldRender: (context) => {
    // Only show if we have a form ID
    return context.formId != null;
  }
});

/**
 * Quick Actions Button (Toolbar)
 */
const QuickActionsButton = ({ formId, schema }) => {
  const handleExport = () => {
    console.log('[UI Panel Extension] Exporting form:', formId);
    alert(`Exporting form ${formId} with ${Object.keys(schema.nodes).length} fields`);
  };

  return (
    <button 
      className="sf-button sf-button-secondary"
      onClick={handleExport}
      title="Quick Export"
    >
      📤 Export
    </button>
  );
};

/**
 * Register toolbar button
 */
api.addUISlot(UI_SLOTS.BUILDER_TOOLBAR_RIGHT, QuickActionsButton, {
  priority: 5,
  shouldRender: (context) => context.formId != null
});

console.log('[UI Panel Extension] Loaded successfully');
