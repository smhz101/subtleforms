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
  // Payment
  'payment_amount',
  'payment_coupon',
  'payment_hidden_price',
  // Dynamic
  'dynamic_field',
  'post_selection',
  // Composite group fields — store object values at their root key
  'name_group',
  'address_group',
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
