/**
 * Hidden inputs for a non-AJAX submit. Nested answers use PHP field names
 * so the server receives arrays, not JSON strings.
 *
 * @param {Object} payload Field key to answer.
 * @return {Array<Array<string>>}
 */
export function classicFieldInputs(payload) {
  const fields = [];
  const walk = (name, value) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item !== null && typeof item === 'object') {
          walk(`${name}[${index}]`, item);
        } else {
          walk(`${name}[]`, item);
        }
      });
      return;
    }
    if (value !== null && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => walk(`${name}[${key}]`, item));
      return;
    }
    fields.push([name, value == null ? '' : String(value)]);
  };
  Object.entries(payload || {}).forEach(([key, value]) => walk(`data[${key}]`, value));
  return fields;
}
