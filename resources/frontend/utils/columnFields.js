/**
 * Fields stored in one layout column.
 *
 * A column is a list of fields, or an object with `fields` or `children`.
 * Pricing on the server reads all three. The form has to use the same list,
 * or a product in an object column is charged without being shown.
 *
 * @param {*} column One entry of a column container's `columns` array.
 * @return {Array}
 */
export function columnFields(column) {
  if (Array.isArray(column)) {
    return column;
  }
  if (column && typeof column === 'object') {
    if (Array.isArray(column.fields)) {
      return column.fields;
    }
    if (Array.isArray(column.children)) {
      return column.children;
    }
  }
  return [];
}

/**
 * Every field in a schema, including fields inside object-shaped columns.
 * Steps are boundaries, not fields.
 *
 * @param {Array} fields Top-level schema fields.
 * @return {Array}
 */
export function flattenSchemaFields(fields) {
  const flatten = (list) => {
    let result = [];
    (Array.isArray(list) ? list : []).forEach((field) => {
      if (!field || typeof field !== 'object') {
        return;
      }
      if (field.type !== 'step') {
        result.push(field);
      }
      const childFields = field.children || field.fields;
      if (Array.isArray(childFields)) {
        result = result.concat(flatten(childFields));
      }
      if (Array.isArray(field.columns)) {
        field.columns.forEach((col) => {
          result = result.concat(flatten(columnFields(col)));
        });
      }
    });
    return result;
  };

  return flatten(fields);
}
