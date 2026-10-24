/**
 * A shallow copy of a schema with its own metadata object, so a caller can
 * set metadata keys without changing the schema it was given.
 *
 * @param {Object} schema Form schema.
 * @return {Object} Copy.
 */
export function withOwnMetadata(schema) {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }
  return { ...schema, metadata: { ...(schema.metadata || {}) } };
}
