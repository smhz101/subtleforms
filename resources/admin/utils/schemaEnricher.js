/**
 * Schema Enricher
 *
 * Adds explicit Pro feature markers to schema metadata.
 * Ensures Pro features survive duplication, import/export, and template cloning.
 *
 * NON-DESTRUCTIVE:
 * - Does not modify field definitions
 * - Backward compatible with older schemas
 * - Only enriches metadata
 */

import { formUsesProFeatures, getProFeaturesUsed } from './proFeatureDetector';

/**
 * Enrich schema with Pro feature markers
 *
 * Adds/updates metadata.uses_pro and metadata.pro_features based on
 * current schema content (template origin + field types).
 *
 * @param {Object} schema - Form schema to enrich
 * @returns {Object} Enriched schema (shallow copy)
 */
export function enrichSchemaWithProMarkers(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  // Detect Pro features using existing logic
  const usesProFeatures = formUsesProFeatures(schema);
  const proFeaturesUsed = usesProFeatures ? getProFeaturesUsed(schema) : [];

  // Ensure metadata object exists
  const metadata = schema.metadata || {};

  // Create enriched schema (shallow copy)
  const enrichedSchema = {
    ...schema,
    metadata: {
      ...metadata,
      uses_pro: usesProFeatures,
      pro_features: proFeaturesUsed,
    },
  };

  return enrichedSchema;
}

/**
 * Check if schema has Pro markers (for import validation)
 *
 * @param {Object} schema - Schema to check
 * @returns {boolean}
 */
export function schemaHasProMarkers(schema) {
  if (!schema || !schema.metadata) {
    return false;
  }

  return (
    schema.metadata.uses_pro === true ||
    (Array.isArray(schema.metadata.pro_features) &&
      schema.metadata.pro_features.length > 0)
  );
}

/**
 * Validate Pro markers match actual content
 *
 * Useful for debugging/testing - ensures markers are accurate.
 *
 * @param {Object} schema - Schema to validate
 * @returns {boolean}
 */
export function validateProMarkers(schema) {
  if (!schema || typeof schema !== 'object') {
    return true; // No schema, nothing to validate
  }

  const actualUsesProFeatures = formUsesProFeatures(schema);
  const markedUsesProFeatures = schema.metadata?.uses_pro === true;

  // If no Pro features, markers should be false/absent
  if (!actualUsesProFeatures) {
    return !markedUsesProFeatures;
  }

  // If Pro features exist, markers must be present and accurate
  if (actualUsesProFeatures && !markedUsesProFeatures) {
    console.warn(
      '[SubtleForms] Schema has Pro features but missing uses_pro marker'
    );
    return false;
  }

  const actualFeatures = getProFeaturesUsed(schema);
  const markedFeatures = schema.metadata?.pro_features || [];

  // Check if all actual features are marked
  const allMarked = actualFeatures.every((feature) =>
    markedFeatures.includes(feature)
  );

  if (!allMarked) {
    console.warn(
      '[SubtleForms] Schema Pro markers incomplete',
      { actual: actualFeatures, marked: markedFeatures }
    );
    return false;
  }

  return true;
}
