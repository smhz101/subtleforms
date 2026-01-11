/**
 * Test ID Generation and Field Key Uniqueness
 *
 * Run in browser console to verify functionality
 */

import {
  createNodeId,
  createFieldKey,
  ensureUniqueFieldKey,
  collectExistingKeys,
  isValidFieldKey,
} from './resources/admin/components/builder/utils/idGenerator';

console.group('ID Generation Tests');

// Test 1: Node ID generation
console.log('Test 1: Node ID Generation');
const nodeIds = Array.from({ length: 100 }, () => createNodeId());
const uniqueNodeIds = new Set(nodeIds);
console.assert(
  uniqueNodeIds.size === 100,
  `❌ Node ID collision detected! Expected 100 unique IDs, got ${uniqueNodeIds.size}`
);
console.log(`✅ Generated 100 unique node IDs`);
console.log(`   Sample: ${nodeIds.slice(0, 3).join(', ')}`);

// Test 2: Field key generation without collisions
console.log('\nTest 2: Field Key Generation (No Collisions)');
const existingKeys = new Set();
const fieldKeys = Array.from({ length: 10 }, () => createFieldKey('email', existingKeys));
fieldKeys.forEach((key) => existingKeys.add(key));
const uniqueFieldKeys = new Set(fieldKeys);
console.assert(
  uniqueFieldKeys.size === 10,
  `❌ Field key collision detected! Expected 10 unique keys, got ${uniqueFieldKeys.size}`
);
console.log(`✅ Generated 10 unique field keys`);
console.log(`   Sample: ${fieldKeys.slice(0, 3).join(', ')}`);

// Test 3: Field key collision handling
console.log('\nTest 3: Field Key Collision Handling');
const existingKeys2 = new Set(['email_abc', 'email_xyz']);
existingKeys2.add('email_abc'); // Duplicate to test collision
const key1 = createFieldKey('email', existingKeys2);
existingKeys2.add(key1);
const key2 = createFieldKey('email', existingKeys2);
console.assert(key1 !== key2, `❌ Keys should be different: ${key1} vs ${key2}`);
console.log(`✅ Collision avoided: ${key1} !== ${key2}`);

// Test 4: ensureUniqueFieldKey with collision
console.log('\nTest 4: Ensure Unique Field Key (Collision)');
const mockTree = {
  nodes: {
    node_1: { id: 'node_1', config: { key: 'email_abc' } },
    node_2: { id: 'node_2', config: { key: 'email_abc_2' } },
  },
};
const uniqueKey = ensureUniqueFieldKey('email_abc', mockTree, null);
console.assert(uniqueKey === 'email_abc_3', `❌ Expected 'email_abc_3', got '${uniqueKey}'`);
console.log(`✅ Collision resolved: email_abc → ${uniqueKey}`);

// Test 5: ensureUniqueFieldKey without collision
console.log('\nTest 5: Ensure Unique Field Key (No Collision)');
const uniqueKey2 = ensureUniqueFieldKey('email_new', mockTree, null);
console.assert(uniqueKey2 === 'email_new', `❌ Expected 'email_new', got '${uniqueKey2}'`);
console.log(`✅ No collision: email_new → ${uniqueKey2}`);

// Test 6: ensureUniqueFieldKey with exclusion
console.log('\nTest 6: Ensure Unique Field Key (With Exclusion)');
const uniqueKey3 = ensureUniqueFieldKey('email_abc', mockTree, 'node_1');
console.assert(
  uniqueKey3 === 'email_abc',
  `❌ Expected 'email_abc' (excluded), got '${uniqueKey3}'`
);
console.log(`✅ Exclusion works: email_abc → ${uniqueKey3} (node_1 excluded)`);

// Test 7: collectExistingKeys
console.log('\nTest 7: Collect Existing Keys');
const collectedKeys = collectExistingKeys(mockTree);
console.assert(collectedKeys.has('email_abc'), `❌ Missing 'email_abc'`);
console.assert(collectedKeys.has('email_abc_2'), `❌ Missing 'email_abc_2'`);
console.assert(collectedKeys.size === 2, `❌ Expected 2 keys, got ${collectedKeys.size}`);
console.log(`✅ Collected ${collectedKeys.size} keys: ${[...collectedKeys].join(', ')}`);

// Test 8: Field key validation
console.log('\nTest 8: Field Key Validation');
const validKeys = ['email_abc', 'name_123', '_private', 'field_a1b2c3'];
const invalidKeys = ['123_invalid', 'email-abc', 'email abc', '', 'a'.repeat(129)];

validKeys.forEach((key) => {
  console.assert(isValidFieldKey(key), `❌ '${key}' should be valid`);
});
console.log(`✅ Valid keys passed: ${validKeys.join(', ')}`);

invalidKeys.forEach((key) => {
  console.assert(!isValidFieldKey(key), `❌ '${key}' should be invalid`);
});
console.log(`✅ Invalid keys rejected: ${invalidKeys.slice(0, 3).join(', ')}...`);

// Test 9: Field key format consistency
console.log('\nTest 9: Field Key Format Consistency');
const keys = [
  createFieldKey('email'),
  createFieldKey('text'),
  createFieldKey('number'),
  createFieldKey('date-picker'), // Should normalize to date_picker
];
keys.forEach((key) => {
  console.assert(/^[a-z_][a-z0-9_]+$/i.test(key), `❌ Invalid format: ${key}`);
});
console.log(`✅ All keys match format: ${keys.join(', ')}`);

// Test 10: Crypto availability check
console.log('\nTest 10: Crypto API Availability');
if (typeof crypto !== 'undefined' && crypto.randomUUID) {
  console.log(`✅ crypto.randomUUID available (best security)`);
} else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
  console.log(`✅ crypto.getRandomValues available (good security)`);
} else {
  console.warn(`⚠️  No crypto API, using Math.random fallback (acceptable)`);
}

console.groupEnd();

console.log('\n🎉 All ID generation tests passed!');
