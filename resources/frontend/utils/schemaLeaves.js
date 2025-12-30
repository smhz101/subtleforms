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
      }

      if (Array.isArray(field.children)) {
        visit(field.children);
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
  return leafPaths;
}
