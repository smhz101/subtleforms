/**
 * A form's type follows its structure (2.3.2).
 *
 * SubtleForms has three form types: Standard, Multi-step and Conversational.
 * Standard and Multi-step differ only in structure: a Multi-step form keeps
 * its fields inside root-level `step` nodes (Page Breaks). Adding the first
 * Page Break to a Standard form makes it Multi-step; removing the last one
 * makes it Standard again. Conversational forms are their own type and are
 * never changed by structure. The server applies the same rule on save
 * (src/Support/SchemaRepair.php, syncType()).
 *
 * Also: the commands the Settings type selector uses to convert between
 * Standard and Multi-step (wrap every field in a first step, or flatten the
 * steps keeping every field in order).
 */

export const TYPE_STANDARD = 'regular';
export const TYPE_MULTI_STEP = 'multi-step';
export const TYPE_CONVERSATIONAL = 'conversational';

const STRUCTURAL = ['', 'regular', 'standard', 'multi-step', 'multistep', 'multi_step', 'sectioned', 'steps'];
const STEP_TYPES = ['step', 'form_step'];

/** Canonical spelling of a stored type. */
export function normalizeType(raw) {
  const v = String(raw || '').toLowerCase();
  if (['multistep', 'multi-step', 'multi_step', 'sectioned', 'steps'].includes(v)) return TYPE_MULTI_STEP;
  if (v === 'conversational') return TYPE_CONVERSATIONAL;
  if (v === '' || v === 'standard') return TYPE_STANDARD;
  return v;
}

/** Whether a root field list contains a Page Break. */
export function hasSteps(fields) {
  return Array.isArray(fields) && fields.some((f) => f && STEP_TYPES.includes(f.type));
}

/**
 * The type a schema's structure gives it.
 *
 * @param {Object} schema { metadata: { type }, fields }.
 * @return {string} 'regular', 'multi-step', 'conversational' or an add-on type.
 */
export function structuralType(schema) {
  const raw = String(schema?.metadata?.type || '').toLowerCase();
  if (!STRUCTURAL.includes(raw)) {
    return normalizeType(raw);
  }
  return hasSteps(schema?.fields) ? TYPE_MULTI_STEP : TYPE_STANDARD;
}

/** The schema with `metadata.type` set from its structure (same object when unchanged). */
export function withStructuralType(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const type = structuralType(schema);
  if (schema.metadata?.type === type) return schema;
  return { ...schema, metadata: { ...(schema.metadata || {}), type } };
}

function stepChildren(step) {
  if (Array.isArray(step.children) && step.children.length) return step.children;
  if (Array.isArray(step.fields) && step.fields.length) return step.fields;
  return [];
}

/**
 * Standard to Multi-step: every field goes into a first step, in order.
 *
 * @param {Array}  fields Root fields.
 * @param {Object} step   The step node to use ({ key, title, ... }).
 * @return {Array} New root list with one step.
 */
export function wrapFieldsInStep(fields, step) {
  if (hasSteps(fields)) return fields;
  const list = Array.isArray(fields) ? fields : [];
  return [{ type: 'step', description: '', ...step, children: list }];
}

/**
 * Multi-step to Standard: the steps go away and every field stays, in
 * order (fields outside a step keep their place).
 *
 * @param {Array} fields Root fields.
 * @return {Array} Flat root list.
 */
export function flattenSteps(fields) {
  const out = [];
  (Array.isArray(fields) ? fields : []).forEach((f) => {
    if (f && STEP_TYPES.includes(f.type)) {
      out.push(...stepChildren(f));
    } else if (f) {
      out.push(f);
    }
  });
  return out;
}
