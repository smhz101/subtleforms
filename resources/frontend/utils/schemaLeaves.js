const INPUT_FIELD_TYPES = new Set([
  'text',
  'email',
  'url',
  'number',
  'phone',
  'textarea',
  'checkbox',
  'radio',
  'multiple_choice',
  'select',
  'dropdown',
  'hidden',
  'payment_amount',
  'payment_coupon',
]);

export function isLeafInputField(field) {
  const type = field?.type;
  if (!type || typeof type !== 'string') {
    return false;
  }

  return INPUT_FIELD_TYPES.has(type);
}

export function collectLeafInputPaths(fields) {
  const leafPaths = [];

  // Remove detailed console logs for production
  console.log('[SubtleForms] collectLeafInputPaths called with:', fields?.length, 'fields');

  const visit = (nodes) => {
    if (!Array.isArray(nodes)) {
      return;
    }

    for (const field of nodes) {
      if (!field || typeof field !== 'object') {
        continue;
      }

      // Debug field processing (reduced verbosity)
      if (isLeafInputField(field)) {
        console.log(
          '[SubtleForms] Found input field:',
          field.type,
          field?.config?.key || field?.key
        );
      }

      if (isLeafInputField(field)) {
        const path = field?.config?.key || field?.key;
        if (typeof path === 'string' && path.trim()) {
          leafPaths.push(path);
          console.log('[SubtleForms] Added leaf path:', path);
        }
      }

      // Support both children and fields properties for backward compatibility
      // Use children if it has items, otherwise fall back to fields
      const childFields =
        field.children && field.children.length > 0 ? field.children : field.fields;
      if (Array.isArray(childFields) && childFields.length > 0) {
        console.log('[SubtleForms] Visiting child fields:', childFields.length);
        visit(childFields);
      }

      if (Array.isArray(field.columns)) {
        for (const col of field.columns) {
          if (Array.isArray(col)) {
            visit(col);
          }
        }
      }
    }
  };

  visit(fields);

  console.log('[SubtleForms] Final leaf paths:', leafPaths);
  return leafPaths;
}
