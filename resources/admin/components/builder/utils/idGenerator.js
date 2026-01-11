/**
 * ID Generation Utilities
 *
 * Provides unique ID generation for schema nodes and field keys.
 * Uses crypto.randomUUID() for secure random IDs with nanoid as fallback.
 */

/**
 * Generate a unique node ID for internal builder use
 * Uses crypto.randomUUID() when available, falls back to custom implementation
 *
 * @returns {string} Unique node ID (e.g., "node_a1b2c3d4")
 */
export function createNodeId() {
  // Try crypto.randomUUID() first (available in modern browsers and Node 14.17+)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    // Use first 8 characters of UUID for readability
    return `node_${crypto.randomUUID().slice(0, 8)}`;
  }

  // Fallback: Use timestamp + random bytes
  const timestamp = Date.now().toString(36);
  const randomBytes = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // Final fallback for older environments
    for (let i = 0; i < 4; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const randomPart = Array.from(randomBytes)
    .map((b) => b.toString(36))
    .join('');

  return `node_${timestamp}_${randomPart}`;
}

/**
 * Generate a unique field key for submission data
 * Includes type prefix for readability
 *
 * @param {string} type - Field type (e.g., 'text', 'email')
 * @param {Object} existingKeys - Set of existing keys for collision detection
 * @returns {string} Unique field key (e.g., "email_a1b2c3d4")
 */
export function createFieldKey(type, existingKeys = new Set()) {
  const base = typeof type === 'string' && type.length ? type : 'field';
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  const prefix = normalized || 'field';

  // Generate unique ID part
  let uniqueId;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    uniqueId = crypto.randomUUID().slice(0, 8);
  } else {
    const timestamp = Date.now().toString(36);
    const randomBytes = new Uint8Array(3);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomBytes);
    } else {
      for (let i = 0; i < 3; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    const randomPart = Array.from(randomBytes)
      .map((b) => b.toString(36))
      .join('');
    uniqueId = `${timestamp.slice(-4)}${randomPart}`;
  }

  let candidateKey = `${prefix}_${uniqueId}`;

  // Handle collision with deterministic suffix
  let suffix = 2;
  while (existingKeys.has(candidateKey)) {
    candidateKey = `${prefix}_${uniqueId}_${suffix}`;
    suffix++;
  }

  return candidateKey;
}

/**
 * Ensure a field key is unique within a tree
 * If collision detected, appends _2, _3, etc.
 *
 * @param {string} desiredKey - The desired field key
 * @param {Object} tree - Current tree structure
 * @param {string} excludeNodeId - Node ID to exclude from collision check (for updates)
 * @returns {string} Unique field key
 */
export function ensureUniqueFieldKey(desiredKey, tree, excludeNodeId = null) {
  // Collect all existing field keys
  const existingKeys = new Set();
  Object.values(tree.nodes).forEach((node) => {
    if (node.id !== excludeNodeId && node.config?.key) {
      existingKeys.add(node.config.key);
    }
  });

  // If no collision, return as-is
  if (!existingKeys.has(desiredKey)) {
    return desiredKey;
  }

  // Handle collision with deterministic suffix
  let suffix = 2;
  let candidateKey = `${desiredKey}_${suffix}`;

  while (existingKeys.has(candidateKey)) {
    suffix++;
    candidateKey = `${desiredKey}_${suffix}`;
  }

  return candidateKey;
}

/**
 * Collect all existing field keys from a tree
 *
 * @param {Object} tree - Tree structure
 * @returns {Set<string>} Set of field keys
 */
export function collectExistingKeys(tree) {
  const keys = new Set();
  Object.values(tree.nodes).forEach((node) => {
    if (node.config?.key) {
      keys.add(node.config.key);
    }
  });
  return keys;
}

/**
 * Validate field key format
 * Field keys must be valid identifiers for use in submissions
 *
 * @param {string} key - Field key to validate
 * @returns {boolean} True if valid
 */
export function isValidFieldKey(key) {
  if (typeof key !== 'string' || !key.length) {
    return false;
  }

  // Must start with letter or underscore
  // Can contain letters, numbers, underscores
  // Max 128 characters
  const validPattern = /^[a-z_][a-z0-9_]{0,127}$/i;
  return validPattern.test(key);
}
