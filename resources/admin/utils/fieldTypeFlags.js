/**
 * What the builder knows about field types an add-on registered (2.7.2):
 * flags from their definitions, sent by the server as
 * `subtleformsAdmin.fieldTypeFlags` (see AddonFieldTypes::typeFlags()).
 *
 * - noAnswer       Shows something but holds no answer.
 * - noMessages     No required or error messages.
 * - logicOnly      Can be shown or hidden by logic, takes no answer.
 * - notInRepeater  Cannot go inside a Repeater.
 */

/**
 * Whether a field type has a flag.
 *
 * @param {string} type Field type.
 * @param {string} flag Flag name.
 * @return {boolean}
 */
export function typeHasFlag(type, flag) {
  const flags = typeof window !== 'undefined' ? window.subtleformsAdmin?.fieldTypeFlags : null;
  return !!(flags && type && flags[type] && flags[type][flag]);
}
