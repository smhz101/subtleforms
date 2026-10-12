/**
 * The questions of a conversational form (2.3.2).
 *
 * One rule for the builder canvas and the live form, so both show the same
 * questions in the same order: every root-level field is one question (a
 * Group or Repeater is one question with its fields inside it). Fields that
 * an older form kept inside steps are questions too, in order, so nothing is
 * hidden.
 */

const STEP_TYPES = ['step', 'form_step'];

function stepChildren(step) {
  if (Array.isArray(step.children) && step.children.length) return step.children;
  if (Array.isArray(step.fields) && step.fields.length) return step.fields;
  return [];
}

/**
 * @param {Array} fields Root fields of a schema.
 * @return {Array} The question fields, in order.
 */
export function questionFields(fields) {
  const out = [];
  (Array.isArray(fields) ? fields : []).forEach((f) => {
    if (!f || typeof f !== 'object') return;
    if (STEP_TYPES.includes(f.type)) {
      out.push(...stepChildren(f).filter(Boolean));
      return;
    }
    out.push(f);
  });
  return out;
}

/**
 * The same list for the builder tree: node ids of the questions.
 *
 * @param {Object} tree   Builder tree ({ nodes, rootId }).
 * @param {string} rootId Root node id.
 * @return {string[]}
 */
export function questionIds(tree, rootId) {
  const root = tree?.nodes?.[rootId];
  const out = [];
  (root?.children || []).forEach((id) => {
    const node = tree.nodes[id];
    if (!node) return;
    if (STEP_TYPES.includes(node.type)) {
      (node.children || []).forEach((childId) => tree.nodes[childId] && out.push(childId));
      return;
    }
    out.push(id);
  });
  return out;
}
