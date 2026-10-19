import { isRegisteredInputType } from '../../shared/extend';
import { columnFields } from './columnFields';

const INPUT_FIELD_TYPES = new Set([
  // Basic text inputs
  'text',
  'email',
  'url',
  'number',
  'phone',
  'tel',
  'textarea',
  'password',
  'hidden',
  // Date / time
  'date',
  'time',
  'datetime',
  // Choice fields
  'checkbox',
  'consent',
  'radio',
  'multiple_choice',
  'select',
  'dropdown',
  'country',
  'chained_select',
  // Media / file
  'file_upload',
  'image_upload',
  // Scale / rating
  'rating',
  'range_slider',
  'net_promoter_score',
  // Rich inputs
  'color_picker',
  'rich_text',
  'checkbox_grid',
  // 2.0 fields. Missing here meant their answers never reached the server:
  // Toggle and Opinion scale (2.2.1, bug 15) and Picture choice (bug 14).
  // Add-on types (Pro Signature and Calculation) are leaves through
  // isRegisteredInputType().
  'toggle',
  'scale',
  'picture_choice',
  // Payment
  'payment_amount',
  'payment_product',
  'payment_choice',
  'payment_coupon',
  'payment_hidden_price',
  // Dynamic
  'dynamic_field',
  'post_selection',
  // Composite group fields — store object values at their root key
  'name_group',
  'address_group',
  // Repeater (2.3.1): a list of groups at its own key; its children are
  // answered inside each group, never at the top level.
  'repeat_container',
]);

export function isLeafInputField(field) {
  const type = field?.type;
  if (!type || typeof type !== 'string') {
    return false;
  }

  // Add-on field types that collect a value (registerFieldType).
  return INPUT_FIELD_TYPES.has(type) || isRegisteredInputType(type);
}

export function collectLeafInputPaths(fields) {
  const leafPaths = [];

  const visit = (nodes) => {
    if (!Array.isArray(nodes)) {
      return;
    }

    for (const field of nodes) {
      if (!field || typeof field !== 'object') {
        continue;
      }

      if (isLeafInputField(field)) {
        const path = field?.config?.key || field?.key;
        if (typeof path === 'string' && path.trim()) {
          leafPaths.push(path);
        }
        // Leaf fields own their value as a single node — do NOT recurse into children.
        // This is critical for Plan A group fields (name_group / address_group) which
        // now have child text nodes; without the continue those child keys would also be
        // pushed, causing the group key AND individual child keys to both appear in the
        // payload (flat leakage).
        continue;
      }

      // Support both children and fields properties for backward compatibility
      // Use children if it has items, otherwise fall back to fields
      const childFields =
        field.children && field.children.length > 0 ? field.children : field.fields;
      if (Array.isArray(childFields) && childFields.length > 0) {
        visit(childFields);
      }

      if (Array.isArray(field.columns)) {
        for (const col of field.columns) {
          visit(columnFields(col));
        }
      }
    }
  };

  visit(fields);
  return leafPaths;
}

/**
 * True layout/container types — fields that group other fields but carry no
 * value of their own. Writes to their key are always ignored by the change
 * handler.
 *
 * A Repeater is not a container here: it owns its groups (a list) at its key.
 *
 * Composite INPUT fields (name_group, address_group, address, checkbox_grid)
 * also have children, but they DO carry a value (an object) at their root key,
 * so they must NOT be treated as containers. Treating "has children" as "is a
 * container" (the old logic) wrongly added name_group's key to the
 * non-writable set, so every keystroke into First/Last Name was silently
 * dropped (Part A1).
 *
 * @param {object} field Field node.
 * @return {boolean}
 */
export function isLayoutContainerField(field) {
  if (!field || typeof field !== 'object') {
    return false;
  }
  const type = field.type;
  if (typeof type !== 'string') {
    return false;
  }
  return (
    type === 'group_container' ||
    type === 'step' ||
    type === 'form_step' ||
    type === 'section' ||
    type === 'section_break' ||
    type === 'repeat_field' ||
    type === 'columns' ||
    type === 'row' ||
    type.includes('_column_container')
  );
}

/**
 * Collect the keys of true layout/container fields. The change handler refuses
 * to write to these keys because containers have no value of their own.
 *
 * Composite input fields (name_group, address_group, …) are intentionally
 * excluded so their object values can be written (Part A1).
 *
 * @param {Array} fields Field nodes.
 * @return {Set<string>} Container keys.
 */
export function collectContainerKeys(fields) {
  const keys = new Set();

  const visit = (nodes) => {
    if (!Array.isArray(nodes)) {
      return;
    }

    for (const field of nodes) {
      if (!field || typeof field !== 'object') {
        continue;
      }

      if (isLayoutContainerField(field)) {
        const key = field.config?.key || field.key;
        if (typeof key === 'string' && key.trim()) {
          keys.add(key);
        }
      }

      const childFields =
        field.children && field.children.length > 0
          ? field.children
          : field.fields;
      if (Array.isArray(childFields)) {
        visit(childFields);
      }

      if (Array.isArray(field.columns)) {
        for (const col of field.columns) {
          visit(columnFields(col));
        }
      }
    }
  };

  visit(fields);
  return keys;
}
