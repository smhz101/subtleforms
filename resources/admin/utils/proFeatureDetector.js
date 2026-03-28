/**
 * Pro Feature Detector
 *
 * Detects if a form schema uses Pro features.
 * This is schema-based and deterministic - no UI state dependencies.
 *
 * @package SubtleForms
 */

/**
 * List of Pro template IDs
 * These match the PHP ProTemplates::get_all() array keys (snake_case)
 */
export const PRO_TEMPLATE_IDS = [
  'event_registration',
  'support_ticket',
  'payment_form',
  'booking_form',
  'job_application',
  'advanced_contact',
  'survey_nps',
  'membership_application',
];

/**
 * List of Pro-only field types
 * These fields require Pro license to use
 */
const PRO_FIELD_TYPES = [
  'file_upload',
  'signature',
  // Add more as Pro fields are introduced
];

/**
 * Check if a field uses Pro features
 *
 * @param {Object} field - Field object from schema
 * @return {boolean} True if field requires Pro
 */
function fieldUsesProFeatures(field) {
  if (!field || !field.type) {
    return false;
  }

  // Check if field type is Pro-only
  if (PRO_FIELD_TYPES.includes(field.type)) {
    return true;
  }

  // Check nested fields (for groups, steps, columns)
  if (field.fields && Array.isArray(field.fields)) {
    return field.fields.some((child) => fieldUsesProFeatures(child));
  }

  if (field.columns && Array.isArray(field.columns)) {
    return field.columns.some((column) =>
      column.fields?.some((child) => fieldUsesProFeatures(child))
    );
  }

  return false;
}

/**
 * Check if form schema uses Pro features
 *
 * Detection criteria:
 * 1. Template origin is a Pro template
 * 2. Contains Pro-only field types
 * 3. Uses Pro-only actions/settings (future)
 *
 * @param {Object} schema - Form schema object
 * @return {boolean} True if form uses Pro features
 */
export function formUsesProFeatures(schema) {
  if (!schema) {
    return false;
  }

  // 1. Check if created from Pro template
  const templateId = schema.metadata?.template;
  if (templateId && PRO_TEMPLATE_IDS.includes(templateId)) {
    return true;
  }

  // 2. Check if any field uses Pro features
  const fields = schema.fields || [];
  if (fields.some((field) => fieldUsesProFeatures(field))) {
    return true;
  }

  // 3. Future: Check for Pro actions (webhooks, integrations)
  // const actions = schema.metadata?.actions || [];
  // if (actions.some(action => PRO_ACTION_TYPES.includes(action.type))) {
  //   return true;
  // }

  return false;
}

/**
 * Get list of Pro features used in this form
 *
 * Useful for showing specific feature requirements to user.
 *
 * @param {Object} schema - Form schema object
 * @return {Array<string>} Array of feature names used
 */
export function getProFeaturesUsed(schema) {
  const features = [];

  if (!schema) {
    return features;
  }

  // Check template origin
  const templateId = schema.metadata?.template;
  if (templateId && PRO_TEMPLATE_IDS.includes(templateId)) {
    features.push('Pro Template');
  }

  // Check Pro fields (simplified - could be more detailed)
  const fields = schema.fields || [];
  const hasProFields = fields.some((field) => fieldUsesProFeatures(field));
  if (hasProFields) {
    features.push('Pro Fields');
  }

  return features;
}
